/**
 * Payment Service
 * Business logic for payment operations
 */

import { PaymentRepository } from '../repositories/PaymentRepository';
import { Payment, CreatePaymentDTO } from '../models/Payment';

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
    const paymentData: CreatePaymentDTO = {
      ...data,
      payment_date: data.payment_date ? new Date(data.payment_date) : new Date(),
    };
    return this.paymentRepo.createForBooking(paymentData);
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    return await this.paymentRepo.getStats();
  }

  /**
   * Get total payments for a booking
   */
  async getTotalByBooking(bookingId: number): Promise<number> {
    return await this.paymentRepo.getTotalByBooking(bookingId);
  }
}
