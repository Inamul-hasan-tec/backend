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

router.get('/', requirePermission(Permission.USER_LIST), listNotifications);
router.get('/unread-count', requirePermission(Permission.USER_LIST), getUnreadCount);
router.put('/read-all', requirePermission(Permission.USER_LIST), markAllNotificationsRead);
router.put('/:id/read', requirePermission(Permission.USER_LIST), markNotificationRead);

export default router;
