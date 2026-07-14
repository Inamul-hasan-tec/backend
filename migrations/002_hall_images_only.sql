-- ============================================
-- Hall Images Gallery - Simple Migration
-- ============================================
-- This is a SAFE migration that only adds hall images
-- No complex features, just multi-image support
-- ============================================

-- Check if table already exists
CREATE TABLE IF NOT EXISTS hall_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  hall_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  image_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  caption VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
  INDEX idx_hall_id (hall_id),
  INDEX idx_order (hall_id, image_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add primary_image_url to halls table (only if not exists)
SET @dbname = DATABASE();
SET @tablename = 'halls';
SET @columnname = 'primary_image_url';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(500) AFTER description')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verify the changes
SELECT 
  'hall_images' as table_name,
  COUNT(*) as columns_count
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'hall_images';

-- Show the structure
DESCRIBE hall_images;

-- Success message
SELECT 'Migration completed successfully! Hall images table created.' as status;
