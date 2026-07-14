/**
 * Booking Routes
 * API endpoints for booking operations
 * Protected with RBAC permissions
 */

import { Router } from 'express';
import * as bookingController from '../controllers/bookingController';
import { requirePermission, requireAllPermissions } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes - Require VIEW permission
router.get('/', 
  requirePermission(Permission.BOOKING_LIST),
  bookingController.getAllBookings
);

router.get('/search', 
  requirePermission(Permission.BOOKING_LIST),
  bookingController.searchBookings
);

router.get('/upcoming', 
  requirePermission(Permission.BOOKING_LIST),
  bookingController.getUpcomingBookings
);

router.get('/today', 
  requirePermission(Permission.BOOKING_LIST),
  bookingController.getTodaysBookings
);

router.get('/stats', 
  requirePermission(Permission.BOOKING_VIEW),
  bookingController.getBookingStats
);

router.get('/:id', 
  requirePermission(Permission.BOOKING_VIEW),
  bookingController.getBookingById
);

// POST routes - Require CREATE permission
router.post('/', 
  requirePermission(Permission.BOOKING_CREATE),
  bookingController.createBooking
);

// Confirm booking - Requires UPDATE and CONFIRM permissions
router.post('/:id/confirm', 
  requireAllPermissions([Permission.BOOKING_UPDATE, Permission.BOOKING_CONFIRM]),
  bookingController.confirmBooking
);

// Cancel booking - Requires UPDATE and CANCEL permissions
router.post('/:id/cancel', 
  requireAllPermissions([Permission.BOOKING_UPDATE, Permission.BOOKING_CANCEL]),
  bookingController.cancelBooking
);

// Complete booking - Requires UPDATE permission
router.post('/:id/complete', 
  requirePermission(Permission.BOOKING_UPDATE),
  bookingController.completeBooking
);

// PUT routes - Require UPDATE permission
router.put('/:id', 
  requirePermission(Permission.BOOKING_UPDATE),
  bookingController.updateBooking
);

export default router;
