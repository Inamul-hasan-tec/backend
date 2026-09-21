-- Migration 313: Add is_gst_registered to business_config and create invoice_sequences table

-- Add is_gst_registered to business_config if missing
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'business_config'
    AND column_name = 'is_gst_registered'
);

SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE business_config ADD COLUMN is_gst_registered BOOLEAN NOT NULL DEFAULT TRUE AFTER gstin',
  'SELECT ''Column is_gst_registered already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill is_gst_registered: if gstin is null or empty or invalid, default to false, else true
UPDATE business_config
SET is_gst_registered = (gstin IS NOT NULL AND TRIM(gstin) != '' AND LENGTH(TRIM(gstin)) = 15);

-- Create invoice_sequences table for concurrency-safe sequential FY numbering
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  doc_type VARCHAR(32) NOT NULL,
  financial_year VARCHAR(10) NOT NULL,
  current_val INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_doc_fy (tenant_id, doc_type, financial_year),
  CONSTRAINT fk_invoice_seq_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure generated invoice numbers cannot collide inside a tenant, even if a
-- future code path bypasses invoice_sequences.
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'invoices'
    AND index_name = 'uq_invoices_tenant_invoice_number'
);

SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE invoices ADD UNIQUE KEY uq_invoices_tenant_invoice_number (tenant_id, invoice_number)',
  'SELECT ''Index uq_invoices_tenant_invoice_number already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
