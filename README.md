# 🎉 Hall Sync Backend API

**Production-ready RESTful API for Marriage Hall Booking System**

Built with TypeScript, Node.js, Express, and MySQL

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Edit .env file with your database credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hall_sync
```

### 3. Setup Database
```bash
# Login to MySQL
mysql -u root -p

# Run schema
source database/schema.sql

# Load sample data (optional)
source database/seed.sql
```

### 4. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

Server will run on: **http://localhost:5000**

---

## 📋 API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Health Check
```
GET /api/health
```

---

## 👥 Customers

### Get All Customers
```
GET /api/customers
Query: ?limit=10&offset=0
```

### Search Customers
```
GET /api/customers/search
Query: ?name=John&phone=9876&city=Mumbai
```

### Get Recent Customers
```
GET /api/customers/recent
Query: ?limit=10
```

### Get Customer Stats
```
GET /api/customers/stats
```

### Get Customer by ID
```
GET /api/customers/:id
```

### Create Customer
```
POST /api/customers
Body: {
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "city": "Mumbai",
  "event_type": "wedding"
}
```

### Update Customer
```
PUT /api/customers/:id
Body: {
  "name": "John Updated",
  "city": "Delhi"
}
```

### Delete Customer
```
DELETE /api/customers/:id
```

---

## 🏛️ Halls

### Get All Halls
```
GET /api/halls
```

### Search Halls
```
GET /api/halls/search
Query: ?name=Grand&min_capacity=300&status=active
```

### Get Active Halls
```
GET /api/halls/active
```

### Get Hall by ID
```
GET /api/halls/:id
```

### Check Hall Availability
```
GET /api/halls/:id/availability
Query: ?date=2025-12-01
```

### Get Hall Availability Range
```
GET /api/halls/:id/availability-range
Query: ?date_from=2025-12-01&date_to=2025-12-31
```

### Create Hall
```
POST /api/halls
Body: {
  "name": "Grand Palace",
  "capacity": 500,
  "base_price": 75000,
  "location": "Mumbai",
  "status": "active"
}
```

### Update Hall
```
PUT /api/halls/:id
```

### Delete Hall
```
DELETE /api/halls/:id
```

---

## 📦 Packages

### Get All Packages
```
GET /api/packages
```

### Search Packages
```
GET /api/packages/search
Query: ?name=Gold&status=active
```

### Get Active Packages
```
GET /api/packages/active
```

### Get Popular Packages
```
GET /api/packages/popular
Query: ?limit=5
```

### Get Package by ID
```
GET /api/packages/:id
```

### Create Package
```
POST /api/packages
Body: {
  "name": "Gold Package",
  "base_price": 100000,
  "description": "Premium services",
  "inclusions": "Decoration, Catering, DJ",
  "status": "active"
}
```

### Update Package
```
PUT /api/packages/:id
```

### Delete Package
```
DELETE /api/packages/:id
```

---

## 📅 Bookings

### Get All Bookings
```
GET /api/bookings
```

### Search Bookings
```
GET /api/bookings/search
Query: ?customer_id=1&status=confirmed&event_date_from=2025-11-01
```

### Get Upcoming Bookings
```
GET /api/bookings/upcoming
Query: ?limit=10
```

### Get Today's Bookings
```
GET /api/bookings/today
```

### Get Booking Stats
```
GET /api/bookings/stats
```

### Get Booking by ID
```
GET /api/bookings/:id
```

### Create Booking
```
POST /api/bookings
Body: {
  "customer_id": 1,
  "hall_id": 2,
  "package_id": 3,
  "event_date": "2025-12-15",
  "event_type": "wedding",
  "guest_count": 400,
  "total_amount": 175000,
  "advance_amount": 75000,
  "payment_mode": "bank_transfer"
}
```

### Update Booking
```
PUT /api/bookings/:id
```

### Confirm Booking
```
POST /api/bookings/:id/confirm
```

### Cancel Booking
```
POST /api/bookings/:id/cancel
```

### Complete Booking
```
POST /api/bookings/:id/complete
```

---

## 📊 Dashboard

### Get Dashboard Stats
```
GET /api/dashboard/stats
```

### Get Revenue Chart
```
GET /api/dashboard/revenue-chart
Query: ?months=6
```

### Get Booking Status Distribution
```
GET /api/dashboard/booking-status
```

### Get Popular Halls
```
GET /api/dashboard/popular-halls
Query: ?limit=5
```

### Get Event Type Distribution
```
GET /api/dashboard/event-types
```

---

## 🏗️ Architecture

### Layered Architecture
```
┌─────────────────────────────────────┐
│         Controllers                 │  ← HTTP Request Handlers
├─────────────────────────────────────┤
│         Services                    │  ← Business Logic
├─────────────────────────────────────┤
│         Repositories                │  ← Data Access Layer
├─────────────────────────────────────┤
│         Database (MySQL)            │  ← Data Storage
└─────────────────────────────────────┘
```

### Project Structure
```
backend/
├── src/
│   ├── config/          # Database configuration
│   ├── models/          # TypeScript interfaces
│   ├── repositories/    # Data access layer
│   ├── services/        # Business logic
│   ├── controllers/     # Request handlers
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   └── server.ts        # Entry point
├── database/
│   ├── schema.sql       # Database schema
│   └── seed.sql         # Sample data
├── package.json
├── tsconfig.json
└── .env
```

---

## 🔧 Technologies

- **Node.js** - Runtime environment
- **TypeScript** - Type safety
- **Express** - Web framework
- **MySQL2** - Database driver
- **dotenv** - Environment variables
- **CORS** - Cross-origin support

---

## ✅ Features

### Core Features
- ✅ Complete CRUD operations
- ✅ Advanced search and filtering
- ✅ Transaction management
- ✅ Error handling
- ✅ Input validation
- ✅ Request logging
- ✅ CORS enabled

### Business Logic
- ✅ Hall availability checking
- ✅ Booking with slot management
- ✅ Automatic balance calculation
- ✅ Status workflow management
- ✅ Dashboard analytics

### Code Quality
- ✅ TypeScript for type safety
- ✅ Repository pattern
- ✅ Service layer separation
- ✅ Async/await error handling
- ✅ Graceful shutdown
- ✅ Environment-based config

---

## 🧪 Testing

### Test with cURL

**Create Customer:**
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "9999888877",
    "email": "test@example.com",
    "city": "Mumbai"
  }'
```

**Get All Halls:**
```bash
curl http://localhost:5000/api/halls
```

**Create Booking:**
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "hall_id": 1,
    "package_id": 2,
    "event_date": "2025-12-20",
    "event_type": "wedding",
    "total_amount": 150000,
    "advance_amount": 75000,
    "payment_mode": "card"
  }'
```

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED
```
**Solution:** Check if MySQL is running and credentials in `.env` are correct

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Change PORT in `.env` or kill process using port 5000

### TypeScript Errors
```
npm run build
```
**Solution:** Fix TypeScript errors shown in output

---

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 3306 |
| DB_USER | Database user | root |
| DB_PASSWORD | Database password | - |
| DB_NAME | Database name | hall_sync |
| API_PREFIX | API route prefix | /api |
| CORS_ORIGIN | Allowed origin | http://localhost:5173 |

---

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### PM2 (Process Manager)
```bash
npm install -g pm2
pm2 start dist/server.js --name hall-sync-api
pm2 save
pm2 startup
```

---

## 📄 License

MIT License - Free to use for learning and commercial purposes

---

## 👨‍💻 Developer

Built with ❤️ by Hall Sync Team

**Status:** ✅ Production Ready

**Version:** 1.0.0
