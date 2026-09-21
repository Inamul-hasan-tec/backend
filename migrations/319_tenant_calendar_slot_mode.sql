-- Tenant-level calendar slot mode preference.
-- Existing venues keep the current Morning / Afternoon / Night behavior by default.

INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, created_at, updated_at)
SELECT id, 'calendar_slot_mode', 'three_slots', NOW(), NOW()
FROM tenants
ON DUPLICATE KEY UPDATE setting_value = setting_value;

