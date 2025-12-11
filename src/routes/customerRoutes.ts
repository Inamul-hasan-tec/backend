/**
 * Customer Routes
 * API endpoints for customer operations
 */

import { Router } from 'express';
import * as customerController from '../controllers/customerController';

const router = Router();

// GET routes
router.get('/', customerController.getAllCustomers);
router.get('/search', customerController.searchCustomers);
router.get('/recent', customerController.getRecentCustomers);
router.get('/stats', customerController.getCustomerStats);
router.get('/:id', customerController.getCustomerById);

// POST routes
router.post('/', customerController.createCustomer);

// PUT routes
router.put('/:id', customerController.updateCustomer);

// DELETE routes
router.delete('/:id', customerController.deleteCustomer);

export default router;
