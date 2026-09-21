-- Rate Studio: hall slot rates, flexible pricing rules, and booking price snapshots.
-- Existing hall.base_price remains the fallback so current tenants keep working.

CREATE TABLE IF NOT EXISTS hall_slot_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  hall_id INT NOT NULL,
  slot_type ENUM('morning','afternoon','night','full_day') NOT NULL,
  rate_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_hall_slot_rate (tenant_id, hall_id, slot_type),
  INDEX idx_hall_slot_prices_tenant_hall (tenant_id, hall_id),
  CONSTRAINT fk_hall_slot_prices_hall FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hall_rate_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  hall_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  rule_type ENUM('fixed_add','percent_add','fixed_override','discount_fixed','discount_percent') NOT NULL,
  value DECIMAL(15,2) NOT NULL DEFAULT 0,
  starts_on DATE NULL,
  ends_on DATE NULL,
  weekdays VARCHAR(32) NULL,
  slot_types VARCHAR(120) NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  visibility ENUM('internal','customer_quote','official') NOT NULL DEFAULT 'internal',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hall_rate_rules_lookup (tenant_id, hall_id, is_active, starts_on, ends_on),
  CONSTRAINT fk_hall_rate_rules_hall FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'hall_rate_amount'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN hall_rate_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER guest_count',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'package_amount'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN package_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER hall_rate_amount',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'pricing_snapshot'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE bookings ADD COLUMN pricing_snapshot JSON NULL AFTER package_amount',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
