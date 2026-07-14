/**
 * Package Controller
 * Handles HTTP requests for package operations
 */

import { Request, Response } from 'express';
import { PackageService } from '../services/PackageService';
import { successResponse, errorResponse } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';

const packageService = new PackageService();

/**
 * GET /api/packages
 * Get all packages
 */
export const getAllPackages = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
  const hallId = req.query.hall_id ? parseInt(req.query.hall_id as string, 10) : undefined;

  const packages = await packageService.searchPackages({ hall_id: hallId, limit, offset });
  res.json(successResponse('Packages retrieved successfully', packages));
});

/**
 * GET /api/packages/search
 * Search packages
 */
export const searchPackages = asyncHandler(async (req: Request, res: Response) => {
  const params = {
    name: req.query.name as string,
    hall_id: req.query.hall_id ? parseInt(req.query.hall_id as string, 10) : undefined,
    status: req.query.status as any,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const packages = await packageService.searchPackages(params);
  res.json(successResponse('Search completed', packages));
});

/**
 * GET /api/packages/active
 * Get active packages
 */
export const getActivePackages = asyncHandler(async (req: Request, res: Response) => {
  const hallId = req.query.hall_id ? parseInt(req.query.hall_id as string, 10) : undefined;
  const packages = hallId
    ? await packageService.getActivePackagesForHall(hallId)
    : await packageService.getActivePackages();
  res.json(successResponse('Active packages retrieved', packages));
});

/**
 * GET /api/packages/popular
 * Get popular packages
 */
export const getPopularPackages = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
  const packages = await packageService.getPopularPackages(limit);
  res.json(successResponse('Popular packages retrieved', packages));
});

/**
 * GET /api/packages/:id
 * Get package by ID
 */
export const getPackageById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const pkg = await packageService.getPackageById(id);

  if (!pkg) {
    return res.status(404).json(errorResponse('Package not found'));
  }

  res.json(successResponse('Package retrieved successfully', pkg));
});

/**
 * POST /api/packages
 * Create new package
 */
export const createPackage = asyncHandler(async (req: Request, res: Response) => {
  const packageId = await packageService.createPackage(req.body);
  const pkg = await packageService.getPackageById(packageId);
  res.status(201).json(successResponse('Package created successfully', pkg));
});

/**
 * PUT /api/packages/:id
 * Update package
 */
export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await packageService.updatePackage(id, req.body);
  const pkg = await packageService.getPackageById(id);
  res.json(successResponse('Package updated successfully', pkg));
});

/**
 * DELETE /api/packages/:id
 * Delete package
 */
export const deletePackage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await packageService.deletePackage(id);
  res.json(successResponse('Package deleted successfully'));
});
