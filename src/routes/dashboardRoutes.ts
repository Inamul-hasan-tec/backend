/**
 * Dashboard Routes
 * API endpoints for dashboard and analytics
 */

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes
router.get('/stats', requirePermission(Permission.DASHBOARD_VIEW), dashboardController.getDashboardStats);
router.get('/revenue-chart', requirePermission(Permission.DASHBOARD_VIEW), dashboardController.getRevenueChart);
router.get('/booking-status', requirePermission(Permission.DASHBOARD_VIEW), dashboardController.getBookingStatusDistribution);
router.get('/popular-halls', requirePermission(Permission.DASHBOARD_VIEW), dashboardController.getPopularHalls);
router.get('/event-types', requirePermission(Permission.DASHBOARD_VIEW), dashboardController.getEventTypeDistribution);

export default router;
