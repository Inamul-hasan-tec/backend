-- Employee/vendor operations foundation.
-- This is tenant-scoped master people + booking-level duty roster/attendance.

CREATE TABLE IF NOT EXISTS employee_profiles (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  hall_id INT NULL,
  person_type ENUM('employee', 'vendor', 'contractor') NOT NULL DEFAULT 'employee',
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  primary_role VARCHAR(100) NOT NULL DEFAULT 'General Staff',
  skills TEXT NULL,
  payment_type ENUM('monthly', 'daily', 'hourly', 'event', 'vendor') NOT NULL DEFAULT 'event',
  rate DECIMAL(12,2) NULL,
  vendor_company VARCHAR(150) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_employee_profiles_tenant_status (tenant_id, status),
  KEY idx_employee_profiles_tenant_role (tenant_id, primary_role, status),
  KEY idx_employee_profiles_tenant_hall (tenant_id, hall_id, status),
  CONSTRAINT fk_employee_profiles_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_profiles_hall
    FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_staff_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  booking_id INT NOT NULL,
  employee_id INT NULL,
  display_name VARCHAR(150) NOT NULL,
  role VARCHAR(100) NOT NULL,
  duty_area VARCHAR(100) NULL,
  shift_start DATETIME NULL,
  shift_end DATETIME NULL,
  status ENUM('planned', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled') NOT NULL DEFAULT 'planned',
  check_in_at DATETIME NULL,
  check_out_at DATETIME NULL,
  payout_amount DECIMAL(12,2) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_staff_tenant_booking (tenant_id, booking_id),
  KEY idx_event_staff_tenant_employee (tenant_id, employee_id),
  KEY idx_event_staff_tenant_status (tenant_id, status),
  CONSTRAINT fk_event_staff_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_staff_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_staff_employee
    FOREIGN KEY (employee_id) REFERENCES employee_profiles(id) ON DELETE SET NULL
);
