/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE additional_payments (
  id int NOT NULL AUTO_INCREMENT,
  booking_id int NOT NULL,
  invoice_id int DEFAULT NULL,
  amount decimal(15,2) NOT NULL,
  payment_date date NOT NULL,
  payment_mode enum('cash','upi','card','bank_transfer','other') NOT NULL,
  category enum('complimentary','discount_adjustment','additional_service','other') DEFAULT 'other',
  `description` text,
  show_in_gst_reports tinyint(1) DEFAULT '0',
  is_official tinyint(1) DEFAULT '0' COMMENT 'TRUE if linked to official invoice',
  created_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY invoice_id (invoice_id),
  KEY idx_booking_additional (booking_id),
  KEY idx_gst_reportable (show_in_gst_reports,is_official),
  CONSTRAINT additional_payments_ibfk_1 FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT additional_payments_ibfk_2 FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE audit_logs (
  id int NOT NULL AUTO_INCREMENT,
  user_id int DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  entity_type varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  entity_id int NOT NULL,
  old_values json DEFAULT NULL,
  new_values json DEFAULT NULL,
  ip_address varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user (user_id),
  KEY idx_entity (entity_type,entity_id),
  KEY idx_created_at (created_at),
  CONSTRAINT audit_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `booking_details` AS SELECT 
 1 AS booking_id,
 1 AS event_date,
 1 AS event_type,
 1 AS guest_count,
 1 AS total_amount,
 1 AS advance_amount,
 1 AS balance_amount,
 1 AS payment_mode,
 1 AS booking_status,
 1 AS booking_notes,
 1 AS booking_created_at,
 1 AS customer_id,
 1 AS customer_name,
 1 AS customer_phone,
 1 AS customer_email,
 1 AS customer_city,
 1 AS hall_id,
 1 AS hall_name,
 1 AS hall_capacity,
 1 AS hall_location,
 1 AS package_id,
 1 AS package_name,
 1 AS package_price,
 1 AS created_by_name*/;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE booking_private_notes (
  id int NOT NULL AUTO_INCREMENT,
  booking_id int NOT NULL,
  note_type enum('payment','adjustment','complimentary','general') DEFAULT 'general',
  amount decimal(15,2) DEFAULT '0.00',
  payment_mode enum('cash','upi','card','bank_transfer','other') DEFAULT NULL,
  `description` text,
  show_in_gst_reports tinyint(1) DEFAULT '0',
  is_private tinyint(1) DEFAULT '1',
  created_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_private (booking_id,is_private),
  CONSTRAINT booking_private_notes_ibfk_1 FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE bookings (
  id int NOT NULL AUTO_INCREMENT,
  customer_id int NOT NULL,
  hall_id int NOT NULL,
  package_id int DEFAULT NULL,
  event_date date NOT NULL,
  time_slot enum('morning','afternoon','night') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  slot_id int DEFAULT NULL,
  event_type enum('wedding','reception','engagement','birthday','corporate','other') COLLATE utf8mb4_unicode_ci DEFAULT 'wedding',
  guest_count int DEFAULT NULL,
  total_amount decimal(10,2) NOT NULL DEFAULT '0.00',
  gst_amount decimal(10,2) DEFAULT '0.00',
  grand_total decimal(10,2) DEFAULT '0.00',
  advance_amount decimal(10,2) DEFAULT '0.00',
  balance_amount decimal(10,2) DEFAULT '0.00',
  invoice_generated tinyint(1) DEFAULT '0',
  invoice_id int DEFAULT NULL,
  payment_mode enum('cash','card','upi','bank_transfer','cheque') COLLATE utf8mb4_unicode_ci DEFAULT 'cash',
  `status` enum('pending','confirmed','cancelled','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  payment_status enum('unpaid','partial','paid','refunded') COLLATE utf8mb4_unicode_ci DEFAULT 'unpaid',
  notes text COLLATE utf8mb4_unicode_ci,
  created_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  agreed_amount decimal(15,2) DEFAULT '0.00',
  invoiced_amount decimal(15,2) DEFAULT '0.00',
  additional_amount decimal(15,2) DEFAULT '0.00' COMMENT 'Undisclosed/private amount',
  PRIMARY KEY (id),
  KEY created_by (created_by),
  KEY idx_customer (customer_id),
  KEY idx_hall (hall_id),
  KEY idx_package (package_id),
  KEY idx_event_date (event_date),
  KEY idx_status (`status`),
  KEY idx_created_at (created_at),
  KEY idx_booking_date_status (event_date,`status`),
  KEY idx_slot_id (slot_id),
  KEY idx_payment_status (payment_status),
  CONSTRAINT bookings_ibfk_1 FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT bookings_ibfk_2 FOREIGN KEY (hall_id) REFERENCES halls (id) ON DELETE RESTRICT,
  CONSTRAINT bookings_ibfk_3 FOREIGN KEY (package_id) REFERENCES packages (id) ON DELETE SET NULL,
  CONSTRAINT bookings_ibfk_4 FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_slot FOREIGN KEY (slot_id) REFERENCES slots (id) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE business_config (
  id int NOT NULL AUTO_INCREMENT,
  business_name varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  gstin varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  pan varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  state varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  state_code varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  address text COLLATE utf8mb4_unicode_ci NOT NULL,
  city varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  pincode varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  phone varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  email varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  billing_mode enum('standard','composite_scheme','optimized') COLLATE utf8mb4_unicode_ci DEFAULT 'standard',
  composite_scheme_enabled tinyint(1) DEFAULT '0',
  website varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_type enum('hall_rental','hotel_with_hall','banquet','resort') COLLATE utf8mb4_unicode_ci DEFAULT 'hall_rental',
  services_offered json DEFAULT NULL,
  pricing_model enum('package','itemized','hourly') COLLATE utf8mb4_unicode_ci DEFAULT 'package',
  is_gst_registered tinyint(1) DEFAULT '1',
  annual_turnover decimal(15,2) DEFAULT '0.00',
  gst_registration_date date DEFAULT NULL,
  composition_scheme tinyint(1) DEFAULT '0',
  advance_percentage int DEFAULT '25',
  allow_multiple_payments tinyint(1) DEFAULT '1',
  cancellation_policy enum('tiered','full_refund','no_refund','custom') COLLATE utf8mb4_unicode_ci DEFAULT 'tiered',
  cancellation_rules json DEFAULT NULL,
  bank_name varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  bank_account_name varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  bank_account_number varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  bank_ifsc varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  bank_branch varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  logo_url varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  invoice_prefix varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'INV',
  receipt_prefix varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'RV',
  credit_note_prefix varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'CN',
  debit_note_prefix varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'DN',
  invoice_counter int DEFAULT '0',
  receipt_counter int DEFAULT '0',
  credit_note_counter int DEFAULT '0',
  debit_note_counter int DEFAULT '0',
  financial_year_start int DEFAULT '4',
  is_active tinyint(1) DEFAULT '1',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  enable_tax_optimization tinyint(1) DEFAULT '1',
  PRIMARY KEY (id),
  UNIQUE KEY gstin (gstin),
  KEY idx_gstin (gstin),
  KEY idx_state (state_code)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE customers (
  id int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  phone varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  email varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  gstin varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  pan varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  customer_type enum('individual','business') COLLATE utf8mb4_unicode_ci DEFAULT 'individual',
  city varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  state varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  state_code varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  pincode varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  address text COLLATE utf8mb4_unicode_ci,
  event_type enum('wedding','reception','engagement','birthday','corporate','other') COLLATE utf8mb4_unicode_ci DEFAULT 'wedding',
  notes text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_phone (phone),
  KEY idx_name (`name`),
  KEY idx_phone (phone),
  KEY idx_email (email),
  KEY idx_city (city),
  KEY idx_status (`status`),
  KEY idx_customer_status (`status`,created_at),
  KEY idx_gstin (gstin)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `dashboard_stats` AS SELECT 
 1 AS confirmed_bookings,
 1 AS pending_bookings,
 1 AS todays_bookings,
 1 AS active_customers,
 1 AS active_halls,
 1 AS monthly_revenue,
 1 AS monthly_advance*/;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE discount_templates (
  id int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `description` text,
  discount_type enum('percentage','fixed_amount','complimentary') NOT NULL,
  discount_value decimal(15,2) NOT NULL,
  reason_template varchar(500) DEFAULT NULL,
  is_active tinyint(1) DEFAULT '1',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE gst_exports (
  id int NOT NULL AUTO_INCREMENT,
  export_type enum('monthly','quarterly','annual','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `month` int DEFAULT NULL,
  `year` int NOT NULL,
  from_date date DEFAULT NULL,
  to_date date DEFAULT NULL,
  total_invoices int DEFAULT '0',
  total_taxable_value decimal(15,2) DEFAULT '0.00',
  total_gst_collected decimal(15,2) DEFAULT '0.00',
  total_credit_notes int DEFAULT '0',
  total_gst_reversed decimal(15,2) DEFAULT '0.00',
  filename varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  file_path varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  file_size int DEFAULT NULL,
  download_count int DEFAULT '0',
  `status` enum('generating','ready','downloaded','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'generating',
  expires_at timestamp NULL DEFAULT NULL,
  generated_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY generated_by (generated_by),
  KEY idx_month_year (`month`,`year`),
  KEY idx_status (`status`),
  KEY idx_expires_at (expires_at),
  CONSTRAINT gst_exports_ibfk_1 FOREIGN KEY (generated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE gst_report_preferences (
  id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  include_advance_receipts tinyint(1) DEFAULT '1',
  include_non_taxable tinyint(1) DEFAULT '0',
  include_security_deposits tinyint(1) DEFAULT '0',
  b2c_threshold_only tinyint(1) DEFAULT '0' COMMENT 'Only B2C > 2.5L for GSTR-1',
  exclude_complimentary tinyint(1) DEFAULT '1',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_pref (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE gst_tax_rates (
  id int NOT NULL AUTO_INCREMENT,
  service_category varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  sac_code varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  gst_rate decimal(5,2) NOT NULL,
  effective_from date NOT NULL,
  effective_to date DEFAULT NULL,
  is_active tinyint(1) DEFAULT '1',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sac_code (sac_code),
  KEY idx_active (is_active)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE halls (
  id int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  capacity int NOT NULL,
  base_price decimal(10,2) NOT NULL DEFAULT '0.00',
  `description` text COLLATE utf8mb4_unicode_ci,
  location varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  amenities text COLLATE utf8mb4_unicode_ci,
  images text COLLATE utf8mb4_unicode_ci,
  features text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive','maintenance') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_name (`name`),
  KEY idx_status (`status`),
  KEY idx_capacity (capacity),
  KEY idx_hall_status (`status`,capacity)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE invoice_line_items (
  id int NOT NULL AUTO_INCREMENT,
  invoice_id int NOT NULL,
  line_number int NOT NULL,
  service_id int DEFAULT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  sac_hsn varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  quantity decimal(10,2) NOT NULL DEFAULT '1.00',
  unit varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'nos',
  unit_price decimal(15,2) NOT NULL,
  discount_percentage decimal(5,2) DEFAULT '0.00',
  line_subtotal decimal(15,2) NOT NULL,
  discount_amount decimal(15,2) DEFAULT '0.00',
  taxable_value decimal(15,2) NOT NULL,
  gst_rate decimal(5,2) NOT NULL,
  cgst_rate decimal(5,2) DEFAULT '0.00',
  sgst_rate decimal(5,2) DEFAULT '0.00',
  igst_rate decimal(5,2) DEFAULT '0.00',
  cess_rate decimal(5,2) DEFAULT '0.00',
  cgst_amount decimal(15,2) DEFAULT '0.00',
  sgst_amount decimal(15,2) DEFAULT '0.00',
  igst_amount decimal(15,2) DEFAULT '0.00',
  cess_amount decimal(15,2) DEFAULT '0.00',
  total_tax decimal(15,2) NOT NULL DEFAULT '0.00',
  total_amount decimal(15,2) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  charge_category varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  show_in_gst_reports tinyint(1) DEFAULT '1',
  is_refundable tinyint(1) DEFAULT '0',
  PRIMARY KEY (id),
  KEY idx_invoice (invoice_id),
  KEY idx_service (service_id),
  CONSTRAINT invoice_line_items_ibfk_1 FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT invoice_line_items_ibfk_2 FOREIGN KEY (service_id) REFERENCES service_catalog (id) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `invoice_summary` AS SELECT 
 1 AS id,
 1 AS invoice_number,
 1 AS invoice_type,
 1 AS invoice_date,
 1 AS due_date,
 1 AS customer_name,
 1 AS customer_gstin,
 1 AS supply_type,
 1 AS subtotal,
 1 AS discount_amount,
 1 AS taxable_amount,
 1 AS cgst_amount,
 1 AS sgst_amount,
 1 AS igst_amount,
 1 AS total_tax,
 1 AS grand_total,
 1 AS amount_paid,
 1 AS balance_amount,
 1 AS payment_status,
 1 AS status,
 1 AS created_at,
 1 AS booking_id,
 1 AS event_date,
 1 AS event_type,
 1 AS customer_id,
 1 AS customer_email,
 1 AS customer_phone*/;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE invoices (
  id int NOT NULL AUTO_INCREMENT,
  invoice_number varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  invoice_type enum('tax_invoice','receipt_voucher','credit_note','debit_note') COLLATE utf8mb4_unicode_ci NOT NULL,
  invoice_date date NOT NULL,
  due_date date DEFAULT NULL,
  booking_id int NOT NULL,
  customer_id int NOT NULL,
  original_invoice_id int DEFAULT NULL,
  customer_name varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_gstin varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  customer_pan varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  customer_address text COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_city varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_state varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_state_code varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_pincode varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_phone varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  customer_email varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_name varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Hall Sync',
  business_gstin varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_address text COLLATE utf8mb4_unicode_ci,
  business_city varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_state varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_state_code varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_pincode varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_phone varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  business_email varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  place_of_supply varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  place_of_supply_code varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  supply_type enum('intrastate','interstate') COLLATE utf8mb4_unicode_ci NOT NULL,
  is_reverse_charge tinyint(1) DEFAULT '0',
  is_export tinyint(1) DEFAULT '0',
  subtotal decimal(15,2) NOT NULL DEFAULT '0.00',
  discount_amount decimal(15,2) DEFAULT '0.00',
  discount_percentage decimal(5,2) DEFAULT '0.00',
  taxable_amount decimal(15,2) NOT NULL DEFAULT '0.00',
  cgst_amount decimal(15,2) DEFAULT '0.00',
  sgst_amount decimal(15,2) DEFAULT '0.00',
  igst_amount decimal(15,2) DEFAULT '0.00',
  cess_amount decimal(15,2) DEFAULT '0.00',
  total_tax decimal(15,2) NOT NULL DEFAULT '0.00',
  round_off decimal(10,2) DEFAULT '0.00',
  grand_total decimal(15,2) NOT NULL DEFAULT '0.00',
  amount_paid decimal(15,2) DEFAULT '0.00',
  balance_amount decimal(15,2) DEFAULT '0.00',
  payment_status enum('unpaid','partial','paid','refunded') COLLATE utf8mb4_unicode_ci DEFAULT 'unpaid',
  tax_calculation_logic text COLLATE utf8mb4_unicode_ci,
  notes text COLLATE utf8mb4_unicode_ci,
  terms_and_conditions text COLLATE utf8mb4_unicode_ci,
  payment_instructions text COLLATE utf8mb4_unicode_ci,
  terms_conditions text COLLATE utf8mb4_unicode_ci,
  `status` enum('draft','issued','sent','paid','partially_paid','cancelled','void') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  issued_at timestamp NULL DEFAULT NULL,
  sent_at timestamp NULL DEFAULT NULL,
  paid_at timestamp NULL DEFAULT NULL,
  cancelled_at timestamp NULL DEFAULT NULL,
  cancellation_reason text COLLATE utf8mb4_unicode_ci,
  irn varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ack_no varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ack_date timestamp NULL DEFAULT NULL,
  qr_code_data text COLLATE utf8mb4_unicode_ci,
  pdf_url varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  pdf_generated_at timestamp NULL DEFAULT NULL,
  created_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reference_number varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  billing_strategy varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'standard',
  tax_optimization_applied tinyint(1) DEFAULT '0',
  effective_gst_rate decimal(5,2) DEFAULT '0.00',
  tax_savings decimal(15,2) DEFAULT '0.00',
  is_partial_invoice tinyint(1) DEFAULT '0',
  parent_invoice_id int DEFAULT NULL,
  invoice_sequence int DEFAULT '1',
  discount_reason varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  complimentary_value decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (id),
  UNIQUE KEY invoice_no (invoice_number),
  KEY original_invoice_id (original_invoice_id),
  KEY generated_by (created_by),
  KEY idx_invoice_no (invoice_number),
  KEY idx_invoice_type (invoice_type),
  KEY idx_invoice_date (invoice_date),
  KEY idx_booking (booking_id),
  KEY idx_customer (customer_id),
  KEY idx_status (`status`),
  KEY idx_gstin (customer_gstin),
  KEY idx_financial_year (invoice_date,invoice_type),
  CONSTRAINT invoices_ibfk_1 FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE RESTRICT,
  CONSTRAINT invoices_ibfk_2 FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT invoices_ibfk_3 FOREIGN KEY (original_invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
  CONSTRAINT invoices_ibfk_4 FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `monthly_gst_summary` AS SELECT 
 1 AS invoice_year,
 1 AS invoice_month,
 1 AS invoice_type,
 1 AS supply_type,
 1 AS invoice_count,
 1 AS total_taxable,
 1 AS total_cgst,
 1 AS total_sgst,
 1 AS total_igst,
 1 AS total_cess,
 1 AS total_tax_amount,
 1 AS total_amount*/;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE packages (
  id int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  base_price decimal(10,2) NOT NULL DEFAULT '0.00',
  `description` text COLLATE utf8mb4_unicode_ci,
  inclusions text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_name (`name`),
  KEY idx_status (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE payment_receipts (
  id int NOT NULL AUTO_INCREMENT,
  payment_id int NOT NULL,
  invoice_id int NOT NULL,
  amount decimal(15,2) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment (payment_id),
  KEY idx_invoice (invoice_id),
  CONSTRAINT payment_receipts_ibfk_1 FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE,
  CONSTRAINT payment_receipts_ibfk_2 FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE payment_transactions (
  id int NOT NULL AUTO_INCREMENT,
  payment_date date NOT NULL,
  amount decimal(15,2) NOT NULL,
  payment_mode enum('cash','card','upi','netbanking','cheque','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  transaction_reference varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  notes text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_date (payment_date),
  KEY idx_payment_mode (payment_mode)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE payments (
  id int NOT NULL AUTO_INCREMENT,
  booking_id int NOT NULL,
  amount decimal(10,2) NOT NULL,
  payment_mode enum('cash','card','upi','bank_transfer','cheque') COLLATE utf8mb4_unicode_ci DEFAULT 'cash',
  payment_type enum('advance','balance','full','refund') COLLATE utf8mb4_unicode_ci DEFAULT 'advance',
  transaction_id varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  payment_date date NOT NULL,
  notes text COLLATE utf8mb4_unicode_ci,
  received_by int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY received_by (received_by),
  KEY idx_booking (booking_id),
  KEY idx_payment_date (payment_date),
  KEY idx_payment_type (payment_type),
  CONSTRAINT payments_ibfk_1 FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT payments_ibfk_2 FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `pending_balance_report` AS SELECT 
 1 AS id,
 1 AS invoice_number,
 1 AS invoice_date,
 1 AS due_date,
 1 AS customer_name,
 1 AS customer_phone,
 1 AS customer_email,
 1 AS grand_total,
 1 AS amount_paid,
 1 AS balance_amount,
 1 AS payment_status,
 1 AS days_overdue,
 1 AS aging_bucket*/;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE service_catalog (
  id int NOT NULL AUTO_INCREMENT,
  service_code varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  category enum('VENUE_RENTAL','CATERING_INHOUSE','CATERING_EXTERNAL','DECORATION','AV_EQUIPMENT','PARKING','ACCOMMODATION','PHOTOGRAPHY','DJ_MUSIC','SECURITY','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL,
  base_price decimal(10,2) NOT NULL DEFAULT '0.00',
  unit enum('day','hour','plate','person','set','nos','sqft') COLLATE utf8mb4_unicode_ci DEFAULT 'nos',
  min_quantity int DEFAULT '1',
  max_quantity int DEFAULT NULL,
  sac_code varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  hsn_code varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  gst_rate decimal(5,2) NOT NULL,
  is_taxable tinyint(1) DEFAULT '1',
  tax_exemption_reason varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  inclusions text COLLATE utf8mb4_unicode_ci,
  terms text COLLATE utf8mb4_unicode_ci,
  is_active tinyint(1) DEFAULT '1',
  display_order int DEFAULT '0',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  charge_category enum('venue_rental','event_services','maintenance','service_charge','security_deposit','advance','complimentary','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  is_refundable tinyint(1) DEFAULT '0',
  show_in_gst_reports tinyint(1) DEFAULT '1',
  PRIMARY KEY (id),
  UNIQUE KEY service_code (service_code),
  KEY idx_category (category),
  KEY idx_active (is_active),
  KEY idx_sac_code (sac_code)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE slots (
  id int NOT NULL AUTO_INCREMENT,
  hall_id int NOT NULL,
  slot_date date NOT NULL,
  slot_type enum('morning','afternoon','night') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'afternoon',
  `status` enum('available','booked','blocked') COLLATE utf8mb4_unicode_ci DEFAULT 'available',
  booking_id int DEFAULT NULL,
  notes text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_hall_date_slot (hall_id,slot_date,slot_type),
  KEY idx_hall_date (hall_id,slot_date),
  KEY idx_status (`status`),
  KEY idx_booking (booking_id),
  CONSTRAINT slots_ibfk_1 FOREIGN KEY (hall_id) REFERENCES halls (id) ON DELETE CASCADE,
  CONSTRAINT slots_ibfk_2 FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE users (
  id int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  email varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','staff','manager') COLLATE utf8mb4_unicode_ci DEFAULT 'staff',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  KEY idx_email (email),
  KEY idx_status (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50001 DROP VIEW IF EXISTS booking_details*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=root@localhost SQL SECURITY DEFINER */
/*!50001 VIEW booking_details AS select b.id AS booking_id,b.event_date AS event_date,b.event_type AS event_type,b.guest_count AS guest_count,b.total_amount AS total_amount,b.advance_amount AS advance_amount,b.balance_amount AS balance_amount,b.payment_mode AS payment_mode,b.`status` AS booking_status,b.notes AS booking_notes,b.created_at AS booking_created_at,c.id AS customer_id,c.`name` AS customer_name,c.phone AS customer_phone,c.email AS customer_email,c.city AS customer_city,h.id AS hall_id,h.`name` AS hall_name,h.capacity AS hall_capacity,h.location AS hall_location,p.id AS package_id,p.`name` AS package_name,p.base_price AS package_price,u.`name` AS created_by_name from ((((bookings b left join customers c on((b.customer_id = c.id))) left join halls h on((b.hall_id = h.id))) left join packages p on((b.package_id = p.id))) left join users u on((b.created_by = u.id))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS dashboard_stats*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=root@localhost SQL SECURITY DEFINER */
/*!50001 VIEW dashboard_stats AS select (select count(0) from bookings where (bookings.`status` = 'confirmed')) AS confirmed_bookings,(select count(0) from bookings where (bookings.`status` = 'pending')) AS pending_bookings,(select count(0) from bookings where (bookings.event_date = curdate())) AS todays_bookings,(select count(0) from customers where (customers.`status` = 'active')) AS active_customers,(select count(0) from halls where (halls.`status` = 'active')) AS active_halls,(select coalesce(sum(bookings.total_amount),0) from bookings where ((month(bookings.created_at) = month(curdate())) and (year(bookings.created_at) = year(curdate())))) AS monthly_revenue,(select coalesce(sum(bookings.advance_amount),0) from bookings where ((month(bookings.created_at) = month(curdate())) and (year(bookings.created_at) = year(curdate())))) AS monthly_advance */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS invoice_summary*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=root@localhost SQL SECURITY DEFINER */
/*!50001 VIEW invoice_summary AS select i.id AS id,i.invoice_number AS invoice_number,i.invoice_type AS invoice_type,i.invoice_date AS invoice_date,i.due_date AS due_date,i.customer_name AS customer_name,i.customer_gstin AS customer_gstin,i.supply_type AS supply_type,i.subtotal AS subtotal,i.discount_amount AS discount_amount,i.taxable_amount AS taxable_amount,i.cgst_amount AS cgst_amount,i.sgst_amount AS sgst_amount,i.igst_amount AS igst_amount,i.total_tax AS total_tax,i.grand_total AS grand_total,i.amount_paid AS amount_paid,i.balance_amount AS balance_amount,i.payment_status AS payment_status,i.`status` AS `status`,i.created_at AS created_at,b.id AS booking_id,b.event_date AS event_date,b.event_type AS event_type,c.id AS customer_id,c.email AS customer_email,c.phone AS customer_phone from ((invoices i left join bookings b on((i.booking_id = b.id))) left join customers c on((i.customer_id = c.id))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS monthly_gst_summary*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=root@localhost SQL SECURITY DEFINER */
/*!50001 VIEW monthly_gst_summary AS select year(invoices.invoice_date) AS invoice_year,month(invoices.invoice_date) AS invoice_month,invoices.invoice_type AS invoice_type,invoices.supply_type AS supply_type,count(0) AS invoice_count,sum(invoices.taxable_amount) AS total_taxable,sum(invoices.cgst_amount) AS total_cgst,sum(invoices.sgst_amount) AS total_sgst,sum(invoices.igst_amount) AS total_igst,sum(invoices.cess_amount) AS total_cess,sum(invoices.total_tax) AS total_tax_amount,sum(invoices.grand_total) AS total_amount from invoices where (invoices.`status` <> 'cancelled') group by year(invoices.invoice_date),month(invoices.invoice_date),invoices.invoice_type,invoices.supply_type order by year(invoices.invoice_date) desc,month(invoices.invoice_date) desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS pending_balance_report*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=root@localhost SQL SECURITY DEFINER */
/*!50001 VIEW pending_balance_report AS select i.id AS id,i.invoice_number AS invoice_number,i.invoice_date AS invoice_date,i.due_date AS due_date,i.customer_name AS customer_name,i.customer_phone AS customer_phone,i.customer_email AS customer_email,i.grand_total AS grand_total,i.amount_paid AS amount_paid,i.balance_amount AS balance_amount,i.payment_status AS payment_status,(to_days(curdate()) - to_days(i.due_date)) AS days_overdue,(case when ((to_days(curdate()) - to_days(i.due_date)) <= 0) then 'Not Due' when ((to_days(curdate()) - to_days(i.due_date)) <= 30) then '1-30 Days' when ((to_days(curdate()) - to_days(i.due_date)) <= 60) then '31-60 Days' when ((to_days(curdate()) - to_days(i.due_date)) <= 90) then '61-90 Days' else '90+ Days' end) AS aging_bucket from invoices i where ((i.balance_amount > 0) and (i.`status` <> 'cancelled')) order by i.due_date */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
INSERT  IGNORE INTO bookings VALUES (1,1,1,1,'2025-12-28',NULL,NULL,'wedding',350,150000.00,0.00,0.00,75000.00,75000.00,0,NULL,'card','pending','unpaid','Created via Postman',NULL,'2025-11-11 20:18:59','2025-11-11 20:18:59',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (2,2,1,1,'2025-11-20','afternoon',NULL,'wedding',NULL,85000.00,0.00,0.00,42500.00,42500.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-16 12:08:44','2025-11-16 12:08:44',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (3,2,1,1,'2025-11-17','afternoon',NULL,'wedding',NULL,85000.00,0.00,0.00,42500.00,42500.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-16 12:12:35','2025-11-16 12:12:35',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (4,1,1,1,'2025-11-16','morning',1,'wedding',NULL,85000.00,0.00,0.00,42500.00,42500.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-16 12:45:35','2025-11-16 12:45:35',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (5,1,1,1,'2025-11-17','afternoon',5,'wedding',NULL,85000.00,0.00,0.00,42500.00,42500.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-16 12:49:37','2025-11-16 12:49:37',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (6,2,1,1,'2025-11-17','night',6,'wedding',NULL,85000.00,0.00,0.00,42500.00,42500.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-16 13:03:06','2025-11-16 13:03:06',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (7,4,1,1,'2025-11-19','night',12,'wedding',NULL,85000.00,0.00,0.00,63750.00,21250.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-16 13:10:12','2025-11-16 13:10:12',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (8,2,1,1,'2025-11-20','night',NULL,'wedding',100,85000.00,0.00,0.00,42500.00,42500.00,0,NULL,'cash','confirmed','unpaid','',NULL,'2025-11-16 17:41:32','2025-11-16 17:41:32',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (9,1,1,1,'2026-01-20','morning',13,'wedding',NULL,85000.00,0.00,0.00,21250.00,63750.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-28 18:58:38','2025-11-28 18:58:38',0.00,0.00,0.00);
INSERT  IGNORE INTO bookings VALUES (10,2,1,1,'2026-01-20','night',15,'wedding',NULL,85000.00,0.00,0.00,40000.00,45000.00,0,NULL,'cash','confirmed','unpaid',NULL,NULL,'2025-11-30 23:09:30','2025-11-30 23:09:30',0.00,0.00,0.00);
INSERT  IGNORE INTO business_config VALUES (1,'Royal Marriage Hall','29ABCDE1234F1Z5','ABCDE1234F','Karnataka','29','123, MG Road, Bangalore','Bangalore','560001','+91-9876543210','info@royalmarriageall.com','standard',0,'www.royalmarriagehall.com','hall_rental','[\"VENUE_RENTAL\", \"CATERING_INHOUSE\", \"DECORATION\", \"AV_EQUIPMENT\", \"PARKING\"]','package',1,5000000.00,'2018-07-01',0,25,1,'tiered','[{\"days_before_event\": 90, \"refund_percentage\": 90}, {\"days_before_event\": 60, \"refund_percentage\": 75}, {\"days_before_event\": 30, \"refund_percentage\": 50}, {\"days_before_event\": 15, \"refund_percentage\": 25}, {\"days_before_event\": 0, \"refund_percentage\": 0}]','HDFC Bank','Royal Marriage Hall','1234567890','HDFC0001234','MG Road Branch, Bangalore',NULL,'INV','RV','CN','DN',12,2,0,0,4,1,'2025-11-19 15:28:55','2025-11-28 19:37:19',1);
INSERT  IGNORE INTO customers VALUES (1,'Test Customer Postman','9999888877','testpostman@example.com',NULL,NULL,'individual','Mumbai','Maharashtra','27','400001','Test Address 123','wedding','Created via Postman','active','2025-10-18 00:42:32','2025-11-19 15:28:55');
INSERT  IGNORE INTO customers VALUES (2,'Inamul Hasan','6656345623','hasaninamul678@mail.com',NULL,NULL,'individual',NULL,NULL,'29',NULL,NULL,'birthday','i need this for my daughters birthday','active','2025-11-16 11:55:13','2025-11-19 15:28:55');
INSERT  IGNORE INTO customers VALUES (3,'inam','6656345679','hasaninamul8@mail.com',NULL,NULL,'individual',NULL,NULL,'29',NULL,NULL,'reception','i need this for my  birthday','active','2025-11-16 12:06:42','2025-11-19 15:28:55');
INSERT  IGNORE INTO customers VALUES (4,'Inamul Hasan','6656345678','hasaninamul678@gmail.com',NULL,NULL,'individual',NULL,NULL,'29',NULL,NULL,'reception','i need this for my daughters birthday','active','2025-11-16 13:09:58','2025-11-19 15:28:55');
INSERT  IGNORE INTO discount_templates VALUES (2,'Early Bird','Advance booking discount','percentage',15.00,'Early booking discount - booked 60+ days in advance',0,'2025-11-25 20:16:06','2025-11-30 23:15:06');
INSERT  IGNORE INTO discount_templates VALUES (3,'Complimentary Upgrade','Free service upgrade','complimentary',0.00,'Complimentary premium services provided',0,'2025-11-25 20:16:06','2025-11-28 23:42:11');
INSERT  IGNORE INTO discount_templates VALUES (4,'Volume Discount','Multiple booking discount','percentage',20.00,'Volume discount for multiple bookings',1,'2025-11-25 20:16:06','2025-11-25 20:16:06');
INSERT  IGNORE INTO discount_templates VALUES (5,'Promotional Offer','Seasonal promotion','percentage',25.00,'Special promotional offer',0,'2025-11-25 20:16:06','2025-11-28 23:48:18');
INSERT  IGNORE INTO discount_templates VALUES (6,'fds','dsad','percentage',12.00,'DSA',0,'2025-11-28 23:43:06','2025-11-28 23:43:19');
INSERT  IGNORE INTO discount_templates VALUES (7,'fdsaf','fdsa','fixed_amount',42313.00,'fdsa',1,'2025-11-28 23:48:13','2025-11-28 23:48:13');
INSERT  IGNORE INTO gst_tax_rates VALUES (1,'Venue Rental','9972','Renting of immovable property (halls, banquet)',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (2,'Restaurant Service','996331','Restaurant and catering services',5.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (3,'Outdoor Catering','996331','Outdoor catering services',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (4,'Decoration','9983','Interior decoration and design services',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (5,'Photography','9983','Photography services',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (6,'DJ/Music','9997','Entertainment services',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (7,'AV Equipment','9972','Rental of audio-visual equipment',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (8,'Parking','9972','Parking services',18.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO gst_tax_rates VALUES (9,'Accommodation','9963','Hotel accommodation services',12.00,'2017-07-01',NULL,1,'2025-11-19 15:27:57','2025-11-19 15:27:57');
INSERT  IGNORE INTO halls VALUES (1,'Test Hall Postman',350,55000.00,'Test hall created via Postman','Test Location, Mumbai','AC, Parking, Catering',NULL,NULL,'active','2025-10-18 00:43:52','2025-10-18 00:43:52');
INSERT  IGNORE INTO invoice_line_items VALUES (1,4,1,1,'Grand Ballroom - Full Day Rental','9972',1.00,'day',50000.00,0.00,50000.00,0.00,50000.00,18.00,0.00,0.00,18.00,0.00,0.00,0.00,9000.00,0.00,9000.00,59000.00,'2025-11-21 06:59:27',NULL,1,0);
INSERT  IGNORE INTO invoice_line_items VALUES (2,4,2,5,'Vegetarian Catering - 300 plates','9963',300.00,'plate',450.00,10.00,135000.00,13500.00,121500.00,5.00,0.00,0.00,5.00,0.00,0.00,0.00,6075.00,0.00,6075.00,127575.00,'2025-11-21 06:59:27',NULL,1,0);
INSERT  IGNORE INTO invoice_line_items VALUES (3,5,1,NULL,'Advance Payment for Booking','9972',1.00,'nos',50000.00,0.00,50000.00,0.00,50000.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,50000.00,'2025-11-21 07:03:39',NULL,1,0);
INSERT  IGNORE INTO invoice_line_items VALUES (4,6,1,NULL,'Venue Charges','998599',1.00,'Service',40000.00,0.00,40000.00,0.00,40000.00,18.00,0.00,0.00,18.00,0.00,0.00,0.00,7200.00,0.00,7200.00,47200.00,'2025-11-28 19:37:19',NULL,1,0);
INSERT  IGNORE INTO invoice_line_items VALUES (5,6,2,NULL,'catrening','998599',1.00,'Service',40000.00,0.00,40000.00,0.00,40000.00,5.00,0.00,0.00,5.00,0.00,0.00,0.00,2000.00,0.00,2000.00,42000.00,'2025-11-28 19:37:19',NULL,1,0);
INSERT  IGNORE INTO invoice_line_items VALUES (6,6,3,NULL,'deposit','998599',1.00,'Service',5000.00,0.00,5000.00,0.00,5000.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,5000.00,'2025-11-28 19:37:19',NULL,1,0);
INSERT  IGNORE INTO invoices VALUES (4,'INV-2025-0009','tax_invoice','2025-11-21','2025-12-21',1,1,NULL,'Test Customer Postman',NULL,NULL,'Test Address 123','Mumbai','Maharashtra','27','400001','9999888877','testpostman@example.com','Royal Marriage Hall','29ABCDE1234F1Z5','123, MG Road, Bangalore','Bangalore','Karnataka','29','560001','+91-9876543210','info@royalmarriageall.com','Maharashtra','27','interstate',0,0,185000.00,13500.00,0.00,171500.00,0.00,0.00,15075.00,0.00,15075.00,0.00,186575.00,50000.00,136575.00,'partial',NULL,'Updated notess',NULL,'Please pay via bank transfer','Payment due within 30 days','partially_paid',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2025-11-21 06:59:27','2025-11-21 07:14:29',NULL,'standard',0,0.00,0.00,0,NULL,1,NULL,0.00);
INSERT  IGNORE INTO invoices VALUES (5,'RV-2025-0002','receipt_voucher','2025-11-21','2025-12-21',1,1,NULL,'Test Customer Postman',NULL,NULL,'Test Address 123','Mumbai','Maharashtra','27','400001','9999888877','testpostman@example.com','Royal Marriage Hall','29ABCDE1234F1Z5','123, MG Road, Bangalore','Bangalore','Karnataka','29','560001','+91-9876543210','info@royalmarriageall.com','Maharashtra','27','interstate',0,0,50000.00,0.00,0.00,50000.00,0.00,0.00,0.00,0.00,0.00,0.00,50000.00,0.00,50000.00,'unpaid',NULL,'Advance payment received',NULL,NULL,NULL,'draft',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2025-11-21 07:03:39','2025-11-21 07:03:39',NULL,'standard',0,0.00,0.00,0,NULL,1,NULL,0.00);
INSERT  IGNORE INTO invoices VALUES (6,'INV-2025-0012','tax_invoice','2025-11-28','2025-12-28',5,1,NULL,'Test Customer Postman',NULL,NULL,'Test Address 123','Mumbai','Maharashtra','27','400001','9999888877','testpostman@example.com','Royal Marriage Hall','29ABCDE1234F1Z5','123, MG Road, Bangalore','Bangalore','Karnataka','29','560001','+91-9876543210','info@royalmarriageall.com','Maharashtra','27','interstate',0,0,85000.00,8500.00,0.00,85000.00,0.00,0.00,9200.00,0.00,9200.00,0.00,94200.00,0.00,94200.00,'unpaid',NULL,NULL,NULL,NULL,NULL,'draft',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2025-11-28 19:37:19','2025-11-28 19:37:19',NULL,'standard',0,0.00,0.00,0,NULL,1,NULL,0.00);
INSERT  IGNORE INTO packages VALUES (1,'Test Package Postman',85000.00,'Test package created via Postman','Decoration, Catering, DJ, Photography','active','2025-10-18 00:44:04','2025-10-18 00:44:04');
INSERT  IGNORE INTO payment_transactions VALUES (1,'2025-11-19',50000.00,'upi','UPI123456789','Partial payment received','2025-11-21 07:04:45','2025-11-21 07:04:45');
INSERT  IGNORE INTO payment_transactions VALUES (3,'2025-11-19',50000.00,'upi','UPI123456789','Partial payment received','2025-11-21 07:14:29','2025-11-21 07:14:29');
INSERT  IGNORE INTO payments VALUES (1,1,75000.00,'cash','balance','1234','2025-11-19','Paid',NULL,'2025-11-19 12:12:22');
INSERT  IGNORE INTO payments VALUES (2,3,42500.00,'cash','balance','1234','2025-11-19','qwer',NULL,'2025-11-19 12:28:44');
INSERT  IGNORE INTO service_catalog VALUES (1,'SRV_001','Grand Ballroom - Full Day','VENUE_RENTAL',50000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'1000 pax capacity, AC hall with stage, green room, and parking',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','venue_rental',0,1);
INSERT  IGNORE INTO service_catalog VALUES (2,'SRV_002','Grand Ballroom - Half Day (Morning)','VENUE_RENTAL',30000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'1000 pax capacity, 6 AM to 2 PM',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','venue_rental',0,1);
INSERT  IGNORE INTO service_catalog VALUES (3,'SRV_003','Grand Ballroom - Half Day (Evening)','VENUE_RENTAL',35000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'1000 pax capacity, 4 PM to 12 AM',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','venue_rental',0,1);
INSERT  IGNORE INTO service_catalog VALUES (4,'SRV_004','Lawn Area - Full Day','VENUE_RENTAL',40000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'500 pax capacity, open lawn with tent setup',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','venue_rental',0,1);
INSERT  IGNORE INTO service_catalog VALUES (5,'SRV_101','Vegetarian Catering - Standard','CATERING_INHOUSE',350.00,'plate',1,NULL,'996331',NULL,5.00,1,NULL,' 4 starters, 3 main course, 2 desserts, welcome drink',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (6,'SRV_102','Vegetarian Catering - Premium','CATERING_INHOUSE',500.00,'plate',1,NULL,'996331',NULL,5.00,1,NULL,'6 starters, 4 main course, 3 desserts, welcome drink, live counter',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (7,'SRV_103','Non-Vegetarian Catering - Standard','CATERING_INHOUSE',450.00,'plate',1,NULL,'996331',NULL,5.00,1,NULL,'4 starters (2 non-veg), 3 main course (1 non-veg), 2 desserts',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (8,'SRV_104','Non-Vegetarian Catering - Premium','CATERING_INHOUSE',650.00,'plate',1,NULL,'996331',NULL,5.00,1,NULL,'6 starters (3 non-veg), 4 main course (2 non-veg), 3 desserts, live counter',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (9,'SRV_201','Stage Decoration - Basic','DECORATION',10000.00,'set',1,NULL,'9983',NULL,18.00,1,NULL,'Floral decoration with backdrop, 2 chairs, lighting',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (10,'SRV_202','Stage Decoration - Premium','DECORATION',25000.00,'set',1,NULL,'9983',NULL,18.00,1,NULL,'Designer floral decoration, custom backdrop, throne chairs, special lighting',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (11,'SRV_203','Hall Decoration - Basic','DECORATION',15000.00,'set',1,NULL,'9983',NULL,18.00,1,NULL,'Entrance arch, table centerpieces, ceiling drapes',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (12,'SRV_204','Hall Decoration - Premium','DECORATION',35000.00,'set',1,NULL,'9983',NULL,18.00,1,NULL,'Complete hall transformation with theme, entrance, stage, ceiling, walls',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (13,'SRV_301','Sound System - Basic','AV_EQUIPMENT',5000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'2 speakers, 1 mixer, 2 wireless mics',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (14,'SRV_302','Sound System - Premium','AV_EQUIPMENT',12000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'4 speakers, subwoofer, mixer, 4 wireless mics, DJ console',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (15,'SRV_303','LED Screen - Small (6x8 ft)','AV_EQUIPMENT',8000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'LED screen with video playback system',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (16,'SRV_304','LED Screen - Large (10x12 ft)','AV_EQUIPMENT',15000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'Large LED screen with HD video playback',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (17,'SRV_305','Projector with Screen','AV_EQUIPMENT',5000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'HD projector with 10x8 ft screen',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (18,'SRV_401','Photography - Basic Package','PHOTOGRAPHY',15000.00,'day',1,NULL,'9983',NULL,18.00,1,NULL,'1 photographer, 300 edited photos, online album',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (19,'SRV_402','Photography - Premium Package','PHOTOGRAPHY',35000.00,'day',1,NULL,'9983',NULL,18.00,1,NULL,'2 photographers, 500 edited photos, printed album, online album',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (20,'SRV_403','Videography - Basic Package','PHOTOGRAPHY',20000.00,'day',1,NULL,'9983',NULL,18.00,1,NULL,'1 videographer, 2-hour edited video, highlights reel',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (21,'SRV_404','Videography - Premium Package','PHOTOGRAPHY',45000.00,'day',1,NULL,'9983',NULL,18.00,1,NULL,'2 videographers, cinematic video, drone shots, same-day edit',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (22,'SRV_501','DJ Services - 4 Hours','DJ_MUSIC',10000.00,'set',1,NULL,'9997',NULL,18.00,1,NULL,'Professional DJ with music system for 4 hours',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (23,'SRV_502','DJ Services - Full Night','DJ_MUSIC',18000.00,'set',1,NULL,'9997',NULL,18.00,1,NULL,'Professional DJ with music system for 8 hours',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (24,'SRV_503','Live Band - 2 Hours','DJ_MUSIC',25000.00,'set',1,NULL,'9997',NULL,18.00,1,NULL,'4-piece live band for 2 hours',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-25 20:16:06','event_services',0,1);
INSERT  IGNORE INTO service_catalog VALUES (25,'SRV_601','Valet Parking Service','PARKING',5000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'Professional valet parking for 100 vehicles',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (26,'SRV_701','Generator Backup','OTHER',8000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'100 KVA generator for power backup',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (27,'SRV_702','Security Services','SECURITY',3000.00,'day',1,NULL,'9972',NULL,18.00,1,NULL,'4 security guards for event duration',NULL,NULL,1,0,'2025-11-19 15:28:55','2025-11-19 15:28:55','other',0,1);
INSERT  IGNORE INTO service_catalog VALUES (28,'SRV_TEST','Test Premium Package','VENUE_RENTAL',75000.00,'day',1,1,'9972',NULL,18.00,1,NULL,'Premium venue package with all amenities','AC Hall, Stage, Green Room, Parking','Booking requires 25% advance',1,0,'2025-11-20 07:02:03','2025-11-25 20:16:06','venue_rental',0,1);
INSERT  IGNORE INTO service_catalog VALUES (29,'ELEC_REIMB','Electricity Charges (Actual Cost Reimbursement)','OTHER',0.00,'nos',1,NULL,'N/A',NULL,0.00,0,'Reimbursement of actual electricity cost - No GST applicable. Meter reading based. Supporting document: Electricity bill required.','Reimbursement of actual electricity consumption based on meter reading. This is not a supply of service but reimbursement of actual cost incurred.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','complimentary',0,0);
INSERT  IGNORE INTO service_catalog VALUES (30,'GEN_FUEL','Generator Fuel (Actual Cost Reimbursement)','OTHER',0.00,'nos',1,NULL,'N/A',NULL,0.00,0,'Reimbursement of actual diesel/petrol cost for backup power - No GST applicable. Supporting document: Fuel bill required.','Reimbursement of actual fuel cost for generator/backup power. Not a supply of service.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','complimentary',0,0);
INSERT  IGNORE INTO service_catalog VALUES (31,'WATER_REIMB','Water Charges (Actual Cost Reimbursement)','OTHER',0.00,'nos',1,NULL,'N/A',NULL,0.00,0,'Reimbursement of actual water consumption cost - No GST applicable. Supporting document: Water bill required.','Reimbursement of actual water consumption cost. Not a supply of service.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','complimentary',0,0);
INSERT  IGNORE INTO service_catalog VALUES (32,'SEC_DEP','Security Deposit (Refundable)','OTHER',0.00,'nos',1,NULL,'N/A',NULL,0.00,0,'Refundable security deposit - No GST applicable as it is not a supply of service. Refunded within 7 days post-event if no damages.','Refundable security deposit for damages/breakages. Fully refundable if no damages occur. Supporting document: Refund policy.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','security_deposit',1,0);
INSERT  IGNORE INTO service_catalog VALUES (33,'GOV_FEES','Government Fees/Licenses','OTHER',0.00,'nos',1,NULL,'N/A',NULL,0.00,0,'Government fees and licenses (Music license, police permission, etc.) - No GST applicable. Supporting document: Fee receipt from government authority.','Reimbursement of government fees paid for licenses and permissions required for the event.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','complimentary',0,0);
INSERT  IGNORE INTO service_catalog VALUES (34,'MAINT_CLEAN','Maintenance & Cleaning Services','OTHER',0.00,'nos',1,NULL,'9973',NULL,18.00,1,NULL,'Pre-event cleaning, maintenance, and upkeep services. SAC 9973 - 18% GST applicable.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','maintenance',0,1);
INSERT  IGNORE INTO service_catalog VALUES (35,'EVENT_COORD','Event Coordination & Management','OTHER',0.00,'nos',1,NULL,'9972',NULL,18.00,1,NULL,'Event planning, coordination, and management services. SAC 9972 - 18% GST applicable.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 20:16:06','service_charge',0,1);
INSERT  IGNORE INTO service_catalog VALUES (36,'SETUP_ARR','Setup & Arrangement Services','OTHER',0.00,'nos',1,NULL,'9972',NULL,18.00,1,NULL,'Furniture arrangement, stage setup, and other arrangement services. SAC 9972 - 18% GST applicable.',NULL,NULL,1,0,'2025-11-25 19:57:50','2025-11-25 19:57:50','other',0,1);
INSERT  IGNORE INTO slots VALUES (1,1,'2025-11-16','morning','booked',4,NULL,'2025-11-16 12:44:04','2025-11-16 12:45:35');
INSERT  IGNORE INTO slots VALUES (2,1,'2025-11-16','afternoon','booked',4,NULL,'2025-11-16 12:44:04','2025-11-16 12:45:35');
INSERT  IGNORE INTO slots VALUES (3,1,'2025-11-16','night','available',NULL,NULL,'2025-11-16 12:44:04','2025-11-16 12:44:04');
INSERT  IGNORE INTO slots VALUES (4,1,'2025-11-17','morning','available',NULL,NULL,'2025-11-16 12:44:04','2025-11-16 12:44:04');
INSERT  IGNORE INTO slots VALUES (5,1,'2025-11-17','afternoon','booked',6,NULL,'2025-11-16 12:44:04','2025-11-16 13:03:06');
INSERT  IGNORE INTO slots VALUES (6,1,'2025-11-17','night','booked',6,NULL,'2025-11-16 12:44:04','2025-11-16 13:03:06');
INSERT  IGNORE INTO slots VALUES (7,1,'2025-11-18','morning','available',NULL,NULL,'2025-11-16 12:44:04','2025-11-16 12:44:04');
INSERT  IGNORE INTO slots VALUES (8,1,'2025-11-18','afternoon','available',NULL,NULL,'2025-11-16 12:44:04','2025-11-16 12:44:04');
INSERT  IGNORE INTO slots VALUES (9,1,'2025-11-18','night','available',NULL,NULL,'2025-11-16 12:44:04','2025-11-16 12:44:04');
INSERT  IGNORE INTO slots VALUES (10,1,'2025-11-19','morning','available',NULL,NULL,'2025-11-16 12:44:04','2025-11-16 12:44:04');
INSERT  IGNORE INTO slots VALUES (11,1,'2025-11-19','afternoon','booked',7,NULL,'2025-11-16 12:44:04','2025-11-16 13:10:12');
INSERT  IGNORE INTO slots VALUES (12,1,'2025-11-19','night','booked',7,NULL,'2025-11-16 12:44:04','2025-11-16 13:10:12');
INSERT  IGNORE INTO slots VALUES (13,1,'2026-01-20','morning','booked',9,NULL,'2025-11-16 12:44:04','2025-11-28 18:58:38');
INSERT  IGNORE INTO slots VALUES (14,1,'2026-01-20','afternoon','booked',10,NULL,'2025-11-16 12:44:04','2025-11-30 23:09:30');
INSERT  IGNORE INTO slots VALUES (15,1,'2026-01-20','night','booked',10,NULL,'2025-11-16 12:44:04','2025-11-30 23:09:30');
INSERT  IGNORE INTO users VALUES (1,'Admin User','admin@hallsync.com','$2b$10$l.dVt3LedtRNRxm/7trW3.Z5fkMCynm.c1jtdRAiX6UYdkG2632.m','admin','active','2025-11-11 22:05:32','2025-11-11 22:05:32');
INSERT  IGNORE INTO users VALUES (2,'Inamul','hasaninamul@gmail.com','$2b$10$cq8xQlqU1hfp5P5dAYeISuqaNO9u8NRyQd0d1VbVGvas6dBiYAx5e','admin','active','2025-11-19 22:59:34','2025-11-19 22:59:34');
