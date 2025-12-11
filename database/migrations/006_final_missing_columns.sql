-- ============================================
-- FINAL MISSING COLUMNS - PHASE 2.3
-- ============================================
-- Date: November 21, 2025
-- Purpose: Add all remaining missing columns
-- ============================================

USE hall_sync;

-- ============================================
-- FIX: invoice_line_items table
-- ============================================

SET @dbname = DATABASE();
SET @tablename = 'invoice_line_items';

-- Add discount_percentage column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'discount_percentage')
  ) = 0,
  'ALTER TABLE invoice_line_items ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0.00 AFTER unit_price',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add cess_rate column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'cess_rate')
  ) = 0,
  'ALTER TABLE invoice_line_items ADD COLUMN cess_rate DECIMAL(5,2) DEFAULT 0.00 AFTER igst_rate',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show invoice_line_items structure
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'invoice_line_items'
ORDER BY ORDINAL_POSITION;

SELECT 'Migration 006 completed successfully!' AS status;
