-- Protect booking balances and external payment references.

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bookings'
    AND column_name = 'balance_amount'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE bookings ADD COLUMN balance_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER advance_amount',
  'SELECT ''bookings.balance_amount exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE bookings
SET balance_amount = GREATEST(total_amount - advance_amount, 0);

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND index_name = 'uq_payments_tenant_transaction'
);

SET @duplicate_refs := (
  SELECT COUNT(*)
  FROM (
    SELECT tenant_id, transaction_id
    FROM payments
    WHERE transaction_id IS NOT NULL AND transaction_id <> ''
    GROUP BY tenant_id, transaction_id
    HAVING COUNT(*) > 1
  ) duplicate_payment_refs
);

SET @sql := IF(
  @index_exists = 0 AND @duplicate_refs = 0,
  'ALTER TABLE payments ADD UNIQUE KEY uq_payments_tenant_transaction (tenant_id, transaction_id)',
  'SELECT ''payments unique transaction index already present or duplicate references need manual cleanup'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
