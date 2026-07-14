-- Persist complete GST invoice calculations and immutable party snapshots.
-- This migration is intentionally additive/idempotent because live databases may
-- already contain earlier invoice tables with legacy columns.

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'state_code'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE business_config ADD COLUMN state_code VARCHAR(2) NULL AFTER state', 'SELECT ''business_config.state_code exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'website'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE business_config ADD COLUMN website VARCHAR(255) NULL AFTER email', 'SELECT ''business_config.website exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'description'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE business_config ADD COLUMN description TEXT NULL AFTER website', 'SELECT ''business_config.description exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'business_hours'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE business_config ADD COLUMN business_hours VARCHAR(100) NULL AFTER description', 'SELECT ''business_config.business_hours exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'primary_color'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE business_config ADD COLUMN primary_color VARCHAR(7) NOT NULL DEFAULT ''#3b82f6'' AFTER business_hours', 'SELECT ''business_config.primary_color exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'secondary_color'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE business_config ADD COLUMN secondary_color VARCHAR(7) NOT NULL DEFAULT ''#8b5cf6'' AFTER primary_color', 'SELECT ''business_config.secondary_color exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE invoices MODIFY COLUMN booking_id INT NULL;
ALTER TABLE invoices MODIFY COLUMN status ENUM(
  'draft',
  'issued',
  'sent',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled',
  'void'
) NOT NULL DEFAULT 'draft';

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_name'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_name VARCHAR(200) NULL AFTER customer_id', 'SELECT ''invoices.customer_name exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_gstin'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_gstin VARCHAR(15) NULL AFTER customer_name', 'SELECT ''invoices.customer_gstin exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_pan'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_pan VARCHAR(10) NULL AFTER customer_gstin', 'SELECT ''invoices.customer_pan exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_address'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_address TEXT NULL AFTER customer_pan', 'SELECT ''invoices.customer_address exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_city'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_city VARCHAR(100) NULL AFTER customer_address', 'SELECT ''invoices.customer_city exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_state'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_state VARCHAR(100) NULL AFTER customer_city', 'SELECT ''invoices.customer_state exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_state_code'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_state_code VARCHAR(2) NULL AFTER customer_state', 'SELECT ''invoices.customer_state_code exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_pincode'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_pincode VARCHAR(10) NULL AFTER customer_state_code', 'SELECT ''invoices.customer_pincode exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_phone'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_phone VARCHAR(20) NULL AFTER customer_pincode', 'SELECT ''invoices.customer_phone exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'customer_email'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN customer_email VARCHAR(150) NULL AFTER customer_phone', 'SELECT ''invoices.customer_email exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_name'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_name VARCHAR(200) NULL AFTER customer_email', 'SELECT ''invoices.business_name exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_gstin'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_gstin VARCHAR(15) NULL AFTER business_name', 'SELECT ''invoices.business_gstin exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_address'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_address TEXT NULL AFTER business_gstin', 'SELECT ''invoices.business_address exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_city'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_city VARCHAR(100) NULL AFTER business_address', 'SELECT ''invoices.business_city exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_state'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_state VARCHAR(100) NULL AFTER business_city', 'SELECT ''invoices.business_state exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_state_code'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_state_code VARCHAR(2) NULL AFTER business_state', 'SELECT ''invoices.business_state_code exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_pincode'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_pincode VARCHAR(10) NULL AFTER business_state_code', 'SELECT ''invoices.business_pincode exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_phone'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_phone VARCHAR(20) NULL AFTER business_pincode', 'SELECT ''invoices.business_phone exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'business_email'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN business_email VARCHAR(150) NULL AFTER business_phone', 'SELECT ''invoices.business_email exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'supply_type'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN supply_type ENUM(''intrastate'', ''interstate'') NULL AFTER business_email', 'SELECT ''invoices.supply_type exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'place_of_supply'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN place_of_supply VARCHAR(100) NULL AFTER supply_type', 'SELECT ''invoices.place_of_supply exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'cgst_amount'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN cgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER taxable_amount', 'SELECT ''invoices.cgst_amount exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'sgst_amount'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN sgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER cgst_amount', 'SELECT ''invoices.sgst_amount exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'igst_amount'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN igst_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER sgst_amount', 'SELECT ''invoices.igst_amount exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'cess_amount'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN cess_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER igst_amount', 'SELECT ''invoices.cess_amount exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'round_off'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN round_off DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER total_tax', 'SELECT ''invoices.round_off exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'notes'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN notes TEXT NULL AFTER status', 'SELECT ''invoices.notes exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'terms_conditions'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN terms_conditions TEXT NULL AFTER notes', 'SELECT ''invoices.terms_conditions exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'payment_instructions'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN payment_instructions TEXT NULL AFTER terms_conditions', 'SELECT ''invoices.payment_instructions exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'reference_number'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN reference_number VARCHAR(100) NULL AFTER payment_instructions', 'SELECT ''invoices.reference_number exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'original_invoice_id'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN original_invoice_id INT NULL AFTER reference_number', 'SELECT ''invoices.original_invoice_id exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'issued_at'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN issued_at DATETIME NULL AFTER updated_at', 'SELECT ''invoices.issued_at exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'cancelled_at'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN cancelled_at DATETIME NULL AFTER issued_at', 'SELECT ''invoices.cancelled_at exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'cancellation_reason'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT NULL AFTER cancelled_at', 'SELECT ''invoices.cancellation_reason exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  invoice_id INT NOT NULL,
  line_number INT NOT NULL,
  description VARCHAR(500) NOT NULL,
  sac_hsn VARCHAR(20) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  line_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(7,4) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  taxable_value DECIMAL(15,2) NOT NULL,
  cgst_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  sgst_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  igst_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  cess_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
  cgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  sgst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  igst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  cess_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  service_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_line_number (invoice_id, line_number),
  KEY idx_invoice_line_items_tenant (tenant_id),
  CONSTRAINT fk_invoice_line_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_line_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoice_line_items' AND column_name = 'line_subtotal'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoice_line_items ADD COLUMN line_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER unit_price', 'SELECT ''invoice_line_items.line_subtotal exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoice_line_items' AND column_name = 'gst_rate'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE invoice_line_items ADD COLUMN gst_rate DECIMAL(7,4) NOT NULL DEFAULT 0 AFTER line_subtotal', 'SELECT ''invoice_line_items.gst_rate exists'' AS migration_note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
