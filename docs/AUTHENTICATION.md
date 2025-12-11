# 🔐 Authentication System

**Last Updated:** 2025-10-17  
**Purpose:** Complete authentication documentation  
**Audience:** Developers

---

## 📖 Overview

Hall Sync API uses **Bearer Token Authentication** for protected endpoints. This is currently a mock authentication system designed for development and testing.

---

## 🚀 Quick Start

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
    "role": "admin",
    "name": "Admin User"
  }
}
```

### 2. Use Token
Add to request headers:
```
Authorization: Bearer mock-jwt-token-for-development
```

---

## 🔄 Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /api/auth/login
       │    { username, password }
       ▼
┌─────────────────┐
│ Auth Controller │
│   Validates     │
└────────┬────────┘
         │
         │ 2. Returns { token, user }
         ▼
    ┌─────────┐
    │ Client  │
    │  Saves  │
    │  Token  │
    └────┬────┘
         │
         │ 3. Subsequent requests
         │    Authorization: Bearer <token>
         ▼
    ┌──────────────┐
    │ Auth         │
    │ Middleware   │
    │ Validates    │
    └──────┬───────┘
           │
           │ 4. Token valid ✓
           │    Attach user to request
           ▼
      ┌──────────────┐
      │  Controller  │
      │  Processes   │
      └──────────────┘
```

---

## 🔑 Endpoints

### Public Endpoints (No Auth Required)
- `POST /api/auth/login` - Get authentication token
- `GET /api/health` - Health check

### Protected Endpoints (Auth Required)
- `GET /api/auth/user` - Get current user
- All `/api/customers/*` endpoints
- All `/api/halls/*` endpoints
- All `/api/packages/*` endpoints
- All `/api/bookings/*` endpoints
- All `/api/dashboard/*` endpoints

---

## 💻 Implementation

### Middleware (`src/middleware/auth.ts`)
```typescript
export const auth = (req: Request, res: Response, next: NextFunction) => {
  // Get token from header
  const token = req.header('x-auth-token') || 
                req.header('Authorization')?.replace('Bearer ', '') || 
                (req.query.token as string);

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No authentication token, access denied' 
    });
  }

  // Mock token verification
  if (token === 'mock-jwt-token-for-development') {
    (req as any).user = MOCK_USER;
    return next();
  }

  return res.status(401).json({ 
    success: false, 
    message: 'Token is not valid' 
  });
};
```

### Controller (`src/controllers/authController.ts`)
```typescript
export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both username and password'
    });
  }

  const result = mockLogin(username, password);

  if (!result.success) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  res.json({
    success: true,
    token: result.token,
    user: result.user
  });
};
```

### Routes (`src/routes/authRoutes.ts`)
```typescript
import { Router } from 'express';
import * as authController from '../controllers/authController';
import { auth } from '../middleware/auth';

const router = Router();

router.post('/login', authController.login);
router.get('/user', auth, authController.getCurrentUser);

export default router;
```

---

## 🧪 Testing

### Using cURL

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Get Customers (with token):**
```bash
curl -X GET http://localhost:5000/api/customers \
  -H "Authorization: Bearer mock-jwt-token-for-development"
```

**Alternative header:**
```bash
curl -X GET http://localhost:5000/api/customers \
  -H "x-auth-token: mock-jwt-token-for-development"
```

### Using Postman

1. **Automatic (Recommended):**
   - Import collection
   - Run "Login (Get Token)"
   - Token auto-saved and used

2. **Manual:**
   - Collection Settings → Authorization
   - Type: Bearer Token
   - Token: `mock-jwt-token-for-development`

---

## 🎨 Frontend Integration

### React Example

```javascript
// Login function
const login = async (username, password) => {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  
  return data;
};

// Authenticated request
const getCustomers = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:5000/api/customers', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### Axios Interceptor

```javascript
import axios from 'axios';

// Add token to all requests
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Handle auth errors
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token invalid or expired
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## ⚠️ Error Responses

### 401 Unauthorized - No Token
```json
{
  "success": false,
  "message": "No authentication token, access denied"
}
```

### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "message": "Token is not valid"
}
```

### 400 Bad Request - Missing Credentials
```json
{
  "success": false,
  "message": "Please provide both username and password"
}
```

### 401 Unauthorized - Invalid Credentials
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## 🔐 Mock Authentication Details

### Current Implementation
- **Type:** Mock/Static token
- **Token:** `mock-jwt-token-for-development`
- **Expiration:** Never expires
- **User:** Single admin user
- **Security:** NOT production-ready

### Mock Credentials
```
Username: admin
Password: admin123
```

### Mock User Object
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "name": "Admin User"
}
```

---

## 🚀 Production Migration

### What Needs to Change:

#### 1. Install Dependencies
```bash
npm install jsonwebtoken bcryptjs
npm install --save-dev @types/jsonwebtoken @types/bcryptjs
```

#### 2. Update Environment Variables
```env
JWT_SECRET=your-super-secret-key-minimum-32-characters
JWT_EXPIRE=7d
```

#### 3. Implement Real JWT
```typescript
import jwt from 'jsonwebtoken';

// Generate token
const token = jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET!,
  { expiresIn: process.env.JWT_EXPIRE }
);

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET!);
```

#### 4. Add User Database
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'customer') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. Hash Passwords
```typescript
import bcrypt from 'bcryptjs';

// Hash password
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// Compare password
const isMatch = await bcrypt.compare(password, user.password_hash);
```

#### 6. Add Token Expiration
```typescript
export const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token expired or invalid' });
  }
};
```

#### 7. Add Refresh Tokens
```typescript
// Generate refresh token
const refreshToken = jwt.sign(
  { id: user.id },
  process.env.REFRESH_TOKEN_SECRET!,
  { expiresIn: '30d' }
);

// Store in database
await RefreshToken.create({ userId: user.id, token: refreshToken });
```

#### 8. Add Security Features
- Rate limiting
- HTTPS only
- CORS configuration
- Token blacklisting
- Password reset flow
- Email verification
- Two-factor authentication (optional)

---

## 🐛 Troubleshooting

### Issue: "No authentication token, access denied"
**Cause:** Token not included in request  
**Solution:** Ensure token is in Authorization header

### Issue: "Token is not valid"
**Cause:** Token doesn't match expected value  
**Solution:** Use exact token: `mock-jwt-token-for-development`

### Issue: Login returns 401
**Cause:** Invalid credentials  
**Solution:** Use username: `admin`, password: `admin123`

### Issue: Token not being sent from frontend
**Cause:** Token not stored or not added to headers  
**Solution:** Check localStorage and axios interceptor

---

## ✅ Security Checklist

### Current (Development)
- ✅ Basic authentication flow
- ✅ Token validation
- ✅ Protected routes
- ❌ No password hashing
- ❌ No token expiration
- ❌ No refresh tokens
- ❌ No rate limiting

### Production Requirements
- [ ] Real JWT implementation
- [ ] Password hashing with bcrypt
- [ ] Token expiration
- [ ] Refresh token system
- [ ] User database
- [ ] Rate limiting
- [ ] HTTPS only
- [ ] Environment variables
- [ ] Token blacklisting
- [ ] Password reset flow

---

## 📚 Related Documentation

- **API Reference:** `backend/docs/API-REFERENCE.md`
- **Testing Guide:** `backend/docs/TESTING.md`
- **Database Schema:** `backend/database/SCHEMA-DOCUMENTATION.md`

---

**Last Updated:** 2025-10-17  
**Status:** Mock Implementation (Development Only)  
**Production Ready:** No - Requires migration
