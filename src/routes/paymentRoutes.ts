/**
 * Payment Routes
 * API endpoints for payment management
 */

import { Router } from 'express';
import * as paymentController from '../controllers/paymentController';

const router = Router();

// Get all payments
router.get('/', paymentController.getPayments);

// Get payment statistics
router.get('/stats', paymentController.getPaymentStats);

// Get payments for a booking
router.get('/booking/:bookingId', paymentController.getPaymentsByBooking);

// Get payment by ID
router.get('/:id', paymentController.getPaymentById);

// Create new payment
router.post('/', paymentController.createPayment);

export default router;
