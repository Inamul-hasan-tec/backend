# 📋 Slots API - Quick Reference Card

## 🔗 Base URL
```
https://hallsyncbackend.onrender.com/api
```

## 🔑 Authentication
All endpoints require JWT token:
```
Authorization: Bearer YOUR_TOKEN
```

---

## 📌 5 Main Endpoints

### 1️⃣ Get Slots for Month
```http
GET /slots/:year/:month?hall_id=1
```
**Example:**
```bash
GET /slots/2025/12?hall_id=1
```

### 2️⃣ Get Available Slots
```http
GET /slots/available?hall_id=1&date_from=2025-12-01&date_to=2025-12-31
```

### 3️⃣ Update Slot Status
```http
PUT /slots/:id
Content-Type: application/json

{
  "status": "booked",
  "booking_id": 123
}
```

### 4️⃣ Generate Slots
```http
POST /slots/generate
Content-Type: application/json

{
  "months": 6
}
```
**OR**
```json
{
  "year": 2025,
  "month": 12,
  "hall_id": 1
}
```

### 5️⃣ Block/Unblock Slot
```http
POST /slots/:id/block
Content-Type: application/json

{
  "block": true,
  "notes": "Maintenance"
}
```

---

## 📊 Slot Status Values

| Status | Description | Color |
|--------|-------------|-------|
| `available` | Free to book | 🟢 Green |
| `booked` | Reserved | 🔴 Red |
| `blocked` | Unavailable | ⚫ Gray |

---

## 🕐 Slot Types

| Type | Time Range |
|------|------------|
| `morning` | 6 AM - 12 PM |
| `afternoon` | 12 PM - 6 PM |
| `night` | 6 PM - 12 AM |

---

## 🚀 Quick Start Commands

### Generate Slots (First Time)
```bash
curl -X POST "https://hallsyncbackend.onrender.com/api/slots/generate" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"months": 6}'
```

### Get Current Month Slots
```bash
curl -X GET "https://hallsyncbackend.onrender.com/api/slots/2025/12" \
  -H "Authorization: Bearer TOKEN"
```

### Check Availability
```bash
curl -X GET "https://hallsyncbackend.onrender.com/api/slots/available?hall_id=1&date_from=2025-12-01&date_to=2025-12-31" \
  -H "Authorization: Bearer TOKEN"
```

---

## 💻 Frontend Integration (React)

```typescript
import api from './services/api';

// Get slots
const slots = await api.get('/slots/2025/12?hall_id=1');

// Generate slots
await api.post('/slots/generate', { months: 6 });

// Update slot
await api.put('/slots/123', { 
  status: 'booked', 
  booking_id: 456 
});

// Block slot
await api.post('/slots/123/block', { 
  block: true, 
  notes: 'Maintenance' 
});
```

---

## ✅ Response Format

### Success Response
```json
{
  "success": true,
  "message": "Slots retrieved successfully",
  "data": [...]
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Details"
}
```

---

## 🎯 Common Use Cases

### 1. Initial Setup
```bash
POST /slots/generate { "months": 6 }
```

### 2. Display Calendar
```bash
GET /slots/2025/12?hall_id=1
```

### 3. Create Booking
```bash
# 1. Check availability
GET /slots/available?...

# 2. Create booking
POST /bookings

# 3. Update slot
PUT /slots/123 { "status": "booked", "booking_id": 456 }
```

### 4. Block for Maintenance
```bash
POST /slots/123/block { "block": true, "notes": "Repair work" }
```

---

## 📝 Notes

- ✅ All endpoints require authentication
- ✅ Dates in `YYYY-MM-DD` format
- ✅ Month is 1-12 (not 0-11)
- ✅ Generate slots before using calendar
- ✅ Each hall has 3 slots per day

---

## 🔧 Troubleshooting

| Error | Solution |
|-------|----------|
| "Slot not found" | Generate slots first |
| "Invalid year/month" | Check format (YYYY, 1-12) |
| "No token provided" | Add Authorization header |
| Slots not showing | Verify hall_id and date range |

---

## 📚 Full Documentation

See **SLOT_API_DOCUMENTATION.md** for complete details.

---

**Quick Test:**
```bash
cd backend
./test-slots-api.sh
```

**Status:** ✅ FULLY IMPLEMENTED & READY TO USE
