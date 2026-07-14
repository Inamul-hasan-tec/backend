/**
 * Service Catalog Controller
 * Handles HTTP requests for service catalog management
 */

import { Request, Response } from 'express';
import ServiceCatalogRepository from '../repositories/ServiceCatalogRepository';
import { CreateServiceDTO, UpdateServiceDTO, ServiceListFilters } from '../models/ServiceCatalog';

export class ServiceCatalogController {
  /**
   * GET /api/services
   * Get all services with optional filters
   */
  async getAllServices(req: Request, res: Response): Promise<void> {
    try {
      const filters: ServiceListFilters = {
        category: req.query.category as any,
        is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
        search: req.query.search as string,
      };

      const services = await ServiceCatalogRepository.getAllServices(filters);

      res.json({
        success: true,
        data: services,
        count: services.length,
      });
    } catch (error) {
      console.error('Error fetching services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch services',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/services/active
   * Get only active services
   */
  async getActiveServices(req: Request, res: Response): Promise<void> {
    try {
      const services = await ServiceCatalogRepository.getActive();

      res.json({
        success: true,
        data: services,
        count: services.length,
      });
    } catch (error) {
      console.error('Error fetching active services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active services',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/services/category/:category
   * Get services by category
   */
  async getServicesByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const services = await ServiceCatalogRepository.getByCategory(category);

      res.json({
        success: true,
        data: services,
        count: services.length,
      });
    } catch (error) {
      console.error('Error fetching services by category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch services by category',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/services/:id
   * Get service by ID
   */
  async getServiceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const service = await ServiceCatalogRepository.findById(parseInt(id));

      if (!service) {
        res.status(404).json({
          success: false,
          message: 'Service not found',
        });
        return;
      }

      res.json({
        success: true,
        data: service,
      });
    } catch (error) {
      console.error('Error fetching service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/services
   * Create new service
   */
  async createService(req: Request, res: Response): Promise<void> {
    try {
      const serviceData: CreateServiceDTO = req.body;

      // Validate required fields
      if (!serviceData.service_code || !serviceData.name || !serviceData.category) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: service_code, name, category',
        });
        return;
      }

      // Check if service code is unique
      const isUnique = await ServiceCatalogRepository.isServiceCodeUnique(serviceData.service_code);
      if (!isUnique) {
        res.status(400).json({
          success: false,
          message: 'Service code already exists',
        });
        return;
      }

      // Validate GST rate
      if (serviceData.gst_rate < 0 || serviceData.gst_rate > 28) {
        res.status(400).json({
          success: false,
          message: 'GST rate must be between 0 and 28',
        });
        return;
      }

      const serviceId = await ServiceCatalogRepository.create(serviceData);
      const service = await ServiceCatalogRepository.findById(serviceId);

      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: service,
      });
    } catch (error) {
      console.error('Error creating service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * PUT /api/services/:id
   * Update service
   */
  async updateService(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateServiceDTO = req.body;

      // Validate GST rate if provided
      if (updateData.gst_rate !== undefined) {
        if (updateData.gst_rate < 0 || updateData.gst_rate > 28) {
          res.status(400).json({
            success: false,
            message: 'GST rate must be between 0 and 28',
          });
          return;
        }
      }

      const updated = await ServiceCatalogRepository.update(parseInt(id), updateData);

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Service not found',
        });
        return;
      }

      const service = await ServiceCatalogRepository.findById(parseInt(id));

      res.json({
        success: true,
        message: 'Service updated successfully',
        data: service,
      });
    } catch (error) {
      console.error('Error updating service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * DELETE /api/services/:id
   * Delete service (soft delete)
   */
  async deleteService(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await ServiceCatalogRepository.delete(parseInt(id));

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Service not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * PUT /api/services/reorder
   * Update display order of multiple services
   */
  async reorderServices(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        res.status(400).json({
          success: false,
          message: 'Invalid request format. Expected array of updates.',
        });
        return;
      }

      await ServiceCatalogRepository.updateDisplayOrder(updates);

      res.json({
        success: true,
        message: 'Services reordered successfully',
      });
    } catch (error) {
      console.error('Error reordering services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reorder services',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/services/categories
   * Get list of service categories
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    const categories = [
      { value: 'VENUE_RENTAL', label: 'Venue Rental' },
      { value: 'CATERING_INHOUSE', label: 'Catering (In-house)' },
      { value: 'CATERING_EXTERNAL', label: 'Catering (External)' },
      { value: 'DECORATION', label: 'Decoration' },
      { value: 'AV_EQUIPMENT', label: 'AV Equipment' },
      { value: 'PARKING', label: 'Parking' },
      { value: 'ACCOMMODATION', label: 'Accommodation' },
      { value: 'PHOTOGRAPHY', label: 'Photography' },
      { value: 'DJ_MUSIC', label: 'DJ/Music' },
      { value: 'SECURITY', label: 'Security' },
      { value: 'OTHER', label: 'Other' },
    ];

    res.json({
      success: true,
      data: categories,
    });
  }
}

export default new ServiceCatalogController();
