const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const expectedMigrations = [
  '300_platform_tenant_lifecycle.sql',
  '301_subscription_billing.sql',
  '302_booking_payment_integrity.sql',
  '303_full_day_slots.sql',
  '304_invoice_integrity.sql',
  '305_invoice_payment_allocations.sql',
  '306_booking_payment_mode.sql',
  '307_subscription_collations.sql',
  '308_auth_session_revocation.sql',
  '309_invitations_subscription_policy.sql',
  '310_user_phone.sql',
  '311_tenant_upi_settings.sql',
  '312_tenant_schema_drift_guards.sql',
];

const productionTarget = process.env.HALL_SYNC_PRODUCTION_TARGET === 'true';

const allowedInvoiceStatuses = new Set([
  'draft',
  'issued',
  'sent',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled',
  'void',
]);

const requiredTables = [
  'schema_migrations',
  'platform_audit_logs',
  'subscription_plans',
  'subscription_orders',
  'subscription_payments',
  'tenant_settings',
  'invoice_line_items',
  'invoice_payment_allocations',
];

const requiredColumns = {
  users: ['auth_version', 'phone'],
  tenants: ['domain', 'logo_url', 'status'],
  bookings: ['balance_amount', 'payment_mode'],
  business_config: [
    'state_code',
    'website',
    'description',
    'business_hours',
    'primary_color',
    'secondary_color',
    'upi_id',
    'upi_name',
  ],
  slots: ['slot_type'],
  invoices: [
    'customer_name',
    'customer_gstin',
    'customer_pan',
    'customer_address',
    'customer_city',
    'customer_state',
    'customer_state_code',
    'customer_pincode',
    'customer_phone',
    'customer_email',
    'business_name',
    'business_gstin',
    'business_address',
    'business_city',
    'business_state',
    'business_state_code',
    'business_pincode',
    'business_phone',
    'business_email',
    'supply_type',
    'place_of_supply',
    'cgst_amount',
    'sgst_amount',
    'igst_amount',
    'cess_amount',
    'round_off',
    'notes',
    'terms_conditions',
    'payment_instructions',
    'reference_number',
    'original_invoice_id',
    'issued_at',
    'cancelled_at',
    'cancellation_reason',
  ],
  invoice_line_items: [
    'tenant_id',
    'invoice_id',
    'line_number',
    'description',
    'sac_hsn',
    'quantity',
    'unit',
    'unit_price',
    'line_subtotal',
    'gst_rate',
    'discount_percentage',
    'discount_amount',
    'taxable_value',
    'cgst_rate',
    'sgst_rate',
    'igst_rate',
    'cess_rate',
    'cgst_amount',
    'sgst_amount',
    'igst_amount',
    'cess_amount',
    'total_tax',
    'total_amount',
  ],
  invoice_payment_allocations: [
    'tenant_id',
    'invoice_id',
    'payment_id',
    'amount',
  ],
};

const requiredColumnCollations = {
  subscriptions: {
    plan: 'utf8mb4_unicode_ci',
    status: 'utf8mb4_unicode_ci',
    billing_cycle: 'utf8mb4_unicode_ci',
  },
  subscription_plans: {
    code: 'utf8mb4_unicode_ci',
    name: 'utf8mb4_unicode_ci',
  },
  subscription_orders: {
    order_number: 'utf8mb4_unicode_ci',
    plan_code: 'utf8mb4_unicode_ci',
  },
  subscription_payments: {
    transaction_reference: 'utf8mb4_unicode_ci',
    proof_url: 'utf8mb4_unicode_ci',
    rejection_reason: 'utf8mb4_unicode_ci',
  },
};

function mask(value) {
  return value ? '<set>' : '<missing>';
}

async function main() {
  const ssl =
    process.env.DB_SSL === 'true'
      ? {
          ca: fs.readFileSync(
            path.resolve(
              process.cwd(),
              process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem'
            )
          ),
          rejectUnauthorized: true,
        }
      : undefined;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl,
  });

  try {
    const [dbRows] = await connection.query(
      'SELECT DATABASE() AS db, @@hostname AS hostname, @@version AS version'
    );
    const [tableRows] = await connection.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()`
    );
    const existingTables = new Set(
      tableRows.map((row) => row.TABLE_NAME || row.table_name)
    );

    const missingTables = requiredTables.filter(
      (table) => !existingTables.has(table)
    );

    const [columnRows] = await connection.query(
      `SELECT table_name, column_name, column_type, is_nullable, collation_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE()`
    );
    const columnsByTable = new Map();
    const columnDetailsByTable = new Map();
    for (const row of columnRows) {
      const table = row.TABLE_NAME || row.table_name;
      const column = row.COLUMN_NAME || row.column_name;
      if (!columnsByTable.has(table)) {
        columnsByTable.set(table, new Set());
      }
      if (!columnDetailsByTable.has(table)) {
        columnDetailsByTable.set(table, new Map());
      }
      columnsByTable.get(table).add(column);
      columnDetailsByTable.get(table).set(column, {
        collation_name: row.COLLATION_NAME || row.collation_name,
      });
    }

    const missingColumns = [];
    for (const [table, columns] of Object.entries(requiredColumns)) {
      const existingColumns = columnsByTable.get(table) || new Set();
      for (const column of columns) {
        if (!existingColumns.has(column)) {
          missingColumns.push(`${table}.${column}`);
        }
      }
    }

    const invalidColumnCollations = [];
    for (const [table, columns] of Object.entries(requiredColumnCollations)) {
      const details = columnDetailsByTable.get(table) || new Map();
      for (const [column, expectedCollation] of Object.entries(columns)) {
        const actualCollation = details.get(column)?.collation_name;
        if (actualCollation && actualCollation !== expectedCollation) {
          invalidColumnCollations.push(
            `${table}.${column}:${actualCollation} expected ${expectedCollation}`
          );
        }
      }
    }

    let appliedMigrations = [];
    if (existingTables.has('schema_migrations')) {
      const [migrationRows] = await connection.query(
        'SELECT migration_name FROM schema_migrations ORDER BY migration_name'
      );
      appliedMigrations = migrationRows.map((row) => row.migration_name);
    }
    const pendingMigrations = expectedMigrations.filter(
      (migration) => !appliedMigrations.includes(migration)
    );

    const warnings = [];
    const notes = [];
    if (process.env.NODE_ENV === 'production' && !productionTarget) {
      warnings.push('NODE_ENV is production; do not treat this as disposable staging.');
    }
    if ((process.env.DB_NAME || '').toLowerCase() === 'defaultdb' && !productionTarget) {
      warnings.push('DB_NAME is defaultdb; confirm this is not production before migrations.');
    }
    if (existingTables.has('migration_tracker')) {
      const message = 'Legacy migration_tracker exists alongside schema_migrations.';
      if (productionTarget) {
        notes.push(message);
      } else {
        warnings.push(message);
      }
    }

    let invoiceStatusCounts = [];
    let unsupportedInvoiceStatuses = [];
    if (existingTables.has('invoices')) {
      const [statusRows] = await connection.query(
        'SELECT status, COUNT(*) AS count FROM invoices GROUP BY status'
      );
      invoiceStatusCounts = statusRows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      }));
      unsupportedInvoiceStatuses = invoiceStatusCounts
        .filter((row) => row.status && !allowedInvoiceStatuses.has(row.status))
        .map((row) => row.status);
      if (unsupportedInvoiceStatuses.length > 0) {
        warnings.push(
          `Unsupported invoice statuses need review before migration: ${unsupportedInvoiceStatuses.join(', ')}`
        );
      }
    }

    let duplicatePaymentReferences = [];
    if (existingTables.has('payments')) {
      const [duplicateRows] = await connection.query(
        `SELECT tenant_id, transaction_id, COUNT(*) AS count
         FROM payments
         WHERE transaction_id IS NOT NULL AND transaction_id <> ''
         GROUP BY tenant_id, transaction_id
         HAVING COUNT(*) > 1
         LIMIT 20`
      );
      duplicatePaymentReferences = duplicateRows.map((row) => ({
        tenant_id: row.tenant_id,
        transaction_id: row.transaction_id,
        count: Number(row.count),
      }));
      if (duplicatePaymentReferences.length > 0) {
        warnings.push(
          'Duplicate payment transaction references need cleanup before adding the unique index.'
        );
      }
    }

    const ok =
      missingTables.length === 0 &&
      missingColumns.length === 0 &&
      invalidColumnCollations.length === 0 &&
      pendingMigrations.length === 0 &&
      warnings.length === 0;

    const report = {
      ok,
      connection: {
        db: dbRows[0].db,
        hostname: dbRows[0].hostname,
        version: dbRows[0].version,
        node_env: process.env.NODE_ENV || '<unset>',
        db_host: process.env.DB_HOST || '<unset>',
        db_user: mask(process.env.DB_USER),
        db_ssl: process.env.DB_SSL || '<unset>',
        production_target: productionTarget,
      },
      table_count: existingTables.size,
      missing_tables: missingTables,
      missing_columns: missingColumns,
      invalid_column_collations: invalidColumnCollations,
      applied_platform_migrations: appliedMigrations.filter((migration) =>
        expectedMigrations.includes(migration)
      ),
      pending_platform_migrations: pendingMigrations,
      invoice_status_counts: invoiceStatusCounts,
      unsupported_invoice_statuses: unsupportedInvoiceStatuses,
      duplicate_payment_references: duplicatePaymentReferences,
      notes,
      warnings,
    };

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = ok ? 0 : 2;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Schema audit failed:', error.message);
  process.exitCode = 1;
});
