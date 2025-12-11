/**
 * Customer Controller
 * Handles HTTP requests for customer operations
 */

import { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { successResponse, errorResponse } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';

const customerService = new CustomerService();

/**
 * GET /api/customers
 * Get all customers
 */
export const getAllCustomers = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

  const customers = await customerService.getAllCustomers(limit, offset);
  res.json(successResponse('Customers retrieved successfully', customers));
});

/**
 * GET /api/customers/search
 * Search customers
 */
export const searchCustomers = asyncHandler(async (req: Request, res: Response) => {
  const params = {
    name: req.query.name as string,
    phone: req.query.phone as string,
    email: req.query.email as string,
    city: req.query.city as string,
    status: req.query.status as any,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const customers = await customerService.searchCustomers(params);
  res.json(successResponse('Search completed', customers));
});

/**
 * GET /api/customers/recent
 * Get recent customers
 */
export const getRecentCustomers = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const customers = await customerService.getRecentCustomers(limit);
  res.json(successResponse('Recent customers retrieved', customers));
});

/**
 * GET /api/customers/stats
 * Get customer statistics
 */
export const getCustomerStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await customerService.getCustomerStats();
  res.json(successResponse('Statistics retrieved', stats));
});

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const customer = await customerService.getCustomerById(id);

  if (!customer) {
    return res.status(404).json(errorResponse('Customer not found'));
  }

  res.json(successResponse('Customer retrieved successfully', customer));
});

/**
 * POST /api/customers
 * Create new customer
 */
export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customerId = await customerService.createCustomer(req.body);
  const customer = await customerService.getCustomerById(customerId);
  res.status(201).json(successResponse('Customer created successfully', customer));
});

/**
 * PUT /api/customers/:id
 * Update customer
 */
export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await customerService.updateCustomer(id, req.body);
  const customer = await customerService.getCustomerById(id);
  res.json(successResponse('Customer updated successfully', customer));
});

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await customerService.deleteCustomer(id);
  res.json(successResponse('Customer deleted successfully'));
});
