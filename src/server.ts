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
import { installStructuredConsoleBridge, logger } from './utils/logger';
import { captureError, isEnabled as isMonitoringEnabled } from './utils/errorMonitor';

// Load environment variables
dotenv.config();
installStructuredConsoleBridge();

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = process.env.API_PREFIX || '/api';
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 2) {
  throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 2');
}

if (trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const developmentOrigins = [
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
  'http://localhost:3000',
];
const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? configuredOrigins
    : [...developmentOrigins, ...configuredOrigins];

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must be configured in production');
}

// ============================================
// Middleware
// ============================================

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
};

// CORS configuration
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Skip body parsing for multipart/form-data
app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  next();
});

// Body parsers
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
    logger.info('database_connection_check_started');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('database_connection_check_failed');
      process.exit(1);
    }

    // Start Express server
    app.listen(PORT, () => {
      logger.info('server_started', {
        port: Number(PORT),
        api_prefix: API_PREFIX,
        health_path: `${API_PREFIX}/health`,
      });
      if (isMonitoringEnabled()) {
        logger.info('error_monitoring_enabled', { dsn_configured: true });
      }
    });
  } catch (error) {
    logger.error('server_start_failed', { error });
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
  logger.info('graceful_shutdown_started', { signal });
  
  try {
    // Close database connections
    await closePool();
    logger.info('graceful_shutdown_completed', { signal });
    process.exit(0);
  } catch (error) {
    logger.error('graceful_shutdown_failed', { signal, error });
    process.exit(1);
  }
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error });
  captureError(error, { source: 'uncaughtException' });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('unhandled_rejection', { reason, promise: String(promise) });
  captureError(reason, { source: 'unhandledRejection' });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();

export default app;
