-- ============================================
-- Run All Migrations
-- Copy and paste this entire file into MySQL
-- ============================================

USE hall_sync;

-- ============================================
-- MIGRATION 1: Add Time Slots Support
-- ============================================

-- Step 1: Add slot_type column to slots table
ALTER TABLE slots 
ADD COLUMN slot_type ENUM('morning', 'afternoon', 'night') 
NOT NULL DEFAULT 'afternoon'
AFTER slot_date;

-- Step 2: Drop old unique constraint
ALTER TABLE slots 
DROP INDEX unique_hall_date;

-- Step 3: Add new unique constraint
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

-- Step 7: Add index
ALTER TABLE bookings 
ADD INDEX idx_slot_id (slot_id);

SELECT 'Migration 1 completed successfully!' as status;

-- ============================================
-- MIGRATION 2: Generate Slots
-- ============================================

-- Temporary procedure to generate slots
DELIMITER $$

DROP PROCEDURE IF EXISTS generate_slots_for_halls$$

CREATE PROCEDURE generate_slots_for_halls()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE hall_id_var INT;
    DECLARE current_date_var DATE;
    DECLARE end_date_var DATE;
    
    -- Cursor for all active halls
    DECLARE hall_cursor CURSOR FOR 
        SELECT id FROM halls WHERE status = 'active';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Set date range (next 6 months)
    SET current_date_var = CURDATE();
    SET end_date_var = DATE_ADD(CURDATE(), INTERVAL 6 MONTH);
    
    -- Open cursor
    OPEN hall_cursor;
    
    -- Loop through each hall
    hall_loop: LOOP
        FETCH hall_cursor INTO hall_id_var;
        
        IF done THEN
            LEAVE hall_loop;
        END IF;
        
        -- Reset date for each hall
        SET current_date_var = CURDATE();
        
        -- Loop through each date
        WHILE current_date_var <= end_date_var DO
            
            -- Create morning slot
            INSERT IGNORE INTO slots (hall_id, slot_date, slot_type, status)
            VALUES (hall_id_var, current_date_var, 'morning', 'available');
            
            -- Create afternoon slot
            INSERT IGNORE INTO slots (hall_id, slot_date, slot_type, status)
            VALUES (hall_id_var, current_date_var, 'afternoon', 'available');
            
            -- Create night slot
            INSERT IGNORE INTO slots (hall_id, slot_date, slot_type, status)
            VALUES (hall_id_var, current_date_var, 'night', 'available');
            
            -- Move to next day
            SET current_date_var = DATE_ADD(current_date_var, INTERVAL 1 DAY);
            
        END WHILE;
        
    END LOOP;
    
    CLOSE hall_cursor;
    
END$$

DELIMITER ;

-- Execute the procedure
CALL generate_slots_for_halls();

-- Show summary
SELECT 
    COUNT(*) as total_slots_created,
    COUNT(DISTINCT hall_id) as halls_processed,
    MIN(slot_date) as start_date,
    MAX(slot_date) as end_date
FROM slots;

-- Verify slots were created
SELECT 
    h.name as hall_name,
    s.slot_type,
    COUNT(*) as slot_count
FROM slots s
JOIN halls h ON s.hall_id = h.id
GROUP BY h.name, s.slot_type
ORDER BY h.name, s.slot_type;

-- Cleanup
DROP PROCEDURE IF EXISTS generate_slots_for_halls;

SELECT 'Migration 2 completed - Slots generated successfully!' as status;

-- Final verification
DESCRIBE slots;
DESCRIBE bookings;
SELECT COUNT(*) as total_slots FROM slots;
