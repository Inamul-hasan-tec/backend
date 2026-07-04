-- ============================================
-- HALL SYNC V2 - MULTI-TENANT SCHEMA
-- ============================================

SET FOREIGN_KEY_CHECKS=0;

-- 1. Master Tenants Table
DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `domain` VARCHAR(100) UNIQUE,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `tenant_settings`;
CREATE TABLE `tenant_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_setting` (`tenant_id`, `setting_key`),
  CONSTRAINT `fk_tenant_settings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Master Users Table
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL,
  `password` VARCHAR(255) NOT NULL,
  `is_super_admin` BOOLEAN DEFAULT FALSE,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `auth_version` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. User Tenants Junction
DROP TABLE IF EXISTS `user_tenants`;
CREATE TABLE `user_tenants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `tenant_id` INT NOT NULL,
  `role` ENUM('admin', 'manager', 'staff', 'staff_1', 'staff_2', 'viewer') DEFAULT 'staff_2',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_tenant` (`user_id`, `tenant_id`),
  CONSTRAINT `fk_ut_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ut_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Business Config (Tenant Settings)
DROP TABLE IF EXISTS `business_config`;
CREATE TABLE `business_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL UNIQUE,
  `business_name` VARCHAR(200) NOT NULL,
  `gstin` VARCHAR(15),
  `pan` VARCHAR(10),
  `address` TEXT,
  `city` VARCHAR(100),
  `state` VARCHAR(100),
  `state_code` VARCHAR(2),
  `pincode` VARCHAR(10),
  `phone` VARCHAR(15),
  `email` VARCHAR(100),
  `website` VARCHAR(255),
  `upi_id` VARCHAR(100) DEFAULT NULL,
  `upi_name` VARCHAR(150) DEFAULT NULL,
  `description` TEXT,
  `business_hours` VARCHAR(100),
  `primary_color` VARCHAR(7) DEFAULT '#3b82f6',
  `secondary_color` VARCHAR(7) DEFAULT '#8b5cf6',
  `logo_url` VARCHAR(500),
  `invoice_prefix` VARCHAR(10) DEFAULT 'INV',
  `receipt_prefix` VARCHAR(10) DEFAULT 'RV',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bc_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Halls
DROP TABLE IF EXISTS `halls`;
CREATE TABLE `halls` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `capacity` INT NOT NULL,
  `gallery_count` INT DEFAULT '0',
  `primary_image_url` VARCHAR(500) DEFAULT NULL,
  `base_price` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `description` TEXT,
  `location` VARCHAR(200) DEFAULT NULL,
  `amenities` TEXT,
  `images` TEXT,
  `features` TEXT,
  `status` ENUM('active','inactive','maintenance') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_halls_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Customers
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(15) NOT NULL,
  `email` VARCHAR(100),
  `gstin` VARCHAR(15) DEFAULT NULL,
  `pan` VARCHAR(10) DEFAULT NULL,
  `customer_type` ENUM('individual','business') DEFAULT 'individual',
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `state_code` VARCHAR(2) DEFAULT NULL,
  `pincode` VARCHAR(10) DEFAULT NULL,
  `address` TEXT,
  `event_type` ENUM('wedding','reception','engagement','birthday','corporate','other') DEFAULT 'wedding',
  `notes` TEXT,
  `status` ENUM('active','inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_phone` (`tenant_id`, `phone`),
  CONSTRAINT `fk_customers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Packages
DROP TABLE IF EXISTS `packages`;
CREATE TABLE `packages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `base_price` DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  `description` TEXT,
  `inclusions` TEXT,
  `status` ENUM('active','inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_packages_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bookings
DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `hall_id` INT NOT NULL,
  `package_id` INT DEFAULT NULL,
  `event_date` DATE NOT NULL,
  `time_slot` ENUM('morning','afternoon','night','full_day') DEFAULT 'full_day',
  `event_type` VARCHAR(50) DEFAULT 'wedding',
  `guest_count` INT,
  `total_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `advance_amount` DECIMAL(15,2) DEFAULT '0.00',
  `balance_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `payment_mode` ENUM('cash','card','upi','bank_transfer','cheque') NOT NULL DEFAULT 'cash',
  `status` ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `payment_status` ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid',
  `notes` TEXT,
  `created_by` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bookings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bookings_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bookings_hall` FOREIGN KEY (`hall_id`) REFERENCES `halls` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bookings_package` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bookings_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Payments
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `booking_id` INT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `payment_mode` ENUM('cash','card','upi','bank_transfer','cheque') DEFAULT 'cash',
  `payment_type` ENUM('advance','balance','full','refund') DEFAULT 'advance',
  `transaction_id` VARCHAR(100),
  `payment_date` DATE NOT NULL,
  `notes` TEXT,
  `received_by` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_payments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_user` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Audit Logs
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `user_id` INT,
  `action` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT NOT NULL,
  `old_values` TEXT,
  `new_values` TEXT,
  `ip_address` VARCHAR(45),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_audit_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Slots
DROP TABLE IF EXISTS `slots`;
CREATE TABLE `slots` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `hall_id` INT NOT NULL,
  `slot_date` DATE NOT NULL,
  `slot_type` ENUM('morning','afternoon','night') NOT NULL DEFAULT 'afternoon',
  `status` ENUM('available','booked','blocked') DEFAULT 'available',
  `booking_id` INT DEFAULT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_hall_date_slot` (`hall_id`,`slot_date`,`slot_type`),
  CONSTRAINT `fk_slots_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_slots_hall` FOREIGN KEY (`hall_id`) REFERENCES `halls` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_slots_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Invoices
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
  `invoice_type` ENUM('tax_invoice','receipt_voucher','credit_note','debit_note') NOT NULL,
  `invoice_date` DATE NOT NULL,
  `due_date` DATE DEFAULT NULL,
  `booking_id` INT DEFAULT NULL,
  `customer_id` INT NOT NULL,
  `customer_name` VARCHAR(200) DEFAULT NULL,
  `customer_gstin` VARCHAR(15) DEFAULT NULL,
  `customer_pan` VARCHAR(10) DEFAULT NULL,
  `customer_address` TEXT,
  `customer_city` VARCHAR(100) DEFAULT NULL,
  `customer_state` VARCHAR(100) DEFAULT NULL,
  `customer_state_code` VARCHAR(2) DEFAULT NULL,
  `customer_pincode` VARCHAR(10) DEFAULT NULL,
  `customer_phone` VARCHAR(20) DEFAULT NULL,
  `customer_email` VARCHAR(150) DEFAULT NULL,
  `business_name` VARCHAR(200) DEFAULT NULL,
  `business_gstin` VARCHAR(15) DEFAULT NULL,
  `business_address` TEXT,
  `business_city` VARCHAR(100) DEFAULT NULL,
  `business_state` VARCHAR(100) DEFAULT NULL,
  `business_state_code` VARCHAR(2) DEFAULT NULL,
  `business_pincode` VARCHAR(10) DEFAULT NULL,
  `business_phone` VARCHAR(20) DEFAULT NULL,
  `business_email` VARCHAR(150) DEFAULT NULL,
  `supply_type` ENUM('intrastate','interstate') DEFAULT NULL,
  `place_of_supply` VARCHAR(100) DEFAULT NULL,
  `subtotal` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `discount_amount` DECIMAL(15,2) DEFAULT '0.00',
  `taxable_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `cgst_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `sgst_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `igst_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `cess_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `total_tax` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `round_off` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `grand_total` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `amount_paid` DECIMAL(15,2) DEFAULT '0.00',
  `balance_amount` DECIMAL(15,2) DEFAULT '0.00',
  `payment_status` ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid',
  `status` ENUM('draft','issued','sent','paid','partially_paid','overdue','cancelled','void') DEFAULT 'draft',
  `notes` TEXT,
  `terms_conditions` TEXT,
  `payment_instructions` TEXT,
  `reference_number` VARCHAR(100) DEFAULT NULL,
  `original_invoice_id` INT DEFAULT NULL,
  `created_by` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `issued_at` DATETIME DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancellation_reason` TEXT,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_invoices_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoices_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_invoices_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoices_original` FOREIGN KEY (`original_invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Invoice Line Items
DROP TABLE IF EXISTS `invoice_line_items`;
CREATE TABLE `invoice_line_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `invoice_id` INT NOT NULL,
  `line_number` INT NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `sac_hsn` VARCHAR(20) NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit` VARCHAR(30) NOT NULL,
  `unit_price` DECIMAL(15,2) NOT NULL,
  `line_subtotal` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `gst_rate` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
  `discount_percentage` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
  `discount_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `taxable_value` DECIMAL(15,2) NOT NULL,
  `cgst_rate` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
  `sgst_rate` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
  `igst_rate` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
  `cess_rate` DECIMAL(7,4) NOT NULL DEFAULT '0.0000',
  `cgst_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `sgst_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `igst_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `cess_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `total_tax` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  `total_amount` DECIMAL(15,2) NOT NULL,
  `service_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoice_line_number` (`invoice_id`,`line_number`),
  KEY `idx_invoice_line_items_tenant` (`tenant_id`),
  CONSTRAINT `fk_invoice_line_items_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_line_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Invoice Payment Allocations
DROP TABLE IF EXISTS `invoice_payment_allocations`;
CREATE TABLE `invoice_payment_allocations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `invoice_id` INT NOT NULL,
  `payment_id` INT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoice_payment_allocation` (`invoice_id`,`payment_id`),
  KEY `idx_invoice_payment_allocations_tenant` (`tenant_id`),
  KEY `idx_invoice_payment_allocations_payment` (`payment_id`),
  CONSTRAINT `fk_invoice_payment_allocations_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_payment_allocations_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_payment_allocations_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_invoice_payment_allocation_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VIEWS
-- ============================================

-- View: booking_details
DROP VIEW IF EXISTS `booking_details`;
CREATE VIEW `booking_details` AS 
SELECT 
  b.id AS booking_id, b.tenant_id, b.event_date, b.event_type, b.guest_count,
  b.total_amount, b.advance_amount, (b.total_amount - b.advance_amount) AS balance_amount,
  b.status AS booking_status, b.notes AS booking_notes, b.created_at AS booking_created_at,
  c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
  c.city AS customer_city,
  h.id AS hall_id, h.name AS hall_name, h.capacity AS hall_capacity, h.location AS hall_location,
  p.id AS package_id, p.name AS package_name, p.base_price AS package_price,
  u.name AS created_by_name
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN halls h ON b.hall_id = h.id
LEFT JOIN packages p ON b.package_id = p.id
LEFT JOIN users u ON b.created_by = u.id;

-- View: dashboard_stats
DROP VIEW IF EXISTS `dashboard_stats`;
CREATE VIEW `dashboard_stats` AS 
SELECT 
  t.id AS tenant_id,
  (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id AND b.status = 'confirmed') AS confirmed_bookings,
  (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id AND b.status = 'pending') AS pending_bookings,
  (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id AND b.event_date = CURDATE()) AS todays_bookings,
  (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.id AND c.status = 'active') AS active_customers,
  (SELECT COUNT(*) FROM halls h WHERE h.tenant_id = t.id AND h.status = 'active') AS active_halls,
  (SELECT COALESCE(SUM(b.total_amount), 0) FROM bookings b WHERE b.tenant_id = t.id AND MONTH(b.created_at) = MONTH(CURDATE()) AND YEAR(b.created_at) = YEAR(CURDATE())) AS monthly_revenue,
  (SELECT COALESCE(SUM(b.advance_amount), 0) FROM bookings b WHERE b.tenant_id = t.id AND MONTH(b.created_at) = MONTH(CURDATE()) AND YEAR(b.created_at) = YEAR(CURDATE())) AS monthly_advance
FROM tenants t;


SET FOREIGN_KEY_CHECKS=1;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Default Super Admin
INSERT INTO `users` (`name`, `email`, `password`, `is_super_admin`) 
VALUES ('Super Admin', 'admin@hallsync.com', '$2b$10$l.dVt3LedtRNRxm/7trW3.Z5fkMCynm.c1jtdRAiX6UYdkG2632.m', TRUE);

-- Default Tenant
INSERT INTO `tenants` (`name`, `slug`) VALUES ('Royal Marriage Hall', 'royal-marriage-hall');

-- Link Admin to Tenant
INSERT INTO `user_tenants` (`user_id`, `tenant_id`, `role`) VALUES (1, 1, 'admin');

-- Default Business Config
INSERT INTO `business_config` (`tenant_id`, `business_name`) VALUES (1, 'Royal Marriage Hall');
