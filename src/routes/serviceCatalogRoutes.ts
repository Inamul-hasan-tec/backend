/**
 * Service Catalog Routes
 */

import { Router } from 'express';
import ServiceCatalogController from '../controllers/ServiceCatalogController';
import { auth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(auth);

// GET /api/services/categories - Get service categories (must be before /:id)
router.get('/categories', ServiceCatalogController.getCategories.bind(ServiceCatalogController));

// GET /api/services/active - Get active services only (must be before /:id)
router.get('/active', ServiceCatalogController.getActiveServices.bind(ServiceCatalogController));

// GET /api/services/category/:category - Get services by category (must be before /:id)
router.get('/category/:category', ServiceCatalogController.getServicesByCategory.bind(ServiceCatalogController));

// GET /api/services - Get all services with filters
router.get('/', ServiceCatalogController.getAllServices.bind(ServiceCatalogController));

// GET /api/services/:id - Get service by ID
router.get('/:id', ServiceCatalogController.getServiceById.bind(ServiceCatalogController));

// POST /api/services - Create new service
router.post('/', ServiceCatalogController.createService.bind(ServiceCatalogController));

// PUT /api/services/reorder - Reorder services
router.put('/reorder', ServiceCatalogController.reorderServices.bind(ServiceCatalogController));

// PUT /api/services/:id - Update service
router.put('/:id', ServiceCatalogController.updateService.bind(ServiceCatalogController));

// DELETE /api/services/:id - Delete service
router.delete('/:id', ServiceCatalogController.deleteService.bind(ServiceCatalogController));

export default router;
