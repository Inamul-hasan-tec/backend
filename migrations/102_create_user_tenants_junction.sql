-- Migration: Create user_tenants junction table (Optional - for multi-tenant users)
-- Description: Allow users to belong to multiple tenants (e.g., consultants, support staff)
-- Date: 2026-01-05
-- Note: This is optional - only run if you need users to access multiple tenants

-- Create user_tenants junction table
CREATE TABLE IF NOT EXISTS user_tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  tenant_id INT NOT NULL,
  role ENUM('admin', 'staff_1', 'staff_2', 'viewer') DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_tenants_user_id (user_id),
  INDEX idx_user_tenants_tenant_id (tenant_id),
  UNIQUE KEY uk_user_tenant (user_id, tenant_id),
  
  -- Foreign keys
  CONSTRAINT fk_user_tenants_user 
    FOREIGN KEY (user_id) REFERENCES users(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_user_tenants_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Junction table for users who can access multiple tenants';

-- Migrate existing user-tenant relationships
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT 
  id as user_id,
  tenant_id,
  role,
  status = 'active' as is_active
FROM users
WHERE tenant_id IS NOT NULL
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Migration complete
SELECT 'Migration 102 completed: user_tenants junction table created' AS status;
