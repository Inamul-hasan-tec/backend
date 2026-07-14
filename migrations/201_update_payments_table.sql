-- Migration: 201_update_payments_table.sql
-- Description: Add subscription-related columns to existing payments table
-- Date: 2026-01-10

-- Add subscription_id column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'subscription_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN subscription_id INT NULL AFTER tenant_id', 'SELECT "Column subscription_id already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add method column (rename from payment_mode if needed)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'method');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN method VARCHAR(50) NULL AFTER amount', 'SELECT "Column method already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add payment_proof_url column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'payment_proof_url');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN payment_proof_url VARCHAR(500) NULL AFTER transaction_id', 'SELECT "Column payment_proof_url already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add status column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'status');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN status VARCHAR(20) DEFAULT "pending" AFTER payment_proof_url', 'SELECT "Column status already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add verified_by column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'verified_by');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN verified_by INT NULL AFTER status', 'SELECT "Column verified_by already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add verified_at column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'verified_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN verified_at TIMESTAMP NULL AFTER verified_by', 'SELECT "Column verified_at already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add updated_at column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'updated_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE payments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at', 'SELECT "Column updated_at already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for subscription_id (if column exists and FK doesn't)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND CONSTRAINT_NAME = 'fk_payments_subscription');
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'subscription_id');
SET @sql = IF(@fk_exists = 0 AND @col_exists > 0, 
  'ALTER TABLE payments ADD CONSTRAINT fk_payments_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE', 
  'SELECT "Foreign key already exists or column missing"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for verified_by (if column exists and FK doesn't)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND CONSTRAINT_NAME = 'fk_payments_verified_by');
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'verified_by');
SET @sql = IF(@fk_exists = 0 AND @col_exists > 0, 
  'ALTER TABLE payments ADD CONSTRAINT fk_payments_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL', 
  'SELECT "Foreign key already exists or column missing"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_subscription_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE payments ADD INDEX idx_subscription_id (subscription_id)', 'SELECT "Index idx_subscription_id already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_status');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE payments ADD INDEX idx_status (status)', 'SELECT "Index idx_status already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update migration tracker
INSERT INTO migration_tracker (migration_name, status, executed_at)
VALUES ('201_update_payments_table', 'completed', NOW())
ON DUPLICATE KEY UPDATE 
  status = 'completed',
  executed_at = NOW();
