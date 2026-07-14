-- Migration: Convert dashboard_stats table to VIEW
-- Description: Replace static table with dynamic VIEW for real-time stats
-- Date: 2026-01-05

-- Drop existing table
DROP TABLE IF EXISTS dashboard_stats;

-- Create VIEW with tenant-specific statistics
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
  b.tenant_id,
  
  -- Booking stats
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) AS confirmed_bookings,
  COUNT(CASE WHEN b.status = 'pending' THEN 1 END) AS pending_bookings,
  COUNT(CASE WHEN DATE(b.event_date) = CURDATE() THEN 1 END) AS todays_bookings,
  
  -- Customer stats
  (SELECT COUNT(DISTINCT id) FROM customers WHERE tenant_id = b.tenant_id AND status = 'active') AS active_customers,
  
  -- Hall stats
  (SELECT COUNT(DISTINCT id) FROM halls WHERE tenant_id = b.tenant_id AND status = 'active') AS active_halls,
  
  -- Revenue stats (current month)
  SUM(CASE 
    WHEN MONTH(b.created_at) = MONTH(CURDATE()) 
    AND YEAR(b.created_at) = YEAR(CURDATE()) 
    THEN b.total_amount 
    ELSE 0 
  END) AS monthly_revenue,
  
  SUM(CASE 
    WHEN MONTH(b.created_at) = MONTH(CURDATE()) 
    AND YEAR(b.created_at) = YEAR(CURDATE()) 
    THEN b.advance_amount 
    ELSE 0 
  END) AS monthly_advance
  
FROM bookings b
GROUP BY b.tenant_id;

-- Migration complete
SELECT 'Migration 104 completed: dashboard_stats converted to VIEW' AS status;
