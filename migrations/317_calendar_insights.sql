-- Calendar insights storage for cultural calendar overlays.
-- Runtime browsing can use generated data first, then this cache/import layer as providers mature.

CREATE TABLE IF NOT EXISTS calendar_days (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  date DATE NOT NULL,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NULL,
  country_code CHAR(2) DEFAULT 'IN',
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  timezone VARCHAR(80) DEFAULT 'Asia/Kolkata',

  moon_phase_name VARCHAR(80) NULL,
  moon_phase_key VARCHAR(40) NULL,
  moon_age DECIMAL(5,2) NULL,
  moon_illumination DECIMAL(5,2) NULL,
  is_full_moon BOOLEAN DEFAULT FALSE,
  is_new_moon BOOLEAN DEFAULT FALSE,

  hijri_day INT NULL,
  hijri_month INT NULL,
  hijri_month_name VARCHAR(80) NULL,
  hijri_year INT NULL,
  hijri_adjustment_days INT DEFAULT 0,
  hijri_confidence VARCHAR(40) DEFAULT 'calculated',

  hindu_tithi VARCHAR(120) NULL,
  hindu_paksha VARCHAR(80) NULL,
  hindu_nakshatra VARCHAR(120) NULL,
  hindu_yoga VARCHAR(120) NULL,
  hindu_karana VARCHAR(120) NULL,
  hindu_month VARCHAR(120) NULL,
  hindu_samvat VARCHAR(120) NULL,
  panchang_source VARCHAR(160) NULL,
  panchang_confidence VARCHAR(40) DEFAULT 'imported',

  demand_score INT DEFAULT 0,
  demand_label VARCHAR(120) NULL,
  notes TEXT NULL,
  source_version VARCHAR(120) NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_calendar_days_location (
    tenant_id,
    date,
    city,
    timezone
  ),
  KEY idx_calendar_days_date_location (tenant_id, date, city, timezone)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  date DATE NOT NULL,
  city VARCHAR(120) NULL,
  region VARCHAR(120) NULL,
  country_code CHAR(2) DEFAULT 'IN',

  calendar_type VARCHAR(60) NOT NULL,
  community VARCHAR(80) NULL,
  title VARCHAR(180) NOT NULL,
  local_title VARCHAR(180) NULL,
  event_type VARCHAR(80) NULL,
  importance INT DEFAULT 1,
  confidence VARCHAR(40) DEFAULT 'imported',
  is_public_holiday BOOLEAN DEFAULT FALSE,
  is_optional_holiday BOOLEAN DEFAULT FALSE,
  source_name VARCHAR(160) NULL,
  source_url VARCHAR(500) NULL,
  notes TEXT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_calendar_events_date_location (tenant_id, date, city, calendar_type)
);

CREATE TABLE IF NOT EXISTS hall_calendar_preferences (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  hall_id INT NOT NULL DEFAULT 0,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  timezone VARCHAR(80) DEFAULT 'Asia/Kolkata',
  default_calendar_mode VARCHAR(40) DEFAULT 'bookings',
  enabled_layers JSON DEFAULT ('["moon","hijri","hindu","christian","indian_public_holiday"]'),
  hijri_adjustment_days INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_hall_calendar_preferences_scope (tenant_id, hall_id, city, timezone),
  KEY idx_hall_calendar_preferences_hall (tenant_id, hall_id)
);

CREATE TABLE IF NOT EXISTS calendar_source_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  provider VARCHAR(120) NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  year INT NULL,
  month INT NULL,
  city VARCHAR(120) NULL,
  status VARCHAR(40) NOT NULL,
  records_imported INT DEFAULT 0,
  error_message TEXT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,

  KEY idx_calendar_source_runs_lookup (tenant_id, provider, source_type, year, month, city)
);
