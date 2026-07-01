import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();
const userController = new UserController();

// User management routes (admin+ only)
router.get(
  '/',
  requirePermission(Permission.USER_VIEW),
  userController.getAllUsers.bind(userController)
);

router.post(
  '/',
  requirePermission(Permission.USER_CREATE),
  userController.createUser.bind(userController)
);

router.get(
  '/:id',
  requirePermission(Permission.USER_VIEW),
  userController.getUserById.bind(userController)
);

router.put(
  '/:id',
  requirePermission(Permission.USER_UPDATE),
  userController.updateUser.bind(userController)
);

router.delete(
  '/:id',
  requirePermission(Permission.USER_DELETE),
  userController.deleteUser.bind(userController)
);

// User status management
router.put(
  '/:id/status',
  requirePermission(Permission.USER_UPDATE),
  userController.updateUserStatus.bind(userController)
);

// Change user role
router.put(
  '/:id/role',
  requirePermission(Permission.USER_UPDATE),
  userController.changeUserRole.bind(userController)
);

export default router;
