-- ============================================
-- SMART BILLING SYSTEM - PHASE 3
-- ============================================
-- Date: November 25, 2025
-- Purpose: Add smart billing features (100% legal)
-- ============================================

USE hall_sync;

-- ============================================
-- 1. BUSINESS CONFIGURATION ENHANCEMENTS
-- ============================================

-- Add billing mode to business_config (if not exists)
SET @dbname = DATABASE();
SET @tablename = 'business_config';

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'billing_mode') = 0,
  'ALTER TABLE business_config ADD COLUMN billing_mode ENUM(''standard'', ''composite_scheme'', ''optimized'') DEFAULT ''standard'' AFTER email',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add composite scheme eligibility
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'composite_scheme_enabled') = 0,
  'ALTER TABLE business_config ADD COLUMN composite_scheme_enabled BOOLEAN DEFAULT FALSE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add annual turnover tracking
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'annual_turnover') = 0,
  'ALTER TABLE business_config ADD COLUMN annual_turnover DECIMAL(15,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add tax optimization preferences
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'enable_tax_optimization') = 0,
  'ALTER TABLE business_config ADD COLUMN enable_tax_optimization BOOLEAN DEFAULT TRUE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'show_dual_quotations') = 0,
  'ALTER TABLE business_config ADD COLUMN show_dual_quotations BOOLEAN DEFAULT TRUE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 2. SERVICE CATALOG ENHANCEMENTS
-- ============================================

-- Add service categorization
ALTER TABLE service_catalog 
ADD COLUMN service_category ENUM(
  'primary',           -- Main services (Venue, Catering)
  'support',           -- Support services (Maintenance, Coordination)
  'reimbursement',     -- Actual cost reimbursements (Electricity, Generator)
  'deposit'            -- Refundable deposits (Security)
) DEFAULT 'primary' AFTER gst_rate;

-- Add reimbursement flag
ALTER TABLE service_catalog 
ADD COLUMN is_reimbursement BOOLEAN DEFAULT FALSE AFTER service_category;

-- Add refundable flag
ALTER TABLE service_catalog 
ADD COLUMN is_refundable BOOLEAN DEFAULT FALSE AFTER is_reimbursement;

-- Add supporting document requirement
ALTER TABLE service_catalog 
ADD COLUMN requires_supporting_doc BOOLEAN DEFAULT FALSE AFTER is_refundable;

-- Add description for legal justification
ALTER TABLE service_catalog 
ADD COLUMN legal_justification TEXT AFTER requires_supporting_doc;

-- ============================================
-- 3. INVOICE ENHANCEMENTS
-- ============================================

-- Add billing strategy used
ALTER TABLE invoices 
ADD COLUMN billing_strategy VARCHAR(50) DEFAULT 'standard' AFTER status;

-- Add tax optimization flag
ALTER TABLE invoices 
ADD COLUMN tax_optimization_applied BOOLEAN DEFAULT FALSE AFTER billing_strategy;

-- Add effective GST rate (for reporting)
ALTER TABLE invoices 
ADD COLUMN effective_gst_rate DECIMAL(5,2) DEFAULT 0.00 AFTER tax_optimization_applied;

-- Add tax savings (compared to standard billing)
ALTER TABLE invoices 
ADD COLUMN tax_savings DECIMAL(15,2) DEFAULT 0.00 AFTER effective_gst_rate;

-- ============================================
-- 4. INVOICE LINE ITEMS ENHANCEMENTS
-- ============================================

-- Add service category to line items
ALTER TABLE invoice_line_items 
ADD COLUMN service_category VARCHAR(50) AFTER service_id;

-- Add legal justification
ALTER TABLE invoice_line_items 
ADD COLUMN legal_justification TEXT AFTER service_category;

-- ============================================
-- 5. INSERT REIMBURSEMENT SERVICES
-- ============================================

-- Clear existing reimbursement services if any
DELETE FROM service_catalog WHERE service_category = 'reimbursement';

-- Insert reimbursement services (0% GST - Legal)
INSERT INTO service_catalog (
  category, name, description, sac_hsn, gst_rate, 
  service_category, is_reimbursement, requires_supporting_doc, legal_justification
) VALUES
-- Electricity Reimbursement
(
  'Utilities',
  'Electricity Charges (Actual)',
  'Reimbursement of actual electricity consumption',
  'N/A',
  0.00,
  'reimbursement',
  TRUE,
  TRUE,
  'Reimbursement of actual electricity cost - No GST applicable as per GST law. Meter reading based calculation. Supporting document: Electricity bill/meter reading.'
),

-- Generator Fuel
(
  'Utilities',
  'Generator Fuel (Actual)',
  'Reimbursement of actual diesel/petrol cost for backup power',
  'N/A',
  0.00,
  'reimbursement',
  TRUE,
  TRUE,
  'Reimbursement of actual fuel cost for generator - No GST applicable. Supporting document: Fuel bill/receipt.'
),

-- Water Charges
(
  'Utilities',
  'Water Charges (Actual)',
  'Reimbursement of actual water consumption',
  'N/A',
  0.00,
  'reimbursement',
  TRUE,
  TRUE,
  'Reimbursement of actual water cost - No GST applicable. Supporting document: Water bill.'
),

-- Security Deposit
(
  'Deposits',
  'Security Deposit (Refundable)',
  'Refundable security deposit for damages/breakages',
  'N/A',
  0.00,
  'deposit',
  FALSE,
  TRUE,
  'Refundable deposit - No GST applicable as it is not a supply of service. Refunded within 7 days post-event if no damages. Supporting document: Refund policy.'
),

-- Government Fees
(
  'Compliance',
  'Government Fees/Licenses',
  'Music license, police permission, etc.',
  'N/A',
  0.00,
  'reimbursement',
  TRUE,
  TRUE,
  'Government fees and licenses - No GST applicable. Supporting document: Fee receipt from government authority.'
);

-- ============================================
-- 6. INSERT SUPPORT SERVICES (18% GST)
-- ============================================

INSERT INTO service_catalog (
  category, name, description, sac_hsn, gst_rate, 
  service_category, legal_justification
) VALUES
-- Maintenance Services
(
  'Facility',
  'Maintenance & Cleaning',
  'Pre-event cleaning, maintenance, and upkeep',
  '9973',
  18.00,
  'support',
  'Maintenance and repair services - SAC 9973 - 18% GST applicable'
),

-- Coordination Services
(
  'Management',
  'Event Coordination',
  'Event planning, coordination, and management services',
  '9972',
  18.00,
  'support',
  'Event management and coordination - SAC 9972 - 18% GST applicable'
),

-- Setup Services
(
  'Facility',
  'Setup & Arrangement',
  'Furniture arrangement, stage setup, etc.',
  '9972',
  18.00,
  'support',
  'Setup and arrangement services - SAC 9972 - 18% GST applicable'
);

-- ============================================
-- 7. CREATE QUOTATION COMPARISON VIEW
-- ============================================

DROP VIEW IF EXISTS quotation_comparison;

CREATE VIEW quotation_comparison AS
SELECT 
  i.id,
  i.invoice_number,
  i.customer_name,
  i.subtotal,
  i.discount_amount,
  i.taxable_amount,
  i.total_tax,
  i.grand_total,
  i.billing_strategy,
  i.effective_gst_rate,
  i.tax_savings,
  
  -- Standard billing calculation (if all were at 18%)
  i.taxable_amount * 0.18 AS standard_tax,
  i.taxable_amount + (i.taxable_amount * 0.18) AS standard_total,
  
  -- Savings
  (i.taxable_amount * 0.18) - i.total_tax AS tax_saved,
  ((i.taxable_amount * 0.18) - i.total_tax) / (i.taxable_amount * 0.18) * 100 AS savings_percentage
  
FROM invoices i
WHERE i.status != 'cancelled';

-- ============================================
-- 8. CREATE BILLING ANALYTICS VIEW
-- ============================================

DROP VIEW IF EXISTS billing_analytics;

CREATE VIEW billing_analytics AS
SELECT 
  billing_strategy,
  COUNT(*) AS invoice_count,
  SUM(grand_total) AS total_revenue,
  SUM(total_tax) AS total_tax_collected,
  SUM(tax_savings) AS total_tax_saved,
  AVG(effective_gst_rate) AS avg_effective_rate,
  SUM(CASE WHEN tax_optimization_applied = TRUE THEN 1 ELSE 0 END) AS optimized_count
FROM invoices
WHERE status != 'cancelled'
GROUP BY billing_strategy;

-- ============================================
-- 9. UPDATE EXISTING SERVICES
-- ============================================

-- Update existing venue services
UPDATE service_catalog 
SET service_category = 'primary',
    legal_justification = 'Venue rental service - SAC 9972 - 18% GST applicable'
WHERE category = 'Venue' AND service_category IS NULL;

-- Update existing catering services
UPDATE service_catalog 
SET service_category = 'primary',
    legal_justification = CASE 
      WHEN gst_rate = 5.00 THEN 'Outdoor catering service - SAC 9963 - 5% GST applicable'
      ELSE 'Catering service - SAC 9963 - 18% GST applicable'
    END
WHERE category = 'Catering' AND service_category IS NULL;

-- Update existing decoration services
UPDATE service_catalog 
SET service_category = 'primary',
    legal_justification = 'Decoration service - SAC 9989 - 18% GST applicable'
WHERE category = 'Decoration' AND service_category IS NULL;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show business_config columns
SELECT 'Business Config Columns:' AS info;
SHOW COLUMNS FROM business_config;

-- Show service_catalog columns
SELECT 'Service Catalog Columns:' AS info;
SHOW COLUMNS FROM service_catalog;

-- Show invoices columns
SELECT 'Invoices Columns:' AS info;
SHOW COLUMNS FROM invoices;

-- Show reimbursement services
SELECT 'Reimbursement Services:' AS info;
SELECT id, name, sac_hsn, gst_rate, service_category, is_reimbursement 
FROM service_catalog 
WHERE service_category IN ('reimbursement', 'deposit');

-- Show views
SELECT 'Views Created:' AS info;
SHOW TABLES LIKE '%quotation%';
SHOW TABLES LIKE '%billing%';

SELECT 'Migration 008 completed successfully!' AS status;
