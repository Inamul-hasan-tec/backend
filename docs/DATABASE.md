# 🗄️ Database Setup & Overview

**Last Updated:** 2025-10-17  
**Database:** MySQL 8.0+  
**Database Name:** `hall_sync`

---

## 🚀 Quick Setup

### 1. Create Database
```sql
CREATE DATABASE hall_sync;
USE hall_sync;
```

### 2. Run Schema
```bash
mysql -u root -p hall_sync < database/schema.sql
```

### 3. Seed Sample Data
```bash
mysql -u root -p hall_sync < database/seed.sql
```

### 4. Configure Environment
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hall_sync
DB_PORT=3306
```

---

## 📊 Database Schema Overview

### Core Tables

#### 1. **customers** - Customer information
- Primary Key: `id`
- Unique: `phone`
- Stores customer contact and event details

#### 2. **halls** - Marriage hall information
- Primary Key: `id`
- Stores hall details, capacity, pricing

#### 3. **packages** - Service packages
- Primary Key: `id`
- Stores package details and pricing

#### 4. **bookings** - Event bookings
- Primary Key: `id`
- Foreign Keys: `customer_id`, `hall_id`, `package_id`
- Stores booking details and status

#### 5. **slots** - Hall availability slots
- Primary Key: `id`
- Foreign Keys: `hall_id`, `booking_id`
- Manages hall availability by date

#### 6. **payments** - Payment records
- Primary Key: `id`
- Foreign Key: `booking_id`
- Tracks payment transactions

#### 7. **users** - System users (future)
- Primary Key: `id`
- For authentication and authorization

---

## 🔗 Relationships

```
customers (1) ──────< (many) bookings
halls (1) ──────────< (many) bookings
packages (1) ────────< (many) bookings
halls (1) ──────────< (many) slots
bookings (1) ────────< (many) payments
bookings (1) ────────< (many) slots
```

---

## 📋 Table Details

### customers
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL |
| phone | VARCHAR(15) | UNIQUE, NOT NULL |
| email | VARCHAR(100) | |
| city | VARCHAR(50) | |
| state | VARCHAR(50) | |
| pincode | VARCHAR(10) | |
| address | TEXT | |
| event_type | ENUM | |
| notes | TEXT | |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

### halls
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL |
| capacity | INT | NOT NULL |
| base_price | DECIMAL(10,2) | NOT NULL |
| description | TEXT | |
| location | VARCHAR(255) | |
| amenities | TEXT | |
| status | ENUM | DEFAULT 'active' |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

### packages
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT |
| name | VARCHAR(100) | NOT NULL |
| base_price | DECIMAL(10,2) | NOT NULL |
| description | TEXT | |
| inclusions | TEXT | |
| status | ENUM | DEFAULT 'active' |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

### bookings
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT |
| customer_id | INT | FOREIGN KEY → customers(id) |
| hall_id | INT | FOREIGN KEY → halls(id) |
| package_id | INT | FOREIGN KEY → packages(id) |
| event_date | DATE | NOT NULL |
| event_type | ENUM | |
| guest_count | INT | |
| status | ENUM | DEFAULT 'pending' |
| total_amount | DECIMAL(10,2) | NOT NULL |
| advance_amount | DECIMAL(10,2) | |
| balance_amount | DECIMAL(10,2) | GENERATED |
| payment_mode | ENUM | |
| notes | TEXT | |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

---

## 🔍 Indexes

### Performance Indexes
```sql
-- Customer lookups
INDEX idx_customer_phone ON customers(phone);
INDEX idx_customer_city ON customers(city);

-- Hall searches
INDEX idx_hall_status ON halls(status);
INDEX idx_hall_capacity ON halls(capacity);

-- Booking queries
INDEX idx_booking_date ON bookings(event_date);
INDEX idx_booking_status ON bookings(status);
INDEX idx_booking_customer ON bookings(customer_id);
INDEX idx_booking_hall ON bookings(hall_id);

-- Slot availability
INDEX idx_slot_date ON slots(slot_date);
INDEX idx_slot_hall ON slots(hall_id);
INDEX idx_slot_status ON slots(status);
```

---

## 📈 Views

### booking_details_view
Complete booking information with customer, hall, and package details.

```sql
CREATE VIEW booking_details_view AS
SELECT 
  b.*,
  c.name as customer_name,
  c.phone as customer_phone,
  h.name as hall_name,
  h.location as hall_location,
  p.name as package_name
FROM bookings b
JOIN customers c ON b.customer_id = c.id
JOIN halls h ON b.hall_id = h.id
LEFT JOIN packages p ON b.package_id = p.id;
```

---

## ⚙️ Stored Procedures

### sp_check_hall_availability
Check if a hall is available on a specific date.

```sql
CALL sp_check_hall_availability(hall_id, 'YYYY-MM-DD');
```

### sp_get_dashboard_stats
Get comprehensive dashboard statistics.

```sql
CALL sp_get_dashboard_stats();
```

---

## 🔔 Triggers

### trg_booking_after_insert
Automatically creates a slot when a booking is created.

### trg_booking_after_update
Updates slot status when booking status changes.

---

## 🔄 Migrations

### Current Version: 1.0

**Schema File:** `database/schema.sql`  
**Seed File:** `database/seed.sql`

### Future Migrations
- Add user authentication tables
- Add audit logs
- Add file attachments
- Add notification preferences

---

## 📊 Sample Data

The seed file includes:
- 10 customers
- 5 halls
- 7 packages
- 10 bookings
- Corresponding slots and payments

---

## 🔧 Maintenance

### Backup Database
```bash
mysqldump -u root -p hall_sync > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
mysql -u root -p hall_sync < backup_20251017.sql
```

### Check Table Status
```sql
SHOW TABLE STATUS FROM hall_sync;
```

### Optimize Tables
```sql
OPTIMIZE TABLE customers, halls, packages, bookings, slots, payments;
```

---

## 🐛 Troubleshooting

### Connection Issues
```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u root -p -e "SELECT 1;"
```

### Permission Issues
```sql
GRANT ALL PRIVILEGES ON hall_sync.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Reset Database
```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS hall_sync;"
mysql -u root -p -e "CREATE DATABASE hall_sync;"
mysql -u root -p hall_sync < database/schema.sql
mysql -u root -p hall_sync < database/seed.sql
```

---

## 📚 Related Documentation

- **Detailed Schema:** `backend/database/SCHEMA-DOCUMENTATION.md`
- **API Reference:** `backend/docs/API-REFERENCE.md`
- **Testing Guide:** `backend/docs/TESTING.md`

---

**Last Updated:** 2025-10-17  
**Schema Version:** 1.0  
**Total Tables:** 7
