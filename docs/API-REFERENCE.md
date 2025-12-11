# 📚 API Reference

**Last Updated:** 2025-10-17  
**Base URL:** `http://localhost:5000/api`  
**Authentication:** Bearer Token (see AUTHENTICATION.md)

---

## 🔐 Authentication

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response 200:**
```json
{
  "success": true,
  "token": "mock-jwt-token-for-development",
  "user": { "id": 1, "username": "admin", "role": "admin" }
}
```

### Get Current User
```http
GET /api/auth/user
Authorization: Bearer {token}
```

---

## ✅ Health Check

### Check Server Health
```http
GET /api/health
```

**Response 200:**
```json
{
  "success": true,
  "message": "Hall Sync API is running",
  "timestamp": "2025-10-17T...",
  "version": "1.0.0"
}
```

---

## 👥 Customers

All customer endpoints require authentication.

### Get All Customers
```http
GET /api/customers
Authorization: Bearer {token}
```

### Search Customers
```http
GET /api/customers/search?name={name}&phone={phone}&city={city}
Authorization: Bearer {token}
```

### Get Recent Customers
```http
GET /api/customers/recent?limit={limit}
Authorization: Bearer {token}
```

### Get Customer Statistics
```http
GET /api/customers/stats
Authorization: Bearer {token}
```

### Get Customer by ID
```http
GET /api/customers/:id
Authorization: Bearer {token}
```

### Create Customer
```http
POST /api/customers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "9999888877",
  "email": "john@example.com",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "address": "123 Main St",
  "event_type": "wedding",
  "notes": "Optional notes"
}
```

### Update Customer
```http
PUT /api/customers/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "city": "Delhi"
}
```

### Delete Customer
```http
DELETE /api/customers/:id
Authorization: Bearer {token}
```

---

## 🏛️ Halls

All hall endpoints require authentication.

### Get All Halls
```http
GET /api/halls
Authorization: Bearer {token}
```

### Search Halls
```http
GET /api/halls/search?name={name}&status={status}&min_capacity={capacity}
Authorization: Bearer {token}
```

### Get Active Halls
```http
GET /api/halls/active
Authorization: Bearer {token}
```

### Get Hall by ID
```http
GET /api/halls/:id
Authorization: Bearer {token}
```

### Check Hall Availability
```http
GET /api/halls/:id/availability?date={YYYY-MM-DD}
Authorization: Bearer {token}
```

### Get Hall Availability Range
```http
GET /api/halls/:id/availability-range?date_from={YYYY-MM-DD}&date_to={YYYY-MM-DD}
Authorization: Bearer {token}
```

### Create Hall
```http
POST /api/halls
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Grand Hall",
  "capacity": 500,
  "base_price": 75000,
  "description": "Spacious hall for large events",
  "location": "Mumbai, Maharashtra",
  "amenities": "AC, Parking, Catering",
  "status": "active"
}
```

### Update Hall
```http
PUT /api/halls/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "base_price": 80000,
  "status": "active"
}
```

### Delete Hall
```http
DELETE /api/halls/:id
Authorization: Bearer {token}
```

---

## 📦 Packages

All package endpoints require authentication.

### Get All Packages
```http
GET /api/packages
Authorization: Bearer {token}
```

### Search Packages
```http
GET /api/packages/search?name={name}&status={status}
Authorization: Bearer {token}
```

### Get Active Packages
```http
GET /api/packages/active
Authorization: Bearer {token}
```

### Get Popular Packages
```http
GET /api/packages/popular?limit={limit}
Authorization: Bearer {token}
```

### Get Package by ID
```http
GET /api/packages/:id
Authorization: Bearer {token}
```

### Create Package
```http
POST /api/packages
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Premium Package",
  "base_price": 120000,
  "description": "Complete wedding package",
  "inclusions": "Decoration, Catering, DJ, Photography",
  "status": "active"
}
```

### Update Package
```http
PUT /api/packages/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "base_price": 125000
}
```

### Delete Package
```http
DELETE /api/packages/:id
Authorization: Bearer {token}
```

---

## 📅 Bookings

All booking endpoints require authentication.

### Get All Bookings
```http
GET /api/bookings
Authorization: Bearer {token}
```

### Search Bookings
```http
GET /api/bookings/search?status={status}&customer_id={id}&hall_id={id}
Authorization: Bearer {token}
```

### Get Upcoming Bookings
```http
GET /api/bookings/upcoming?limit={limit}
Authorization: Bearer {token}
```

### Get Today's Bookings
```http
GET /api/bookings/today
Authorization: Bearer {token}
```

### Get Booking Statistics
```http
GET /api/bookings/stats
Authorization: Bearer {token}
```

### Get Booking by ID
```http
GET /api/bookings/:id
Authorization: Bearer {token}
```

### Create Booking
```http
POST /api/bookings
Authorization: Bearer {token}
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
  "payment_mode": "card",
  "notes": "Optional notes"
}
```

### Update Booking
```http
PUT /api/bookings/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "guest_count": 400,
  "notes": "Updated guest count"
}
```

### Confirm Booking
```http
POST /api/bookings/:id/confirm
Authorization: Bearer {token}
```

### Cancel Booking
```http
POST /api/bookings/:id/cancel
Authorization: Bearer {token}
```

### Complete Booking
```http
POST /api/bookings/:id/complete
Authorization: Bearer {token}
```

---

## 📊 Dashboard

All dashboard endpoints require authentication.

### Get Dashboard Statistics
```http
GET /api/dashboard/stats
Authorization: Bearer {token}
```

**Response includes:**
- Booking statistics
- Customer statistics
- Revenue statistics
- Upcoming bookings

### Get Revenue Chart
```http
GET /api/dashboard/revenue-chart?months={number}
Authorization: Bearer {token}
```

### Get Booking Status Distribution
```http
GET /api/dashboard/booking-status
Authorization: Bearer {token}
```

### Get Popular Halls
```http
GET /api/dashboard/popular-halls?limit={limit}
Authorization: Bearer {token}
```

### Get Event Type Distribution
```http
GET /api/dashboard/event-types
Authorization: Bearer {token}
```

---

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## 🔢 HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created
- **400 Bad Request** - Invalid input
- **401 Unauthorized** - Authentication required
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

---

## 📚 Related Documentation

- **Authentication:** `backend/docs/AUTHENTICATION.md`
- **Testing Guide:** `backend/docs/TESTING.md`
- **Database Schema:** `backend/database/SCHEMA-DOCUMENTATION.md`

---

**Last Updated:** 2025-10-17  
**Total Endpoints:** 44
