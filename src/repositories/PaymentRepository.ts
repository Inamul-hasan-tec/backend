/**
 * Payment Repository
 * Database operations for payments with Strict Multi-Tenancy via ALS
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool, { getConnection } from '../config/db';
import { TenantBaseRepository } from './TenantBaseRepository';
import { Payment, CreatePaymentDTO } from '../models/Payment';
import { getTenantId } from '../utils/tenantContext';
import {
  allocatePaymentToOpenBookingInvoices,
  assertUniqueTransactionReference,
  insertBookingPayment,
  lockBookingAndValidatePayment,
  updateBookingPaymentTotals,
  validatePositiveMoney,
} from './PaymentLedgerRepository';

export class PaymentRepository extends TenantBaseRepository<Payment> {
  constructor() {
    super('payments');
  }

  /**
   * Get all payments
   */
  async findAllPayments(limit?: number, offset?: number): Promise<Payment[]> {
    return this.findAll(limit, offset);
  }

  /**
   * Get payments by booking ID
   */
  async findByBookingId(bookingId: number): Promise<Payment[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM payments WHERE booking_id = ? AND tenant_id = ? ORDER BY payment_date DESC',
      [bookingId, tenantId]
    );
    return rows as Payment[];
  }

  /**
   * Create new payment
   */
  async createPayment(payment: CreatePaymentDTO): Promise<number> {
    const tenantId = getTenantId();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO payments (
        tenant_id, booking_id, amount, payment_mode, payment_type,
        transaction_id, payment_date, notes, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        payment.booking_id,
        payment.amount,
        payment.payment_mode,
        payment.payment_type,
        payment.transaction_id || null,
        payment.payment_date,
        payment.notes || null,
        payment.received_by || null,
      ]
    );
    return result.insertId;
  }

  /**
   * Record a payment and update the booking totals atomically.
   */
  async createForBooking(payment: CreatePaymentDTO): Promise<number> {
    const tenantId = getTenantId();
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const amount = validatePositiveMoney(Number(payment.amount));
      const { totalAmount, updatedTotalPaid } = await lockBookingAndValidatePayment(
        connection,
        tenantId,
        payment.booking_id,
        amount
      );
      await assertUniqueTransactionReference(
        connection,
        tenantId,
        payment.transaction_id
      );

      const paymentId = await insertBookingPayment(connection, {
          tenantId,
          bookingId: payment.booking_id,
          amount,
          paymentMode: payment.payment_mode,
          paymentType: payment.payment_type,
          transactionId: payment.transaction_id || null,
          paymentDate: payment.payment_date,
          notes: payment.notes || null,
          receivedBy: payment.received_by || null,
        }
      );

      await updateBookingPaymentTotals(
        connection,
        tenantId,
        payment.booking_id,
        totalAmount,
        updatedTotalPaid
      );
      await allocatePaymentToOpenBookingInvoices(
        connection,
        tenantId,
        payment.booking_id,
        paymentId,
        amount
      );

      await connection.commit();
      return paymentId;
    } catch (error) {
      await connection.rollback();
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        throw new Error('Transaction reference has already been recorded');
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get total payments for a booking
   */
  async getTotalByBooking(bookingId: number): Promise<number> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT SUM(amount) as total FROM payments WHERE booking_id = ? AND tenant_id = ?',
      [bookingId, tenantId]
    );
    return rows[0]?.total || 0;
  }

  /**
   * Get payment statistics
   */
  async getStats() {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_amount,
        payment_mode,
        COUNT(*) as count
      FROM payments
      WHERE tenant_id = ?
      GROUP BY payment_mode
    `, [tenantId]);
    return rows;
  }
}

export function validatePaymentTotal(
  amount: number,
  totalPaid: number,
  totalAmount: number
): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be positive');
  }

  const updatedTotalPaid = totalPaid + amount;
  if (updatedTotalPaid > totalAmount) {
    throw new Error('Payment amount exceeds the booking balance');
  }

  return updatedTotalPaid;
}

export default new PaymentRepository();
