-- Migration 312: Add tax_mode, place of supply validation, and financial year to invoices
-- Idempotent schema migration for India GST compliance

-- 1. Add tax_mode to invoices
SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'tax_mode'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE invoices ADD COLUMN tax_mode ENUM(''inclusive'', ''exclusive'', ''exempt'', ''no_gst'') NOT NULL DEFAULT ''inclusive'' AFTER place_of_supply',
  'SELECT ''invoices.tax_mode exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add place_of_supply_state_code to invoices
SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'place_of_supply_state_code'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE invoices ADD COLUMN place_of_supply_state_code VARCHAR(2) NULL AFTER tax_mode',
  'SELECT ''invoices.place_of_supply_state_code exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add place_of_supply_reason to invoices
SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'place_of_supply_reason'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE invoices ADD COLUMN place_of_supply_reason VARCHAR(255) NULL AFTER place_of_supply_state_code',
  'SELECT ''invoices.place_of_supply_reason exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Add financial_year to invoices
SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'financial_year'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE invoices ADD COLUMN financial_year VARCHAR(10) NULL AFTER invoice_date',
  'SELECT ''invoices.financial_year exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Add tax_treatment to invoice_line_items
SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'invoice_line_items' AND column_name = 'tax_treatment'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE invoice_line_items ADD COLUMN tax_treatment ENUM(''taxable'', ''exempt'', ''nil_rated'', ''non_gst'') NOT NULL DEFAULT ''taxable'' AFTER sac_hsn',
  'SELECT ''invoice_line_items.tax_treatment exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Backfill existing invoice data safely
UPDATE invoices
SET tax_mode = 'inclusive'
WHERE tax_mode IS NULL;

UPDATE invoices
SET place_of_supply_state_code = COALESCE(customer_state_code, business_state_code)
WHERE place_of_supply_state_code IS NULL
  AND COALESCE(customer_state_code, business_state_code) IS NOT NULL;

UPDATE invoices
SET place_of_supply_reason = COALESCE(
  place_of_supply_reason,
  'Backfilled from existing customer/business state during migration 312'
)
WHERE place_of_supply_state_code IS NOT NULL
  AND place_of_supply_reason IS NULL;

UPDATE invoices
SET financial_year = CONCAT(
  IF(MONTH(invoice_date) >= 4, YEAR(invoice_date), YEAR(invoice_date) - 1),
  '-',
  IF(MONTH(invoice_date) >= 4, YEAR(invoice_date) + 1, YEAR(invoice_date))
)
WHERE financial_year IS NULL;

UPDATE invoice_line_items
SET tax_treatment = 'taxable'
WHERE tax_treatment IS NULL;
