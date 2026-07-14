/**
 * Payment Controller
 * Handles HTTP requests for payment management
 */

import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import AuditRepository from '../repositories/AuditRepository';

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
    const idempotencyKey =
      String(req.headers['idempotency-key'] || req.body.idempotency_key || '').trim() || undefined;
    const paymentData = {
      ...req.body,
      idempotency_key: idempotencyKey,
      received_by: req.user?.id,
    };
    const paymentId = await paymentService.createPayment(paymentData);
    await AuditRepository.recordTenant({
      actorUserId: req.user?.id,
      action: 'payment.recorded',
      entityType: 'payment',
      entityId: paymentId,
      newValues: {
        ...paymentData,
        idempotency_key: idempotencyKey ? '[PRESENT]' : null,
      },
      ipAddress: req.ip,
    });

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
 * POST /api/payments/:id/verify
 * Mark a recorded offline payment as verified.
 */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const payment = await paymentService.verifyPayment(paymentId, req.user.id);
    await AuditRepository.recordTenant({
      actorUserId: req.user.id,
      action: 'payment.verified',
      entityType: 'payment',
      entityId: paymentId,
      newValues: {
        status: payment.status,
        verified_by: req.user.id,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: payment,
    });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify payment',
    });
  }
};

/**
 * POST /api/payments/:id/reverse
 * Reverse a mistaken payment without deleting history.
 */
export const reversePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const reason = String(req.body.reason || '').trim();
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const payment = await paymentService.reversePayment(paymentId, req.user.id, reason);
    await AuditRepository.recordTenant({
      actorUserId: req.user.id,
      action: 'payment.reversed',
      entityType: 'payment',
      entityId: paymentId,
      newValues: {
        status: payment.status,
        reversed_by: req.user.id,
        reason,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Payment reversed successfully',
      data: payment,
    });
  } catch (error) {
    console.error('Error in reversePayment:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reverse payment',
    });
  }
};

/**
 * POST /api/payments/:id/fail
 * Mark a cheque/transfer/card payment as failed without deleting history.
 */
export const markPaymentFailed = async (req: Request, res: Response): Promise<void> => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const reason = String(req.body.reason || '').trim();
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const payment = await paymentService.markPaymentFailed(paymentId, req.user.id, reason);
    await AuditRepository.recordTenant({
      actorUserId: req.user.id,
      action: 'payment.failed',
      entityType: 'payment',
      entityId: paymentId,
      newValues: {
        status: payment.status,
        failure_reason: reason,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Payment marked failed successfully',
      data: payment,
    });
  } catch (error) {
    console.error('Error in markPaymentFailed:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to mark payment failed',
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

/**
 * GET /api/payments/reconciliation
 * Tenant-scoped payment review summary and action queue.
 */
export const getPaymentReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    const reconciliation = await paymentService.getPaymentReconciliation();

    res.json({
      success: true,
      message: 'Payment reconciliation retrieved successfully',
      data: reconciliation,
    });
  } catch (error) {
    console.error('Error in getPaymentReconciliation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment reconciliation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
