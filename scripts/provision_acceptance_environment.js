const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const credentialsPath = path.join(__dirname, '../.acceptance-credentials.local.json');

function randomPassword() {
  return `Hs-${crypto.randomBytes(18).toString('base64url')}9a`;
}

function loadExistingCredentials() {
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
}

function ensureCredential(credentials, key, email) {
  if (!credentials[key]) {
    credentials[key] = {
      email,
      password: randomPassword(),
    };
  }
  if (!credentials[key].email) {
    credentials[key].email = email;
  }
  if (!credentials[key].password) {
    credentials[key].password = randomPassword();
  }
}

function sslConfig() {
  if (process.env.DB_SSL !== 'true') return undefined;
  return {
    ca: fs.readFileSync(
      path.resolve(process.cwd(), process.env.DB_SSL_CA_PATH || 'config/aiven-ca.pem')
    ),
    rejectUnauthorized: true,
  };
}

async function upsertTenant(connection, tenant) {
  const [rows] = await connection.query(
    'SELECT id FROM tenants WHERE slug = ?',
    [tenant.slug]
  );
  if (rows.length > 0) {
    await connection.query(
      'UPDATE tenants SET name = ?, domain = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [tenant.name, tenant.domain, 'active', rows[0].id]
    );
    return rows[0].id;
  }

  const [result] = await connection.query(
    'INSERT INTO tenants (name, slug, domain, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [tenant.name, tenant.slug, tenant.domain, 'active']
  );
  return result.insertId;
}

async function upsertUser(connection, user, password, tenantId = null, role = null) {
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  const [rows] = await connection.query(
    'SELECT id FROM users WHERE email = ?',
    [user.email]
  );

  let userId;
  if (rows.length > 0) {
    userId = rows[0].id;
    await connection.query(
      'UPDATE users SET name = ?, password = ?, is_super_admin = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [user.name, passwordHash, user.isSuperAdmin ? 1 : 0, 'active', userId]
    );
  } else {
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, is_super_admin, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [user.name, user.email, passwordHash, user.isSuperAdmin ? 1 : 0, 'active']
    );
    userId = result.insertId;
  }

  if (tenantId && role) {
    const [linkRows] = await connection.query(
      'SELECT id FROM user_tenants WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId]
    );
    if (linkRows.length > 0) {
      await connection.query(
        'UPDATE user_tenants SET role = ?, is_active = true, updated_at = NOW() WHERE id = ?',
        [role, linkRows[0].id]
      );
    } else {
      await connection.query(
        'INSERT INTO user_tenants (user_id, tenant_id, role, is_active, created_at, updated_at) VALUES (?, ?, ?, true, NOW(), NOW())',
        [userId, tenantId, role]
      );
    }
  }

  return userId;
}

async function upsertBusinessConfig(connection, tenantId, tenantName, email) {
  const [rows] = await connection.query(
    'SELECT id FROM business_config WHERE tenant_id = ?',
    [tenantId]
  );
  const values = [
    tenantName,
    'Bengaluru',
    'Karnataka',
    '29',
    '560001',
    '9999999999',
    email,
  ];
  if (rows.length > 0) {
    await connection.query(
      `UPDATE business_config
       SET business_name = ?, city = ?, state = ?, state_code = ?, pincode = ?, phone = ?, email = ?, updated_at = NOW()
       WHERE tenant_id = ?`,
      [...values, tenantId]
    );
  } else {
    await connection.query(
      `INSERT INTO business_config
       (tenant_id, business_name, city, state, state_code, pincode, phone, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [tenantId, ...values]
    );
  }
}

async function ensureFixtureData(connection, tenantId, label) {
  const [hallRows] = await connection.query(
    'SELECT id FROM halls WHERE tenant_id = ? AND name = ?',
    [tenantId, `${label} Main Hall`]
  );
  const hallId = hallRows.length > 0
    ? hallRows[0].id
    : (await connection.query(
        'INSERT INTO halls (tenant_id, name, capacity, base_price, description, location, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [tenantId, `${label} Main Hall`, 300, 50000, 'Acceptance test hall', 'Bengaluru', 'active']
      ))[0].insertId;

  const [packageRows] = await connection.query(
    'SELECT id FROM packages WHERE tenant_id = ? AND name = ?',
    [tenantId, `${label} Standard Package`]
  );
  if (packageRows.length === 0) {
    await connection.query(
      'INSERT INTO packages (tenant_id, name, base_price, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [tenantId, `${label} Standard Package`, 75000, 'Acceptance test package', 'active']
    );
  }

  const [customerRows] = await connection.query(
    'SELECT id FROM customers WHERE tenant_id = ? AND phone = ?',
    [tenantId, label === 'Tenant A' ? '9000000001' : '9000000002']
  );
  if (customerRows.length === 0) {
    await connection.query(
      `INSERT INTO customers
       (tenant_id, name, phone, email, city, state, state_code, pincode, address, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        `${label} Acceptance Customer`,
        label === 'Tenant A' ? '9000000001' : '9000000002',
        label === 'Tenant A' ? 'acceptance.customer.a@hallsync.local' : 'acceptance.customer.b@hallsync.local',
        'Bengaluru',
        'Karnataka',
        '29',
        '560001',
        'Acceptance address',
        'active',
      ]
    );
  }

  const date = new Date();
  date.setDate(date.getDate() + 14);
  const slotDate = date.toISOString().slice(0, 10);
  const [slotRows] = await connection.query(
    'SELECT id FROM slots WHERE tenant_id = ? AND hall_id = ? AND slot_date = ? AND slot_type = ?',
    [tenantId, hallId, slotDate, 'morning']
  );
  if (slotRows.length === 0) {
    await connection.query(
      'INSERT INTO slots (tenant_id, hall_id, slot_date, slot_type, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [tenantId, hallId, slotDate, 'morning', 'available', 'Acceptance slot']
    );
  }
}

async function main() {
  const existing = loadExistingCredentials();
  const credentials = existing || {
    generated_at: new Date().toISOString(),
    api_base_url: process.env.ACCEPTANCE_API_BASE_URL || 'http://localhost:5000/api',
    platform: {
      email: 'acceptance.platform@hallsync.local',
      password: randomPassword(),
    },
    tenantA: {
      email: 'acceptance.admin.a@hallsync.local',
      password: randomPassword(),
    },
    tenantB: {
      email: 'acceptance.admin.b@hallsync.local',
      password: randomPassword(),
    },
  };
  ensureCredential(credentials, 'tenantAStaff2', 'acceptance.staff2.a@hallsync.local');
  ensureCredential(credentials, 'tenantAViewer', 'acceptance.viewer.a@hallsync.local');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: sslConfig(),
  });

  try {
    await connection.beginTransaction();

    const tenantAId = await upsertTenant(connection, {
      name: 'Acceptance Tenant A',
      slug: 'acceptance-tenant-a',
      domain: 'acceptance-a',
    });
    const tenantBId = await upsertTenant(connection, {
      name: 'Acceptance Tenant B',
      slug: 'acceptance-tenant-b',
      domain: 'acceptance-b',
    });

    await upsertUser(
      connection,
      {
        name: 'Acceptance Platform Owner',
        email: credentials.platform.email,
        isSuperAdmin: true,
      },
      credentials.platform.password
    );
    await upsertUser(
      connection,
      {
        name: 'Acceptance Tenant A Admin',
        email: credentials.tenantA.email,
        isSuperAdmin: false,
      },
      credentials.tenantA.password,
      tenantAId,
      'admin'
    );
    await upsertUser(
      connection,
      {
        name: 'Acceptance Tenant B Admin',
        email: credentials.tenantB.email,
        isSuperAdmin: false,
      },
      credentials.tenantB.password,
      tenantBId,
      'admin'
    );
    await upsertUser(
      connection,
      {
        name: 'Acceptance Tenant A Staff 2',
        email: credentials.tenantAStaff2.email,
        isSuperAdmin: false,
      },
      credentials.tenantAStaff2.password,
      tenantAId,
      'staff_2'
    );
    await upsertUser(
      connection,
      {
        name: 'Acceptance Tenant A Viewer',
        email: credentials.tenantAViewer.email,
        isSuperAdmin: false,
      },
      credentials.tenantAViewer.password,
      tenantAId,
      'viewer'
    );

    await upsertBusinessConfig(connection, tenantAId, 'Acceptance Tenant A', credentials.tenantA.email);
    await upsertBusinessConfig(connection, tenantBId, 'Acceptance Tenant B', credentials.tenantB.email);
    await ensureFixtureData(connection, tenantAId, 'Tenant A');
    await ensureFixtureData(connection, tenantBId, 'Tenant B');

    await connection.commit();

    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    fs.chmodSync(credentialsPath, 0o600);

    console.log(JSON.stringify({
      ok: true,
      credentials_path: credentialsPath,
      tenants: {
        tenantAId,
        tenantBId,
      },
      acceptance_env: {
        ACCEPTANCE_API_BASE_URL: credentials.api_base_url,
        ACCEPTANCE_SUPER_ADMIN_EMAIL: credentials.platform.email,
        ACCEPTANCE_TENANT_A_EMAIL: credentials.tenantA.email,
        ACCEPTANCE_TENANT_B_EMAIL: credentials.tenantB.email,
        ACCEPTANCE_TENANT_A_STAFF2_EMAIL: credentials.tenantAStaff2.email,
        ACCEPTANCE_TENANT_A_VIEWER_EMAIL: credentials.tenantAViewer.email,
      },
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Acceptance provisioning failed:', error.message);
  process.exitCode = 1;
});
