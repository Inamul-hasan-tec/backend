import { Router } from 'express';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

router.get('/', requirePermission(Permission.DASHBOARD_VIEW), listNotifications);
router.get('/unread-count', requirePermission(Permission.DASHBOARD_VIEW), getUnreadCount);
router.put('/read-all', requirePermission(Permission.DASHBOARD_VIEW), markAllNotificationsRead);
router.put('/:id/read', requirePermission(Permission.DASHBOARD_VIEW), markNotificationRead);

export default router;
