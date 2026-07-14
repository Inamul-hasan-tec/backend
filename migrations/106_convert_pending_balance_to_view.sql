-- Migration: Convert pending_balance_report table to VIEW
-- Description: Replace static table with dynamic VIEW for real-time aging report
-- Date: 2026-01-05

-- Drop existing table
DROP TABLE IF EXISTS pending_balance_report;

-- Create VIEW with tenant filtering and aging buckets
CREATE OR REPLACE VIEW pending_balance_report AS
SELECT 
  i.id,
  i.tenant_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  
  -- Customer details
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.email AS customer_email,
  
  -- Payment details
  i.grand_total,
  i.amount_paid,
  i.balance_amount,
  i.payment_status,
  
  -- Aging calculation
  DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
  
  -- Aging bucket
  CASE 
    WHEN DATEDIFF(CURDATE(), i.due_date) <= 0 THEN 'Current'
    WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 1 AND 30 THEN '1-30 days'
    WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 31 AND 60 THEN '31-60 days'
    WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 61 AND 90 THEN '61-90 days'
    ELSE '90+ days'
  END AS aging_bucket
  
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id AND i.tenant_id = c.tenant_id
WHERE i.balance_amount > 0
  AND i.payment_status IN ('pending', 'partial');

-- Migration complete
SELECT 'Migration 106 completed: pending_balance_report converted to VIEW' AS status;
