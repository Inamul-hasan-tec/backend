/**
 * Payment Routes
 * API endpoints for payment management
 * Protected with RBAC permissions
 */

import { Router } from 'express';
import * as paymentController from '../controllers/paymentController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes - Require VIEW permission
router.get('/', 
  requirePermission(Permission.PAYMENT_LIST),
  paymentController.getPayments
);

router.get('/stats', 
  requirePermission(Permission.PAYMENT_VIEW),
  paymentController.getPaymentStats
);

router.get('/reconciliation',
  requirePermission(Permission.PAYMENT_VIEW),
  paymentController.getPaymentReconciliation
);

router.get('/booking/:bookingId', 
  requirePermission(Permission.PAYMENT_LIST),
  paymentController.getPaymentsByBooking
);

router.get('/:id', 
  requirePermission(Permission.PAYMENT_VIEW),
  paymentController.getPaymentById
);

// POST routes - Require CREATE permission
router.post('/', 
  requirePermission(Permission.PAYMENT_CREATE),
  paymentController.createPayment
);

router.post('/:id/verify',
  requirePermission(Permission.PAYMENT_UPDATE),
  paymentController.verifyPayment
);

router.post('/:id/reverse',
  requirePermission(Permission.PAYMENT_UPDATE),
  paymentController.reversePayment
);

router.post('/:id/fail',
  requirePermission(Permission.PAYMENT_UPDATE),
  paymentController.markPaymentFailed
);

export default router;
