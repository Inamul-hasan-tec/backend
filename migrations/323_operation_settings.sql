-- Tenant-level operations module settings.
-- Keeps pilot features configurable without forcing every hall into the same workflow.

CREATE TABLE IF NOT EXISTS tenant_operation_settings (
  tenant_id INT NOT NULL,
  employee_mode ENUM('off', 'simple', 'event_staffing', 'advanced') NOT NULL DEFAULT 'event_staffing',
  enable_employee_attendance BOOLEAN NOT NULL DEFAULT TRUE,
  enable_employee_conflict_warnings BOOLEAN NOT NULL DEFAULT TRUE,
  require_staff_for_event_closeout BOOLEAN NOT NULL DEFAULT FALSE,
  enable_vendor_payout_tracking BOOLEAN NOT NULL DEFAULT FALSE,
  enable_weekly_roster BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  CONSTRAINT fk_tenant_operation_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

INSERT INTO tenant_operation_settings (tenant_id)
SELECT id
FROM tenants
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_operation_settings tos
  WHERE tos.tenant_id = tenants.id
);
