/**
 * Payment Service
 * Business logic for payment operations
 */

import { PaymentRepository } from '../repositories/PaymentRepository';
import { Payment, CreatePaymentDTO } from '../models/Payment';

const referenceRequiredModes = new Set(['upi', 'bank_transfer', 'cheque', 'card']);

export class PaymentService {
  private paymentRepo: PaymentRepository;

  constructor() {
    this.paymentRepo = new PaymentRepository();
  }

  /**
   * Get all payments
   */
  async getAllPayments(limit?: number, offset?: number): Promise<Payment[]> {
    return await this.paymentRepo.findAll(limit, offset);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: number): Promise<Payment | null> {
    return await this.paymentRepo.findById(id);
  }

  /**
   * Get payments for a booking
   */
  async getPaymentsByBooking(bookingId: number): Promise<Payment[]> {
    return await this.paymentRepo.findByBookingId(bookingId);
  }

  /**
   * Create new payment
   */
  async createPayment(data: CreatePaymentDTO): Promise<number> {
    if (data.payment_type === 'refund' || data.payment_type === 'correction') {
      throw new Error('Refunds and corrections must use the controlled payment action flow');
    }
    if (referenceRequiredModes.has(data.payment_mode) && !data.transaction_id?.trim()) {
      throw new Error('Transaction reference is required for this payment mode');
    }

    const paymentData: CreatePaymentDTO = {
      ...data,
      transaction_id: data.transaction_id?.trim() || undefined,
      payment_date: data.payment_date ? new Date(data.payment_date) : new Date(),
    };
    return this.paymentRepo.createForBooking(paymentData);
  }

  async verifyPayment(paymentId: number, actorUserId: number): Promise<Payment> {
    return await this.paymentRepo.verifyPayment(paymentId, actorUserId);
  }

  async reversePayment(paymentId: number, actorUserId: number, reason: string): Promise<Payment> {
    return await this.paymentRepo.reversePayment(paymentId, actorUserId, reason);
  }

  async markPaymentFailed(paymentId: number, actorUserId: number, reason: string): Promise<Payment> {
    return await this.paymentRepo.markPaymentFailed(paymentId, actorUserId, reason);
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    return await this.paymentRepo.getStats();
  }

  async getPaymentReconciliation() {
    return await this.paymentRepo.getReconciliation();
  }

  /**
   * Get total payments for a booking
   */
  async getTotalByBooking(bookingId: number): Promise<number> {
    return await this.paymentRepo.getTotalByBooking(bookingId);
  }
}
