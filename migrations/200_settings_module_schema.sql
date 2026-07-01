-- Migration: 200_settings_module_schema.sql
-- Description: Add tables for Settings module (Business Profile, Subscriptions, Payments, Notifications)
-- Date: 2026-01-10

-- ============================================
-- 1. Update users table with phone and last_active
-- ============================================
-- Check and add phone column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN phone VARCHAR(20) AFTER email', 'SELECT "Column phone already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add last_active column
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_active');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN last_active TIMESTAMP NULL AFTER updated_at', 'SELECT "Column last_active already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 2. Create business_profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS business_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  website VARCHAR(255),
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  gst_number VARCHAR(20),
  description TEXT,
  business_hours VARCHAR(100),
  logo_url VARCHAR(500),
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  secondary_color VARCHAR(7) DEFAULT '#8b5cf6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_subdomain (subdomain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Create subscriptions table
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  plan VARCHAR(50) NOT NULL COMMENT 'starter, professional, enterprise',
  price DECIMAL(10, 2) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL COMMENT 'monthly, yearly',
  status VARCHAR(20) NOT NULL DEFAULT 'trial' COMMENT 'active, trial, suspended, cancelled',
  trial_ends_at TIMESTAMP NULL,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_status (status),
  INDEX idx_period_end (current_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Create payments table
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  subscription_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(50) NOT NULL COMMENT 'upi, bank_transfer',
  transaction_id VARCHAR(255),
  payment_proof_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, paid, failed',
  verified_by INT NULL,
  verified_at TIMESTAMP NULL,
  payment_date TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_status (status),
  INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Create notification_preferences table
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  tenant_id INT NOT NULL,
  channel VARCHAR(20) NOT NULL COMMENT 'email, sms, whatsapp',
  event_type VARCHAR(50) NOT NULL COMMENT 'booking_created, booking_updated, booking_cancelled, payment_received, payment_reminder, daily_summary',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE KEY unique_preference (user_id, channel, event_type),
  INDEX idx_user_id (user_id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_channel (channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. Insert default business profiles for existing tenants
-- ============================================
INSERT INTO business_profiles (tenant_id, business_name, subdomain, email, phone, address, city, state, pincode)
SELECT 
  t.id,
  t.name,
  LOWER(REPLACE(t.name, ' ', '')),
  CONCAT('contact@', LOWER(REPLACE(t.name, ' ', '')), '.com'),
  '+91 98765 43210',
  '123 Main Street',
  'Bangalore',
  'Karnataka',
  '560001'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM business_profiles bp WHERE bp.tenant_id = t.id
);

-- ============================================
-- 7. Insert default subscriptions for existing tenants
-- ============================================
INSERT INTO subscriptions (tenant_id, plan, price, billing_cycle, status, current_period_start, current_period_end, trial_ends_at)
SELECT 
  t.id,
  'professional',
  4999.00,
  'monthly',
  'trial',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 1 MONTH),
  DATE_ADD(NOW(), INTERVAL 14 DAY)
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.tenant_id = t.id
);

-- ============================================
-- 8. Insert default notification preferences for existing users
-- ============================================
INSERT INTO notification_preferences (user_id, tenant_id, channel, event_type, enabled)
SELECT 
  u.id,
  u.tenant_id,
  channel.name,
  event.name,
  TRUE
FROM users u
CROSS JOIN (
  SELECT 'email' as name UNION ALL
  SELECT 'sms' UNION ALL
  SELECT 'whatsapp'
) channel
CROSS JOIN (
  SELECT 'booking_created' as name UNION ALL
  SELECT 'booking_updated' UNION ALL
  SELECT 'booking_cancelled' UNION ALL
  SELECT 'payment_received' UNION ALL
  SELECT 'payment_reminder' UNION ALL
  SELECT 'daily_summary'
) event
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences np 
  WHERE np.user_id = u.id 
  AND np.channel = channel.name 
  AND np.event_type = event.name
)
AND u.tenant_id IS NOT NULL;

-- ============================================
-- 9. Update migration tracker
-- ============================================
INSERT INTO migration_tracker (migration_name, status, executed_at)
VALUES ('200_settings_module_schema', 'completed', NOW())
ON DUPLICATE KEY UPDATE 
  status = 'completed',
  executed_at = NOW();
