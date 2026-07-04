-- Repair tenant schema drift found during fresh VPS production launch.
-- These columns/tables are used by TenantRepository and platform tenant
-- management, so the audit must catch them before runtime.

SET @tenant_logo_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE table_schema = DATABASE() AND table_name = 'tenants' AND column_name = 'logo_url'
);
SET @sql := IF(
  @tenant_logo_exists = 0,
  'ALTER TABLE tenants ADD COLUMN logo_url VARCHAR(500) NULL AFTER domain',
  'SELECT ''tenants.logo_url exists'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS tenant_settings (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_tenant_setting (tenant_id, setting_key),
  CONSTRAINT fk_tenant_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

