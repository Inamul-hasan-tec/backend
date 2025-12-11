-- ============================================
-- GST COMPLIANCE MIGRATION - PHASE 2
-- ============================================
-- Version: 2.0
-- Date: November 19, 2025
-- Purpose: Add GST-compliant invoice system
-- Reference: PHASE1_DETAILED_DOC.md
-- ============================================

USE hall_sync;

-- ============================================
-- TABLE: business_config
-- Purpose: Store business GST configuration
-- ============================================
CREATE TABLE IF NOT EXISTS business_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_name VARCHAR(200) NOT NULL,
  gstin VARCHAR(15) UNIQUE,  -- Can be NULL for unregistered businesses
  pan VARCHAR(10),
  state VARCHAR(100) NOT NULL,
  state_code VARCHAR(2) NOT NULL,  -- GST state code (e.g., '29' for Karnataka)
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(100) NOT NULL,
  website VARCHAR(200),
  
  -- Business Model Configuration
  business_type ENUM('hall_rental', 'hotel_with_hall', 'banquet', 'resort') DEFAULT 'hall_rental',
  services_offered JSON,  -- Array: ["VENUE_RENTAL", "CATERING_INHOUSE", "DECORATION", etc.]
  pricing_model ENUM('package', 'itemized', 'hourly') DEFAULT 'package',
  
  -- GST Configuration
  is_gst_registered BOOLEAN DEFAULT TRUE,
  annual_turnover DECIMAL(15,2) DEFAULT 0.00,
  gst_registration_date DATE,
  composition_scheme BOOLEAN DEFAULT FALSE,  -- Under composition scheme?
  
  -- Payment Terms
  advance_percentage INT DEFAULT 25,  -- Default advance %
  allow_multiple_payments BOOLEAN DEFAULT TRUE,
  cancellation_policy ENUM('tiered', 'full_refund', 'no_refund', 'custom') DEFAULT 'tiered',
  cancellation_rules JSON,  -- Array of {days_before_event, refund_percentage}
  
  -- Bank Details
  bank_name VARCHAR(100),
  bank_account_name VARCHAR(200),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(11),
  bank_branch VARCHAR(100),
  
  -- Branding
  logo_url VARCHAR(500),
  invoice_prefix VARCHAR(10) DEFAULT 'INV',  -- Invoice number prefix
  receipt_prefix VARCHAR(10) DEFAULT 'RV',   -- Receipt voucher prefix
  credit_note_prefix VARCHAR(10) DEFAULT 'CN',
  debit_note_prefix VARCHAR(10) DEFAULT 'DN',
  
  -- Counters for invoice numbering
  invoice_counter INT DEFAULT 0,
  receipt_counter INT DEFAULT 0,
  credit_note_counter INT DEFAULT 0,
  debit_note_counter INT DEFAULT 0,
  financial_year_start INT DEFAULT 4,  -- April (month number)
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_gstin (gstin),
  INDEX idx_state (state_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: service_catalog
-- Purpose: Services offered by the business
-- ============================================
CREATE TABLE IF NOT EXISTS service_catalog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_code VARCHAR(20) UNIQUE NOT NULL,  -- e.g., 'SRV_001'
  name VARCHAR(200) NOT NULL,
  category ENUM(
    'VENUE_RENTAL', 
    'CATERING_INHOUSE', 
    'CATERING_EXTERNAL',
    'DECORATION', 
    'AV_EQUIPMENT', 
    'PARKING', 
    'ACCOMMODATION',
    'PHOTOGRAPHY',
    'DJ_MUSIC',
    'SECURITY',
    'OTHER'
  ) NOT NULL,
  
  -- Pricing
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unit ENUM('day', 'hour', 'plate', 'person', 'set', 'nos', 'sqft') DEFAULT 'nos',
  min_quantity INT DEFAULT 1,
  max_quantity INT,
  
  -- GST Details
  sac_code VARCHAR(10) NOT NULL,  -- Service Accounting Code (e.g., '9972' for venue rental)
  hsn_code VARCHAR(10),  -- For goods (if applicable)
  gst_rate DECIMAL(5,2) NOT NULL,  -- 5, 12, 18, 28
  is_taxable BOOLEAN DEFAULT TRUE,
  tax_exemption_reason VARCHAR(500),
  
  -- Description
  description TEXT,
  inclusions TEXT,  -- What's included in this service
  terms TEXT,  -- Specific terms for this service
  
  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_active (is_active),
  INDEX idx_sac_code (sac_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: invoices
-- Purpose: All invoice types (Tax Invoice, Receipt Voucher, Credit Note, Debit Note)
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  invoice_type ENUM('tax_invoice', 'receipt_voucher', 'credit_note', 'debit_note') NOT NULL,
  invoice_date DATE NOT NULL,
  
  -- References
  booking_id INT NOT NULL,
  customer_id INT NOT NULL,
  original_invoice_id INT,  -- For credit/debit notes (reference to original invoice)
  
  -- Customer Details (snapshot at time of invoice)
  customer_name VARCHAR(200) NOT NULL,
  customer_gstin VARCHAR(15),  -- NULL for B2C customers
  customer_pan VARCHAR(10),
  customer_address TEXT NOT NULL,
  customer_city VARCHAR(100) NOT NULL,
  customer_state VARCHAR(100) NOT NULL,
  customer_state_code VARCHAR(2) NOT NULL,
  customer_pincode VARCHAR(10) NOT NULL,
  customer_phone VARCHAR(15) NOT NULL,
  customer_email VARCHAR(100),
  
  -- Supply Details
  place_of_supply VARCHAR(100) NOT NULL,  -- State name
  place_of_supply_code VARCHAR(2) NOT NULL,  -- GST state code
  supply_type ENUM('intrastate', 'interstate') NOT NULL,
  is_reverse_charge BOOLEAN DEFAULT FALSE,
  is_export BOOLEAN DEFAULT FALSE,
  
  -- Financial Details
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,  -- Before discount
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  discount_percentage DECIMAL(5,2) DEFAULT 0.00,
  taxable_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,  -- After discount, before tax
  
  -- GST Breakdown
  cgst_amount DECIMAL(15,2) DEFAULT 0.00,
  sgst_amount DECIMAL(15,2) DEFAULT 0.00,
  igst_amount DECIMAL(15,2) DEFAULT 0.00,
  cess_amount DECIMAL(15,2) DEFAULT 0.00,
  total_tax DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  
  -- Total
  round_off DECIMAL(10,2) DEFAULT 0.00,
  invoice_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,  -- Final amount
  
  -- Payment Tracking (for invoices)
  amount_paid DECIMAL(15,2) DEFAULT 0.00,
  balance_due DECIMAL(15,2) DEFAULT 0.00,
  payment_status ENUM('unpaid', 'partial', 'paid', 'refunded') DEFAULT 'unpaid',
  
  -- Tax Calculation Logic (for transparency)
  tax_calculation_logic TEXT,  -- Explanation of why this rate was applied
  
  -- Notes & Terms
  notes TEXT,
  terms_and_conditions TEXT,
  payment_terms TEXT,
  
  -- Status
  status ENUM('draft', 'sent', 'paid', 'cancelled', 'void') DEFAULT 'draft',
  sent_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  cancellation_reason TEXT,
  
  -- E-Invoice (for future Phase 2.5)
  irn VARCHAR(64),  -- Invoice Reference Number from IRP
  ack_no VARCHAR(20),  -- Acknowledgement number
  ack_date TIMESTAMP NULL,
  qr_code_data TEXT,  -- QR code content
  
  -- PDF Storage
  pdf_url VARCHAR(500),
  pdf_generated_at TIMESTAMP NULL,
  
  -- Metadata
  generated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (original_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_invoice_no (invoice_no),
  INDEX idx_invoice_type (invoice_type),
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_booking (booking_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_gstin (customer_gstin),
  INDEX idx_financial_year (invoice_date, invoice_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: invoice_line_items
-- Purpose: Line items for each invoice
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  line_no INT NOT NULL,  -- Line number in invoice (1, 2, 3...)
  
  -- Service/Product Details
  service_id INT,  -- Reference to service_catalog (can be NULL for custom items)
  description VARCHAR(500) NOT NULL,
  sac_hsn VARCHAR(10) NOT NULL,  -- SAC or HSN code
  
  -- Quantity & Pricing
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'nos',
  unit_price DECIMAL(15,2) NOT NULL,
  
  -- Line Total
  line_subtotal DECIMAL(15,2) NOT NULL,  -- quantity * unit_price
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  taxable_value DECIMAL(15,2) NOT NULL,  -- After discount
  
  -- GST Details
  gst_rate DECIMAL(5,2) NOT NULL,
  cgst_rate DECIMAL(5,2) DEFAULT 0.00,
  sgst_rate DECIMAL(5,2) DEFAULT 0.00,
  igst_rate DECIMAL(5,2) DEFAULT 0.00,
  
  cgst_amount DECIMAL(15,2) DEFAULT 0.00,
  sgst_amount DECIMAL(15,2) DEFAULT 0.00,
  igst_amount DECIMAL(15,2) DEFAULT 0.00,
  cess_amount DECIMAL(15,2) DEFAULT 0.00,
  
  total_tax DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(15,2) NOT NULL,  -- taxable_value + total_tax
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE SET NULL,
  
  INDEX idx_invoice (invoice_id),
  INDEX idx_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: payment_receipts
-- Purpose: Link payments to invoices/receipts
-- ============================================
CREATE TABLE IF NOT EXISTS payment_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  invoice_id INT NOT NULL,  -- Links payment to receipt voucher or invoice
  amount DECIMAL(15,2) NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  
  INDEX idx_payment (payment_id),
  INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: gst_tax_rates
-- Purpose: Master table for GST rates
-- ============================================
CREATE TABLE IF NOT EXISTS gst_tax_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_category VARCHAR(100) NOT NULL,
  sac_code VARCHAR(10) NOT NULL,
  description TEXT,
  gst_rate DECIMAL(5,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_sac_code (sac_code),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: gst_exports
-- Purpose: Track CA export packages
-- ============================================
CREATE TABLE IF NOT EXISTS gst_exports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  export_type ENUM('monthly', 'quarterly', 'annual', 'custom') NOT NULL,
  month INT,  -- 1-12
  year INT NOT NULL,
  from_date DATE,
  to_date DATE,
  
  -- Export Details
  total_invoices INT DEFAULT 0,
  total_taxable_value DECIMAL(15,2) DEFAULT 0.00,
  total_gst_collected DECIMAL(15,2) DEFAULT 0.00,
  total_credit_notes INT DEFAULT 0,
  total_gst_reversed DECIMAL(15,2) DEFAULT 0.00,
  
  -- File Details
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,  -- in bytes
  download_count INT DEFAULT 0,
  
  -- Status
  status ENUM('generating', 'ready', 'downloaded', 'expired') DEFAULT 'generating',
  expires_at TIMESTAMP NULL,
  
  generated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_month_year (month, year),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MODIFY EXISTING TABLES
-- ============================================

-- NOTE: These ALTER TABLE statements have been moved to fix_migration.sql
-- to handle MySQL version compatibility issues with IF NOT EXISTS syntax.
-- Run fix_migration.sql BEFORE running this main migration script.

-- Add GST fields to customers table (HANDLED BY fix_migration.sql)
-- ALTER TABLE customers 
-- ADD COLUMN IF NOT EXISTS gstin VARCHAR(15) AFTER email,
-- ADD COLUMN IF NOT EXISTS pan VARCHAR(10) AFTER gstin,
-- ADD COLUMN IF NOT EXISTS customer_type ENUM('individual', 'business') DEFAULT 'individual' AFTER pan,
-- ADD COLUMN IF NOT EXISTS state_code VARCHAR(2) AFTER state,
-- ADD INDEX idx_gstin (gstin);

-- Add more payment tracking fields to bookings (HANDLED BY fix_migration.sql)
-- ALTER TABLE bookings
-- ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount,
-- ADD COLUMN IF NOT EXISTS grand_total DECIMAL(10,2) DEFAULT 0.00 AFTER gst_amount,
-- ADD COLUMN IF NOT EXISTS invoice_generated BOOLEAN DEFAULT FALSE AFTER balance_amount,
-- ADD COLUMN IF NOT EXISTS invoice_id INT AFTER invoice_generated,
-- ADD COLUMN IF NOT EXISTS payment_status ENUM('unpaid', 'partial', 'paid', 'refunded') DEFAULT 'unpaid' AFTER status,
-- ADD FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
-- ADD INDEX idx_payment_status (payment_status);

-- Add index for GSTIN on customers (if not already added)
SET @dbname = DATABASE();
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS 
   WHERE TABLE_SCHEMA = @dbname
   AND TABLE_NAME = 'customers'
   AND INDEX_NAME = 'idx_gstin'
  ) = 0,
  'CREATE INDEX idx_gstin ON customers(gstin)',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default GST tax rates
INSERT INTO gst_tax_rates (service_category, sac_code, description, gst_rate, effective_from) VALUES
('Venue Rental', '9972', 'Renting of immovable property (halls, banquet)', 18.00, '2017-07-01'),
('Restaurant Service', '996331', 'Restaurant and catering services', 5.00, '2017-07-01'),
('Outdoor Catering', '996331', 'Outdoor catering services', 18.00, '2017-07-01'),
('Decoration', '9983', 'Interior decoration and design services', 18.00, '2017-07-01'),
('Photography', '9983', 'Photography services', 18.00, '2017-07-01'),
('DJ/Music', '9997', 'Entertainment services', 18.00, '2017-07-01'),
('AV Equipment', '9972', 'Rental of audio-visual equipment', 18.00, '2017-07-01'),
('Parking', '9972', 'Parking services', 18.00, '2017-07-01'),
('Accommodation', '9963', 'Hotel accommodation services', 12.00, '2017-07-01')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Invoice Summary
CREATE OR REPLACE VIEW invoice_summary AS
SELECT 
  i.id,
  i.invoice_no,
  i.invoice_type,
  i.invoice_date,
  i.customer_name,
  i.customer_gstin,
  i.place_of_supply,
  i.supply_type,
  i.taxable_amount,
  i.cgst_amount,
  i.sgst_amount,
  i.igst_amount,
  i.total_tax,
  i.invoice_total,
  i.payment_status,
  i.status,
  b.event_date,
  b.event_type,
  h.name AS hall_name
FROM invoices i
LEFT JOIN bookings b ON i.booking_id = b.id
LEFT JOIN halls h ON b.hall_id = h.id;

-- View: Monthly GST Summary
CREATE OR REPLACE VIEW monthly_gst_summary AS
SELECT 
  YEAR(invoice_date) AS year,
  MONTH(invoice_date) AS month,
  invoice_type,
  supply_type,
  COUNT(*) AS invoice_count,
  SUM(taxable_amount) AS total_taxable,
  SUM(cgst_amount) AS total_cgst,
  SUM(sgst_amount) AS total_sgst,
  SUM(igst_amount) AS total_igst,
  SUM(total_tax) AS total_tax,
  SUM(invoice_total) AS total_amount
FROM invoices
WHERE status != 'cancelled' AND status != 'void'
GROUP BY YEAR(invoice_date), MONTH(invoice_date), invoice_type, supply_type;

-- View: Pending Balance Report
CREATE OR REPLACE VIEW pending_balance_report AS
SELECT 
  b.id AS booking_id,
  CONCAT('BK', LPAD(b.id, 6, '0')) AS booking_no,
  c.name AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone,
  h.name AS hall_name,
  b.event_date,
  b.total_amount,
  b.advance_amount,
  b.balance_amount,
  b.payment_status,
  DATEDIFF(b.event_date, CURDATE()) AS days_until_event,
  i.invoice_no,
  i.invoice_total,
  i.amount_paid AS invoice_paid,
  i.balance_due AS invoice_balance
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN halls h ON b.hall_id = h.id
LEFT JOIN invoices i ON b.invoice_id = i.id
WHERE b.balance_amount > 0 
  AND b.status IN ('confirmed', 'pending')
  AND b.event_date >= CURDATE()
ORDER BY b.event_date ASC;

-- ============================================
-- STORED PROCEDURES FOR GST
-- ============================================

-- Procedure: Generate Invoice Number
DELIMITER //
CREATE PROCEDURE generate_invoice_number(
  IN p_invoice_type VARCHAR(20),
  OUT p_invoice_no VARCHAR(50)
)
BEGIN
  DECLARE v_prefix VARCHAR(10);
  DECLARE v_counter INT;
  DECLARE v_fy_start INT;
  DECLARE v_fy VARCHAR(10);
  DECLARE v_current_month INT;
  
  -- Get business config
  SELECT 
    CASE p_invoice_type
      WHEN 'tax_invoice' THEN invoice_prefix
      WHEN 'receipt_voucher' THEN receipt_prefix
      WHEN 'credit_note' THEN credit_note_prefix
      WHEN 'debit_note' THEN debit_note_prefix
    END,
    CASE p_invoice_type
      WHEN 'tax_invoice' THEN invoice_counter + 1
      WHEN 'receipt_voucher' THEN receipt_counter + 1
      WHEN 'credit_note' THEN credit_note_counter + 1
      WHEN 'debit_note' THEN debit_note_counter + 1
    END,
    financial_year_start
  INTO v_prefix, v_counter, v_fy_start
  FROM business_config
  WHERE is_active = TRUE
  LIMIT 1;
  
  -- Calculate financial year
  SET v_current_month = MONTH(CURDATE());
  IF v_current_month >= v_fy_start THEN
    SET v_fy = CONCAT(YEAR(CURDATE()), '-', RIGHT(YEAR(CURDATE()) + 1, 2));
  ELSE
    SET v_fy = CONCAT(YEAR(CURDATE()) - 1, '-', RIGHT(YEAR(CURDATE()), 2));
  END IF;
  
  -- Generate invoice number: PREFIX/FY/COUNTER
  -- Example: INV/2024-25/001
  SET p_invoice_no = CONCAT(v_prefix, '/', v_fy, '/', LPAD(v_counter, 4, '0'));
  
  -- Update counter
  UPDATE business_config
  SET 
    invoice_counter = CASE WHEN p_invoice_type = 'tax_invoice' THEN v_counter ELSE invoice_counter END,
    receipt_counter = CASE WHEN p_invoice_type = 'receipt_voucher' THEN v_counter ELSE receipt_counter END,
    credit_note_counter = CASE WHEN p_invoice_type = 'credit_note' THEN v_counter ELSE credit_note_counter END,
    debit_note_counter = CASE WHEN p_invoice_type = 'debit_note' THEN v_counter ELSE debit_note_counter END
  WHERE is_active = TRUE;
END//
DELIMITER ;

-- ============================================
-- TRIGGERS FOR INVOICE AUTOMATION
-- ============================================

-- Trigger: Auto-calculate invoice totals before insert
DELIMITER //
CREATE TRIGGER before_invoice_insert
BEFORE INSERT ON invoices
FOR EACH ROW
BEGIN
  -- Calculate total tax
  SET NEW.total_tax = NEW.cgst_amount + NEW.sgst_amount + NEW.igst_amount + NEW.cess_amount;
  
  -- Calculate invoice total
  SET NEW.invoice_total = NEW.taxable_amount + NEW.total_tax + NEW.round_off;
  
  -- Set balance due
  SET NEW.balance_due = NEW.invoice_total - NEW.amount_paid;
  
  -- Set payment status
  IF NEW.amount_paid = 0 THEN
    SET NEW.payment_status = 'unpaid';
  ELSEIF NEW.amount_paid >= NEW.invoice_total THEN
    SET NEW.payment_status = 'paid';
  ELSE
    SET NEW.payment_status = 'partial';
  END IF;
END//
DELIMITER ;

-- Trigger: Auto-calculate invoice totals before update
DELIMITER //
CREATE TRIGGER before_invoice_update
BEFORE UPDATE ON invoices
FOR EACH ROW
BEGIN
  -- Calculate total tax
  SET NEW.total_tax = NEW.cgst_amount + NEW.sgst_amount + NEW.igst_amount + NEW.cess_amount;
  
  -- Calculate invoice total
  SET NEW.invoice_total = NEW.taxable_amount + NEW.total_tax + NEW.round_off;
  
  -- Set balance due
  SET NEW.balance_due = NEW.invoice_total - NEW.amount_paid;
  
  -- Set payment status
  IF NEW.amount_paid = 0 THEN
    SET NEW.payment_status = 'unpaid';
  ELSEIF NEW.amount_paid >= NEW.invoice_total THEN
    SET NEW.payment_status = 'paid';
    SET NEW.paid_at = CURRENT_TIMESTAMP;
  ELSE
    SET NEW.payment_status = 'partial';
  END IF;
END//
DELIMITER ;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT 'GST Compliance Schema Migration Completed!' AS Status;
SELECT 'New Tables: business_config, service_catalog, invoices, invoice_line_items, payment_receipts, gst_tax_rates, gst_exports' AS Info;
SELECT 'Modified Tables: customers (added GSTIN, PAN), bookings (added GST fields)' AS Info;
SELECT 'Views Created: invoice_summary, monthly_gst_summary, pending_balance_report' AS Info;
SELECT 'Procedures Created: generate_invoice_number' AS Info;
SELECT 'Triggers Created: before_invoice_insert, before_invoice_update' AS Info;
