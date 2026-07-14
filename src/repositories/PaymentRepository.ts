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
  findPaymentByIdempotencyKey,
  generatePaymentReceiptNumber,
  insertBookingPayment,
  lockBookingAndValidatePayment,
  recalculateBookingPaymentTotals,
  roundMoney,
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

  async findById(id: number): Promise<Payment | null> {
    return super.findById(id);
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

      const existingPaymentId = await findPaymentByIdempotencyKey(
        connection,
        tenantId,
        payment.idempotency_key
      );
      if (existingPaymentId) {
        await connection.commit();
        return existingPaymentId;
      }

      if (payment.payment_type === 'refund' || payment.payment_type === 'correction') {
        throw new Error('Refunds and corrections must use the controlled payment action flow');
      }

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
      const receiptNumber = await generatePaymentReceiptNumber(connection, tenantId);

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
          status: 'recorded',
          idempotencyKey: payment.idempotency_key || null,
          receiptNumber,
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

  async verifyPayment(paymentId: number, actorUserId: number): Promise<Payment> {
    const tenantId = getTenantId();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE payments
       SET status = 'verified',
           verified_by = ?,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?
         AND tenant_id = ?
         AND COALESCE(status, 'recorded') IN ('recorded', 'verified')`,
      [actorUserId, paymentId, tenantId]
    );
    if (result.affectedRows === 0) {
      throw new Error('Payment not found or cannot be verified');
    }
    const payment = await this.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    return payment;
  }

  async markPaymentFailed(paymentId: number, actorUserId: number, reason: string): Promise<Payment> {
    const tenantId = getTenantId();
    if (!reason || reason.trim().length < 5) {
      throw new Error('Failure reason is required');
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      const [paymentRows] = await connection.execute<RowDataPacket[]>(
        `SELECT *
         FROM payments
         WHERE id = ? AND tenant_id = ?
         FOR UPDATE`,
        [paymentId, tenantId]
      );
      const payment = paymentRows[0];
      if (!payment) throw new Error('Payment not found');
      if (!['recorded', 'verified'].includes(payment.status || 'recorded')) {
        throw new Error('Only active payments can be marked failed');
      }

      await connection.execute(
        `UPDATE payments
         SET status = 'failed',
             reversed_by = ?,
             reversed_at = NOW(),
             failure_reason = ?,
             updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [actorUserId, reason.trim(), paymentId, tenantId]
      );

      await this.recalculateInvoicesAfterPaymentRemoval(connection, tenantId, paymentId);
      await recalculateBookingPaymentTotals(connection, tenantId, Number(payment.booking_id));
      await connection.commit();

      const updated = await this.findById(paymentId);
      if (!updated) throw new Error('Payment not found after update');
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async reversePayment(paymentId: number, actorUserId: number, reason: string): Promise<Payment> {
    const tenantId = getTenantId();
    if (!reason || reason.trim().length < 5) {
      throw new Error('Reversal reason is required');
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      const [paymentRows] = await connection.execute<RowDataPacket[]>(
        `SELECT *
         FROM payments
         WHERE id = ? AND tenant_id = ?
         FOR UPDATE`,
        [paymentId, tenantId]
      );
      const payment = paymentRows[0];
      if (!payment) throw new Error('Payment not found');
      if (!['recorded', 'verified'].includes(payment.status || 'recorded')) {
        throw new Error('Only active payments can be reversed');
      }

      await connection.execute(
        `UPDATE payments
         SET status = 'reversed',
             reversed_by = ?,
             reversed_at = NOW(),
             reversal_reason = ?,
             updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [actorUserId, reason.trim(), paymentId, tenantId]
      );

      await this.recalculateInvoicesAfterPaymentRemoval(connection, tenantId, paymentId);
      await recalculateBookingPaymentTotals(connection, tenantId, Number(payment.booking_id));
      await connection.commit();

      const updated = await this.findById(paymentId);
      if (!updated) throw new Error('Payment not found after reversal');
      return updated;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async recalculateInvoicesAfterPaymentRemoval(
    connection: any,
    tenantId: number,
    paymentId: number
  ): Promise<void> {
    const [allocations] = await connection.execute(
      `SELECT invoice_id, amount
       FROM invoice_payment_allocations
       WHERE payment_id = ? AND tenant_id = ?`,
      [paymentId, tenantId]
    );

    for (const allocation of allocations as RowDataPacket[]) {
      const amount = validatePositiveMoney(Number(allocation.amount), 'Allocation amount');
      await connection.execute(
        `UPDATE invoices
         SET amount_paid = GREATEST(ROUND(amount_paid - ?, 2), 0),
             balance_amount = ROUND(grand_total - GREATEST(ROUND(amount_paid - ?, 2), 0), 2),
             payment_status = CASE
               WHEN GREATEST(ROUND(amount_paid - ?, 2), 0) <= 0 THEN 'unpaid'
               WHEN ROUND(grand_total - GREATEST(ROUND(amount_paid - ?, 2), 0), 2) <= 0 THEN 'paid'
               ELSE 'partial'
             END,
             status = CASE
               WHEN status IN ('cancelled', 'void') THEN status
               WHEN ROUND(grand_total - GREATEST(ROUND(amount_paid - ?, 2), 0), 2) <= 0 THEN 'paid'
               WHEN GREATEST(ROUND(amount_paid - ?, 2), 0) > 0 THEN 'partially_paid'
               ELSE 'issued'
             END,
             updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [
          amount,
          amount,
          amount,
          amount,
          amount,
          amount,
          allocation.invoice_id,
          tenantId,
        ]
      );
    }
  }

  /**
   * Get total payments for a booking
   */
  async getTotalByBooking(bookingId: number): Promise<number> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT SUM(amount) as total
       FROM payments
       WHERE booking_id = ? AND tenant_id = ?
         AND COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')`,
      [bookingId, tenantId]
    );
    return roundMoney(Number(rows[0]?.total || 0));
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
        AND COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')
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
