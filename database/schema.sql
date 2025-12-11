-- ============================================
-- Hall Sync - Production Database Schema
-- ============================================
-- Version: 1.0
-- Date: October 15, 2025
-- MySQL Version: 5.7+ compatible
-- Database: hall_sync
-- ============================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS hall_sync;
USE hall_sync;

-- ============================================
-- TABLE: users
-- Purpose: System users (admin, staff)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'manager') DEFAULT 'staff',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: customers
-- Purpose: Customer information
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  address TEXT,
  event_type ENUM('wedding', 'reception', 'engagement', 'birthday', 'corporate', 'other') DEFAULT 'wedding',
  notes TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phone (phone),
  INDEX idx_name (name),
  INDEX idx_phone (phone),
  INDEX idx_email (email),
  INDEX idx_city (city),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: halls
-- Purpose: Marriage hall details
-- ============================================
CREATE TABLE IF NOT EXISTS halls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  location VARCHAR(200),
  amenities TEXT,
  images TEXT,
  features TEXT,
  status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_capacity (capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: packages
-- Purpose: Wedding/event packages
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  inclusions TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: bookings
-- Purpose: Hall bookings
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  hall_id INT NOT NULL,
  package_id INT,
  event_date DATE NOT NULL,
  event_type ENUM('wedding', 'reception', 'engagement', 'birthday', 'corporate', 'other') DEFAULT 'wedding',
  guest_count INT,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  advance_amount DECIMAL(10,2) DEFAULT 0.00,
  balance_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_mode ENUM('cash', 'card', 'upi', 'bank_transfer', 'cheque') DEFAULT 'cash',
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE RESTRICT,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customer (customer_id),
  INDEX idx_hall (hall_id),
  INDEX idx_package (package_id),
  INDEX idx_event_date (event_date),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: slots
-- Purpose: Hall availability slots
-- ============================================
CREATE TABLE IF NOT EXISTS slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hall_id INT NOT NULL,
  slot_date DATE NOT NULL,
  status ENUM('available', 'booked', 'blocked') DEFAULT 'available',
  booking_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  UNIQUE KEY unique_hall_date (hall_id, slot_date),
  INDEX idx_hall_date (hall_id, slot_date),
  INDEX idx_status (status),
  INDEX idx_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: payments
-- Purpose: Payment tracking
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_mode ENUM('cash', 'card', 'upi', 'bank_transfer', 'cheque') DEFAULT 'cash',
  payment_type ENUM('advance', 'balance', 'full', 'refund') DEFAULT 'advance',
  transaction_id VARCHAR(100),
  payment_date DATE NOT NULL,
  notes TEXT,
  received_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_booking (booking_id),
  INDEX idx_payment_date (payment_date),
  INDEX idx_payment_type (payment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: audit_logs
-- Purpose: Track all changes for compliance
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VIEWS: For easier data access
-- ============================================

-- View: Booking details with all related information
CREATE OR REPLACE VIEW booking_details AS
SELECT 
  b.id AS booking_id,
  b.event_date,
  b.event_type,
  b.guest_count,
  b.total_amount,
  b.advance_amount,
  b.balance_amount,
  b.payment_mode,
  b.status AS booking_status,
  b.notes AS booking_notes,
  b.created_at AS booking_created_at,
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.email AS customer_email,
  c.city AS customer_city,
  h.id AS hall_id,
  h.name AS hall_name,
  h.capacity AS hall_capacity,
  h.location AS hall_location,
  p.id AS package_id,
  p.name AS package_name,
  p.base_price AS package_price,
  u.name AS created_by_name
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN halls h ON b.hall_id = h.id
LEFT JOIN packages p ON b.package_id = p.id
LEFT JOIN users u ON b.created_by = u.id;

-- View: Dashboard statistics
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmed_bookings,
  (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings,
  (SELECT COUNT(*) FROM bookings WHERE event_date = CURDATE()) AS todays_bookings,
  (SELECT COUNT(*) FROM customers WHERE status = 'active') AS active_customers,
  (SELECT COUNT(*) FROM halls WHERE status = 'active') AS active_halls,
  (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())) AS monthly_revenue,
  (SELECT COALESCE(SUM(advance_amount), 0) FROM bookings WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())) AS monthly_advance;

-- ============================================
-- STORED PROCEDURES
-- ============================================

-- Procedure: Create booking with slot
DELIMITER //
CREATE PROCEDURE create_booking_with_slot(
  IN p_customer_id INT,
  IN p_hall_id INT,
  IN p_package_id INT,
  IN p_event_date DATE,
  IN p_event_type VARCHAR(50),
  IN p_guest_count INT,
  IN p_total_amount DECIMAL(10,2),
  IN p_advance_amount DECIMAL(10,2),
  IN p_payment_mode VARCHAR(50),
  IN p_created_by INT,
  OUT p_booking_id INT
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_booking_id = -1;
  END;
  
  START TRANSACTION;
  
  -- Create booking
  INSERT INTO bookings (
    customer_id, hall_id, package_id, event_date, event_type,
    guest_count, total_amount, advance_amount, 
    balance_amount, payment_mode, status, created_by
  ) VALUES (
    p_customer_id, p_hall_id, p_package_id, p_event_date, p_event_type,
    p_guest_count, p_total_amount, p_advance_amount,
    p_total_amount - p_advance_amount, p_payment_mode, 'pending', p_created_by
  );
  
  SET p_booking_id = LAST_INSERT_ID();
  
  -- Create or update slot
  INSERT INTO slots (hall_id, slot_date, status, booking_id)
  VALUES (p_hall_id, p_event_date, 'booked', p_booking_id)
  ON DUPLICATE KEY UPDATE 
    status = 'booked',
    booking_id = p_booking_id;
  
  COMMIT;
END//
DELIMITER ;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger: Update balance amount on booking insert
DELIMITER //
CREATE TRIGGER before_booking_insert
BEFORE INSERT ON bookings
FOR EACH ROW
BEGIN
  SET NEW.balance_amount = NEW.total_amount - NEW.advance_amount;
END//
DELIMITER ;

-- Trigger: Update balance amount on booking update
DELIMITER //
CREATE TRIGGER before_booking_update
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
  SET NEW.balance_amount = NEW.total_amount - NEW.advance_amount;
END//
DELIMITER ;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Additional composite indexes for common queries
CREATE INDEX idx_booking_date_status ON bookings(event_date, status);
CREATE INDEX idx_customer_status ON customers(status, created_at);
CREATE INDEX idx_hall_status ON halls(status, capacity);

-- ============================================
-- SCHEMA COMPLETE
-- ============================================

-- Display success message
SELECT 'Database schema created successfully!' AS Status;
SELECT 'Tables created: users, customers, halls, packages, bookings, slots, payments, audit_logs' AS Info;
SELECT 'Views created: booking_details, dashboard_stats' AS Info;
SELECT 'Stored procedures created: create_booking_with_slot' AS Info;
SELECT 'Triggers created: before_booking_insert, before_booking_update' AS Info;
