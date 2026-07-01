/**
 * Route Aggregator
 * Combines all routes with API prefix
 */

import { Router } from 'express';
import customerRoutes from './customerRoutes';
import hallRoutes from './hallRoutes';
import packageRoutes from './packageRoutes';
import bookingRoutes from './bookingRoutes';
import dashboardRoutes from './dashboardRoutes';
import authRoutes from './authRoutes';
import slotRoutes from './slotRoutes';
import paymentRoutes from './paymentRoutes';
import reminderRoutes from './reminderRoutes';
import businessConfigRoutes from './businessConfigRoutes';
import serviceCatalogRoutes from './serviceCatalogRoutes';
import invoiceRoutes from './invoiceRoutes';
import smartBillingRoutes from './smartBillingRoutes';
import flexibleBillingRoutes from './flexibleBillingRoutes';
import discountTemplateRoutes from './discountTemplateRoutes';
import tenantRoutes from './tenantRoutes';
// import hallImageRoutes from './hallImageRoutes'; // DEPRECATED - replaced by galleryRoutes
import userRoutes from './userRoutes';
import settingsRoutes from './settingsRoutes';
import galleryRoutes from './galleryRoutes';
import platformRoutes from './platformRoutes';
import { auth } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenantMiddleware';

const router = Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes (require authentication + tenant context)
router.use('/customers', auth, tenantMiddleware, customerRoutes);
router.use('/halls', auth, tenantMiddleware, hallRoutes);
router.use('/halls', auth, tenantMiddleware, galleryRoutes);
router.use('/packages', auth, tenantMiddleware, packageRoutes);
router.use('/bookings', auth, tenantMiddleware, bookingRoutes);
router.use('/slots', auth, tenantMiddleware, slotRoutes);
router.use('/payments', auth, tenantMiddleware, paymentRoutes);
router.use('/reminders', auth, tenantMiddleware, reminderRoutes);
router.use('/dashboard', auth, tenantMiddleware, dashboardRoutes);

// GST & Invoice routes (Phase 2)
router.use('/business-config', auth, tenantMiddleware, businessConfigRoutes);
router.use('/services', auth, tenantMiddleware, serviceCatalogRoutes);
router.use('/invoices', auth, tenantMiddleware, invoiceRoutes);

// Smart Billing routes (Phase 3)
router.use('/smart-billing', auth, tenantMiddleware, smartBillingRoutes);

// Flexible Billing routes (Phase 3B - Real-world features)
router.use('/flexible-billing', auth, tenantMiddleware, flexibleBillingRoutes);

// Discount Templates routes (direct access)
router.use('/discount-templates', auth, tenantMiddleware, discountTemplateRoutes);

// User management routes (Phase 2 - RBAC)
router.use('/users', auth, tenantMiddleware, userRoutes);

// Multi-Tenancy routes (Phase 4 - SaaS)
// NOTE: tenantMiddleware removed - tenant routes handle their own tenant logic
router.use('/tenants', auth, tenantRoutes);
router.use('/platform', auth, platformRoutes);

// Settings routes (Phase 2 - Advanced Features)
router.use('/settings', auth, tenantMiddleware, settingsRoutes);

// Gallery routes (Phase 5 - Gallery System) - Merged with hallRoutes above
// Note: galleryRoutes are now mounted within hallRoutes

// Health check endpoint (public)
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Hall Sync API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Root endpoint (public)
router.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    success: true,
    message: 'Welcome to Hall Sync API',
    version: '1.0.0',
    documentation: `${baseUrl}/api/health`,
    auth: {
      login: `${baseUrl}/api/auth/login`,
      getCurrentUser: `${baseUrl}/api/auth/user`
    },
    endpoints: {
      customers: `${baseUrl}/api/customers`,
      halls: `${baseUrl}/api/halls`,
      packages: `${baseUrl}/api/packages`,
      bookings: `${baseUrl}/api/bookings`,
      slots: `${baseUrl}/api/slots`,
      payments: `${baseUrl}/api/payments`,
      reminders: `${baseUrl}/api/reminders`,
      dashboard: `${baseUrl}/api/dashboard`,
      businessConfig: `${baseUrl}/api/business-config`,
      services: `${baseUrl}/api/services`,
      invoices: `${baseUrl}/api/invoices`,
    },
  });
});

export default router;
