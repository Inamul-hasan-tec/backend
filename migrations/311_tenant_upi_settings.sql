-- Add tenant-owned UPI collection details for venue customer payments.
-- This is separate from the platform-level UPI_ID used for Hall Sync
-- subscription payments.

SET @upi_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'upi_id'
);
SET @sql := IF(
  @upi_id_exists = 0,
  'ALTER TABLE business_config ADD COLUMN upi_id VARCHAR(100) NULL AFTER website',
  'SELECT ''business_config.upi_id exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @upi_name_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'business_config' AND column_name = 'upi_name'
);
SET @sql := IF(
  @upi_name_exists = 0,
  'ALTER TABLE business_config ADD COLUMN upi_name VARCHAR(150) NULL AFTER upi_id',
  'SELECT ''business_config.upi_name exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
