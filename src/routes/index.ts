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
import { auth } from '../middleware/auth';

const router = Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes (require authentication)
router.use('/customers', auth, customerRoutes);
router.use('/halls', auth, hallRoutes);
router.use('/packages', auth, packageRoutes);
router.use('/bookings', auth, bookingRoutes);
router.use('/slots', auth, slotRoutes);
router.use('/payments', auth, paymentRoutes);
router.use('/reminders', auth, reminderRoutes);
router.use('/dashboard', auth, dashboardRoutes);

// GST & Invoice routes (Phase 2)
router.use('/business-config', auth, businessConfigRoutes);
router.use('/services', auth, serviceCatalogRoutes);
router.use('/invoices', auth, invoiceRoutes);

// Smart Billing routes (Phase 3)
router.use('/smart-billing', auth, smartBillingRoutes);

// Flexible Billing routes (Phase 3B - Real-world features)
router.use('/flexible-billing', auth, flexibleBillingRoutes);

// Discount Templates routes (direct access)
router.use('/discount-templates', auth, discountTemplateRoutes);

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
