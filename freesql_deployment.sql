-- ============================================
-- Hall Sync - Production Database Schema
-- ============================================
-- Version: 1.0
-- Date: October 15, 2025
-- MySQL Version: 5.7+ compatible
-- Database: hall_sync
-- ============================================

-- Create database if not exists



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

-- ============================================
-- Hall Sync - Sample Data (Seed File)
-- ============================================
-- Purpose: Populate database with test data
-- Date: October 15, 2025
-- ============================================



-- ============================================
-- USERS: Sample admin and staff users
-- ============================================
INSERT INTO users (name, email, password, role, status) VALUES
('Admin User', 'admin@hallsync.com', 'admin123', 'admin', 'active'),
('Manager John', 'john@hallsync.com', 'john123', 'manager', 'active'),
('Staff Sarah', 'sarah@hallsync.com', 'sarah123', 'staff', 'active');

-- ============================================
-- CUSTOMERS: Sample customers
-- ============================================
INSERT INTO customers (name, phone, email, city, state, pincode, address, event_type, status) VALUES
('Rahul Sharma', '9876543210', 'rahul.sharma@email.com', 'Mumbai', 'Maharashtra', '400001', '123 Marine Drive, Mumbai', 'wedding', 'active'),
('Priya Patel', '9876543211', 'priya.patel@email.com', 'Ahmedabad', 'Gujarat', '380001', '456 SG Highway, Ahmedabad', 'reception', 'active'),
('Amit Kumar', '9876543212', 'amit.kumar@email.com', 'Delhi', 'Delhi', '110001', '789 Connaught Place, Delhi', 'engagement', 'active'),
('Sneha Reddy', '9876543213', 'sneha.reddy@email.com', 'Hyderabad', 'Telangana', '500001', '321 Banjara Hills, Hyderabad', 'wedding', 'active'),
('Vikram Singh', '9876543214', 'vikram.singh@email.com', 'Jaipur', 'Rajasthan', '302001', '654 MI Road, Jaipur', 'birthday', 'active'),
('Anjali Mehta', '9876543215', 'anjali.mehta@email.com', 'Pune', 'Maharashtra', '411001', '987 FC Road, Pune', 'corporate', 'active'),
('Rohan Gupta', '9876543216', 'rohan.gupta@email.com', 'Bangalore', 'Karnataka', '560001', '147 MG Road, Bangalore', 'wedding', 'active'),
('Kavita Joshi', '9876543217', 'kavita.joshi@email.com', 'Chennai', 'Tamil Nadu', '600001', '258 Anna Salai, Chennai', 'reception', 'active'),
('Arjun Nair', '9876543218', 'arjun.nair@email.com', 'Kochi', 'Kerala', '682001', '369 MG Road, Kochi', 'engagement', 'active'),
('Meera Iyer', '9876543219', 'meera.iyer@email.com', 'Coimbatore', 'Tamil Nadu', '641001', '741 RS Puram, Coimbatore', 'wedding', 'active');

-- ============================================
-- HALLS: Sample marriage halls
-- ============================================
INSERT INTO halls (name, capacity, base_price, description, location, amenities, features, status) VALUES
('Grand Palace Hall', 500, 75000.00, 'Luxurious hall with modern amenities and elegant decor', 'Andheri West, Mumbai', 'AC, Parking, Catering, Sound System, LED Screens', 'Spacious dance floor, VIP lounge, Bridal room', 'active'),
('Royal Banquet', 300, 50000.00, 'Perfect for intimate gatherings with royal ambiance', 'Bandra East, Mumbai', 'AC, Parking, Catering, Decoration', 'Garden area, Stage setup, Green room', 'active'),
('Crystal Convention Center', 800, 120000.00, 'Large convention center for grand celebrations', 'Powai, Mumbai', 'AC, Valet Parking, Premium Catering, AV Equipment', 'Multiple halls, Conference rooms, Rooftop terrace', 'active'),
('Emerald Gardens', 400, 60000.00, 'Beautiful outdoor and indoor venue with garden', 'Juhu, Mumbai', 'AC, Parking, Garden, Catering', 'Lawn area, Gazebo, Fountain', 'active'),
('Diamond Hall', 250, 45000.00, 'Elegant hall perfect for small to medium events', 'Goregaon, Mumbai', 'AC, Parking, Basic Catering', 'Modern interiors, LED lighting', 'active');

-- ============================================
-- PACKAGES: Sample wedding packages
-- ============================================
INSERT INTO packages (name, base_price, description, inclusions, status) VALUES
('Basic Package', 25000.00, 'Essential services for a simple celebration', 'Decoration, Basic Catering (Veg), Sound System', 'active'),
('Silver Package', 50000.00, 'Enhanced services with better amenities', 'Decoration, Catering (Veg/Non-Veg), Sound System, Photography (4 hours), Videography', 'active'),
('Gold Package', 100000.00, 'Premium services for a memorable event', 'Premium Decoration, Catering (Multi-cuisine), DJ, Photography (Full day), Videography, Makeup Artist', 'active'),
('Platinum Package', 150000.00, 'Luxury package with all premium services', 'Luxury Decoration, Premium Catering, Live Band, Professional Photography, Cinematic Videography, Makeup & Mehendi, Valet Parking', 'active'),
('Diamond Package', 250000.00, 'Ultimate luxury experience with exclusive services', 'Designer Decoration, Gourmet Catering, Celebrity DJ, Premium Photography & Videography, Complete Bridal Services, Choreography, Fireworks', 'active'),
('Corporate Package', 75000.00, 'Professional package for corporate events', 'Stage Setup, AV Equipment, Catering (Snacks & Meals), Projector & Screen, Wi-Fi', 'active');

-- ============================================
-- BOOKINGS: Sample bookings
-- ============================================
INSERT INTO bookings (customer_id, hall_id, package_id, event_date, event_type, guest_count, total_amount, advance_amount, balance_amount, payment_mode, status, created_by) VALUES
(1, 1, 4, '2025-11-15', 'wedding', 450, 225000.00, 100000.00, 125000.00, 'bank_transfer', 'confirmed', 1),
(2, 2, 3, '2025-11-20', 'reception', 280, 150000.00, 75000.00, 75000.00, 'card', 'confirmed', 1),
(3, 4, 2, '2025-11-25', 'engagement', 350, 110000.00, 50000.00, 60000.00, 'upi', 'pending', 2),
(4, 3, 5, '2025-12-01', 'wedding', 750, 370000.00, 150000.00, 220000.00, 'bank_transfer', 'confirmed', 1),
(5, 5, 1, '2025-12-05', 'birthday', 200, 70000.00, 30000.00, 40000.00, 'cash', 'pending', 3),
(6, 1, 6, '2025-12-10', 'corporate', 400, 195000.00, 100000.00, 95000.00, 'cheque', 'confirmed', 2),
(7, 2, 3, '2025-12-15', 'wedding', 250, 150000.00, 75000.00, 75000.00, 'upi', 'pending', 1),
(8, 4, 2, '2025-12-20', 'reception', 300, 110000.00, 50000.00, 60000.00, 'card', 'confirmed', 3),
(9, 3, 4, '2025-12-25', 'engagement', 600, 270000.00, 120000.00, 150000.00, 'bank_transfer', 'pending', 1),
(10, 5, 1, '2025-12-30', 'wedding', 220, 70000.00, 35000.00, 35000.00, 'cash', 'confirmed', 2);

-- ============================================
-- SLOTS: Create slots for booked dates
-- ============================================
INSERT INTO slots (hall_id, slot_date, status, booking_id) VALUES
(1, '2025-11-15', 'booked', 1),
(2, '2025-11-20', 'booked', 2),
(4, '2025-11-25', 'booked', 3),
(3, '2025-12-01', 'booked', 4),
(5, '2025-12-05', 'booked', 5),
(1, '2025-12-10', 'booked', 6),
(2, '2025-12-15', 'booked', 7),
(4, '2025-12-20', 'booked', 8),
(3, '2025-12-25', 'booked', 9),
(5, '2025-12-30', 'booked', 10);

-- Add some available slots for future dates
INSERT INTO slots (hall_id, slot_date, status) VALUES
(1, '2025-11-01', 'available'),
(1, '2025-11-05', 'available'),
(2, '2025-11-01', 'available'),
(2, '2025-11-10', 'available'),
(3, '2025-11-01', 'available'),
(3, '2025-11-15', 'available'),
(4, '2025-11-01', 'available'),
(4, '2025-11-10', 'available'),
(5, '2025-11-01', 'available'),
(5, '2025-11-15', 'available');

-- ============================================
-- PAYMENTS: Sample payment records
-- ============================================
INSERT INTO payments (booking_id, amount, payment_mode, payment_type, transaction_id, payment_date, received_by) VALUES
(1, 100000.00, 'bank_transfer', 'advance', 'TXN001234567', '2025-10-01', 1),
(2, 75000.00, 'card', 'advance', 'TXN001234568', '2025-10-05', 1),
(3, 50000.00, 'upi', 'advance', 'TXN001234569', '2025-10-10', 2),
(4, 150000.00, 'bank_transfer', 'advance', 'TXN001234570', '2025-10-12', 1),
(5, 30000.00, 'cash', 'advance', NULL, '2025-10-15', 3),
(6, 100000.00, 'cheque', 'advance', 'CHQ123456', '2025-10-18', 2),
(7, 75000.00, 'upi', 'advance', 'TXN001234571', '2025-10-20', 1),
(8, 50000.00, 'card', 'advance', 'TXN001234572', '2025-10-22', 3),
(9, 120000.00, 'bank_transfer', 'advance', 'TXN001234573', '2025-10-25', 1),
(10, 35000.00, 'cash', 'advance', NULL, '2025-10-28', 2);

-- ============================================
-- AUDIT LOGS: Sample audit entries
-- ============================================
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address) VALUES
(1, 'CREATE', 'booking', 1, '{}', '{"customer_id":1,"hall_id":1,"status":"confirmed"}', '192.168.1.100'),
(1, 'CREATE', 'booking', 2, '{}', '{"customer_id":2,"hall_id":2,"status":"confirmed"}', '192.168.1.100'),
(2, 'UPDATE', 'booking', 3, '{"status":"pending"}', '{"status":"confirmed"}', '192.168.1.101'),
(1, 'CREATE', 'customer', 1, '{}', '{"name":"Rahul Sharma","phone":"9876543210"}', '192.168.1.100'),
(3, 'CREATE', 'payment', 1, '{}', '{"booking_id":1,"amount":100000}', '192.168.1.102');

-- ============================================
-- SEED DATA COMPLETE
-- ============================================

SELECT 'Sample data inserted successfully!' AS Status;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS customer_count FROM customers;
SELECT COUNT(*) AS hall_count FROM halls;
SELECT COUNT(*) AS package_count FROM packages;
SELECT COUNT(*) AS booking_count FROM bookings;
SELECT COUNT(*) AS slot_count FROM slots;
SELECT COUNT(*) AS payment_count FROM payments;
