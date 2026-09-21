/**
 * Slot Routes
 * API endpoints for slot management
 */

import { Router } from 'express';
import * as slotController from '../controllers/slotController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// Get availability health diagnostics
// GET /api/slots/health
router.get('/health', requirePermission(Permission.BOOKING_LIST), slotController.getAvailabilityHealth);

// Get slots for a specific month
// GET /api/slots/2025/11?hall_id=1
router.get('/:year/:month', requirePermission(Permission.BOOKING_LIST), slotController.getSlots);

// Get available slots for a date range
// GET /api/slots/available?hall_id=1&date_from=2025-11-01&date_to=2025-11-30
router.get('/available', requirePermission(Permission.BOOKING_LIST), slotController.getAvailableSlots);

// Update slot status
// PUT /api/slots/123
router.put('/:id', requirePermission(Permission.BOOKING_UPDATE), slotController.updateSlot);

// Generate slots
// POST /api/slots/generate
router.post('/generate', requirePermission(Permission.BOOKING_UPDATE), slotController.generateSlots);

// Block/Unblock slot
// POST /api/slots/123/block
router.post('/:id/block', requirePermission(Permission.BOOKING_UPDATE), slotController.blockSlot);

export default router;
