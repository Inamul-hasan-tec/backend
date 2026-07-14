import { Router } from 'express';
import PlatformSubscriptionController from '../controllers/PlatformSubscriptionController';
import {
  requirePermission,
  requireSuperAdmin,
} from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';
import PlatformOperationsController from '../controllers/PlatformOperationsController';

const router = Router();

router.use(requireSuperAdmin());

router.get('/overview', PlatformOperationsController.overview.bind(PlatformOperationsController));
router.get('/operations', PlatformOperationsController.operations.bind(PlatformOperationsController));
router.get('/audit-logs', PlatformOperationsController.auditLogs.bind(PlatformOperationsController));
router.get('/tenant-audit-logs', PlatformOperationsController.tenantAuditLogs.bind(PlatformOperationsController));

router.get(
  '/subscription-payments',
  requirePermission(Permission.SUBSCRIPTION_MANAGE),
  PlatformSubscriptionController.listPending
);
router.post(
  '/subscription-payments/:paymentId/approve',
  requirePermission(Permission.SUBSCRIPTION_MANAGE),
  PlatformSubscriptionController.approve
);
router.post(
  '/subscription-payments/:paymentId/reject',
  requirePermission(Permission.SUBSCRIPTION_MANAGE),
  PlatformSubscriptionController.reject
);
router.get(
  '/subscription-payments/:paymentId/proof',
  requirePermission(Permission.SUBSCRIPTION_MANAGE),
  PlatformSubscriptionController.getProofUrl
);

export default router;
