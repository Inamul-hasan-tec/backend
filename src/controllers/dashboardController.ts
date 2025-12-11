/**
 * Dashboard Controller
 * Handles HTTP requests for dashboard and analytics
 */

import { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import { successResponse } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';

const dashboardService = new DashboardService();

/**
 * GET /api/dashboard/stats
 * Get complete dashboard statistics
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getDashboardStats();
  res.json(successResponse('Dashboard statistics retrieved', stats));
});

/**
 * GET /api/dashboard/revenue-chart
 * Get monthly revenue chart data
 */
export const getRevenueChart = asyncHandler(async (req: Request, res: Response) => {
  const months = req.query.months ? parseInt(req.query.months as string) : 6;
  const data = await dashboardService.getMonthlyRevenueChart(months);
  res.json(successResponse('Revenue chart data retrieved', data));
});

/**
 * GET /api/dashboard/booking-status
 * Get booking status distribution
 */
export const getBookingStatusDistribution = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getBookingStatusDistribution();
  res.json(successResponse('Booking status distribution retrieved', data));
});

/**
 * GET /api/dashboard/popular-halls
 * Get popular halls
 */
export const getPopularHalls = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
  const data = await dashboardService.getPopularHalls(limit);
  res.json(successResponse('Popular halls retrieved', data));
});

/**
 * GET /api/dashboard/event-types
 * Get event type distribution
 */
export const getEventTypeDistribution = asyncHandler(async (req: Request, res: Response) => {
  const data = await dashboardService.getEventTypeDistribution();
  res.json(successResponse('Event type distribution retrieved', data));
});
