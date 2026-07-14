-- Migration: Create migration_tracker table
-- Description: Track all database migrations
-- Date: 2026-01-05

CREATE TABLE IF NOT EXISTS migration_tracker (
  id INT AUTO_INCREMENT PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INT DEFAULT 0,
  status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
  notes TEXT,
  INDEX idx_migration_name (migration_name),
  INDEX idx_executed_at (executed_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks database migration execution history';

-- Migration complete
SELECT 'Migration tracker table created successfully' AS status;
