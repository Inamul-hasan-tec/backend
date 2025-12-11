-- ============================================
-- SMART BILLING SYSTEM - SIMPLE VERSION
-- ============================================
-- Date: November 25, 2025
-- Purpose: Add smart billing features (100% legal)
-- ============================================

USE hall_sync;

SET @dbname = DATABASE();

-- ============================================
-- 1. BUSINESS CONFIGURATION ENHANCEMENTS
-- ============================================

-- Add billing mode
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'business_config' AND COLUMN_NAME = 'billing_mode') = 0,
  'ALTER TABLE business_config ADD COLUMN billing_mode ENUM(''standard'', ''composite_scheme'', ''optimized'') DEFAULT ''standard''',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add composite scheme flag
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'business_config' AND COLUMN_NAME = 'composite_scheme_enabled') = 0,
  'ALTER TABLE business_config ADD COLUMN composite_scheme_enabled BOOLEAN DEFAULT FALSE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add tax optimization flag
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'business_config' AND COLUMN_NAME = 'enable_tax_optimization') = 0,
  'ALTER TABLE business_config ADD COLUMN enable_tax_optimization BOOLEAN DEFAULT TRUE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 2. INVOICE ENHANCEMENTS
-- ============================================

-- Add billing strategy
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'billing_strategy') = 0,
  'ALTER TABLE invoices ADD COLUMN billing_strategy VARCHAR(50) DEFAULT ''standard''',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add tax optimization flag
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'tax_optimization_applied') = 0,
  'ALTER TABLE invoices ADD COLUMN tax_optimization_applied BOOLEAN DEFAULT FALSE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add effective GST rate
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'effective_gst_rate') = 0,
  'ALTER TABLE invoices ADD COLUMN effective_gst_rate DECIMAL(5,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add tax savings
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'tax_savings') = 0,
  'ALTER TABLE invoices ADD COLUMN tax_savings DECIMAL(15,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 3. INSERT REIMBURSEMENT SERVICES
-- ============================================

-- Delete existing if any
DELETE FROM service_catalog WHERE service_code IN ('ELEC_REIMB', 'GEN_FUEL', 'WATER_REIMB', 'SEC_DEP', 'GOV_FEES');

-- Electricity Reimbursement
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate, 
  is_taxable, tax_exemption_reason, description, is_active
) VALUES (
  'ELEC_REIMB',
  'Electricity Charges (Actual Cost Reimbursement)',
  'OTHER',
  0.00,
  'nos',
  'N/A',
  0.00,
  0,
  'Reimbursement of actual electricity cost - No GST applicable. Meter reading based. Supporting document: Electricity bill required.',
  'Reimbursement of actual electricity consumption based on meter reading. This is not a supply of service but reimbursement of actual cost incurred.',
  1
);

-- Generator Fuel
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  is_taxable, tax_exemption_reason, description, is_active
) VALUES (
  'GEN_FUEL',
  'Generator Fuel (Actual Cost Reimbursement)',
  'OTHER',
  0.00,
  'nos',
  'N/A',
  0.00,
  0,
  'Reimbursement of actual diesel/petrol cost for backup power - No GST applicable. Supporting document: Fuel bill required.',
  'Reimbursement of actual fuel cost for generator/backup power. Not a supply of service.',
  1
);

-- Water Charges
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  is_taxable, tax_exemption_reason, description, is_active
) VALUES (
  'WATER_REIMB',
  'Water Charges (Actual Cost Reimbursement)',
  'OTHER',
  0.00,
  'nos',
  'N/A',
  0.00,
  0,
  'Reimbursement of actual water consumption cost - No GST applicable. Supporting document: Water bill required.',
  'Reimbursement of actual water consumption cost. Not a supply of service.',
  1
);

-- Security Deposit
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  is_taxable, tax_exemption_reason, description, is_active
) VALUES (
  'SEC_DEP',
  'Security Deposit (Refundable)',
  'OTHER',
  0.00,
  'nos',
  'N/A',
  0.00,
  0,
  'Refundable security deposit - No GST applicable as it is not a supply of service. Refunded within 7 days post-event if no damages.',
  'Refundable security deposit for damages/breakages. Fully refundable if no damages occur. Supporting document: Refund policy.',
  1
);

-- Government Fees
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  is_taxable, tax_exemption_reason, description, is_active
) VALUES (
  'GOV_FEES',
  'Government Fees/Licenses',
  'OTHER',
  0.00,
  'nos',
  'N/A',
  0.00,
  0,
  'Government fees and licenses (Music license, police permission, etc.) - No GST applicable. Supporting document: Fee receipt from government authority.',
  'Reimbursement of government fees paid for licenses and permissions required for the event.',
  1
);

-- ============================================
-- 4. INSERT SUPPORT SERVICES
-- ============================================

-- Delete existing if any
DELETE FROM service_catalog WHERE service_code IN ('MAINT_CLEAN', 'EVENT_COORD', 'SETUP_ARR');

-- Maintenance & Cleaning
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  description, is_active
) VALUES (
  'MAINT_CLEAN',
  'Maintenance & Cleaning Services',
  'OTHER',
  0.00,
  'nos',
  '9973',
  18.00,
  'Pre-event cleaning, maintenance, and upkeep services. SAC 9973 - 18% GST applicable.',
  1
);

-- Event Coordination
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  description, is_active
) VALUES (
  'EVENT_COORD',
  'Event Coordination & Management',
  'OTHER',
  0.00,
  'nos',
  '9972',
  18.00,
  'Event planning, coordination, and management services. SAC 9972 - 18% GST applicable.',
  1
);

-- Setup & Arrangement
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate,
  description, is_active
) VALUES (
  'SETUP_ARR',
  'Setup & Arrangement Services',
  'OTHER',
  0.00,
  'nos',
  '9972',
  18.00,
  'Furniture arrangement, stage setup, and other arrangement services. SAC 9972 - 18% GST applicable.',
  1
);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Business Config Columns Added:' AS info;
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'business_config'
  AND COLUMN_NAME IN ('billing_mode', 'composite_scheme_enabled', 'enable_tax_optimization');

SELECT 'Invoice Columns Added:' AS info;
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'invoices'
  AND COLUMN_NAME IN ('billing_strategy', 'tax_optimization_applied', 'effective_gst_rate', 'tax_savings');

SELECT 'Reimbursement Services Added:' AS info;
SELECT service_code, name, gst_rate, is_taxable, tax_exemption_reason
FROM service_catalog 
WHERE service_code IN ('ELEC_REIMB', 'GEN_FUEL', 'WATER_REIMB', 'SEC_DEP', 'GOV_FEES');

SELECT 'Support Services Added:' AS info;
SELECT service_code, name, sac_code, gst_rate
FROM service_catalog 
WHERE service_code IN ('MAINT_CLEAN', 'EVENT_COORD', 'SETUP_ARR');

SELECT 'Migration 008 completed successfully!' AS status;
