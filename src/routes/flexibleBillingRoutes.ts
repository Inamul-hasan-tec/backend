import express from 'express';
import { FlexibleBillingController } from '../controllers/FlexibleBillingController';
import { auth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * PRIVATE NOTES ROUTES
 */

// Add private note to booking
router.post('/bookings/:id/private-notes', FlexibleBillingController.addPrivateNote);

// Get private notes for booking
router.get('/bookings/:id/private-notes', FlexibleBillingController.getPrivateNotes);

// Delete private note
router.delete('/private-notes/:id', FlexibleBillingController.deletePrivateNote);

/**
 * ADDITIONAL PAYMENTS ROUTES
 */

// Add additional payment (undisclosed)
router.post('/bookings/:id/additional-payments', FlexibleBillingController.addAdditionalPayment);

// Get additional payments for booking
router.get('/bookings/:id/additional-payments', FlexibleBillingController.getAdditionalPayments);

/**
 * DISCOUNT TEMPLATES ROUTES
 */

// Get all discount templates
router.get('/discount-templates', FlexibleBillingController.getDiscountTemplates);

// Create discount template
router.post('/discount-templates', FlexibleBillingController.createDiscountTemplate);

// Update discount template
router.put('/discount-templates/:id', FlexibleBillingController.updateDiscountTemplate);

// Delete discount template
router.delete('/discount-templates/:id', FlexibleBillingController.deleteDiscountTemplate);

/**
 * BOOKING SUMMARY ROUTES
 */

// Get booking summary (actual vs invoiced)
router.get('/bookings/:id/summary', FlexibleBillingController.getBookingSummary);

// Update booking amounts
router.put('/bookings/:id/amounts', FlexibleBillingController.updateBookingAmounts);

/**
 * GST REPORTS ROUTES
 */

// Generate flexible GST report
router.post('/gst-reports/generate', FlexibleBillingController.generateGSTReport);

export default router;
