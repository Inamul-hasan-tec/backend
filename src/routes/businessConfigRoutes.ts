/**
 * Business Configuration Routes
 */

import { Router } from 'express';
import BusinessConfigController from '../controllers/BusinessConfigController';
import { auth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(auth);

// GET /api/business-config - Get active business configuration
router.get('/', BusinessConfigController.getConfig.bind(BusinessConfigController));

// PUT /api/business-config/:id - Update business configuration
router.put('/:id', BusinessConfigController.updateConfig.bind(BusinessConfigController));

// GET /api/business-config/validate-gstin/:gstin - Validate GSTIN
router.get('/validate-gstin/:gstin', BusinessConfigController.validateGstin.bind(BusinessConfigController));

// GET /api/business-config/state-codes - Get Indian state codes
router.get('/state-codes', BusinessConfigController.getStateCodes.bind(BusinessConfigController));

export default router;
