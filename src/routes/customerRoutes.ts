/**
 * Customer Routes
 * API endpoints for customer operations
 * Protected with RBAC permissions
 */

import { Router } from 'express';
import * as customerController from '../controllers/customerController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes - Require VIEW permission
router.get('/', 
  requirePermission(Permission.CUSTOMER_LIST),
  customerController.getAllCustomers
);

router.get('/search', 
  requirePermission(Permission.CUSTOMER_LIST),
  customerController.searchCustomers
);

router.get('/recent', 
  requirePermission(Permission.CUSTOMER_LIST),
  customerController.getRecentCustomers
);

router.get('/stats', 
  requirePermission(Permission.CUSTOMER_VIEW),
  customerController.getCustomerStats
);

router.get('/:id', 
  requirePermission(Permission.CUSTOMER_VIEW),
  customerController.getCustomerById
);

// POST routes - Require CREATE permission
router.post('/', 
  requirePermission(Permission.CUSTOMER_CREATE),
  customerController.createCustomer
);

// PUT routes - Require UPDATE permission
router.put('/:id', 
  requirePermission(Permission.CUSTOMER_UPDATE),
  customerController.updateCustomer
);

// DELETE routes - Require DELETE permission
router.delete('/:id', 
  requirePermission(Permission.CUSTOMER_DELETE),
  customerController.deleteCustomer
);

export default router;
