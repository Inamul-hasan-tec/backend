-- Payment machine hardening: append-only records, idempotency, status, receipts, verification, reversals.

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'status'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''recorded'' AFTER payment_type',
  'SELECT ''payments.status exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE payments
SET status = 'recorded'
WHERE status IS NULL OR status = '' OR status = 'pending';

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'idempotency_key'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(120) NULL AFTER status',
  'SELECT ''payments.idempotency_key exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'receipt_number'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN receipt_number VARCHAR(60) NULL AFTER idempotency_key',
  'SELECT ''payments.receipt_number exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'verified_by'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN verified_by INT NULL AFTER received_by',
  'SELECT ''payments.verified_by exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'verified_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN verified_at TIMESTAMP NULL AFTER verified_by',
  'SELECT ''payments.verified_at exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'reversed_by'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN reversed_by INT NULL AFTER verified_at',
  'SELECT ''payments.reversed_by exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'reversed_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN reversed_at TIMESTAMP NULL AFTER reversed_by',
  'SELECT ''payments.reversed_at exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'reversal_reason'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN reversal_reason VARCHAR(500) NULL AFTER reversed_at',
  'SELECT ''payments.reversal_reason exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'failure_reason'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN failure_reason VARCHAR(500) NULL AFTER reversal_reason',
  'SELECT ''payments.failure_reason exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND column_name = 'updated_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE payments ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT ''payments.updated_at exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND index_name = 'uq_payments_tenant_idempotency'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE payments ADD UNIQUE KEY uq_payments_tenant_idempotency (tenant_id, idempotency_key)',
  'SELECT ''payments idempotency index exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND index_name = 'uq_payments_tenant_receipt'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE payments ADD UNIQUE KEY uq_payments_tenant_receipt (tenant_id, receipt_number)',
  'SELECT ''payments receipt index exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND index_name = 'idx_payments_tenant_status'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE payments ADD INDEX idx_payments_tenant_status (tenant_id, status, payment_date)',
  'SELECT ''payments status index exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
