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
    const tenantId = getTenantId();
    let sql = `
      SELECT
        p.*,
        b.event_date,
        b.time_slot,
        b.payment_status AS booking_payment_status,
        c.name AS customer_name,
        c.phone AS customer_phone,
        h.name AS hall_name
      FROM payments p
      LEFT JOIN bookings b ON b.id = p.booking_id AND b.tenant_id = p.tenant_id
      LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = p.tenant_id
      LEFT JOIN halls h ON h.id = b.hall_id AND h.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
      ORDER BY p.payment_date DESC, p.id DESC
    `;

    if (limit !== undefined && limit > 0) {
      sql += ` LIMIT ${Math.floor(Math.abs(limit))}`;
    }

    if (offset !== undefined && offset >= 0) {
      sql += ` OFFSET ${Math.floor(Math.abs(offset))}`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Payment[];
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

  async getReconciliation() {
    const tenantId = getTenantId();
    const [summaryRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        COUNT(*) AS total_records,
        SUM(CASE WHEN COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed') THEN 1 ELSE 0 END) AS active_count,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed') THEN amount ELSE 0 END), 0) AS active_amount,
        SUM(CASE WHEN COALESCE(status, 'recorded') = 'recorded' THEN 1 ELSE 0 END) AS needs_verification_count,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'recorded') = 'recorded' THEN amount ELSE 0 END), 0) AS needs_verification_amount,
        SUM(CASE WHEN COALESCE(status, 'recorded') = 'verified' THEN 1 ELSE 0 END) AS verified_count,
        COALESCE(SUM(CASE WHEN COALESCE(status, 'recorded') = 'verified' THEN amount ELSE 0 END), 0) AS verified_amount,
        SUM(CASE WHEN COALESCE(status, 'recorded') = 'failed' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN COALESCE(status, 'recorded') = 'reversed' THEN 1 ELSE 0 END) AS reversed_count,
        SUM(CASE
          WHEN COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')
           AND payment_mode IN ('upi', 'bank_transfer', 'cheque', 'card')
           AND (transaction_id IS NULL OR TRIM(transaction_id) = '')
          THEN 1 ELSE 0
        END) AS missing_reference_count,
        COALESCE(SUM(CASE
          WHEN COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')
           AND DATE(payment_date) = CURRENT_DATE()
          THEN amount ELSE 0
        END), 0) AS today_active_amount,
        SUM(CASE
          WHEN COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')
           AND DATE(payment_date) = CURRENT_DATE()
          THEN 1 ELSE 0
        END) AS today_active_count
       FROM payments
       WHERE tenant_id = ?`,
      [tenantId]
    );

    const [reviewRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
        p.id,
        p.booking_id,
        p.receipt_number,
        p.amount,
        p.payment_mode,
        p.payment_type,
        p.transaction_id,
        COALESCE(p.status, 'recorded') AS status,
        p.payment_date,
        p.verified_at,
        p.reversed_at,
        p.reversal_reason,
        p.failure_reason,
        b.event_date,
        b.time_slot,
        c.name AS customer_name,
        h.name AS hall_name,
        CASE
          WHEN COALESCE(p.status, 'recorded') = 'recorded' THEN 'needs_verification'
          WHEN COALESCE(p.status, 'recorded') = 'failed' THEN 'failed'
          WHEN COALESCE(p.status, 'recorded') = 'reversed' THEN 'reversed'
          WHEN COALESCE(p.status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')
           AND p.payment_mode IN ('upi', 'bank_transfer', 'cheque', 'card')
           AND (p.transaction_id IS NULL OR TRIM(p.transaction_id) = '')
          THEN 'missing_reference'
          ELSE 'review'
        END AS review_reason
       FROM payments p
       LEFT JOIN bookings b ON b.id = p.booking_id AND b.tenant_id = p.tenant_id
       LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = p.tenant_id
       LEFT JOIN halls h ON h.id = b.hall_id AND h.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
         AND (
          COALESCE(p.status, 'recorded') IN ('recorded', 'failed', 'reversed')
          OR (
            COALESCE(p.status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')
            AND p.payment_mode IN ('upi', 'bank_transfer', 'cheque', 'card')
            AND (p.transaction_id IS NULL OR TRIM(p.transaction_id) = '')
          )
         )
       ORDER BY
        CASE COALESCE(p.status, 'recorded')
          WHEN 'recorded' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'reversed' THEN 3
          ELSE 4
        END,
        p.payment_date DESC,
        p.id DESC
       LIMIT 25`,
      [tenantId]
    );

    return {
      summary: summaryRows[0] || {},
      review_items: reviewRows,
    };
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
