/**
 * Package Routes
 * API endpoints for package operations
 */

import { Router } from 'express';
import * as packageController from '../controllers/packageController';

const router = Router();

// GET routes
router.get('/', packageController.getAllPackages);
router.get('/search', packageController.searchPackages);
router.get('/active', packageController.getActivePackages);
router.get('/popular', packageController.getPopularPackages);
router.get('/:id', packageController.getPackageById);

// POST routes
router.post('/', packageController.createPackage);

// PUT routes
router.put('/:id', packageController.updatePackage);

// DELETE routes
router.delete('/:id', packageController.deletePackage);

export default router;
