import { Router } from 'express';
import multer from 'multer';
import {
  getCalendarPreferences,
  getCalendarInsights,
  importHolidayCsv,
  importPanchangCsv,
  updateCalendarPreferences,
} from '../controllers/CalendarInsightsController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

router.get('/', getCalendarInsights);
router.get(
  '/preferences',
  requirePermission(Permission.SETTINGS_VIEW),
  getCalendarPreferences
);
router.put(
  '/preferences',
  requirePermission(Permission.SETTINGS_UPDATE),
  updateCalendarPreferences
);
router.post(
  '/imports/panchang',
  requirePermission(Permission.SETTINGS_UPDATE),
  upload.single('file'),
  importPanchangCsv
);
router.post(
  '/imports/holidays',
  requirePermission(Permission.SETTINGS_UPDATE),
  upload.single('file'),
  importHolidayCsv
);

export default router;
