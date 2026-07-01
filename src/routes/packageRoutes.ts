/**
 * Package Routes
 * API endpoints for package operations
 * Protected with RBAC permissions
 */

import { Router } from 'express';
import * as packageController from '../controllers/packageController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes - Require VIEW permission
router.get('/', 
  requirePermission(Permission.PACKAGE_LIST),
  packageController.getAllPackages
);

router.get('/search', 
  requirePermission(Permission.PACKAGE_LIST),
  packageController.searchPackages
);

router.get('/active', 
  requirePermission(Permission.PACKAGE_LIST),
  packageController.getActivePackages
);

router.get('/popular', 
  requirePermission(Permission.PACKAGE_LIST),
  packageController.getPopularPackages
);

router.get('/:id', 
  requirePermission(Permission.PACKAGE_VIEW),
  packageController.getPackageById
);

// POST routes - Require CREATE permission
router.post('/', 
  requirePermission(Permission.PACKAGE_CREATE),
  packageController.createPackage
);

// PUT routes - Require UPDATE permission
router.put('/:id', 
  requirePermission(Permission.PACKAGE_UPDATE),
  packageController.updatePackage
);

// DELETE routes - Require DELETE permission
router.delete('/:id', 
  requirePermission(Permission.PACKAGE_DELETE),
  packageController.deletePackage
);

export default router;
