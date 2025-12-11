# ⚡ Quick Backend Test (5 Minutes)

**Fast verification that everything works**

---

## 🚀 Prerequisites

1. ✅ Backend server running (`npm run dev`)
2. ✅ Database setup complete
3. ✅ Postman installed

---

## ⚡ 5-Minute Test

### 1. Health Check (10 seconds)
```
GET http://localhost:5000/api/health
```
**Expected:** ✅ "Hall Sync API is running"

---

### 2. Get Sample Data (30 seconds)

**Customers:**
```
GET http://localhost:5000/api/customers
```
**Expected:** ✅ 10 customers

**Halls:**
```
GET http://localhost:5000/api/halls
```
**Expected:** ✅ 5 halls

**Packages:**
```
GET http://localhost:5000/api/packages
```
**Expected:** ✅ 6 packages

**Bookings:**
```
GET http://localhost:5000/api/bookings
```
**Expected:** ✅ 10 bookings

---

### 3. Create Operations (2 minutes)

**Create Customer:**
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick Test User",
    "phone": "9999999999",
    "email": "quicktest@example.com",
    "city": "Mumbai"
  }'
```
**Expected:** ✅ Customer created, note the ID

**Create Booking:**
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "hall_id": 1,
    "package_id": 2,
    "event_date": "2025-12-30",
    "event_type": "wedding",
    "total_amount": 150000,
    "advance_amount": 75000,
    "payment_mode": "card"
  }'
```
**Expected:** ✅ Booking created with slot

---

### 4. Dashboard Stats (30 seconds)
```
GET http://localhost:5000/api/dashboard/stats
```
**Expected:** ✅ Complete statistics with revenue, bookings, customers

---

### 5. Search & Filter (1 minute)

**Search Customer:**
```
GET http://localhost:5000/api/customers/search?name=Rahul
```
**Expected:** ✅ Filtered results

**Check Hall Availability:**
```
GET http://localhost:5000/api/halls/1/availability?date=2025-12-31
```
**Expected:** ✅ Availability status

**Get Upcoming Bookings:**
```
GET http://localhost:5000/api/bookings/upcoming?limit=5
```
**Expected:** ✅ Future bookings

---

## ✅ Success Checklist

- [ ] Health check works
- [ ] Can get all customers
- [ ] Can get all halls
- [ ] Can get all packages
- [ ] Can get all bookings
- [ ] Can create customer
- [ ] Can create booking
- [ ] Dashboard shows stats
- [ ] Search works
- [ ] Hall availability works

**All checked?** ✅ **Backend is working perfectly!**

---

## 🐛 If Something Fails

### Server Not Responding?
```bash
# Check if server is running
lsof -ti:5000

# Restart server
cd backend
npm run dev
```

### Database Error?
```bash
# Check MySQL
mysql -u root -p -e "SHOW DATABASES;"

# Verify hall_sync exists
mysql -u root -p -e "USE hall_sync; SHOW TABLES;"
```

### Wrong Data?
```bash
# Reload seed data
mysql -u root -p hall_sync < database/seed.sql
```

---

## 📊 Expected Results Summary

| Endpoint | Expected Count | Status |
|----------|---------------|--------|
| Customers | 10 | ✅ |
| Halls | 5 | ✅ |
| Packages | 6 | ✅ |
| Bookings | 10 | ✅ |
| Create Customer | 1 new | ✅ |
| Create Booking | 1 new | ✅ |

---

## 🎯 Next Steps

### If All Tests Pass:
1. ✅ Import full Postman collection
2. ✅ Run complete test suite (42 endpoints)
3. ✅ Proceed to frontend development

### If Tests Fail:
1. 🐛 Check server console
2. 🐛 Verify database connection
3. 🐛 Review error messages
4. 🐛 Fix issues and retest

---

**Quick test complete! Ready for full testing!** 🚀
