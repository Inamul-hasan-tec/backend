/**
 * Hall Routes
 * API endpoints for hall operations
 */

import { Router } from 'express';
import * as hallController from '../controllers/hallController';

const router = Router();

// GET routes
router.get('/', hallController.getAllHalls);
router.get('/search', hallController.searchHalls);
router.get('/active', hallController.getActiveHalls);
router.get('/:id', hallController.getHallById);
router.get('/:id/availability', hallController.checkHallAvailability);
router.get('/:id/availability-range', hallController.getHallAvailabilityRange);

// POST routes
router.post('/', hallController.createHall);

// PUT routes
router.put('/:id', hallController.updateHall);

// DELETE routes
router.delete('/:id', hallController.deleteHall);

export default router;
