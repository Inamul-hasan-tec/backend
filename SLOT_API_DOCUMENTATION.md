# 📅 Slot Management API - Complete Documentation

## Overview
The Slot Management API provides complete functionality for managing hall availability slots. All endpoints are fully implemented and ready to use.

---

## 🔐 Authentication
All slot endpoints require authentication. Include the JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

---

## 📋 API Endpoints

### 1. **Get Slots for a Specific Month**
Retrieve all slots for a given month with booking details.

**Endpoint:**
```http
GET /api/slots/:year/:month
```

**Parameters:**
- `year` (path) - Year (e.g., 2025)
- `month` (path) - Month (1-12)
- `hall_id` (query, optional) - Filter by specific hall

**Example Request:**
```bash
# Get all slots for December 2025
curl -X GET "https://hallsyncbackend.onrender.com/api/slots/2025/12" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get slots for specific hall
curl -X GET "https://hallsyncbackend.onrender.com/api/slots/2025/12?hall_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Slots retrieved successfully",
  "data": [
    {
      "id": 1,
      "hall_id": 1,
      "date": "2025-12-15",
      "slot_type": "morning",
      "status": "vacant",
      "booking_id": null,
      "notes": null,
      "booking_details": null
    },
    {
      "id": 2,
      "hall_id": 1,
      "date": "2025-12-15",
      "slot_type": "afternoon",
      "status": "booked",
      "booking_id": 123,
      "notes": null,
      "booking_details": {
        "customer_name": "John Doe",
        "package_name": "Premium Package",
        "booking_id": 123,
        "total_amount": 50000,
        "advance_paid": 10000
      }
    }
  ]
}
```

---

### 2. **Get Available Slots**
Get only available slots for a specific date range.

**Endpoint:**
```http
GET /api/slots/available
```

**Query Parameters:**
- `hall_id` (required) - Hall ID
- `date_from` (required) - Start date (YYYY-MM-DD)
- `date_to` (required) - End date (YYYY-MM-DD)

**Example Request:**
```bash
curl -X GET "https://hallsyncbackend.onrender.com/api/slots/available?hall_id=1&date_from=2025-12-01&date_to=2025-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Available slots retrieved successfully",
  "data": [
    {
      "id": 1,
      "hall_id": 1,
      "slot_date": "2025-12-15",
      "slot_type": "morning",
      "status": "available",
      "booking_id": null,
      "notes": null
    }
  ]
}
```

---

### 3. **Update Slot Status**
Update the status of a specific slot (e.g., mark as booked or available).

**Endpoint:**
```http
PUT /api/slots/:id
```

**Parameters:**
- `id` (path) - Slot ID

**Request Body:**
```json
{
  "status": "booked",
  "booking_id": 123
}
```

**Valid Status Values:**
- `available` - Slot is free
- `booked` - Slot is reserved
- `blocked` - Slot is unavailable

**Example Request:**
```bash
curl -X PUT "https://hallsyncbackend.onrender.com/api/slots/1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "booked",
    "booking_id": 123
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Slot updated successfully"
}
```

---

### 4. **Generate Slots**
Automatically generate slots for a specific month or for all halls.

**Endpoint:**
```http
POST /api/slots/generate
```

**Option A: Generate for Specific Month and Hall**
```json
{
  "year": 2025,
  "month": 12,
  "hall_id": 1
}
```

**Option B: Generate for All Halls (Next N Months)**
```json
{
  "months": 6
}
```

**Example Request:**
```bash
# Generate slots for December 2025, Hall 1
curl -X POST "https://hallsyncbackend.onrender.com/api/slots/generate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 12,
    "hall_id": 1
  }'

# Generate slots for all halls for next 6 months
curl -X POST "https://hallsyncbackend.onrender.com/api/slots/generate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "months": 6
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Generated 93 slots",
  "data": {
    "slotsCreated": 93
  }
}
```

---

### 5. **Block/Unblock Slot**
Manually block or unblock a slot (admin feature).

**Endpoint:**
```http
POST /api/slots/:id/block
```

**Parameters:**
- `id` (path) - Slot ID

**Request Body:**
```json
{
  "block": true,
  "notes": "Hall maintenance scheduled"
}
```

**Example Request:**
```bash
# Block a slot
curl -X POST "https://hallsyncbackend.onrender.com/api/slots/1/block" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "block": true,
    "notes": "Hall maintenance"
  }'

# Unblock a slot
curl -X POST "https://hallsyncbackend.onrender.com/api/slots/1/block" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "block": false
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Slot blocked successfully"
}
```

---

## 🎯 Frontend Integration Examples

### React/TypeScript Example

```typescript
import api from './services/api';

// 1. Get slots for December 2025
const fetchSlots = async () => {
  try {
    const response = await api.get('/slots/2025/12?hall_id=1');
    console.log('Slots:', response.data.data);
  } catch (error) {
    console.error('Error fetching slots:', error);
  }
};

// 2. Get available slots
const fetchAvailableSlots = async () => {
  try {
    const response = await api.get('/slots/available', {
      params: {
        hall_id: 1,
        date_from: '2025-12-01',
        date_to: '2025-12-31'
      }
    });
    console.log('Available slots:', response.data.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// 3. Update slot status
const updateSlotStatus = async (slotId: number, bookingId: number) => {
  try {
    const response = await api.put(`/slots/${slotId}`, {
      status: 'booked',
      booking_id: bookingId
    });
    console.log('Slot updated:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// 4. Generate slots for next 6 months
const generateSlots = async () => {
  try {
    const response = await api.post('/slots/generate', {
      months: 6
    });
    console.log('Slots generated:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};

// 5. Block a slot
const blockSlot = async (slotId: number) => {
  try {
    const response = await api.post(`/slots/${slotId}/block`, {
      block: true,
      notes: 'Maintenance scheduled'
    });
    console.log('Slot blocked:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## 📊 Database Schema

### Slots Table Structure
```sql
CREATE TABLE slots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  hall_id INT NOT NULL,
  slot_date DATE NOT NULL,
  slot_type ENUM('morning', 'afternoon', 'night') NOT NULL,
  status ENUM('available', 'booked', 'blocked') DEFAULT 'available',
  booking_id INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL,
  FOREIGN KEY (hall_id) REFERENCES halls(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  UNIQUE KEY unique_slot (hall_id, slot_date, slot_type)
);
```

---

## 🔄 Slot Types

The system supports three slot types per day:

1. **Morning** - Typically 6:00 AM - 12:00 PM
2. **Afternoon** - Typically 12:00 PM - 6:00 PM
3. **Night** - Typically 6:00 PM - 12:00 AM

Each hall can have up to 3 slots per day (one for each type).

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid year or month parameter"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "No token provided"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Slot not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to retrieve slots",
  "error": "Database connection error"
}
```

---

## 🧪 Testing the API

### Using cURL

```bash
# 1. Login first to get token
TOKEN=$(curl -X POST "https://hallsyncbackend.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

# 2. Get slots for December 2025
curl -X GET "https://hallsyncbackend.onrender.com/api/slots/2025/12" \
  -H "Authorization: Bearer $TOKEN"

# 3. Generate slots for next 3 months
curl -X POST "https://hallsyncbackend.onrender.com/api/slots/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"months": 3}'
```

### Using Postman

1. **Set Base URL**: `https://hallsyncbackend.onrender.com/api`
2. **Login**: POST `/auth/login` with credentials
3. **Copy Token**: From login response
4. **Set Authorization**: Bearer Token in Headers
5. **Test Endpoints**: Try any of the slot endpoints above

---

## 🚀 Quick Start Guide

### Step 1: Generate Initial Slots
```bash
# Generate slots for all halls for next 6 months
POST /api/slots/generate
{
  "months": 6
}
```

### Step 2: View Slots in Calendar
```bash
# Get slots for current month
GET /api/slots/2025/12?hall_id=1
```

### Step 3: Book a Slot
```bash
# Update slot when booking is created
PUT /api/slots/123
{
  "status": "booked",
  "booking_id": 456
}
```

### Step 4: Check Availability
```bash
# Get available slots for date range
GET /api/slots/available?hall_id=1&date_from=2025-12-01&date_to=2025-12-31
```

---

## 💡 Best Practices

1. **Generate Slots in Advance**
   - Run the generate endpoint monthly to create slots for upcoming months
   - Recommended: Generate 3-6 months in advance

2. **Status Management**
   - Use `available` for free slots
   - Use `booked` when a booking is confirmed
   - Use `blocked` for maintenance or unavailable dates

3. **Booking Integration**
   - Always update slot status when creating/canceling bookings
   - Include `booking_id` when marking as booked
   - Set `booking_id` to null when marking as available

4. **Error Handling**
   - Always check for slot availability before booking
   - Handle 404 errors gracefully (slot might not exist yet)
   - Validate date formats before sending requests

---

## 🔧 Troubleshooting

### Issue: "Slot not found"
**Solution**: Generate slots first using `/api/slots/generate`

### Issue: "Invalid year or month parameter"
**Solution**: Ensure year is 4 digits and month is 1-12

### Issue: "No token provided"
**Solution**: Include Authorization header with valid JWT token

### Issue: Slots not showing in calendar
**Solution**: 
1. Check if slots exist in database
2. Verify hall_id is correct
3. Ensure date range includes the slots

---

## 📝 Notes

- All dates are in `YYYY-MM-DD` format
- Timestamps are in UTC
- Status changes are logged with `updated_at` timestamp
- Deleting a booking automatically sets slot status to 'available'
- Slots can be pre-generated for future months

---

## 🎉 Summary

Your slot management system is **fully functional** with:

✅ **5 Complete API Endpoints**
✅ **Full CRUD Operations**
✅ **Booking Integration**
✅ **Availability Checking**
✅ **Bulk Slot Generation**
✅ **Admin Controls (Block/Unblock)**
✅ **Comprehensive Error Handling**
✅ **TypeScript Type Safety**
✅ **Database Relationships**
✅ **Authentication & Authorization**

**Ready to use!** 🚀
