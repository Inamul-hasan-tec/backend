# 🧪 API Testing Guide

**Last Updated:** 2025-10-17  
**Purpose:** Complete guide for testing the Hall Sync API  
**Audience:** Developers, QA, Testers

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- ✅ Postman installed
- ✅ Backend server running
- ✅ Database set up with seed data

### Step 1: Start Server
```bash
cd backend
npm run dev
```
**Expected:** Server running on http://localhost:5000

### Step 2: Import Postman Collection
1. Open Postman
2. Click **Import**
3. Select `Hall-Sync-API.postman_collection.json`
4. Collection appears in sidebar

### Step 3: Login (Required!)
1. Open **Auth → Login (Get Token)**
2. Click **Send**
3. Token automatically saved

**Credentials:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Step 4: Test Any Endpoint
Token is now automatically included in all requests!

---

## 📋 All Endpoints (44 Total)

### Authentication (2 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Get authentication token |
| GET | `/api/auth/user` | Yes | Get current user info |

### Health Check (1 endpoint)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Server health check |

### Customers (8 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/customers` | Yes | Get all customers |
| GET | `/api/customers/search` | Yes | Search customers |
| GET | `/api/customers/recent` | Yes | Get recent customers |
| GET | `/api/customers/stats` | Yes | Get customer statistics |
| GET | `/api/customers/:id` | Yes | Get customer by ID |
| POST | `/api/customers` | Yes | Create new customer |
| PUT | `/api/customers/:id` | Yes | Update customer |
| DELETE | `/api/customers/:id` | Yes | Delete customer |

### Halls (9 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/halls` | Yes | Get all halls |
| GET | `/api/halls/search` | Yes | Search halls |
| GET | `/api/halls/active` | Yes | Get active halls |
| GET | `/api/halls/:id` | Yes | Get hall by ID |
| GET | `/api/halls/:id/availability` | Yes | Check availability |
| GET | `/api/halls/:id/availability-range` | Yes | Check date range |
| POST | `/api/halls` | Yes | Create new hall |
| PUT | `/api/halls/:id` | Yes | Update hall |
| DELETE | `/api/halls/:id` | Yes | Delete hall |

### Packages (8 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/packages` | Yes | Get all packages |
| GET | `/api/packages/search` | Yes | Search packages |
| GET | `/api/packages/active` | Yes | Get active packages |
| GET | `/api/packages/popular` | Yes | Get popular packages |
| GET | `/api/packages/:id` | Yes | Get package by ID |
| POST | `/api/packages` | Yes | Create new package |
| PUT | `/api/packages/:id` | Yes | Update package |
| DELETE | `/api/packages/:id` | Yes | Delete package |

### Bookings (11 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/bookings` | Yes | Get all bookings |
| GET | `/api/bookings/search` | Yes | Search bookings |
| GET | `/api/bookings/upcoming` | Yes | Get upcoming bookings |
| GET | `/api/bookings/today` | Yes | Get today's bookings |
| GET | `/api/bookings/stats` | Yes | Get booking statistics |
| GET | `/api/bookings/:id` | Yes | Get booking by ID |
| POST | `/api/bookings` | Yes | Create new booking |
| PUT | `/api/bookings/:id` | Yes | Update booking |
| POST | `/api/bookings/:id/confirm` | Yes | Confirm booking |
| POST | `/api/bookings/:id/cancel` | Yes | Cancel booking |
| POST | `/api/bookings/:id/complete` | Yes | Complete booking |

### Dashboard (5 endpoints)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard/stats` | Yes | Get dashboard statistics |
| GET | `/api/dashboard/revenue-chart` | Yes | Get revenue chart data |
| GET | `/api/dashboard/booking-status` | Yes | Get booking status distribution |
| GET | `/api/dashboard/popular-halls` | Yes | Get popular halls |
| GET | `/api/dashboard/event-types` | Yes | Get event type distribution |

---

## 🧪 Testing Workflow

### Recommended Order:

#### Phase 0: Authentication ⚡
1. Login (Get Token)
2. Get Current User

#### Phase 1: Read Operations 📖
1. Health Check
2. Get All Customers
3. Get All Halls
4. Get All Packages
5. Get All Bookings
6. Get Dashboard Stats

#### Phase 2: Search & Filter 🔍
1. Search Customers
2. Search Halls
3. Search Packages
4. Search Bookings
5. Get Recent Customers
6. Get Upcoming Bookings

#### Phase 3: Create Operations ➕
1. Create Customer
2. Create Hall
3. Create Package
4. Create Booking

#### Phase 4: Update Operations ✏️
1. Update Customer
2. Update Hall
3. Update Package
4. Update Booking

#### Phase 5: Status Changes 🔄
1. Confirm Booking
2. Cancel Booking
3. Complete Booking

#### Phase 6: Delete Operations 🗑️
1. Delete Customer
2. Delete Hall
3. Delete Package

---

## 📝 Example Requests

### 1. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "mock-jwt-token-for-development",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 2. Get All Customers
```bash
GET /api/customers
Authorization: Bearer mock-jwt-token-for-development
```

**Response:**
```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": [...]
}
```

### 3. Create Customer
```bash
POST /api/customers
Authorization: Bearer mock-jwt-token-for-development
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "9999888877",
  "email": "john@example.com",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "address": "123 Main St",
  "event_type": "wedding"
}
```

### 4. Create Booking
```bash
POST /api/bookings
Authorization: Bearer mock-jwt-token-for-development
Content-Type: application/json

{
  "customer_id": 1,
  "hall_id": 2,
  "package_id": 3,
  "event_date": "2025-12-28",
  "event_type": "wedding",
  "guest_count": 350,
  "total_amount": 150000,
  "advance_amount": 75000,
  "payment_mode": "card"
}
```

---

## ✅ Success Criteria

### All Tests Pass When:
- [ ] All GET requests return data
- [ ] All POST requests create records
- [ ] All PUT requests update records
- [ ] All DELETE requests remove records
- [ ] Search and filters work correctly
- [ ] Validation errors are clear
- [ ] Authentication works properly
- [ ] Status codes are correct (200, 201, 400, 401, 404, 500)

---

## 🐛 Common Issues

### Issue: "No authentication token, access denied"
**Solution:** Run Login request first, token will be auto-saved

### Issue: "Cannot POST /api/auth/login"
**Solution:** Ensure server is running (`npm run dev`)

### Issue: "Connection refused"
**Solution:** Start the server

### Issue: 404 Not Found
**Solution:** Check URL and endpoint path

### Issue: 400 Bad Request
**Solution:** Verify request body has all required fields

### Issue: 500 Internal Server Error
**Solution:** Check server console for detailed error

---

## 📊 Testing Checklist

```
Authentication
[ ] Login and get token
[ ] Get current user

Health Check
[ ] Health check returns 200

Customers (8)
[ ] Get all customers
[ ] Search customers
[ ] Get recent customers
[ ] Get customer stats
[ ] Get customer by ID
[ ] Create customer
[ ] Update customer
[ ] Delete customer

Halls (9)
[ ] Get all halls
[ ] Search halls
[ ] Get active halls
[ ] Get hall by ID
[ ] Check hall availability
[ ] Get hall availability range
[ ] Create hall
[ ] Update hall
[ ] Delete hall

Packages (8)
[ ] Get all packages
[ ] Search packages
[ ] Get active packages
[ ] Get popular packages
[ ] Get package by ID
[ ] Create package
[ ] Update package
[ ] Delete package

Bookings (11)
[ ] Get all bookings
[ ] Search bookings
[ ] Get upcoming bookings
[ ] Get today's bookings
[ ] Get booking stats
[ ] Get booking by ID
[ ] Create booking
[ ] Update booking
[ ] Confirm booking
[ ] Cancel booking
[ ] Complete booking

Dashboard (5)
[ ] Get dashboard stats
[ ] Get revenue chart
[ ] Get booking status distribution
[ ] Get popular halls
[ ] Get event type distribution

Total: __/44 endpoints tested
```

---

## 🎯 Test Scenarios

### Scenario 1: Complete Booking Flow
1. Create customer
2. Check hall availability
3. Get active packages
4. Create booking
5. Confirm booking
6. View dashboard stats

### Scenario 2: Search & Filter
1. Search customers by name
2. Search halls by capacity
3. Filter bookings by status
4. Get upcoming bookings

### Scenario 3: Validation Testing
1. Try creating customer with duplicate phone
2. Try booking with past date
3. Try booking unavailable hall
4. Try updating non-existent record

---

## 📞 Additional Resources

- **API Reference:** See `backend/docs/API-REFERENCE.md`
- **Authentication:** See `backend/docs/AUTHENTICATION.md`
- **Database Schema:** See `backend/database/SCHEMA-DOCUMENTATION.md`

---

**Last Updated:** 2025-10-17  
**Total Endpoints:** 44  
**Estimated Testing Time:** 30-45 minutes
