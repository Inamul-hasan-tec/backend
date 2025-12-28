/**
 * Hall Sync Backend Server
 * Main entry point for the application
 */

import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, closePool } from './config/db';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// Middleware
// ============================================

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'||'http://localhost:8001',
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use(requestLogger);

// ============================================
// Routes
// ============================================

// API routes
app.use(API_PREFIX, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Hall Sync API',
    version: '1.0.0',
    documentation: `${req.protocol}://${req.get('host')}${API_PREFIX}/health`,
    endpoints: {
      customers: `${API_PREFIX}/customers`,
      halls: `${API_PREFIX}/halls`,
      packages: `${API_PREFIX}/packages`,
      bookings: `${API_PREFIX}/bookings`,
      dashboard: `${API_PREFIX}/dashboard`,
    },
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// Server Startup
// ============================================

/**
 * Start the server
 */
async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      console.error('Please check your database configuration in .env file');
      process.exit(1);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('🎉 Hall Sync Backend Server Started');
      console.log('═══════════════════════════════════════════════');
      console.log(`🚀 Server running on: http://localhost:${PORT}`);
      console.log(`📡 API endpoint: http://localhost:${PORT}${API_PREFIX}`);
      console.log(`🏥 Health check: http://localhost:${PORT}${API_PREFIX}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('═══════════════════════════════════════════════');
      console.log('');
      console.log('📋 Available Endpoints:');
      console.log(`   • Customers:  ${API_PREFIX}/customers`);
      console.log(`   • Halls:      ${API_PREFIX}/halls`);
      console.log(`   • Packages:   ${API_PREFIX}/packages`);
      console.log(`   • Bookings:   ${API_PREFIX}/bookings`);
      console.log(`   • Dashboard:  ${API_PREFIX}/dashboard`);
      console.log('');
      console.log('✅ Server is ready to accept requests!');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================
// Graceful Shutdown
// ============================================

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await closePool();
    console.log('✅ Database connections closed');
    
    console.log('✅ Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();

export default app;
