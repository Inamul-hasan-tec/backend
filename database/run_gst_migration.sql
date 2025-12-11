-- ============================================
-- RUN GST COMPLIANCE MIGRATION
-- ============================================
-- This script safely runs the GST migration
-- ============================================

-- Set safe mode
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- Backup reminder
SELECT '⚠️  IMPORTANT: Make sure you have a database backup before proceeding!' AS Warning;
SELECT 'Press Ctrl+C to cancel, or continue to run migration...' AS Info;

-- Run the migration
SOURCE /Users/inamulhasan/Desktop/Frontend\ Course/untitled\ folder/hall-sync-complete/backend/database/migrations/003_gst_compliance_schema.sql;

-- Restore settings
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- Verify migration
SELECT 'Verifying migration...' AS Status;

SELECT 
  TABLE_NAME, 
  TABLE_ROWS,
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'hall_sync'
  AND TABLE_NAME IN (
    'business_config',
    'service_catalog',
    'invoices',
    'invoice_line_items',
    'payment_receipts',
    'gst_tax_rates',
    'gst_exports'
  )
ORDER BY TABLE_NAME;

SELECT '✅ Migration completed successfully!' AS Status;
SELECT 'Next step: Insert your business configuration data' AS NextStep;
