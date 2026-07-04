/**
 * Tenant Controller
 * Handles tenant-related HTTP requests
 */

import { Request, Response } from 'express';
import TenantRepository from '../repositories/TenantRepository';
import { getTenantId } from '../utils/tenantContext';
import AuditRepository from '../repositories/AuditRepository';
import { SlotService } from '../services/SlotService';
import pool from '../config/db';

const slotService = new SlotService();

export class TenantController {
  /**
   * Get current tenant info
   */
  async getCurrent(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const { tenant, settings } = await TenantRepository.getTenantWithSettings(tenantId);

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      res.json({
        tenant,
        settings,
      });
    } catch (error: any) {
      console.error('Get current tenant error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all tenants (admin only)
   */
  async getAll(req: Request, res: Response) {
    try {
      const tenants = await TenantRepository.findAll();
      res.json(tenants);
    } catch (error: any) {
      console.error('Get all tenants error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get tenant by ID
   */
  async getById(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id);
      const { tenant, settings } = await TenantRepository.getTenantWithSettings(tenantId);

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      res.json({
        tenant,
        settings,
      });
    } catch (error: any) {
      console.error('Get tenant by ID error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update tenant
   */
  async update(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const { name, logo_url, status } = req.body;

      await TenantRepository.update(tenantId, {
        name,
        logo_url,
        status,
      });
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'tenant.updated',
        entityType: 'tenant',
        entityId: tenantId,
        newValues: { name, logo_url, status },
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Tenant updated successfully' });
    } catch (error: any) {
      console.error('Update tenant error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get tenant settings
   */
  async getSettings(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const settings = await TenantRepository.getSettings(tenantId);
      res.json(settings);
    } catch (error: any) {
      console.error('Get tenant settings error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update tenant setting
   */
  async updateSetting(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const { key, value } = req.body;

      if (!key) {
        return res.status(400).json({ error: 'Setting key is required' });
      }

      await TenantRepository.setSetting(tenantId, key, value);
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'tenant.setting_updated',
        entityType: 'tenant_setting',
        entityId: tenantId,
        newValues: { key, value },
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Setting updated successfully' });
    } catch (error: any) {
      console.error('Update tenant setting error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new tenant (Super Admin only)
   */
  async create(req: Request, res: Response) {
    try {
      const { name, slug, subdomain, domain, logo_url } = req.body;
      const tenantDomain = domain || subdomain;

      // Validate required fields
      if (!name || !slug) {
        return res.status(400).json({ 
          success: false,
          error: 'Name and slug are required' 
        });
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          error: 'Slug must contain lowercase letters, numbers, and hyphens only',
        });
      }

      // Check if slug already exists
      const existing = await TenantRepository.findBySlug(slug);
      if (existing) {
        return res.status(409).json({ 
          success: false,
          error: 'Slug already exists. Please choose a different slug.' 
        });
      }

      // Check if subdomain already exists (if provided)
      if (tenantDomain) {
        const existingSubdomain = await TenantRepository.findBySubdomain(tenantDomain);
        if (existingSubdomain) {
          return res.status(409).json({ 
            success: false,
            error: 'Subdomain already exists. Please choose a different subdomain.' 
          });
        }
      }

      // Create tenant
      const tenantId = await TenantRepository.create({
        name,
        slug,
        subdomain: tenantDomain,
        logo_url,
      });
      await AuditRepository.recordPlatform({
        actorUserId: req.user?.id,
        action: 'tenant.created',
        targetType: 'tenant',
        targetId: String(tenantId),
        metadata: { name, slug, domain: tenantDomain, logo_url },
        requestId: req.requestId,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Tenant created successfully',
        data: { id: tenantId },
      });
    } catch (error: any) {
      console.error('Create tenant error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Update tenant by ID (Super Admin only)
   */
  async updateById(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id);
      const { name, slug, subdomain, domain, logo_url, status } = req.body;
      const tenantDomain = domain || subdomain;
      const allowedStatuses = [
        'trial',
        'active',
        'past_due',
        'inactive',
        'suspended',
        'archived',
      ];

      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tenant status',
        });
      }
      if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          error: 'Slug must contain lowercase letters, numbers, and hyphens only',
        });
      }

      // Check if tenant exists
      const tenant = await TenantRepository.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ 
          success: false,
          error: 'Tenant not found' 
        });
      }

      // Check if slug is being changed and already exists
      if (slug && slug !== tenant.slug) {
        const existing = await TenantRepository.findBySlug(slug);
        if (existing) {
          return res.status(409).json({ 
            success: false,
            error: 'Slug already exists' 
          });
        }
      }

      // Check if subdomain is being changed and already exists
      if (tenantDomain && tenantDomain !== (tenant.subdomain || tenant.domain)) {
        const existing = await TenantRepository.findBySubdomain(tenantDomain);
        if (existing) {
          return res.status(409).json({ 
            success: false,
            error: 'Subdomain already exists' 
          });
        }
      }

      await TenantRepository.updateById(tenantId, {
        name,
        slug,
        subdomain: tenantDomain,
        logo_url,
        status,
      });
      await AuditRepository.recordPlatform({
        actorUserId: req.user?.id,
        action: 'tenant.updated',
        targetType: 'tenant',
        targetId: String(tenantId),
        metadata: {
          previous: { name: tenant.name, slug: tenant.slug, status: tenant.status },
          updated: { name, slug, domain: tenantDomain, logo_url, status },
        },
        requestId: req.requestId,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: 'Tenant updated successfully',
      });
    } catch (error: any) {
      console.error('Update tenant error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get tenant statistics (Super Admin only)
   */
  async getStats(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id);

      const stats = await TenantRepository.getStats(tenantId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Get tenant stats error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get all tenants with stats (Super Admin only)
   */
  async getAllWithStats(req: Request, res: Response) {
    try {
      const tenants = await TenantRepository.getAllWithStats();
      res.json({
        success: true,
        data: tenants,
      });
    } catch (error: any) {
      console.error('Get all tenants with stats error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  /**
   * Get slots for a tenant (Super Admin only)
   */
  async getSlots(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id, 10);
      const hallId = req.query.hall_id ? parseInt(req.query.hall_id as string, 10) : undefined;
      const dateFrom = String(req.query.date_from || '');
      const dateTo = String(req.query.date_to || '');

      if (!tenantId || !dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          error: 'tenant id, date_from, and date_to are required',
        });
      }

      const tenant = await TenantRepository.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      const slots = await slotService.getSlotsForPlatform(tenantId, dateFrom, dateTo, hallId);
      res.json({ success: true, data: slots });
    } catch (error: any) {
      console.error('Get tenant slots error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get halls for a tenant (Super Admin only)
   */
  async getHalls(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id, 10);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenant id is required' });
      }

      const tenant = await TenantRepository.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      const [halls] = await pool.execute(
        `SELECT id, name, capacity, base_price, status
         FROM halls
         WHERE tenant_id = ?
         ORDER BY name`,
        [tenantId]
      );

      res.json({ success: true, data: halls });
    } catch (error: any) {
      console.error('Get tenant halls error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Generate slots for a tenant/hall date range (Super Admin only)
   */
  async generateSlots(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id, 10);
      const hallId = Number(req.body.hall_id);
      const dateFrom = String(req.body.date_from || '');
      const dateTo = String(req.body.date_to || '');

      if (!tenantId || !hallId || !dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          error: 'tenant id, hall_id, date_from, and date_to are required',
        });
      }

      const tenant = await TenantRepository.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      const result = await slotService.generateSlotsForHallRange(
        tenantId,
        hallId,
        dateFrom,
        dateTo
      );
      await AuditRepository.recordPlatform({
        actorUserId: req.user?.id,
        action: 'tenant.slots_generated',
        targetType: 'tenant',
        targetId: String(tenantId),
        metadata: { tenant_id: tenantId, hall_id: hallId, date_from: dateFrom, date_to: dateTo, ...result },
        requestId: req.requestId,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Slots generated successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Generate tenant slots error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Block or unblock a tenant slot (Super Admin only)
   */
  async blockSlot(req: Request, res: Response) {
    try {
      const tenantId = parseInt(req.params.id, 10);
      const slotId = parseInt(req.params.slotId, 10);
      const block = Boolean(req.body.block);
      const notes = req.body.notes ? String(req.body.notes) : undefined;

      if (!tenantId || !slotId) {
        return res.status(400).json({
          success: false,
          error: 'tenant id and slot id are required',
        });
      }

      await slotService.blockSlotForPlatform(tenantId, slotId, block, notes);
      await AuditRepository.recordPlatform({
        actorUserId: req.user?.id,
        action: block ? 'tenant.slot_blocked' : 'tenant.slot_unblocked',
        targetType: 'tenant',
        targetId: String(tenantId),
        metadata: { tenant_id: tenantId, slot_id: slotId, notes },
        requestId: req.requestId,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: block ? 'Slot blocked successfully' : 'Slot unblocked successfully',
      });
    } catch (error: any) {
      console.error('Block tenant slot error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new TenantController();
