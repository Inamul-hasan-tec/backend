/**
 * Payment Controller
 * Handles HTTP requests for payment management
 */

import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';

const paymentService = new PaymentService();

/**
 * GET /api/payments
 * Get all payments
 */
export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, offset } = req.query;
    const payments = await paymentService.getAllPayments(
      limit ? parseInt(limit as string) : undefined,
      offset ? parseInt(offset as string) : undefined
    );

    res.json({
      success: true,
      message: 'Payments retrieved successfully',
      data: payments
    });
  } catch (error) {
    console.error('Error in getPayments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/payments/:id
 * Get payment by ID
 */
export const getPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const payment = await paymentService.getPaymentById(parseInt(id));

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
      return;
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error in getPaymentById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/payments/booking/:bookingId
 * Get payments for a booking
 */
export const getPaymentsByBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const payments = await paymentService.getPaymentsByBooking(parseInt(bookingId));

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error in getPaymentsByBooking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * POST /api/payments
 * Create new payment
 */
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const paymentData = req.body;
    const paymentId = await paymentService.createPayment(paymentData);

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: { id: paymentId }
    });
  } catch (error) {
    console.error('Error in createPayment:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create payment'
    });
  }
};

/**
 * GET /api/payments/stats
 * Get payment statistics
 */
export const getPaymentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await paymentService.getPaymentStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in getPaymentStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
