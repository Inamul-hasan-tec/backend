/**
 * Hall Routes
 * API endpoints for hall operations
 * Protected with RBAC permissions
 */

import { Router } from 'express';
import * as hallController from '../controllers/hallController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes - Require VIEW permission
router.get('/', 
  requirePermission(Permission.HALL_LIST),
  hallController.getAllHalls
);

router.get('/search', 
  requirePermission(Permission.HALL_LIST),
  hallController.searchHalls
);

router.get('/active', 
  requirePermission(Permission.HALL_LIST),
  hallController.getActiveHalls
);

router.get('/:id', 
  requirePermission(Permission.HALL_VIEW),
  hallController.getHallById
);

router.get('/:id/availability', 
  requirePermission(Permission.HALL_VIEW),
  hallController.checkHallAvailability
);

router.get('/:id/availability-range', 
  requirePermission(Permission.HALL_VIEW),
  hallController.getHallAvailabilityRange
);

// POST routes - Require CREATE permission
router.post('/', 
  requirePermission(Permission.HALL_CREATE),
  hallController.createHall
);

// PUT routes - Require UPDATE permission
router.put('/:id', 
  requirePermission(Permission.HALL_UPDATE),
  hallController.updateHall
);

// DELETE routes - Require DELETE permission
router.delete('/:id', 
  requirePermission(Permission.HALL_DELETE),
  hallController.deleteHall
);

// Hall Images Routes - MOVED TO hallImageRoutes.ts
// These routes are now handled by hallImageRoutes.ts with proper multiparty middleware
// router.get('/:hallId/images', HallImageController.getHallImages.bind(HallImageController));
// router.post('/:hallId/images', HallImageController.uploadImage.bind(HallImageController));
// router.put('/:hallId/images/reorder', HallImageController.reorderImages.bind(HallImageController));
// router.put('/images/:id', HallImageController.updateImage.bind(HallImageController));
// router.delete('/images/:id', HallImageController.deleteImage.bind(HallImageController));
// router.put('/images/:id/primary', HallImageController.setPrimary.bind(HallImageController));

export default router;
