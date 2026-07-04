/**
 * Tenant Routes
 * API endpoints for tenant management
 * Protected with RBAC permissions
 */

import express from 'express';
import TenantController from '../controllers/TenantController';
import {
  requirePermission,
  requireSuperAdmin,
  requireTenantAccount,
} from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';
import InvitationController from '../controllers/InvitationController';

const router = express.Router();

// Current tenant routes - Accessible by all authenticated users
router.get('/current', 
  requireTenantAccount(),
  TenantController.getCurrent
);

router.get('/current/settings', 
  requireTenantAccount(),
  requirePermission(Permission.SETTINGS_VIEW),
  TenantController.getSettings
);

router.put('/current', 
  requireTenantAccount(),
  requirePermission(Permission.SETTINGS_UPDATE),
  TenantController.update
);

router.put('/current/settings', 
  requireTenantAccount(),
  requirePermission(Permission.SETTINGS_UPDATE),
  TenantController.updateSetting
);

// Admin routes - Super admin only
router.get('/', 
  requireSuperAdmin(),
  TenantController.getAllWithStats
);

router.post('/', 
  requireSuperAdmin(),
  TenantController.create
);

router.get('/:id/owner-invitations',
  requireSuperAdmin(),
  InvitationController.listOwnerInvitations.bind(InvitationController)
);

router.post('/:id/owner-invitations',
  requireSuperAdmin(),
  InvitationController.createOwnerInvitation.bind(InvitationController)
);

router.post('/:id/owner-invitations/:invitationId/resend',
  requireSuperAdmin(),
  InvitationController.resendOwnerInvitation.bind(InvitationController)
);

router.get('/:id/halls',
  requireSuperAdmin(),
  TenantController.getHalls
);

router.get('/:id/slots',
  requireSuperAdmin(),
  TenantController.getSlots
);

router.post('/:id/slots/generate',
  requireSuperAdmin(),
  TenantController.generateSlots
);

router.post('/:id/slots/:slotId/block',
  requireSuperAdmin(),
  TenantController.blockSlot
);

router.get('/:id', 
  requireSuperAdmin(),
  TenantController.getById
);

router.put('/:id', 
  requireSuperAdmin(),
  TenantController.updateById
);

router.get('/:id/stats', 
  requireSuperAdmin(),
  TenantController.getStats
);

export default router;
