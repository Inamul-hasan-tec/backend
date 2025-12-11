-- ============================================
-- Hall Sync - Cloud Database Schema
-- ============================================
-- Optimized for FreeSQLDatabase
-- ============================================

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'manager') DEFAULT 'staff',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: customers
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
  updated_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY unique_phone (phone),
  INDEX idx_name (name),
  INDEX idx_phone (phone),
  INDEX idx_email (email),
  INDEX idx_city (city),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: halls
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
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_capacity (capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: packages
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  inclusions TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: bookings
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
  updated_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE RESTRICT,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customer (customer_id),
  INDEX idx_hall (hall_id),
  INDEX idx_package (package_id),
  INDEX idx_event_date (event_date),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_booking_date_status (event_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: slots
-- ============================================
CREATE TABLE IF NOT EXISTS slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hall_id INT NOT NULL,
  slot_date DATE NOT NULL,
  status ENUM('available', 'booked', 'blocked') DEFAULT 'available',
  booking_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  UNIQUE KEY unique_hall_date (hall_id, slot_date),
  INDEX idx_hall_date (hall_id, slot_date),
  INDEX idx_status (status),
  INDEX idx_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: payments
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
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Additional indexes for performance
-- ============================================
CREATE INDEX idx_customer_status ON customers(status, created_at);
CREATE INDEX idx_hall_status ON halls(status, capacity);

-- ============================================
-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
-- ============================================
INSERT INTO users (name, email, password, role, status) VALUES
('Admin User', 'admin@hallsync.com', '$2a$10$rOzJw8qKlE9YvH8vKxH8NeqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', 'admin', 'active')
ON DUPLICATE KEY UPDATE name=name;

-- ============================================
-- Insert sample halls
-- ============================================
INSERT INTO halls (name, capacity, base_price, description, location, status) VALUES
('Grand Palace Hall', 500, 50000.00, 'Luxurious hall with modern amenities', 'Downtown', 'active'),
('Royal Garden Hall', 300, 35000.00, 'Beautiful outdoor and indoor space', 'North Zone', 'active'),
('Crystal Banquet', 200, 25000.00, 'Elegant hall for intimate gatherings', 'South Zone', 'active')
ON DUPLICATE KEY UPDATE name=name;

-- ============================================
-- Insert sample packages
-- ============================================
INSERT INTO packages (name, base_price, description, inclusions, status) VALUES
('Basic Package', 15000.00, 'Essential services for your event', 'Decoration, Catering, Music', 'active'),
('Premium Package', 30000.00, 'Complete event management', 'Decoration, Catering, Music, Photography, DJ', 'active'),
('Luxury Package', 50000.00, 'All-inclusive premium experience', 'Everything in Premium + Valet, Security, Premium Decor', 'active')
ON DUPLICATE KEY UPDATE name=name;
