-- Speed up tenant calendar slot reads.
-- Calendar GET endpoints must remain read-only and should use this covering range index.

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'slots'
    AND INDEX_NAME = 'idx_slots_tenant_hall_date_type'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_slots_tenant_hall_date_type ON slots (tenant_id, hall_id, slot_date, slot_type)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'slots'
    AND INDEX_NAME = 'idx_slots_tenant_date_hall_type'
);
SET @ddl := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_slots_tenant_date_hall_type ON slots (tenant_id, slot_date, hall_id, slot_type)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
