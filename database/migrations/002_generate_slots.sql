-- ============================================
-- Generate Slots for All Halls
-- Date: November 13, 2025
-- Purpose: Create morning/afternoon/night slots for next 6 months
-- ============================================

USE hall_sync;

-- This script generates slots for all halls for the next 6 months
-- Run this AFTER running 001_add_time_slots.sql

-- Temporary procedure to generate slots
DELIMITER $$

DROP PROCEDURE IF EXISTS generate_slots_for_halls$$

CREATE PROCEDURE generate_slots_for_halls()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE hall_id_var INT;
    DECLARE current_date_var DATE;
    DECLARE end_date_var DATE;
    DECLARE slot_type_var VARCHAR(20);
    
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
    
    -- Show summary
    SELECT 
        COUNT(*) as total_slots_created,
        COUNT(DISTINCT hall_id) as halls_processed,
        MIN(slot_date) as start_date,
        MAX(slot_date) as end_date
    FROM slots;
    
END$$

DELIMITER ;

-- Execute the procedure
CALL generate_slots_for_halls();

-- Verify slots were created
SELECT 
    h.name as hall_name,
    s.slot_type,
    COUNT(*) as slot_count
FROM slots s
JOIN halls h ON s.hall_id = h.id
GROUP BY h.name, s.slot_type
ORDER BY h.name, s.slot_type;

-- Show sample slots
SELECT 
    h.name as hall_name,
    s.slot_date,
    s.slot_type,
    s.status
FROM slots s
JOIN halls h ON s.hall_id = h.id
WHERE s.slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
ORDER BY s.slot_date, h.name, s.slot_type
LIMIT 50;

-- Cleanup
DROP PROCEDURE IF EXISTS generate_slots_for_halls;

SELECT 'Slots generated successfully!' as status;
