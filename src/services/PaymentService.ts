/**
 * Payment Service
 * Business logic for payment operations
 */

import { PaymentRepository } from '../repositories/PaymentRepository';
import { BookingRepository } from '../repositories/BookingRepository';
import { Payment, CreatePaymentDTO } from '../models/Payment';

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private bookingRepo: BookingRepository;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.bookingRepo = new BookingRepository();
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
    // Validate booking exists
    const booking = await this.bookingRepo.findById(data.booking_id);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Validate amount
    if (data.amount <= 0) {
      throw new Error('Payment amount must be positive');
    }

    // Create payment
    const paymentId = await this.paymentRepo.create(data);

    // Update booking balance if needed
    const totalPaid = await this.paymentRepo.getTotalByBooking(data.booking_id);
    const balance = booking.total_amount - totalPaid;

    await this.bookingRepo.update(data.booking_id, {
      advance_amount: totalPaid,
    });

    return paymentId;
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
