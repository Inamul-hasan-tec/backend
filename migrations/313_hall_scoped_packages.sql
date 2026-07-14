-- Hall-scoped package support.
-- NULL hall_id means the package can be used for any hall in the tenant.
-- Non-NULL hall_id means the package/service bundle is only valid for that hall.

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'packages'
    AND COLUMN_NAME = 'hall_id'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE packages ADD COLUMN hall_id INT NULL AFTER tenant_id',
  'SELECT ''packages.hall_id exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'packages'
    AND INDEX_NAME = 'idx_packages_tenant_hall_status'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE packages ADD INDEX idx_packages_tenant_hall_status (tenant_id, hall_id, status)',
  'SELECT ''idx_packages_tenant_hall_status exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'packages'
    AND COLUMN_NAME = 'hall_id'
    AND REFERENCED_TABLE_NAME = 'halls'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE packages ADD CONSTRAINT fk_packages_hall FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE SET NULL',
  'SELECT ''fk_packages_hall exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
