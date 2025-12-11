-- ============================================
-- FLEXIBLE BILLING SYSTEM - PHASE 3B
-- ============================================
-- Date: November 25, 2025
-- Purpose: Real-world flexible billing features
-- ============================================

USE hall_sync;

SET @dbname = DATABASE();

-- ============================================
-- 1. ENHANCED CHARGE CATEGORIES
-- ============================================

-- Add charge category to service_catalog
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_catalog' AND COLUMN_NAME = 'charge_category') = 0,
  'ALTER TABLE service_catalog ADD COLUMN charge_category ENUM(
    ''venue_rental'',
    ''event_services'',
    ''maintenance'',
    ''service_charge'',
    ''security_deposit'',
    ''advance'',
    ''complimentary'',
    ''other''
  ) DEFAULT ''other''',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add flexibility flags
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_catalog' AND COLUMN_NAME = 'is_refundable') = 0,
  'ALTER TABLE service_catalog ADD COLUMN is_refundable BOOLEAN DEFAULT FALSE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'service_catalog' AND COLUMN_NAME = 'show_in_gst_reports') = 0,
  'ALTER TABLE service_catalog ADD COLUMN show_in_gst_reports BOOLEAN DEFAULT TRUE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 2. BOOKINGS - ACTUAL VS INVOICED TRACKING
-- ============================================

-- Add agreed amount vs invoiced amount
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'agreed_amount') = 0,
  'ALTER TABLE bookings ADD COLUMN agreed_amount DECIMAL(15,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'invoiced_amount') = 0,
  'ALTER TABLE bookings ADD COLUMN invoiced_amount DECIMAL(15,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'additional_amount') = 0,
  'ALTER TABLE bookings ADD COLUMN additional_amount DECIMAL(15,2) DEFAULT 0.00 COMMENT ''Undisclosed/private amount''',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 3. INVOICES - PARTIAL BILLING SUPPORT
-- ============================================

-- Add partial invoice flag
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'is_partial_invoice') = 0,
  'ALTER TABLE invoices ADD COLUMN is_partial_invoice BOOLEAN DEFAULT FALSE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add parent invoice reference (for split invoices)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'parent_invoice_id') = 0,
  'ALTER TABLE invoices ADD COLUMN parent_invoice_id INT NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add invoice sequence for same booking
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'invoice_sequence') = 0,
  'ALTER TABLE invoices ADD COLUMN invoice_sequence INT DEFAULT 1',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add discount details
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'discount_reason') = 0,
  'ALTER TABLE invoices ADD COLUMN discount_reason VARCHAR(500) NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add complimentary value tracking
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'complimentary_value') = 0,
  'ALTER TABLE invoices ADD COLUMN complimentary_value DECIMAL(15,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 4. PRIVATE NOTES & INTERNAL RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS booking_private_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  note_type ENUM('payment', 'adjustment', 'complimentary', 'general') DEFAULT 'general',
  amount DECIMAL(15,2) DEFAULT 0.00,
  payment_mode ENUM('cash', 'upi', 'card', 'bank_transfer', 'other') NULL,
  description TEXT,
  show_in_gst_reports BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  INDEX idx_booking_private (booking_id, is_private)
);

-- ============================================
-- 5. ADDITIONAL PAYMENTS (UNDISCLOSED)
-- ============================================

CREATE TABLE IF NOT EXISTS additional_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  invoice_id INT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode ENUM('cash', 'upi', 'card', 'bank_transfer', 'other') NOT NULL,
  category ENUM('complimentary', 'discount_adjustment', 'additional_service', 'other') DEFAULT 'other',
  description TEXT,
  show_in_gst_reports BOOLEAN DEFAULT FALSE,
  is_official BOOLEAN DEFAULT FALSE COMMENT 'TRUE if linked to official invoice',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  INDEX idx_booking_additional (booking_id),
  INDEX idx_gst_reportable (show_in_gst_reports, is_official)
);

-- ============================================
-- 6. DISCOUNT TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS discount_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  discount_type ENUM('percentage', 'fixed_amount', 'complimentary') NOT NULL,
  discount_value DECIMAL(15,2) NOT NULL,
  reason_template VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default discount templates
INSERT INTO discount_templates (name, description, discount_type, discount_value, reason_template) VALUES
('Loyalty Customer', 'Regular customer discount', 'percentage', 10.00, 'Loyalty discount for repeat customer'),
('Early Bird', 'Advance booking discount', 'percentage', 15.00, 'Early booking discount - booked 60+ days in advance'),
('Complimentary Upgrade', 'Free service upgrade', 'complimentary', 0.00, 'Complimentary premium services provided'),
('Volume Discount', 'Multiple booking discount', 'percentage', 20.00, 'Volume discount for multiple bookings'),
('Promotional Offer', 'Seasonal promotion', 'percentage', 25.00, 'Special promotional offer');

-- ============================================
-- 7. GST REPORT PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS gst_report_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  include_advance_receipts BOOLEAN DEFAULT TRUE,
  include_non_taxable BOOLEAN DEFAULT FALSE,
  include_security_deposits BOOLEAN DEFAULT FALSE,
  b2c_threshold_only BOOLEAN DEFAULT FALSE COMMENT 'Only B2C > 2.5L for GSTR-1',
  exclude_complimentary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_pref (user_id)
);

-- ============================================
-- 8. INVOICE LINE ITEMS - ENHANCED
-- ============================================

-- Add charge category
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoice_line_items' AND COLUMN_NAME = 'charge_category') = 0,
  'ALTER TABLE invoice_line_items ADD COLUMN charge_category VARCHAR(50) NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add show in GST flag
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoice_line_items' AND COLUMN_NAME = 'show_in_gst_reports') = 0,
  'ALTER TABLE invoice_line_items ADD COLUMN show_in_gst_reports BOOLEAN DEFAULT TRUE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add is refundable flag
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'invoice_line_items' AND COLUMN_NAME = 'is_refundable') = 0,
  'ALTER TABLE invoice_line_items ADD COLUMN is_refundable BOOLEAN DEFAULT FALSE',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 9. UPDATE EXISTING SERVICES
-- ============================================

-- Update charge categories for existing services
UPDATE service_catalog SET charge_category = 'venue_rental' WHERE category = 'VENUE_RENTAL';
UPDATE service_catalog SET charge_category = 'event_services' WHERE category IN ('DECORATION', 'AV_EQUIPMENT', 'PHOTOGRAPHY', 'DJ_MUSIC');
UPDATE service_catalog SET charge_category = 'maintenance' WHERE service_code = 'MAINT_CLEAN';
UPDATE service_catalog SET charge_category = 'service_charge' WHERE service_code = 'EVENT_COORD';
UPDATE service_catalog SET charge_category = 'security_deposit', is_refundable = TRUE, show_in_gst_reports = FALSE WHERE service_code = 'SEC_DEP';
UPDATE service_catalog SET charge_category = 'complimentary', show_in_gst_reports = FALSE WHERE service_code IN ('ELEC_REIMB', 'GEN_FUEL', 'WATER_REIMB', 'GOV_FEES');

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Booking columns added:' AS info;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
AND COLUMN_NAME IN ('agreed_amount', 'invoiced_amount', 'additional_amount');

SELECT 'Invoice columns added:' AS info;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'
AND COLUMN_NAME IN ('is_partial_invoice', 'parent_invoice_id', 'invoice_sequence', 'discount_reason', 'complimentary_value');

SELECT 'New tables created:' AS info;
SHOW TABLES LIKE '%private%';
SHOW TABLES LIKE '%additional%';
SHOW TABLES LIKE '%discount%';

SELECT 'Discount templates:' AS info;
SELECT id, name, discount_type, discount_value FROM discount_templates;

SELECT 'Migration 009 completed successfully!' AS status;
