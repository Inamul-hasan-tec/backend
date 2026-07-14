-- Hall Sync platform and tenant lifecycle separation

ALTER TABLE tenants
  MODIFY COLUMN status ENUM(
    'trial',
    'active',
    'past_due',
    'inactive',
    'suspended',
    'archived'
  ) NOT NULL DEFAULT 'trial';

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NULL,
  reason VARCHAR(500) NULL,
  metadata JSON NULL,
  request_id VARCHAR(100) NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_platform_audit_actor (actor_user_id),
  INDEX idx_platform_audit_target (target_type, target_id),
  INDEX idx_platform_audit_created (created_at),
  CONSTRAINT fk_platform_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);
