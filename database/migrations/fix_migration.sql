-- First, check if columns exist before adding them
SET @dbname = DATABASE();
SET @tablename = 'customers';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'gstin')
  ) = 0,
  'ALTER TABLE customers ADD COLUMN gstin VARCHAR(15) AFTER email',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'pan')
  ) = 0,
  'ALTER TABLE customers ADD COLUMN pan VARCHAR(10) AFTER gstin',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Continue with other ALTER statements similarly
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'customer_type')
  ) = 0,
  'ALTER TABLE customers ADD COLUMN customer_type ENUM(\'individual\', \'business\') DEFAULT \'individual\' AFTER pan',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'state_code')
  ) = 0,
  'ALTER TABLE customers ADD COLUMN state_code VARCHAR(2) AFTER state',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- For the bookings table
SET @tablename = 'bookings';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'gst_amount')
  ) = 0,
  'ALTER TABLE bookings ADD COLUMN gst_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'grand_total')
  ) = 0,
  'ALTER TABLE bookings ADD COLUMN grand_total DECIMAL(10,2) DEFAULT 0.00 AFTER gst_amount',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'invoice_generated')
  ) = 0,
  'ALTER TABLE bookings ADD COLUMN invoice_generated BOOLEAN DEFAULT FALSE AFTER balance_amount',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'invoice_id')
  ) = 0,
  'ALTER TABLE bookings ADD COLUMN invoice_id INT AFTER invoice_generated',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE (TABLE_SCHEMA = @dbname)
   AND (TABLE_NAME = @tablename)
   AND (COLUMN_NAME = 'payment_status')
  ) = 0,
  'ALTER TABLE bookings ADD COLUMN payment_status ENUM(\'unpaid\', \'partial\', \'paid\', \'refunded\') DEFAULT \'unpaid\' AFTER status',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key after all columns are added
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = @dbname
   AND TABLE_NAME = 'bookings'
   AND CONSTRAINT_NAME = 'bookings_ibfk_3'
  ) = 0,
  'ALTER TABLE bookings ADD CONSTRAINT fk_booking_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS 
   WHERE TABLE_SCHEMA = @dbname
   AND TABLE_NAME = 'bookings'
   AND INDEX_NAME = 'idx_payment_status'
  ) = 0,
  'CREATE INDEX idx_payment_status ON bookings(payment_status)',
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;