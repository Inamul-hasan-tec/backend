-- Keep legacy full-day bookings compatible with conflict-safe slot handling.

ALTER TABLE slots
  MODIFY COLUMN slot_type
    ENUM('morning', 'afternoon', 'night', 'full_day')
    NOT NULL DEFAULT 'afternoon';
