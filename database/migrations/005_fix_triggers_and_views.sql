-- ============================================
-- FIX TRIGGERS AND VIEWS - PHASE 2.2
-- ============================================
-- Date: November 21, 2025
-- Purpose: Fix triggers and views using old column names
-- ============================================

USE hall_sync;

-- ============================================
-- DROP OLD TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS before_invoice_insert;
DROP TRIGGER IF EXISTS before_invoice_update;

-- ============================================
-- CREATE NEW TRIGGERS WITH CORRECT COLUMN NAMES
-- ============================================

DELIMITER //

-- Trigger: Before Invoice Insert
CREATE TRIGGER before_invoice_insert
BEFORE INSERT ON invoices
FOR EACH ROW
BEGIN
  -- Calculate total tax
  SET NEW.total_tax = NEW.cgst_amount + NEW.sgst_amount + NEW.igst_amount + NEW.cess_amount;
  
  -- Calculate grand total (using correct column name)
  SET NEW.grand_total = NEW.taxable_amount + NEW.total_tax + NEW.round_off;
  
  -- Set balance amount (using correct column name)
  SET NEW.balance_amount = NEW.grand_total - NEW.amount_paid;
  
  -- Set payment status
  IF NEW.amount_paid = 0 THEN
    SET NEW.payment_status = 'unpaid';
  ELSEIF NEW.amount_paid >= NEW.grand_total THEN
    SET NEW.payment_status = 'paid';
  ELSE
    SET NEW.payment_status = 'partial';
  END IF;
END//

-- Trigger: Before Invoice Update
CREATE TRIGGER before_invoice_update
BEFORE UPDATE ON invoices
FOR EACH ROW
BEGIN
  -- Calculate total tax
  SET NEW.total_tax = NEW.cgst_amount + NEW.sgst_amount + NEW.igst_amount + NEW.cess_amount;
  
  -- Calculate grand total (using correct column name)
  SET NEW.grand_total = NEW.taxable_amount + NEW.total_tax + NEW.round_off;
  
  -- Set balance amount (using correct column name)
  SET NEW.balance_amount = NEW.grand_total - NEW.amount_paid;
  
  -- Set payment status
  IF NEW.amount_paid = 0 THEN
    SET NEW.payment_status = 'unpaid';
  ELSEIF NEW.amount_paid >= NEW.grand_total THEN
    SET NEW.payment_status = 'paid';
    SET NEW.paid_at = CURRENT_TIMESTAMP;
  ELSE
    SET NEW.payment_status = 'partial';
  END IF;
END//

DELIMITER ;

-- ============================================
-- DROP AND RECREATE VIEWS WITH CORRECT COLUMN NAMES
-- ============================================

-- Drop existing views
DROP VIEW IF EXISTS invoice_summary;
DROP VIEW IF EXISTS monthly_gst_summary;
DROP VIEW IF EXISTS pending_balance_report;

-- View 1: Invoice Summary
CREATE VIEW invoice_summary AS
SELECT 
  i.id,
  i.invoice_number,
  i.invoice_type,
  i.invoice_date,
  i.due_date,
  i.customer_name,
  i.customer_gstin,
  i.supply_type,
  i.subtotal,
  i.discount_amount,
  i.taxable_amount,
  i.cgst_amount,
  i.sgst_amount,
  i.igst_amount,
  i.total_tax,
  i.grand_total,
  i.amount_paid,
  i.balance_amount,
  i.payment_status,
  i.status,
  i.created_at,
  b.id AS booking_id,
  b.event_date,
  b.event_type,
  c.id AS customer_id,
  c.email AS customer_email,
  c.phone AS customer_phone
FROM invoices i
LEFT JOIN bookings b ON i.booking_id = b.id
LEFT JOIN customers c ON i.customer_id = c.id;

-- View 2: Monthly GST Summary
CREATE VIEW monthly_gst_summary AS
SELECT 
  YEAR(invoice_date) AS invoice_year,
  MONTH(invoice_date) AS invoice_month,
  invoice_type,
  supply_type,
  COUNT(*) AS invoice_count,
  SUM(taxable_amount) AS total_taxable,
  SUM(cgst_amount) AS total_cgst,
  SUM(sgst_amount) AS total_sgst,
  SUM(igst_amount) AS total_igst,
  SUM(cess_amount) AS total_cess,
  SUM(total_tax) AS total_tax_amount,
  SUM(grand_total) AS total_amount
FROM invoices
WHERE status != 'cancelled'
GROUP BY 
  YEAR(invoice_date),
  MONTH(invoice_date),
  invoice_type,
  supply_type
ORDER BY YEAR(invoice_date) DESC, MONTH(invoice_date) DESC;

-- View 3: Pending Balance Report
CREATE VIEW pending_balance_report AS
SELECT 
  i.id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.customer_name,
  i.customer_phone,
  i.customer_email,
  i.grand_total,
  i.amount_paid,
  i.balance_amount,
  i.payment_status,
  DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
  CASE 
    WHEN DATEDIFF(CURDATE(), i.due_date) <= 0 THEN 'Not Due'
    WHEN DATEDIFF(CURDATE(), i.due_date) <= 30 THEN '1-30 Days'
    WHEN DATEDIFF(CURDATE(), i.due_date) <= 60 THEN '31-60 Days'
    WHEN DATEDIFF(CURDATE(), i.due_date) <= 90 THEN '61-90 Days'
    ELSE '90+ Days'
  END AS aging_bucket
FROM invoices i
WHERE i.balance_amount > 0
  AND i.status != 'cancelled'
ORDER BY i.due_date ASC;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show triggers
SELECT 
  TRIGGER_NAME,
  EVENT_MANIPULATION,
  EVENT_OBJECT_TABLE,
  ACTION_TIMING
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND EVENT_OBJECT_TABLE = 'invoices';

-- Show views
SELECT 
  TABLE_NAME,
  TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'VIEW';

SELECT 'Migration 005 completed successfully!' AS status;
