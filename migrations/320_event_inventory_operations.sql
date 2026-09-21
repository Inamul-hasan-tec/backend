-- Event operations and inventory base.
-- This is intentionally lightweight: item master + booking-linked event requirements.

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  hall_id INT NULL,
  name VARCHAR(150) NOT NULL,
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
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  total_quantity INT NOT NULL DEFAULT 0,
  usable_quantity INT NOT NULL DEFAULT 0,
  damaged_quantity INT NOT NULL DEFAULT 0,
  missing_quantity INT NOT NULL DEFAULT 0,
  maintenance_quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  storage_location VARCHAR(150) NULL,
  rented_default BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_items_tenant_hall_status (tenant_id, hall_id, status),
  KEY idx_inventory_items_tenant_category_status (tenant_id, category, status),
  KEY idx_inventory_items_tenant_name (tenant_id, name),
  CONSTRAINT fk_inventory_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_items_hall
    FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_items_quantities
    CHECK (
      total_quantity >= 0
      AND usable_quantity >= 0
      AND damaged_quantity >= 0
      AND missing_quantity >= 0
      AND maintenance_quantity >= 0
      AND reorder_level >= 0
    )
);

SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'subscription_plans'
    AND COLUMN_NAME = 'inventory_photo_limit'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE subscription_plans ADD COLUMN inventory_photo_limit INT NULL AFTER storage_gb',
  'SELECT ''subscription_plans.inventory_photo_limit exists'' AS migration_note'
);
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
  CONSTRAINT fk_inventory_item_images_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item_images_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item_images_uploaded_by
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
  CONSTRAINT fk_inventory_kits_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_kits_hall
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
  CONSTRAINT fk_inventory_kit_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_kit_items_kit
    FOREIGN KEY (kit_id) REFERENCES inventory_kits(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_kit_items_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_kit_items_quantity
    CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS event_inventory_requirements (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  booking_id INT NOT NULL,
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
  required_quantity INT NOT NULL DEFAULT 0,
  owned_reserved_quantity INT NOT NULL DEFAULT 0,
  rental_needed_quantity INT NOT NULL DEFAULT 0,
  dispatched_quantity INT NOT NULL DEFAULT 0,
  returned_quantity INT NOT NULL DEFAULT 0,
  damaged_quantity INT NOT NULL DEFAULT 0,
  missing_quantity INT NOT NULL DEFAULT 0,
  source ENUM('owned', 'rental', 'vendor', 'unknown') NOT NULL DEFAULT 'unknown',
  status ENUM(
    'needs_review',
    'ready',
    'short',
    'rental_needed',
    'dispatched',
    'partially_returned',
    'returned',
    'damaged_or_missing',
    'not_needed'
  ) NOT NULL DEFAULT 'needs_review',
  responsible_name VARCHAR(120) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_inventory_tenant_booking (tenant_id, booking_id),
  KEY idx_event_inventory_tenant_item (tenant_id, inventory_item_id),
  KEY idx_event_inventory_tenant_status (tenant_id, status),
  CONSTRAINT fk_event_inventory_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_inventory_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  CONSTRAINT chk_event_inventory_quantities
    CHECK (
      required_quantity >= 0
      AND owned_reserved_quantity >= 0
      AND rental_needed_quantity >= 0
      AND dispatched_quantity >= 0
      AND returned_quantity >= 0
      AND damaged_quantity >= 0
      AND missing_quantity >= 0
    )
);

CREATE TABLE IF NOT EXISTS inventory_stock_adjustments (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  adjustment_type ENUM(
    'stock_in',
    'stock_out',
    'mark_damaged',
    'mark_missing',
    'send_to_maintenance',
    'restore_damaged',
    'restore_missing',
    'restore_maintenance',
    'retire_stock'
  ) NOT NULL,
  quantity INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT NULL,
  previous_quantities JSON NOT NULL,
  new_quantities JSON NOT NULL,
  adjusted_by INT NULL,
  adjusted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_adjustments_tenant_item (tenant_id, inventory_item_id, adjusted_at),
  KEY idx_inventory_adjustments_tenant_type (tenant_id, adjustment_type, adjusted_at),
  CONSTRAINT fk_inventory_adjustments_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_adjustments_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_adjustments_user
    FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_adjustments_quantity
    CHECK (quantity > 0)
);
