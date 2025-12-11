/**
 * Slot Routes
 * API endpoints for slot management
 */

import { Router } from 'express';
import * as slotController from '../controllers/slotController';

const router = Router();

// Get slots for a specific month
// GET /api/slots/2025/11?hall_id=1
router.get('/:year/:month', slotController.getSlots);

// Get available slots for a date range
// GET /api/slots/available?hall_id=1&date_from=2025-11-01&date_to=2025-11-30
router.get('/available', slotController.getAvailableSlots);

// Update slot status
// PUT /api/slots/123
router.put('/:id', slotController.updateSlot);

// Generate slots
// POST /api/slots/generate
router.post('/generate', slotController.generateSlots);

// Block/Unblock slot
// POST /api/slots/123/block
router.post('/:id/block', slotController.blockSlot);

export default router;
