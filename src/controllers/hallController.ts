/**
 * Hall Controller
 * Handles HTTP requests for hall operations
 */

import { Request, Response } from 'express';
import { HallService } from '../services/HallService';
import { successResponse, errorResponse } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';

const hallService = new HallService();

/**
 * GET /api/halls
 * Get all halls
 */
export const getAllHalls = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

  const halls = await hallService.getAllHalls(limit, offset);
  res.json(successResponse('Halls retrieved successfully', halls));
});

/**
 * GET /api/halls/search
 * Search halls
 */
export const searchHalls = asyncHandler(async (req: Request, res: Response) => {
  const params = {
    name: req.query.name as string,
    min_capacity: req.query.min_capacity ? parseInt(req.query.min_capacity as string) : undefined,
    max_capacity: req.query.max_capacity ? parseInt(req.query.max_capacity as string) : undefined,
    status: req.query.status as any,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const halls = await hallService.searchHalls(params);
  res.json(successResponse('Search completed', halls));
});

/**
 * GET /api/halls/active
 * Get active halls
 */
export const getActiveHalls = asyncHandler(async (req: Request, res: Response) => {
  const halls = await hallService.getActiveHalls();
  res.json(successResponse('Active halls retrieved', halls));
});

/**
 * GET /api/halls/:id
 * Get hall by ID
 */
export const getHallById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const hall = await hallService.getHallById(id);

  if (!hall) {
    return res.status(404).json(errorResponse('Hall not found'));
  }

  res.json(successResponse('Hall retrieved successfully', hall));
});

/**
 * GET /api/halls/:id/availability
 * Check hall availability
 */
export const checkHallAvailability = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const date = req.query.date as string;

  if (!date) {
    return res.status(400).json(errorResponse('Date parameter is required'));
  }

  const isAvailable = await hallService.checkAvailability(id, date);
  res.json(successResponse('Availability checked', { available: isAvailable }));
});

/**
 * GET /api/halls/:id/availability-range
 * Get hall availability for date range
 */
export const getHallAvailabilityRange = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;

  if (!dateFrom || !dateTo) {
    return res.status(400).json(errorResponse('date_from and date_to parameters are required'));
  }

  const result = await hallService.getHallWithAvailability(id, dateFrom, dateTo);
  
  if (!result) {
    return res.status(404).json(errorResponse('Hall not found'));
  }

  res.json(successResponse('Availability retrieved', result));
});

/**
 * POST /api/halls
 * Create new hall
 */
export const createHall = asyncHandler(async (req: Request, res: Response) => {
  const hallId = await hallService.createHall(req.body);
  const hall = await hallService.getHallById(hallId);
  res.status(201).json(successResponse('Hall created successfully', hall));
});

/**
 * PUT /api/halls/:id
 * Update hall
 */
export const updateHall = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await hallService.updateHall(id, req.body);
  const hall = await hallService.getHallById(id);
  res.json(successResponse('Hall updated successfully', hall));
});

/**
 * DELETE /api/halls/:id
 * Delete hall
 */
export const deleteHall = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await hallService.deleteHall(id);
  res.json(successResponse('Hall deleted successfully'));
});
