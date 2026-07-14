-- Align bookings with the API contract that records the selected payment mode.

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'bookings'
    AND column_name = 'payment_mode'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE bookings ADD COLUMN payment_mode ENUM(''cash'',''card'',''upi'',''bank_transfer'',''cheque'') NOT NULL DEFAULT ''cash'' AFTER balance_amount',
  'SELECT ''bookings.payment_mode exists'' AS migration_note'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
