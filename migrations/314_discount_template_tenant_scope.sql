-- Migration 314: Scope discount templates by tenant.
-- This is a privacy hardening migration for older flexible-billing tables.

SET @table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'discount_templates'
);

SET @tenant_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'discount_templates'
    AND column_name = 'tenant_id'
);

SET @sql := IF(
  @table_exists = 1 AND @tenant_column_exists = 0,
  'ALTER TABLE discount_templates ADD COLUMN tenant_id INT NULL AFTER id',
  'SELECT ''discount_templates.tenant_id already exists or table missing'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @tenant_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'discount_templates'
    AND column_name = 'tenant_id'
);

SET @sql := IF(
  @table_exists = 1 AND @tenant_column_exists = 1,
  'UPDATE discount_templates SET tenant_id = COALESCE(tenant_id, (SELECT id FROM tenants ORDER BY id LIMIT 1)) WHERE tenant_id IS NULL',
  'SELECT ''discount_templates tenant backfill skipped'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  @table_exists = 1 AND @tenant_column_exists = 1,
  'ALTER TABLE discount_templates MODIFY COLUMN tenant_id INT NOT NULL',
  'SELECT ''discount_templates tenant not-null skipped'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'discount_templates'
    AND index_name = 'idx_discount_templates_tenant'
);

SET @sql := IF(
  @table_exists = 1 AND @tenant_column_exists = 1 AND @index_exists = 0,
  'ALTER TABLE discount_templates ADD INDEX idx_discount_templates_tenant (tenant_id)',
  'SELECT ''discount_templates tenant index exists or skipped'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'discount_templates'
    AND constraint_name = 'fk_discount_templates_tenant'
);

SET @sql := IF(
  @table_exists = 1 AND @tenant_column_exists = 1 AND @fk_exists = 0,
  'ALTER TABLE discount_templates ADD CONSTRAINT fk_discount_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
  'SELECT ''discount_templates tenant fk exists or skipped'' AS migration_note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
