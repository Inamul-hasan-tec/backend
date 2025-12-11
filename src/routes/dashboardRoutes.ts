/**
 * Dashboard Routes
 * API endpoints for dashboard and analytics
 */

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

// GET routes
router.get('/stats', dashboardController.getDashboardStats);
router.get('/revenue-chart', dashboardController.getRevenueChart);
router.get('/booking-status', dashboardController.getBookingStatusDistribution);
router.get('/popular-halls', dashboardController.getPopularHalls);
router.get('/event-types', dashboardController.getEventTypeDistribution);

export default router;
