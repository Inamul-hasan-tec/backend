-- Performance Optimization Indexes
-- Run this SQL to improve query performance

-- Bookings table indexes
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_hall_id ON bookings(hall_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_composite ON bookings(hall_id, event_date, status);

-- Slots table indexes
CREATE INDEX IF NOT EXISTS idx_slots_hall_id ON slots(hall_id);
CREATE INDEX IF NOT EXISTS idx_slots_slot_date ON slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
CREATE INDEX IF NOT EXISTS idx_slots_booking_id ON slots(booking_id);
CREATE INDEX IF NOT EXISTS idx_slots_composite ON slots(hall_id, slot_date, slot_type);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Halls table indexes
CREATE INDEX IF NOT EXISTS idx_halls_status ON halls(status);

-- Packages table indexes
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);

-- Show all indexes
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('bookings', 'slots', 'customers', 'halls', 'packages')
GROUP BY 
    TABLE_NAME, INDEX_NAME
ORDER BY 
    TABLE_NAME, INDEX_NAME;
