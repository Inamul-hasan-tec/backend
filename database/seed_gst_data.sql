-- ============================================
-- SEED DATA FOR GST COMPLIANCE
-- ============================================
-- Sample business configuration and services
-- ============================================

USE hall_sync;

-- ============================================
-- INSERT BUSINESS CONFIGURATION
-- ============================================

INSERT INTO business_config (
  business_name,
  gstin,
  pan,
  state,
  state_code,
  address,
  city,
  pincode,
  phone,
  email,
  website,
  business_type,
  services_offered,
  pricing_model,
  is_gst_registered,
  annual_turnover,
  gst_registration_date,
  advance_percentage,
  allow_multiple_payments,
  cancellation_policy,
  cancellation_rules,
  bank_name,
  bank_account_name,
  bank_account_number,
  bank_ifsc,
  bank_branch,
  invoice_prefix,
  receipt_prefix,
  credit_note_prefix,
  debit_note_prefix,
  financial_year_start
) VALUES (
  'Royal Marriage Hall',
  '29ABCDE1234F1Z5',
  'ABCDE1234F',
  'Karnataka',
  '29',
  '123, MG Road, Bangalore',
  'Bangalore',
  '560001',
  '+91-9876543210',
  'info@royalmarriageall.com',
  'www.royalmarriagehall.com',
  'hall_rental',
  '["VENUE_RENTAL", "CATERING_INHOUSE", "DECORATION", "AV_EQUIPMENT", "PARKING"]',
  'package',
  TRUE,
  5000000.00,
  '2018-07-01',
  25,
  TRUE,
  'tiered',
  '[
    {"days_before_event": 90, "refund_percentage": 90},
    {"days_before_event": 60, "refund_percentage": 75},
    {"days_before_event": 30, "refund_percentage": 50},
    {"days_before_event": 15, "refund_percentage": 25},
    {"days_before_event": 0, "refund_percentage": 0}
  ]',
  'HDFC Bank',
  'Royal Marriage Hall',
  '1234567890',
  'HDFC0001234',
  'MG Road Branch, Bangalore',
  'INV',
  'RV',
  'CN',
  'DN',
  4
) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- INSERT SERVICE CATALOG
-- ============================================

-- Venue Rental Services
INSERT INTO service_catalog (
  service_code, name, category, base_price, unit, sac_code, gst_rate, description, is_active
) VALUES
('SRV_001', 'Grand Ballroom - Full Day', 'VENUE_RENTAL', 50000.00, 'day', '9972', 18.00, 
 '1000 pax capacity, AC hall with stage, green room, and parking', TRUE),

('SRV_002', 'Grand Ballroom - Half Day (Morning)', 'VENUE_RENTAL', 30000.00, 'day', '9972', 18.00,
 '1000 pax capacity, 6 AM to 2 PM', TRUE),

('SRV_003', 'Grand Ballroom - Half Day (Evening)', 'VENUE_RENTAL', 35000.00, 'day', '9972', 18.00,
 '1000 pax capacity, 4 PM to 12 AM', TRUE),

('SRV_004', 'Lawn Area - Full Day', 'VENUE_RENTAL', 40000.00, 'day', '9972', 18.00,
 '500 pax capacity, open lawn with tent setup', TRUE),

-- Catering Services
('SRV_101', 'Vegetarian Catering - Standard', 'CATERING_INHOUSE', 350.00, 'plate', '996331', 5.00,
 ' 4 starters, 3 main course, 2 desserts, welcome drink', TRUE),

('SRV_102', 'Vegetarian Catering - Premium', 'CATERING_INHOUSE', 500.00, 'plate', '996331', 5.00,
 '6 starters, 4 main course, 3 desserts, welcome drink, live counter', TRUE),

('SRV_103', 'Non-Vegetarian Catering - Standard', 'CATERING_INHOUSE', 450.00, 'plate', '996331', 5.00,
 '4 starters (2 non-veg), 3 main course (1 non-veg), 2 desserts', TRUE),

('SRV_104', 'Non-Vegetarian Catering - Premium', 'CATERING_INHOUSE', 650.00, 'plate', '996331', 5.00,
 '6 starters (3 non-veg), 4 main course (2 non-veg), 3 desserts, live counter', TRUE),

-- Decoration Services
('SRV_201', 'Stage Decoration - Basic', 'DECORATION', 10000.00, 'set', '9983', 18.00,
 'Floral decoration with backdrop, 2 chairs, lighting', TRUE),

('SRV_202', 'Stage Decoration - Premium', 'DECORATION', 25000.00, 'set', '9983', 18.00,
 'Designer floral decoration, custom backdrop, throne chairs, special lighting', TRUE),

('SRV_203', 'Hall Decoration - Basic', 'DECORATION', 15000.00, 'set', '9983', 18.00,
 'Entrance arch, table centerpieces, ceiling drapes', TRUE),

('SRV_204', 'Hall Decoration - Premium', 'DECORATION', 35000.00, 'set', '9983', 18.00,
 'Complete hall transformation with theme, entrance, stage, ceiling, walls', TRUE),

-- AV Equipment
('SRV_301', 'Sound System - Basic', 'AV_EQUIPMENT', 5000.00, 'day', '9972', 18.00,
 '2 speakers, 1 mixer, 2 wireless mics', TRUE),

('SRV_302', 'Sound System - Premium', 'AV_EQUIPMENT', 12000.00, 'day', '9972', 18.00,
 '4 speakers, subwoofer, mixer, 4 wireless mics, DJ console', TRUE),

('SRV_303', 'LED Screen - Small (6x8 ft)', 'AV_EQUIPMENT', 8000.00, 'day', '9972', 18.00,
 'LED screen with video playback system', TRUE),

('SRV_304', 'LED Screen - Large (10x12 ft)', 'AV_EQUIPMENT', 15000.00, 'day', '9972', 18.00,
 'Large LED screen with HD video playback', TRUE),

('SRV_305', 'Projector with Screen', 'AV_EQUIPMENT', 5000.00, 'day', '9972', 18.00,
 'HD projector with 10x8 ft screen', TRUE),

-- Photography & Videography
('SRV_401', 'Photography - Basic Package', 'PHOTOGRAPHY', 15000.00, 'day', '9983', 18.00,
 '1 photographer, 300 edited photos, online album', TRUE),

('SRV_402', 'Photography - Premium Package', 'PHOTOGRAPHY', 35000.00, 'day', '9983', 18.00,
 '2 photographers, 500 edited photos, printed album, online album', TRUE),

('SRV_403', 'Videography - Basic Package', 'PHOTOGRAPHY', 20000.00, 'day', '9983', 18.00,
 '1 videographer, 2-hour edited video, highlights reel', TRUE),

('SRV_404', 'Videography - Premium Package', 'PHOTOGRAPHY', 45000.00, 'day', '9983', 18.00,
 '2 videographers, cinematic video, drone shots, same-day edit', TRUE),

-- DJ & Entertainment
('SRV_501', 'DJ Services - 4 Hours', 'DJ_MUSIC', 10000.00, 'set', '9997', 18.00,
 'Professional DJ with music system for 4 hours', TRUE),

('SRV_502', 'DJ Services - Full Night', 'DJ_MUSIC', 18000.00, 'set', '9997', 18.00,
 'Professional DJ with music system for 8 hours', TRUE),

('SRV_503', 'Live Band - 2 Hours', 'DJ_MUSIC', 25000.00, 'set', '9997', 18.00,
 '4-piece live band for 2 hours', TRUE),

-- Parking
('SRV_601', 'Valet Parking Service', 'PARKING', 5000.00, 'day', '9972', 18.00,
 'Professional valet parking for 100 vehicles', TRUE),

-- Additional Services
('SRV_701', 'Generator Backup', 'OTHER', 8000.00, 'day', '9972', 18.00,
 '100 KVA generator for power backup', TRUE),

('SRV_702', 'Security Services', 'SECURITY', 3000.00, 'day', '9972', 18.00,
 '4 security guards for event duration', TRUE)

ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- UPDATE STATE CODES FOR EXISTING CUSTOMERS
-- ============================================

-- Karnataka
UPDATE customers SET state_code = '29' WHERE state = 'Karnataka' OR state LIKE '%karnataka%';

-- Common states (add more as needed)
UPDATE customers SET state_code = '27' WHERE state = 'Maharashtra' OR state LIKE '%maharashtra%';
UPDATE customers SET state_code = '33' WHERE state = 'Tamil Nadu' OR state LIKE '%tamil%';
UPDATE customers SET state_code = '32' WHERE state = 'Kerala' OR state LIKE '%kerala%';
UPDATE customers SET state_code = '36' WHERE state = 'Telangana' OR state LIKE '%telangana%';
UPDATE customers SET state_code = '29' WHERE state = 'Karnataka' OR state LIKE '%karnataka%';
UPDATE customers SET state_code = '07' WHERE state = 'Delhi' OR state LIKE '%delhi%';
UPDATE customers SET state_code = '09' WHERE state = 'Uttar Pradesh' OR state LIKE '%uttar%';
UPDATE customers SET state_code = '24' WHERE state = 'Gujarat' OR state LIKE '%gujarat%';
UPDATE customers SET state_code = '10' WHERE state = 'Bihar' OR state LIKE '%bihar%';
UPDATE customers SET state_code = '19' WHERE state = 'West Bengal' OR state LIKE '%bengal%';

-- Set default state code for NULL values (Karnataka)
UPDATE customers SET state_code = '29' WHERE state_code IS NULL OR state_code = '';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT '✅ Business Configuration Inserted' AS Status;
SELECT * FROM business_config LIMIT 1;

SELECT '✅ Service Catalog Inserted' AS Status;
SELECT COUNT(*) AS total_services, category, COUNT(*) AS count 
FROM service_catalog 
GROUP BY category;

SELECT '✅ GST Tax Rates Available' AS Status;
SELECT * FROM gst_tax_rates WHERE is_active = TRUE;

SELECT '✅ Customer State Codes Updated' AS Status;
SELECT state, state_code, COUNT(*) AS customer_count 
FROM customers 
GROUP BY state, state_code;

SELECT '🎉 GST Compliance Data Seeded Successfully!' AS Status;
