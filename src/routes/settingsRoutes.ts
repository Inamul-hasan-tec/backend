import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';
import InvitationController from '../controllers/InvitationController';
import multer from 'multer';

const router = Router();
const settingsController = new SettingsController();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// ============================================
// Personal Settings
// ============================================
router.get(
  '/profile',
  settingsController.getProfile.bind(settingsController)
);

router.put(
  '/profile',
  settingsController.updateProfile.bind(settingsController)
);

router.put(
  '/password',
  settingsController.changePassword.bind(settingsController)
);

// ============================================
// Business Profile
// ============================================
router.get(
  '/business',
  requirePermission(Permission.SETTINGS_VIEW),
  settingsController.getBusinessProfile.bind(settingsController)
);

router.put(
  '/business',
  requirePermission(Permission.SETTINGS_UPDATE),
  settingsController.updateBusinessProfile.bind(settingsController)
);

router.post(
  '/business/logo',
  requirePermission(Permission.SETTINGS_UPDATE),
  upload.single('logo'),
  settingsController.uploadBusinessLogo.bind(settingsController)
);

// ============================================
// Team Management
// ============================================
router.get(
  '/team/invitations',
  requirePermission(Permission.USER_VIEW),
  InvitationController.list.bind(InvitationController)
);

router.post(
  '/team/invitations',
  requirePermission(Permission.USER_CREATE),
  InvitationController.create.bind(InvitationController)
);

router.post(
  '/team/invitations/:id/resend',
  requirePermission(Permission.USER_CREATE),
  InvitationController.resend.bind(InvitationController)
);

router.get(
  '/team',
  requirePermission(Permission.USER_VIEW),
  settingsController.getTeamMembers.bind(settingsController)
);

router.post(
  '/team',
  requirePermission(Permission.USER_CREATE),
  settingsController.addTeamMember.bind(settingsController)
);

router.put(
  '/team/:id',
  requirePermission(Permission.USER_UPDATE),
  settingsController.updateTeamMember.bind(settingsController)
);

router.delete(
  '/team/:id',
  requirePermission(Permission.USER_DELETE),
  settingsController.deleteTeamMember.bind(settingsController)
);

// ============================================
// Billing & Subscription
// ============================================
router.get(
  '/subscription',
  requirePermission(Permission.SETTINGS_VIEW),
  settingsController.getSubscription.bind(settingsController)
);

router.get(
  '/payments',
  requirePermission(Permission.SETTINGS_VIEW),
  settingsController.getPaymentHistory.bind(settingsController)
);

router.post(
  '/subscription/generate-qr',
  requirePermission(Permission.SETTINGS_VIEW),
  settingsController.generateUPIQR.bind(settingsController)
);

router.post(
  '/subscription/payment',
  requirePermission(Permission.SETTINGS_UPDATE),
  upload.single('payment_proof'),
  settingsController.submitPayment.bind(settingsController)
);

// ============================================
// Notification Preferences
// ============================================
router.get(
  '/notifications',
  settingsController.getNotificationPreferences.bind(settingsController)
);

router.put(
  '/notifications',
  settingsController.updateNotificationPreferences.bind(settingsController)
);

export default router;
