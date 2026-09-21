-- Idempotent guards for inventory master strengthening.
-- Safe when 320 already includes these objects, and useful if an earlier 320 ran first.

SET @column_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'hall_id'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE inventory_items ADD COLUMN hall_id INT NULL AFTER tenant_id', 'SELECT ''inventory_items.hall_id exists'' AS migration_note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'maintenance_quantity'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE inventory_items ADD COLUMN maintenance_quantity INT NOT NULL DEFAULT 0 AFTER missing_quantity', 'SELECT ''inventory_items.maintenance_quantity exists'' AS migration_note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'reorder_level'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE inventory_items ADD COLUMN reorder_level INT NOT NULL DEFAULT 0 AFTER maintenance_quantity', 'SELECT ''inventory_items.reorder_level exists'' AS migration_note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'storage_location'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE inventory_items ADD COLUMN storage_location VARCHAR(150) NULL AFTER reorder_level', 'SELECT ''inventory_items.storage_location exists'' AS migration_note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'inventory_photo_limit'
);
SET @sql := IF(@column_exists = 0, 'ALTER TABLE subscription_plans ADD COLUMN inventory_photo_limit INT NULL AFTER storage_gb', 'SELECT ''subscription_plans.inventory_photo_limit exists'' AS migration_note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE subscription_plans
SET inventory_photo_limit = CASE code
  WHEN 'starter' THEN 300
  WHEN 'professional' THEN 1500
  WHEN 'enterprise' THEN NULL
  ELSE inventory_photo_limit
END
WHERE inventory_photo_limit IS NULL OR code IN ('starter', 'professional', 'enterprise');

CREATE TABLE IF NOT EXISTS inventory_item_images (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  public_id VARCHAR(500) NULL,
  caption VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_item_images_tenant_item_order (tenant_id, inventory_item_id, display_order, created_at),
  KEY idx_inventory_item_images_tenant_primary (tenant_id, inventory_item_id, is_primary),
  CONSTRAINT fk_inventory_item_images_tenant_guard
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item_images_item_guard
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item_images_uploaded_by_guard
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_kits (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  hall_id INT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  event_type VARCHAR(60) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_kits_tenant_hall_status (tenant_id, hall_id, status),
  KEY idx_inventory_kits_tenant_event (tenant_id, event_type, status),
  CONSTRAINT fk_inventory_kits_tenant_guard
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_kits_hall_guard
    FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_kit_items (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  kit_id INT NOT NULL,
  inventory_item_id INT NULL,
  item_name VARCHAR(150) NOT NULL,
  category ENUM(
    'furniture',
    'linen',
    'dining',
    'kitchen_service',
    'decor',
    'sound_lighting',
    'utility',
    'other'
  ) NOT NULL DEFAULT 'other',
  quantity INT NOT NULL DEFAULT 1,
  source ENUM('owned', 'rental', 'vendor', 'unknown') NOT NULL DEFAULT 'owned',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_kit_items_tenant_kit (tenant_id, kit_id),
  KEY idx_inventory_kit_items_tenant_item (tenant_id, inventory_item_id),
  CONSTRAINT fk_inventory_kit_items_tenant_guard
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_kit_items_kit_guard
    FOREIGN KEY (kit_id) REFERENCES inventory_kits(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_kit_items_item_guard
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
);

SET @table_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_stock_adjustments'
);
SET @sql := IF(
  @table_exists > 0,
  'ALTER TABLE inventory_stock_adjustments MODIFY COLUMN adjustment_type ENUM(''stock_in'', ''stock_out'', ''mark_damaged'', ''mark_missing'', ''send_to_maintenance'', ''restore_damaged'', ''restore_missing'', ''restore_maintenance'', ''retire_stock'') NOT NULL',
  'SELECT ''inventory_stock_adjustments does not exist yet'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
