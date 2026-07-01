-- ============================================
-- Advanced Features Database Migration
-- ============================================
-- This migration adds support for:
-- 1. Multi-image hall galleries
-- 2. Custom package builder with add-ons
-- 3. Dynamic slot pricing engine
-- ============================================

-- ============================================
-- 1. MULTI-IMAGE HALL GALLERY
-- ============================================

-- Hall Images Table
CREATE TABLE IF NOT EXISTS hall_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  hall_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  image_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  caption VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
  INDEX idx_hall_id (hall_id),
  INDEX idx_order (hall_id, image_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add primary_image_url to halls table (if not exists)
ALTER TABLE halls 
ADD COLUMN IF NOT EXISTS primary_image_url VARCHAR(500) AFTER description;

-- ============================================
-- 2. CUSTOM PACKAGE BUILDER WITH ADD-ONS
-- ============================================

-- Package Add-ons Master Table
CREATE TABLE IF NOT EXISTS package_addons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- 'decoration', 'catering', 'photography', 'entertainment', 'services', 'equipment'
  base_price DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'fixed', -- 'per_person', 'per_hour', 'fixed'
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_active (is_active),
  INDEX idx_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Booking Custom Add-ons (Order-specific)
CREATE TABLE IF NOT EXISTS booking_custom_addons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  addon_id INT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1, -- For per_person, per_hour units
  unit_price DECIMAL(10,2) NOT NULL, -- Price at time of booking (snapshot)
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (addon_id) REFERENCES package_addons(id),
  INDEX idx_booking (booking_id),
  INDEX idx_addon (addon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Package Default Add-ons (Pre-built packages)
CREATE TABLE IF NOT EXISTS package_default_addons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  package_id INT NOT NULL,
  addon_id INT NOT NULL,
  is_included BOOLEAN DEFAULT TRUE,
  quantity DECIMAL(10,2) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (addon_id) REFERENCES package_addons(id),
  UNIQUE KEY unique_package_addon (package_id, addon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. DYNAMIC SLOT PRICING ENGINE
-- ============================================

-- Slot Pricing Rules
CREATE TABLE IF NOT EXISTS slot_pricing_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  hall_id INT NULL, -- NULL means global rule for all halls
  slot_type VARCHAR(50) NOT NULL, -- 'morning', 'evening', 'night', 'full_day'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  price_multiplier DECIMAL(5,2) DEFAULT 1.00, -- 1.5 = 150% of base price
  fixed_price DECIMAL(10,2) NULL, -- Alternative to multiplier
  day_of_week VARCHAR(20) DEFAULT 'all', -- 'monday', 'tuesday', 'weekend', 'weekday', 'all'
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0, -- Higher priority rules override lower
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
  INDEX idx_hall_slot (hall_id, slot_type),
  INDEX idx_priority (priority DESC),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seasonal & Holiday Pricing Modifiers
CREATE TABLE IF NOT EXISTS slot_pricing_modifiers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  modifier_type VARCHAR(50) NOT NULL, -- 'seasonal', 'holiday', 'special_event'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0, -- Fixed amount to add/subtract
  percentage_adjustment DECIMAL(5,2) DEFAULT 0, -- Percentage to add/subtract
  applies_to VARCHAR(50) DEFAULT 'all', -- 'all', 'specific_halls', 'specific_slots'
  target_ids TEXT, -- JSON array of hall_ids or slot_types if specific
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dates (start_date, end_date),
  INDEX idx_active (is_active),
  INDEX idx_type (modifier_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Sample Package Add-ons
INSERT INTO package_addons (name, description, category, base_price, unit, display_order) VALUES
-- Decoration
('Stage Decoration - Premium', 'Premium stage setup with fresh flowers and lighting', 'decoration', 15000.00, 'fixed', 1),
('Stage Decoration - Standard', 'Standard stage setup with artificial flowers', 'decoration', 8000.00, 'fixed', 2),
('Entrance Decoration', 'Grand entrance arch with flowers', 'decoration', 5000.00, 'fixed', 3),
('Table Decoration', 'Centerpieces for guest tables', 'decoration', 200.00, 'per_person', 4),

-- Catering
('Catering - Veg Premium', 'Premium vegetarian meal with 8 items', 'catering', 450.00, 'per_person', 10),
('Catering - Veg Standard', 'Standard vegetarian meal with 6 items', 'catering', 350.00, 'per_person', 11),
('Catering - Non-Veg Premium', 'Premium non-vegetarian meal with 8 items', 'catering', 550.00, 'per_person', 12),
('Catering - Non-Veg Standard', 'Standard non-vegetarian meal with 6 items', 'catering', 450.00, 'per_person', 13),
('Welcome Drinks', 'Mocktails and refreshments', 'catering', 50.00, 'per_person', 14),
('Dessert Counter', 'Live dessert counter with variety', 'catering', 150.00, 'per_person', 15),

-- Entertainment
('DJ Service - 4 Hours', 'Professional DJ with sound system', 'entertainment', 8000.00, 'fixed', 20),
('DJ Service - 8 Hours', 'Professional DJ with sound system', 'entertainment', 15000.00, 'fixed', 21),
('Live Band', 'Live music band for 3 hours', 'entertainment', 25000.00, 'fixed', 22),
('Anchor/MC', 'Professional event anchor', 'entertainment', 5000.00, 'fixed', 23),

-- Photography
('Photography - Basic', 'Professional photographer for 4 hours', 'photography', 15000.00, 'fixed', 30),
('Photography - Premium', 'Professional photographer + videographer for 8 hours', 'photography', 35000.00, 'fixed', 31),
('Drone Photography', 'Aerial drone shots', 'photography', 8000.00, 'fixed', 32),
('Photo Booth', 'Instant photo booth with props', 'photography', 10000.00, 'fixed', 33),

-- Services
('Valet Parking', 'Professional valet parking service', 'services', 5000.00, 'fixed', 40),
('Security Service', 'Professional security personnel', 'services', 3000.00, 'fixed', 41),
('Cleaning Service', 'Post-event cleaning', 'services', 2000.00, 'fixed', 42),
('Return Gifts', 'Customized return gifts', 'services', 100.00, 'per_person', 43),

-- Equipment
('LED Wall - Small', '10x8 ft LED display', 'equipment', 12000.00, 'fixed', 50),
('LED Wall - Large', '20x12 ft LED display', 'equipment', 25000.00, 'fixed', 51),
('Sound System - Premium', 'High-end sound system', 'equipment', 8000.00, 'fixed', 52),
('Lighting - Basic', 'Basic event lighting', 'equipment', 5000.00, 'fixed', 53),
('Lighting - Premium', 'Premium lighting with effects', 'equipment', 12000.00, 'fixed', 54);

-- Sample Slot Pricing Rules (Global)
INSERT INTO slot_pricing_rules (hall_id, slot_type, start_time, end_time, price_multiplier, day_of_week, priority) VALUES
-- Weekday pricing
(NULL, 'morning', '06:00:00', '12:00:00', 1.00, 'weekday', 1),
(NULL, 'evening', '12:00:00', '18:00:00', 1.20, 'weekday', 1),
(NULL, 'night', '18:00:00', '23:59:59', 1.50, 'weekday', 1),
(NULL, 'full_day', '06:00:00', '23:59:59', 2.00, 'weekday', 1),

-- Weekend pricing (higher priority)
(NULL, 'morning', '06:00:00', '12:00:00', 1.20, 'weekend', 2),
(NULL, 'evening', '12:00:00', '18:00:00', 1.50, 'weekend', 2),
(NULL, 'night', '18:00:00', '23:59:59', 1.80, 'weekend', 2),
(NULL, 'full_day', '06:00:00', '23:59:59', 2.50, 'weekend', 2);

-- Sample Seasonal Modifiers
INSERT INTO slot_pricing_modifiers (name, description, modifier_type, start_date, end_date, percentage_adjustment, applies_to) VALUES
('Wedding Season Premium', 'Peak wedding season pricing', 'seasonal', '2026-11-01', '2027-02-28', 25.00, 'all'),
('Summer Discount', 'Off-season discount', 'seasonal', '2026-04-01', '2026-06-30', -15.00, 'all'),
('Diwali Special', 'Diwali festival premium', 'holiday', '2026-10-20', '2026-10-25', 30.00, 'all'),
('New Year Premium', 'New Year celebration premium', 'holiday', '2026-12-28', '2027-01-02', 40.00, 'all');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check tables created
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'hall_images',
    'package_addons',
    'booking_custom_addons',
    'package_default_addons',
    'slot_pricing_rules',
    'slot_pricing_modifiers'
  )
ORDER BY TABLE_NAME;

-- Check sample data
SELECT 'Package Add-ons' as Table_Name, COUNT(*) as Row_Count FROM package_addons
UNION ALL
SELECT 'Slot Pricing Rules', COUNT(*) FROM slot_pricing_rules
UNION ALL
SELECT 'Pricing Modifiers', COUNT(*) FROM slot_pricing_modifiers;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

/*
-- Uncomment to rollback this migration
DROP TABLE IF EXISTS booking_custom_addons;
DROP TABLE IF EXISTS package_default_addons;
DROP TABLE IF EXISTS package_addons;
DROP TABLE IF EXISTS hall_images;
DROP TABLE IF EXISTS slot_pricing_modifiers;
DROP TABLE IF EXISTS slot_pricing_rules;

ALTER TABLE halls DROP COLUMN IF EXISTS primary_image_url;
*/
