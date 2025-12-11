# 📊 Database Schema Documentation

**Project:** Hall Sync  
**Version:** 1.0  
**Date:** October 15, 2025  
**Database:** hall_sync

---

## 🎯 Schema Overview

### Purpose
This database schema is designed for a **Marriage Hall Booking Management System** with complete customer, booking, payment, and inventory management.

### Key Features
- ✅ Customer relationship management
- ✅ Multiple hall management
- ✅ Package-based pricing
- ✅ Booking with slot management
- ✅ Payment tracking
- ✅ Audit logging for compliance
- ✅ User access control

---

## 📋 Tables (8 Core Tables)

### 1. **users** - System Users
**Purpose:** Store admin, manager, and staff user accounts

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| name | VARCHAR(100) | User full name | NOT NULL |
| email | VARCHAR(100) | Login email | NOT NULL, UNIQUE |
| password | VARCHAR(255) | Hashed password | NOT NULL |
| role | ENUM | User role | 'admin', 'staff', 'manager' |
| status | ENUM | Account status | 'active', 'inactive' |
| created_at | TIMESTAMP | Creation time | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | Last update | ON UPDATE CURRENT_TIMESTAMP |

**Indexes:**
- `idx_email` - Fast email lookup for login
- `idx_status` - Filter active users

**Sample Data:**
- Admin User (admin@hallsync.com)
- Manager John (john@hallsync.com)
- Staff Sarah (sarah@hallsync.com)

---

### 2. **customers** - Customer Information
**Purpose:** Store customer details for bookings

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| name | VARCHAR(100) | Customer name | NOT NULL |
| phone | VARCHAR(15) | Contact number | NOT NULL, UNIQUE |
| email | VARCHAR(100) | Email address | Optional |
| city | VARCHAR(100) | City | Optional |
| state | VARCHAR(100) | State | Optional |
| pincode | VARCHAR(10) | Postal code | Optional |
| address | TEXT | Full address | Optional |
| event_type | ENUM | Preferred event type | wedding, reception, etc. |
| notes | TEXT | Additional notes | Optional |
| status | ENUM | Customer status | 'active', 'inactive' |
| created_at | TIMESTAMP | Registration time | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | Last update | ON UPDATE CURRENT_TIMESTAMP |

**Indexes:**
- `unique_phone` - Prevent duplicate phone numbers
- `idx_name` - Fast name search
- `idx_phone` - Fast phone search
- `idx_email` - Fast email search
- `idx_city` - Filter by location
- `idx_status` - Filter active customers

**Business Rules:**
- Phone number must be unique (one customer per phone)
- Email is optional but recommended
- Status 'inactive' for customers who requested deletion

---

### 3. **halls** - Marriage Halls
**Purpose:** Store hall inventory and details

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| name | VARCHAR(100) | Hall name | NOT NULL |
| capacity | INT | Guest capacity | NOT NULL |
| base_price | DECIMAL(10,2) | Base rental price | NOT NULL, DEFAULT 0.00 |
| description | TEXT | Hall description | Optional |
| location | VARCHAR(200) | Address/location | Optional |
| amenities | TEXT | Available amenities | Optional (comma-separated) |
| images | TEXT | Image URLs | Optional (comma-separated) |
| features | TEXT | Special features | Optional |
| status | ENUM | Hall status | 'active', 'inactive', 'maintenance' |
| created_at | TIMESTAMP | Creation time | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | Last update | ON UPDATE CURRENT_TIMESTAMP |

**Indexes:**
- `idx_name` - Fast name search
- `idx_status` - Filter available halls
- `idx_capacity` - Filter by capacity

**Business Rules:**
- Capacity determines maximum guests
- Base price is starting price (packages add to this)
- Status 'maintenance' blocks bookings temporarily

**Sample Halls:**
- Grand Palace Hall (500 capacity, ₹75,000)
- Royal Banquet (300 capacity, ₹50,000)
- Crystal Convention Center (800 capacity, ₹120,000)

---

### 4. **packages** - Event Packages
**Purpose:** Store pre-defined service packages

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| name | VARCHAR(100) | Package name | NOT NULL |
| base_price | DECIMAL(10,2) | Package price | NOT NULL, DEFAULT 0.00 |
| description | TEXT | Package description | Optional |
| inclusions | TEXT | Included services | Optional (comma-separated) |
| status | ENUM | Package status | 'active', 'inactive' |
| created_at | TIMESTAMP | Creation time | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | Last update | ON UPDATE CURRENT_TIMESTAMP |

**Indexes:**
- `idx_name` - Fast name search
- `idx_status` - Filter active packages

**Business Rules:**
- Inclusions stored as comma-separated text
- Total booking amount = Hall base_price + Package base_price

**Sample Packages:**
- Basic Package (₹25,000) - Decoration, Catering, Sound
- Gold Package (₹100,000) - Premium services
- Platinum Package (₹150,000) - Luxury services

---

### 5. **bookings** - Hall Bookings
**Purpose:** Core booking records

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| customer_id | INT | Customer reference | FK to customers, NOT NULL |
| hall_id | INT | Hall reference | FK to halls, NOT NULL |
| package_id | INT | Package reference | FK to packages, Optional |
| event_date | DATE | Event date | NOT NULL |
| event_type | ENUM | Event type | wedding, reception, etc. |
| guest_count | INT | Expected guests | Optional |
| total_amount | DECIMAL(10,2) | Total booking cost | NOT NULL, DEFAULT 0.00 |
| advance_amount | DECIMAL(10,2) | Advance paid | DEFAULT 0.00 |
| balance_amount | DECIMAL(10,2) | Balance due | DEFAULT 0.00 |
| payment_mode | ENUM | Payment method | cash, card, upi, etc. |
| status | ENUM | Booking status | pending, confirmed, cancelled, completed |
| notes | TEXT | Booking notes | Optional |
| created_by | INT | User who created | FK to users |
| created_at | TIMESTAMP | Booking time | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | Last update | ON UPDATE CURRENT_TIMESTAMP |

**Foreign Keys:**
- `customer_id` → customers(id) - RESTRICT (can't delete customer with bookings)
- `hall_id` → halls(id) - RESTRICT (can't delete hall with bookings)
- `package_id` → packages(id) - SET NULL (can delete package)
- `created_by` → users(id) - SET NULL (can delete user)

**Indexes:**
- `idx_customer` - Find customer bookings
- `idx_hall` - Find hall bookings
- `idx_package` - Find package usage
- `idx_event_date` - Date-based queries
- `idx_status` - Filter by status
- `idx_booking_date_status` - Composite for dashboard

**Triggers:**
- `before_booking_insert` - Auto-calculate balance_amount
- `before_booking_update` - Auto-update balance_amount

**Business Rules:**
- balance_amount = total_amount - advance_amount (auto-calculated)
- Status flow: pending → confirmed → completed (or cancelled)
- Can't delete customer/hall if they have bookings

---

### 6. **slots** - Hall Availability
**Purpose:** Track hall availability by date

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| hall_id | INT | Hall reference | FK to halls, NOT NULL |
| slot_date | DATE | Date | NOT NULL |
| status | ENUM | Slot status | 'available', 'booked', 'blocked' |
| booking_id | INT | Booking reference | FK to bookings, Optional |
| notes | TEXT | Slot notes | Optional |
| created_at | TIMESTAMP | Creation time | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | Last update | ON UPDATE CURRENT_TIMESTAMP |

**Foreign Keys:**
- `hall_id` → halls(id) - CASCADE (delete slots if hall deleted)
- `booking_id` → bookings(id) - SET NULL (keep slot if booking deleted)

**Unique Constraint:**
- `unique_hall_date` - One slot per hall per date

**Indexes:**
- `idx_hall_date` - Fast availability check
- `idx_status` - Filter available slots
- `idx_booking` - Find booking slot

**Business Rules:**
- One hall can only have one booking per date
- Status 'blocked' for maintenance or special events
- Auto-created when booking is made

---

### 7. **payments** - Payment Tracking
**Purpose:** Track all payment transactions

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| booking_id | INT | Booking reference | FK to bookings, NOT NULL |
| amount | DECIMAL(10,2) | Payment amount | NOT NULL |
| payment_mode | ENUM | Payment method | cash, card, upi, etc. |
| payment_type | ENUM | Payment type | advance, balance, full, refund |
| transaction_id | VARCHAR(100) | Transaction ID | Optional |
| payment_date | DATE | Payment date | NOT NULL |
| notes | TEXT | Payment notes | Optional |
| received_by | INT | User who received | FK to users |
| created_at | TIMESTAMP | Record time | DEFAULT CURRENT_TIMESTAMP |

**Foreign Keys:**
- `booking_id` → bookings(id) - CASCADE (delete payments if booking deleted)
- `received_by` → users(id) - SET NULL

**Indexes:**
- `idx_booking` - Find booking payments
- `idx_payment_date` - Date-based reports
- `idx_payment_type` - Filter by type

**Business Rules:**
- Multiple payments allowed per booking
- Sum of payments should match booking amounts
- Transaction ID required for digital payments

---

### 8. **audit_logs** - Audit Trail
**Purpose:** Track all system changes for compliance

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | INT | Primary key | AUTO_INCREMENT |
| user_id | INT | User who made change | FK to users |
| action | VARCHAR(50) | Action type | NOT NULL (CREATE, UPDATE, DELETE) |
| entity_type | VARCHAR(50) | Table name | NOT NULL |
| entity_id | INT | Record ID | NOT NULL |
| old_values | JSON | Before state | Optional |
| new_values | JSON | After state | Optional |
| ip_address | VARCHAR(45) | User IP | Optional |
| created_at | TIMESTAMP | Action time | DEFAULT CURRENT_TIMESTAMP |

**Foreign Keys:**
- `user_id` → users(id) - SET NULL

**Indexes:**
- `idx_user` - Find user actions
- `idx_entity` - Find entity changes
- `idx_created_at` - Time-based audit

**Business Rules:**
- Immutable (never update/delete audit logs)
- JSON columns store complete before/after state
- Critical for compliance and debugging

---

## 📊 Views (2 Views)

### 1. **booking_details** - Complete Booking Information
**Purpose:** Join all booking-related data for easy querying

**Columns:**
- All booking fields
- Customer details (name, phone, email, city)
- Hall details (name, capacity, location)
- Package details (name, price)
- Created by user name

**Usage:**
```sql
SELECT * FROM booking_details WHERE booking_status = 'confirmed';
```

---

### 2. **dashboard_stats** - Dashboard Statistics
**Purpose:** Real-time dashboard metrics

**Columns:**
- confirmed_bookings (count)
- pending_bookings (count)
- todays_bookings (count)
- active_customers (count)
- active_halls (count)
- monthly_revenue (sum)
- monthly_advance (sum)

**Usage:**
```sql
SELECT * FROM dashboard_stats;
```

---

## 🔧 Stored Procedures

### **create_booking_with_slot**
**Purpose:** Atomically create booking and slot

**Parameters:**
- IN: customer_id, hall_id, package_id, event_date, etc.
- OUT: booking_id (returns -1 on error)

**Features:**
- Transaction-safe
- Auto-creates slot
- Handles errors gracefully

**Usage:**
```sql
CALL create_booking_with_slot(1, 2, 3, '2025-12-01', 'wedding', 300, 150000, 75000, 'card', 1, @booking_id);
SELECT @booking_id;
```

---

## 🎯 Relationships Diagram

```
users
  ├── bookings (created_by)
  ├── payments (received_by)
  └── audit_logs (user_id)

customers
  └── bookings (customer_id) [RESTRICT]

halls
  ├── bookings (hall_id) [RESTRICT]
  └── slots (hall_id) [CASCADE]

packages
  └── bookings (package_id) [SET NULL]

bookings
  ├── slots (booking_id) [SET NULL]
  └── payments (booking_id) [CASCADE]
```

---

## ✅ YOUR APPROVAL REQUIRED

### Please Review:

#### 1. **Table Structure** - Is this correct?
- [ ] 8 tables cover all requirements
- [ ] Column names are clear
- [ ] Data types are appropriate

#### 2. **Relationships** - Are foreign keys correct?
- [ ] Customer → Booking (RESTRICT)
- [ ] Hall → Booking (RESTRICT)
- [ ] Package → Booking (SET NULL)
- [ ] Booking → Slot (auto-create)

#### 3. **Business Logic** - Does this match your needs?
- [ ] One hall, one date = one booking
- [ ] Balance auto-calculated
- [ ] Payment tracking separate
- [ ] Audit logging enabled

#### 4. **Sample Data** - Is this helpful?
- [ ] 3 users (admin, manager, staff)
- [ ] 10 customers
- [ ] 5 halls
- [ ] 6 packages
- [ ] 10 bookings

### Questions for You:

1. **Do you want to add any fields?** (e.g., GST number, PAN, etc.)
2. **Do you need any additional tables?** (e.g., expenses, vendors, etc.)
3. **Are the enums correct?** (event types, payment modes, etc.)
4. **Should I add more sample data?**

---

## 🚀 Next Steps (After Your Approval):

1. ✅ You approve this schema
2. ⏳ I'll help you run it on your MySQL
3. ⏳ Build backend API
4. ⏳ Build frontend UI
5. ⏳ Test everything
6. ⏳ Deploy

---

**Status:** ⏸️ WAITING FOR YOUR APPROVAL

**Please reply with:**
- "APPROVED" to proceed
- OR specific changes you want
- OR questions about the schema

**I'm ready to proceed once you approve!** 🚀
