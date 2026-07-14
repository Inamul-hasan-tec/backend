SET @users_phone_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'phone'
);

SET @users_phone_sql := IF(
  @users_phone_exists = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER email',
  'SELECT ''users.phone exists'' AS migration_note'
);

PREPARE users_phone_statement FROM @users_phone_sql;
EXECUTE users_phone_statement;
DEALLOCATE PREPARE users_phone_statement;
