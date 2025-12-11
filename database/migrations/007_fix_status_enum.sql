-- ============================================
-- FIX STATUS ENUM - PHASE 2.4
-- ============================================
-- Date: November 21, 2025
-- Purpose: Add missing status values to ENUM
-- ============================================

USE hall_sync;

-- ============================================
-- FIX: invoices.status ENUM
-- ============================================

-- Add 'issued' and 'partially_paid' to status ENUM
ALTER TABLE invoices 
MODIFY COLUMN status ENUM(
  'draft',
  'issued',
  'sent', 
  'paid',
  'partially_paid',
  'cancelled',
  'void'
) DEFAULT 'draft';

-- ============================================
-- VERIFICATION
-- ============================================

-- Show status column
SHOW COLUMNS FROM invoices WHERE Field = 'status';

SELECT 'Migration 007 completed successfully!' AS status;
