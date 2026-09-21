/**
 * Service Catalog Routes
 */

import { Router } from 'express';
import ServiceCatalogController from '../controllers/ServiceCatalogController';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// All routes require authentication
router.use(auth);

// GET /api/services/categories - Get service categories (must be before /:id)
router.get('/categories', requirePermission(Permission.PACKAGE_LIST), ServiceCatalogController.getCategories.bind(ServiceCatalogController));

// GET /api/services/active - Get active services only (must be before /:id)
router.get('/active', requirePermission(Permission.PACKAGE_LIST), ServiceCatalogController.getActiveServices.bind(ServiceCatalogController));

// GET /api/services/category/:category - Get services by category (must be before /:id)
router.get('/category/:category', requirePermission(Permission.PACKAGE_LIST), ServiceCatalogController.getServicesByCategory.bind(ServiceCatalogController));

// GET /api/services - Get all services with filters
router.get('/', requirePermission(Permission.PACKAGE_LIST), ServiceCatalogController.getAllServices.bind(ServiceCatalogController));

// GET /api/services/:id - Get service by ID
router.get('/:id', requirePermission(Permission.PACKAGE_VIEW), ServiceCatalogController.getServiceById.bind(ServiceCatalogController));

// POST /api/services - Create new service
router.post('/', requirePermission(Permission.PACKAGE_CREATE), ServiceCatalogController.createService.bind(ServiceCatalogController));

// PUT /api/services/reorder - Reorder services
router.put('/reorder', requirePermission(Permission.PACKAGE_UPDATE), ServiceCatalogController.reorderServices.bind(ServiceCatalogController));

// PUT /api/services/:id - Update service
router.put('/:id', requirePermission(Permission.PACKAGE_UPDATE), ServiceCatalogController.updateService.bind(ServiceCatalogController));

// DELETE /api/services/:id - Delete service
router.delete('/:id', requirePermission(Permission.PACKAGE_DELETE), ServiceCatalogController.deleteService.bind(ServiceCatalogController));

export default router;
