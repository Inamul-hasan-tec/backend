/**
 * Booking Routes
 * API endpoints for booking operations
 */

import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';

const router = Router();

// GET routes
router.get('/', bookingController.getAllBookings);
router.get('/search', bookingController.searchBookings);
router.get('/upcoming', bookingController.getUpcomingBookings);
router.get('/today', bookingController.getTodaysBookings);
router.get('/stats', bookingController.getBookingStats);
router.get('/:id', bookingController.getBookingById);

// POST routes
router.post('/', bookingController.createBooking);
router.post('/:id/confirm', bookingController.confirmBooking);
router.post('/:id/cancel', bookingController.cancelBooking);
router.post('/:id/complete', bookingController.completeBooking);

// PUT routes
router.put('/:id', bookingController.updateBooking);

export default router;
