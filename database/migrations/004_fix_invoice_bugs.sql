-- ============================================
-- FIX INVOICE BUGS - PHASE 2.1
-- ============================================
-- Date: November 20, 2025
-- Purpose: Fix column name mismatches and missing tables
-- ============================================

USE hall_sync;

-- ============================================
-- FIX 1: Add missing columns to invoices table
-- ============================================

-- Check and add issued_at column
SET @dbname = DATABASE();
SET @tablename = 'invoices';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'issued_at')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN issued_at TIMESTAMP NULL AFTER status',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add payment_instructions column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'payment_instructions')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN payment_instructions TEXT AFTER terms_and_conditions',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add cancelled_at column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'cancelled_at')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN cancelled_at TIMESTAMP NULL AFTER paid_at',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add due_date column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'due_date')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN due_date DATE NULL AFTER invoice_date',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add reference_number column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'reference_number')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN reference_number VARCHAR(100) NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add original_invoice_id column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'original_invoice_id')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN original_invoice_id INT NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_name column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_name')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_name VARCHAR(200) NOT NULL DEFAULT "Hall Sync" AFTER customer_email',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_gstin column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_gstin')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_gstin VARCHAR(15) NULL AFTER business_name',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_address column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_address')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_address TEXT NULL AFTER business_gstin',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_city column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_city')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_city VARCHAR(100) NULL AFTER business_address',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_state column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_state')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_state VARCHAR(100) NULL AFTER business_city',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_state_code column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_state_code')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_state_code VARCHAR(2) NULL AFTER business_state',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_pincode column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_pincode')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_pincode VARCHAR(10) NULL AFTER business_state_code',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_phone column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_phone')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_phone VARCHAR(15) NULL AFTER business_pincode',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add business_email column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'business_email')
  ) = 0,
  'ALTER TABLE invoices ADD COLUMN business_email VARCHAR(100) NULL AFTER business_phone',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- FIX 2: Rename columns to match code
-- ============================================

-- Rename invoice_no to invoice_number (if exists)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'invoice_no')
  ) > 0,
  'ALTER TABLE invoices CHANGE COLUMN invoice_no invoice_number VARCHAR(50) NOT NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Rename invoice_total to grand_total (if exists)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'invoice_total')
  ) > 0,
  'ALTER TABLE invoices CHANGE COLUMN invoice_total grand_total DECIMAL(15,2) NOT NULL DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Rename balance_due to balance_amount (if exists)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'balance_due')
  ) > 0,
  'ALTER TABLE invoices CHANGE COLUMN balance_due balance_amount DECIMAL(15,2) DEFAULT 0.00',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Rename generated_by to created_by (if exists)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'generated_by')
  ) > 0,
  'ALTER TABLE invoices CHANGE COLUMN generated_by created_by INT',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Rename payment_terms to terms_conditions (if exists)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'payment_terms')
  ) > 0,
  'ALTER TABLE invoices CHANGE COLUMN payment_terms terms_conditions TEXT',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- FIX 3: Rename columns in invoice_line_items
-- ============================================

SET @tablename = 'invoice_line_items';

-- Rename line_no to line_number
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'line_no')
  ) > 0,
  'ALTER TABLE invoice_line_items CHANGE COLUMN line_no line_number INT NOT NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Rename line_total to taxable_value
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'line_total')
  ) > 0,
  'ALTER TABLE invoice_line_items CHANGE COLUMN line_total taxable_value DECIMAL(15,2) NOT NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- FIX 4: Create payment_transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_mode ENUM('cash', 'card', 'upi', 'netbanking', 'cheque', 'other') NOT NULL,
  transaction_reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_payment_date (payment_date),
  INDEX idx_payment_mode (payment_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- FIX 5: Update stored procedure to return value
-- ============================================

DROP PROCEDURE IF EXISTS generate_invoice_number;

DELIMITER //
CREATE PROCEDURE generate_invoice_number(
  IN p_invoice_type VARCHAR(20)
)
BEGIN
  DECLARE v_prefix VARCHAR(10);
  DECLARE v_counter INT;
  DECLARE v_year INT;
  DECLARE v_invoice_no VARCHAR(50);
  
  -- Get current financial year (April to March)
  SET v_year = IF(MONTH(CURDATE()) >= 4, YEAR(CURDATE()), YEAR(CURDATE()) - 1);
  
  -- Get prefix and increment counter based on invoice type
  CASE p_invoice_type
    WHEN 'tax_invoice' THEN
      SELECT invoice_prefix, invoice_counter + 1 INTO v_prefix, v_counter
      FROM business_config WHERE is_active = TRUE LIMIT 1;
      
      UPDATE business_config 
      SET invoice_counter = v_counter 
      WHERE is_active = TRUE;
      
    WHEN 'receipt_voucher' THEN
      SELECT receipt_prefix, receipt_counter + 1 INTO v_prefix, v_counter
      FROM business_config WHERE is_active = TRUE LIMIT 1;
      
      UPDATE business_config 
      SET receipt_counter = v_counter 
      WHERE is_active = TRUE;
      
    WHEN 'credit_note' THEN
      SELECT credit_note_prefix, credit_note_counter + 1 INTO v_prefix, v_counter
      FROM business_config WHERE is_active = TRUE LIMIT 1;
      
      UPDATE business_config 
      SET credit_note_counter = v_counter 
      WHERE is_active = TRUE;
      
    WHEN 'debit_note' THEN
      SELECT debit_note_prefix, debit_note_counter + 1 INTO v_prefix, v_counter
      FROM business_config WHERE is_active = TRUE LIMIT 1;
      
      UPDATE business_config 
      SET debit_note_counter = v_counter 
      WHERE is_active = TRUE;
      
    ELSE
      SET v_prefix = 'INV';
      SET v_counter = 1;
  END CASE;
  
  -- Generate invoice number: PREFIX-YEAR-NNNN
  SET v_invoice_no = CONCAT(v_prefix, '-', v_year, '-', LPAD(v_counter, 4, '0'));
  
  -- Return as result set (not OUT parameter)
  SELECT v_invoice_no AS invoice_number;
END //
DELIMITER ;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show updated invoice table structure
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'invoices'
ORDER BY ORDINAL_POSITION;

-- Test stored procedure
CALL generate_invoice_number('tax_invoice');

SELECT 'Migration 004 completed successfully!' AS status;
