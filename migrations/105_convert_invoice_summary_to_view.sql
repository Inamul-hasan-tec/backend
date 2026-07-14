-- Migration: Convert invoice_summary table to VIEW
-- Description: Replace denormalized table with dynamic VIEW
-- Date: 2026-01-05

-- Drop existing table
DROP TABLE IF EXISTS invoice_summary;

-- Create VIEW with tenant filtering
CREATE OR REPLACE VIEW invoice_summary AS
SELECT 
  i.id,
  i.tenant_id,
  i.invoice_number,
  i.invoice_type,
  i.invoice_date,
  i.due_date,
  i.subtotal,
  i.discount_amount,
  i.taxable_amount,
  i.cgst_amount,
  i.sgst_amount,
  i.igst_amount,
  i.total_tax,
  i.grand_total,
  i.amount_paid,
  i.balance_amount,
  i.payment_status,
  i.status,
  i.created_at,
  
  -- Customer details
  c.name AS customer_name,
  c.gstin AS customer_gstin,
  c.email AS customer_email,
  c.phone AS customer_phone,
  
  -- Booking details
  b.id AS booking_id,
  b.event_date,
  b.event_type,
  
  -- Business config
  bc.business_name,
  bc.gstin AS business_gstin,
  bc.state AS business_state
  
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id AND i.tenant_id = c.tenant_id
LEFT JOIN bookings b ON i.booking_id = b.id AND i.tenant_id = b.tenant_id
LEFT JOIN business_config bc ON i.tenant_id = bc.tenant_id;

-- Migration complete
SELECT 'Migration 105 completed: invoice_summary converted to VIEW' AS status;
