import express from 'express';
import { FlexibleBillingController } from '../controllers/FlexibleBillingController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = express.Router();

/**
 * DISCOUNT TEMPLATES ROUTES
 * All routes are prefixed with /api/discount-templates
 */

// Get all discount templates
router.get('/', requirePermission(Permission.INVOICE_VIEW), FlexibleBillingController.getDiscountTemplates);

// Create discount template
router.post('/', requirePermission(Permission.INVOICE_CREATE), FlexibleBillingController.createDiscountTemplate);

// Update discount template
router.put('/:id', requirePermission(Permission.INVOICE_UPDATE), FlexibleBillingController.updateDiscountTemplate);

// Delete discount template
router.delete('/:id', requirePermission(Permission.INVOICE_DELETE), FlexibleBillingController.deleteDiscountTemplate);

export default router;
