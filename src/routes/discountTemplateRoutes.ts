import express from 'express';
import { FlexibleBillingController } from '../controllers/FlexibleBillingController';

const router = express.Router();

/**
 * DISCOUNT TEMPLATES ROUTES
 * All routes are prefixed with /api/discount-templates
 */

// Get all discount templates
router.get('/', FlexibleBillingController.getDiscountTemplates);

// Create discount template
router.post('/', FlexibleBillingController.createDiscountTemplate);

// Update discount template
router.put('/:id', FlexibleBillingController.updateDiscountTemplate);

// Delete discount template
router.delete('/:id', FlexibleBillingController.deleteDiscountTemplate);

export default router;
