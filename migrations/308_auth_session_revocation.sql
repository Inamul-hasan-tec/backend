-- Add a monotonic session version so logout and account security changes can
-- invalidate all previously issued JWT access tokens.

SET @auth_version_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'auth_version'
);

SET @auth_version_sql = IF(
  @auth_version_exists = 0,
  'ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER status',
  'SELECT 1'
);

PREPARE auth_version_stmt FROM @auth_version_sql;
EXECUTE auth_version_stmt;
DEALLOCATE PREPARE auth_version_stmt;

