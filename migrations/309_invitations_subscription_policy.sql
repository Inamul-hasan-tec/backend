CREATE TABLE IF NOT EXISTS user_invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  role ENUM('admin', 'staff_1', 'staff_2', 'viewer') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  invited_by INT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_invitations_token_hash (token_hash),
  INDEX idx_user_invitations_tenant_email (tenant_id, email),
  INDEX idx_user_invitations_expiry (expires_at),
  CONSTRAINT fk_user_invitations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_invitations_inviter FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subscription_reminder_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subscription_id INT NOT NULL,
  tenant_id INT NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  reminder_days INT NOT NULL,
  period_end DATE NOT NULL,
  status ENUM('sent', 'skipped', 'failed') NOT NULL,
  error_message VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_reminder_delivery
    (subscription_id, recipient_email, reminder_days, period_end),
  INDEX idx_subscription_reminder_tenant (tenant_id, created_at),
  CONSTRAINT fk_subscription_reminder_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_subscription_reminder_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
