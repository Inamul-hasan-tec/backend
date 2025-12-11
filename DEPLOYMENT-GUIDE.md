# 🚀 Hall Sync Backend - Deployment Guide

## ✅ Completed Steps

### 1. Database Setup (FreeSQLDatabase)
- ✅ Database created and configured
- ✅ Schema imported successfully
- ✅ 8 tables created (users, customers, halls, packages, bookings, slots, payments, audit_logs)
- ✅ Sample data inserted (1 admin user, 3 halls, 3 packages)

**Database Credentials:**
- Host: `sql12.freesqldatabase.com`
- Port: `3306`
- Database: `sql12811442`
- Username: `sql12811442`
- Password: `q7UHJn19md`

**Default Admin Login:**
- Email: `admin@hallsync.com`
- Password: `admin123` (⚠️ Change after first login!)

### 2. Backend Configuration
- ✅ Environment variables configured
- ✅ Database connection tested and working
- ✅ Build successful
- ✅ Local server tested on port 5000

---

## 🌐 Deploy to Render.com (Recommended - Free Tier)

### Step 1: Create GitHub Repository

1. **Go to GitHub** (https://github.com)
2. **Create a new repository:**
   - Name: `hall-sync-backend`
   - Description: `Hall Sync - Marriage Hall Booking System Backend`
   - Visibility: Public or Private
   - Don't initialize with README (we already have one)

3. **Push your code to GitHub:**
   ```bash
   cd /Users/inamulhasan/Desktop/Frontend\ Course/untitled\ folder/hall-sync-complete/backend
   
   # Add remote repository (replace YOUR_USERNAME with your GitHub username)
   git remote add origin https://github.com/YOUR_USERNAME/hall-sync-backend.git
   
   # Push to GitHub
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Render

1. **Go to Render** (https://render.com)
2. **Sign up/Login** (you can use GitHub to sign in)
3. **Click "New +" → "Web Service"**
4. **Connect your GitHub repository:**
   - Select `hall-sync-backend` repository
   - Click "Connect"

5. **Configure the service:**
   - **Name:** `hall-sync-backend`
   - **Region:** Singapore (or closest to you)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

6. **Add Environment Variables** (click "Advanced" → "Add Environment Variable"):
   ```
   NODE_ENV=production
   PORT=5000
   DB_HOST=sql12.freesqldatabase.com
   DB_PORT=3306
   DB_USER=sql12811442
   DB_PASSWORD=q7UHJn19md
   DB_NAME=sql12811442
   DB_CONNECTION_LIMIT=10
   DB_QUEUE_LIMIT=0
   JWT_SECRET=hall-sync-secret-key-2025-production-ready-min-32-characters
   JWT_EXPIRES_IN=7d
   BCRYPT_ROUNDS=10
   API_PREFIX=/api
   CORS_ORIGIN=*
   LOG_LEVEL=info
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=hasaninamul678@gmail.com
   SMTP_PASS=cthl mtod odly wqou
   ```

7. **Click "Create Web Service"**

8. **Wait for deployment** (5-10 minutes)
   - Render will build and deploy your app
   - You'll get a URL like: `https://hall-sync-backend.onrender.com`

9. **Test your API:**
   - Health check: `https://hall-sync-backend.onrender.com/api/health`
   - Login: `POST https://hall-sync-backend.onrender.com/api/auth/login`

---

## 🔄 Alternative: Deploy to Railway.app

### Step 1: Deploy to Railway

1. **Go to Railway** (https://railway.app)
2. **Sign up/Login** with GitHub
3. **Click "New Project" → "Deploy from GitHub repo"**
4. **Select your repository:** `hall-sync-backend`
5. **Railway will auto-detect Node.js**

### Step 2: Configure Environment Variables

1. **Go to your project → Variables tab**
2. **Add all environment variables** (same as Render above)

### Step 3: Configure Build & Start

1. **Go to Settings**
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `npm start`
4. **Click "Deploy"**

Your app will be available at: `https://your-app.railway.app`

---

## 📱 Next Steps: Frontend Deployment

Once your backend is deployed, you'll need to:

1. **Update Frontend API URL:**
   - Replace `http://localhost:5000` with your deployed backend URL
   - Example: `https://hall-sync-backend.onrender.com`

2. **Deploy Frontend** (options):
   - **Vercel** (Recommended for React/Next.js)
   - **Netlify** (Great for static sites)
   - **GitHub Pages** (Free, but limited)

---

## 🧪 Testing Your Deployed Backend

### 1. Health Check
```bash
curl https://YOUR-BACKEND-URL/api/health
```

### 2. Login Test
```bash
curl -X POST https://YOUR-BACKEND-URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hallsync.com",
    "password": "admin123"
  }'
```

### 3. Get Halls
```bash
curl https://YOUR-BACKEND-URL/api/halls
```

---

## 📊 Database Management

### Access phpMyAdmin
- URL: http://www.phpmyadmin.co
- Server: `sql12.freesqldatabase.com`
- Username: `sql12811442`
- Password: `q7UHJn19md`

### Backup Database
```bash
# Run this from your local machine
node import-cloud-schema.js
```

---

## ⚠️ Important Notes

1. **Free Tier Limitations:**
   - Render: Service sleeps after 15 min of inactivity (first request takes ~30s)
   - FreeSQLDatabase: 5MB storage limit
   - Consider upgrading for production use

2. **Security:**
   - Change default admin password immediately
   - Use environment variables for sensitive data
   - Enable HTTPS (automatic on Render/Railway)

3. **Monitoring:**
   - Check Render/Railway logs for errors
   - Monitor database size in phpMyAdmin
   - Set up uptime monitoring (e.g., UptimeRobot)

---

## 🎉 Deployment Checklist

- [x] Database created and configured
- [x] Schema imported
- [x] Backend tested locally
- [x] Code committed to Git
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Render/Railway account created
- [ ] Backend deployed to cloud
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Frontend updated with backend URL
- [ ] Frontend deployed

---

## 🆘 Troubleshooting

### Database Connection Issues
- Verify credentials in environment variables
- Check if FreeSQLDatabase is accessible
- Review logs in Render/Railway dashboard

### Build Failures
- Check Node.js version compatibility
- Verify all dependencies in package.json
- Review build logs for specific errors

### API Not Responding
- Check if service is running in dashboard
- Verify CORS settings
- Check logs for runtime errors

---

## 📞 Support

If you encounter issues:
1. Check the logs in Render/Railway dashboard
2. Review this deployment guide
3. Test database connection using `test-db-connection.js`
4. Verify all environment variables are set correctly

---

**Good luck with your deployment! 🚀**
