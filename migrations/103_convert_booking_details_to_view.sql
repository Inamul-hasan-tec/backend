-- Migration: Convert booking_details table to VIEW
-- Description: Replace denormalized table with dynamic VIEW for better data consistency
-- Date: 2026-01-05

-- Drop existing table (backup first if needed)
DROP TABLE IF EXISTS booking_details;

-- Create VIEW with tenant filtering
CREATE OR REPLACE VIEW booking_details AS
SELECT 
  b.id AS booking_id,
  b.tenant_id,
  b.event_date,
  b.event_type,
  b.guest_count,
  b.total_amount,
  b.advance_amount,
  b.balance_amount,
  b.payment_mode,
  b.status AS booking_status,
  b.notes AS booking_notes,
  b.created_at AS booking_created_at,
  
  -- Customer details
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.email AS customer_email,
  c.city AS customer_city,
  
  -- Hall details
  h.id AS hall_id,
  h.name AS hall_name,
  h.capacity AS hall_capacity,
  h.location AS hall_location,
  
  -- Package details
  p.id AS package_id,
  p.name AS package_name,
  p.base_price AS package_price,
  
  -- Created by
  u.name AS created_by_name
  
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id AND b.tenant_id = c.tenant_id
LEFT JOIN halls h ON b.hall_id = h.id AND b.tenant_id = h.tenant_id
LEFT JOIN packages p ON b.package_id = p.id AND b.tenant_id = p.tenant_id
LEFT JOIN users u ON b.created_by = u.id;

-- Migration complete
SELECT 'Migration 103 completed: booking_details converted to VIEW' AS status;
