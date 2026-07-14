-- Provider-independent Hall Sync subscription billing

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'starter',
  price DECIMAL(10, 2) NOT NULL DEFAULT 1999,
  status VARCHAR(30) NOT NULL DEFAULT 'trial',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  trial_ends_at TIMESTAMP NULL,
  current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_tenant (tenant_id),
  INDEX idx_subscription_status (status),
  INDEX idx_subscription_period_end (current_period_end),
  CONSTRAINT fk_subscription_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  monthly_price DECIMAL(10, 2) NOT NULL,
  annual_price DECIMAL(10, 2) NOT NULL,
  hall_limit INT NULL,
  user_limit INT NULL,
  booking_limit INT NULL,
  storage_gb INT NULL,
  features JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_plan_code (code)
);

INSERT INTO subscription_plans
  (code, name, monthly_price, annual_price, hall_limit, user_limit, booking_limit, storage_gb)
VALUES
  ('starter', 'Starter', 1999, 19990, 1, 5, 100, 5),
  ('professional', 'Professional', 4999, 49990, 5, 20, NULL, 25),
  ('enterprise', 'Enterprise', 14999, 149990, NULL, NULL, NULL, 100)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  monthly_price = VALUES(monthly_price),
  annual_price = VALUES(annual_price);

CREATE TABLE IF NOT EXISTS subscription_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL,
  tenant_id INT NOT NULL,
  subscription_id INT NOT NULL,
  plan_code VARCHAR(50) NOT NULL,
  billing_cycle ENUM('monthly', 'annual') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM(
    'pending',
    'payment_submitted',
    'approved',
    'rejected',
    'expired',
    'cancelled'
  ) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_order_number (order_number),
  INDEX idx_subscription_order_tenant (tenant_id, created_at),
  INDEX idx_subscription_order_status (status),
  CONSTRAINT fk_subscription_order_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_order_subscription
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_order_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_order_approver
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  tenant_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method ENUM('upi', 'bank_transfer', 'cash', 'other') NOT NULL,
  transaction_reference VARCHAR(255) NOT NULL,
  proof_url VARCHAR(500) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  submitted_by INT NOT NULL,
  verified_by INT NULL,
  verified_at TIMESTAMP NULL,
  rejection_reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_payment_reference (transaction_reference),
  INDEX idx_subscription_payment_status (status, created_at),
  INDEX idx_subscription_payment_tenant (tenant_id, created_at),
  CONSTRAINT fk_subscription_payment_order
    FOREIGN KEY (order_id) REFERENCES subscription_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_payment_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_payment_submitter
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_subscription_payment_verifier
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);
