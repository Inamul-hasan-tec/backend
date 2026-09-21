-- Flexible operations readiness.
-- Lets each tenant choose a lightweight or strict process without breaking the shared workflow.

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant_operation_settings'
    AND COLUMN_NAME = 'operations_profile'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tenant_operation_settings ADD COLUMN operations_profile ENUM(''simple'', ''standard'', ''full'', ''custom'') NOT NULL DEFAULT ''standard'' AFTER tenant_id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant_operation_settings'
    AND COLUMN_NAME = 'enable_event_readiness'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tenant_operation_settings ADD COLUMN enable_event_readiness BOOLEAN NOT NULL DEFAULT TRUE AFTER operations_profile',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant_operation_settings'
    AND COLUMN_NAME = 'include_inventory_in_readiness'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tenant_operation_settings ADD COLUMN include_inventory_in_readiness BOOLEAN NOT NULL DEFAULT TRUE AFTER enable_event_readiness',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant_operation_settings'
    AND COLUMN_NAME = 'include_staff_in_readiness'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tenant_operation_settings ADD COLUMN include_staff_in_readiness BOOLEAN NOT NULL DEFAULT TRUE AFTER include_inventory_in_readiness',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant_operation_settings'
    AND COLUMN_NAME = 'include_payment_in_readiness'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tenant_operation_settings ADD COLUMN include_payment_in_readiness BOOLEAN NOT NULL DEFAULT TRUE AFTER include_staff_in_readiness',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant_operation_settings'
    AND COLUMN_NAME = 'include_invoice_in_readiness'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE tenant_operation_settings ADD COLUMN include_invoice_in_readiness BOOLEAN NOT NULL DEFAULT TRUE AFTER include_payment_in_readiness',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
