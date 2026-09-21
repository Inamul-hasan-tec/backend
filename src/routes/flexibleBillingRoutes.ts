import express from 'express';
import { FlexibleBillingController } from '../controllers/FlexibleBillingController';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * PRIVATE NOTES ROUTES
 */

// Add private note to booking
router.post('/bookings/:id/private-notes', requirePermission(Permission.INVOICE_UPDATE), FlexibleBillingController.addPrivateNote);

// Get private notes for booking
router.get('/bookings/:id/private-notes', requirePermission(Permission.INVOICE_VIEW), FlexibleBillingController.getPrivateNotes);

// Delete private note
router.delete('/private-notes/:id', requirePermission(Permission.INVOICE_UPDATE), FlexibleBillingController.deletePrivateNote);

/**
 * ADDITIONAL PAYMENTS ROUTES
 */

// Add additional payment (undisclosed)
router.post('/bookings/:id/additional-payments', requirePermission(Permission.PAYMENT_CREATE), FlexibleBillingController.addAdditionalPayment);

// Get additional payments for booking
router.get('/bookings/:id/additional-payments', requirePermission(Permission.PAYMENT_LIST), FlexibleBillingController.getAdditionalPayments);

/**
 * DISCOUNT TEMPLATES ROUTES
 */

// Get all discount templates
router.get('/discount-templates', requirePermission(Permission.INVOICE_VIEW), FlexibleBillingController.getDiscountTemplates);

// Create discount template
router.post('/discount-templates', requirePermission(Permission.INVOICE_CREATE), FlexibleBillingController.createDiscountTemplate);

// Update discount template
router.put('/discount-templates/:id', requirePermission(Permission.INVOICE_UPDATE), FlexibleBillingController.updateDiscountTemplate);

// Delete discount template
router.delete('/discount-templates/:id', requirePermission(Permission.INVOICE_DELETE), FlexibleBillingController.deleteDiscountTemplate);

/**
 * BOOKING SUMMARY ROUTES
 */

// Get booking summary (actual vs invoiced)
router.get('/bookings/:id/summary', requirePermission(Permission.INVOICE_VIEW), FlexibleBillingController.getBookingSummary);

// Update booking amounts
router.put('/bookings/:id/amounts', requirePermission(Permission.INVOICE_UPDATE), FlexibleBillingController.updateBookingAmounts);

/**
 * GST REPORTS ROUTES
 */

// Generate flexible GST report
router.post('/gst-reports/generate', requirePermission(Permission.REPORT_EXPORT), FlexibleBillingController.generateGSTReport);

export default router;
