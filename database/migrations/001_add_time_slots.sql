-- ============================================
-- Migration: Add Time Slots Support
-- Date: November 13, 2025
-- Purpose: Enable morning/afternoon/night slots
-- ============================================

USE hall_sync;

-- Step 1: Add slot_type column to slots table
ALTER TABLE slots 
ADD COLUMN slot_type ENUM('morning', 'afternoon', 'night') 
NOT NULL DEFAULT 'afternoon'
AFTER slot_date;

-- Step 2: Drop old unique constraint (only allows 1 slot per day)
ALTER TABLE slots 
DROP INDEX unique_hall_date;

-- Step 3: Add new unique constraint (allows 3 slots per day)
ALTER TABLE slots 
ADD UNIQUE KEY unique_hall_date_slot (hall_id, slot_date, slot_type);

-- Step 4: Add time_slot to bookings table
ALTER TABLE bookings 
ADD COLUMN time_slot ENUM('morning', 'afternoon', 'night')
AFTER event_date;

-- Step 5: Add slot_id to bookings table
ALTER TABLE bookings 
ADD COLUMN slot_id INT
AFTER time_slot;

-- Step 6: Add foreign key constraint
ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_slot 
FOREIGN KEY (slot_id) REFERENCES slots(id) 
ON DELETE SET NULL;

-- Step 7: Add index for better query performance
ALTER TABLE bookings 
ADD INDEX idx_slot_id (slot_id);

-- Verification queries
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as total_slots FROM slots;
DESCRIBE slots;
DESCRIBE bookings;
