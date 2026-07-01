-- Migration: Add tenant_id to users table
-- Description: Link users to tenants for multi-tenancy support
-- Date: 2026-01-05

-- Add tenant_id column to users table
ALTER TABLE users 
ADD COLUMN tenant_id INT NULL AFTER id,
ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE AFTER role,
ADD INDEX idx_users_tenant_id (tenant_id),
ADD CONSTRAINT fk_users_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) 
  ON DELETE CASCADE;

-- Update existing users to belong to first tenant (if any)
UPDATE users 
SET tenant_id = (SELECT id FROM tenants ORDER BY id LIMIT 1)
WHERE tenant_id IS NULL;

-- Add comment
ALTER TABLE users 
MODIFY COLUMN tenant_id INT NOT NULL COMMENT 'Tenant ID - links user to tenant';

-- Add role enum validation (optional - for better data integrity)
ALTER TABLE users 
MODIFY COLUMN role ENUM('super_admin', 'admin', 'staff_1', 'staff_2', 'viewer') 
DEFAULT 'staff_2';

-- Migration complete
SELECT 'Migration 101 completed: tenant_id added to users table' AS status;
