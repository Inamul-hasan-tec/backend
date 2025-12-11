/**
 * Payment Repository
 * Database operations for payments
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';
import { Payment, CreatePaymentDTO } from '../models/Payment';

export class PaymentRepository {
  /**
   * Get all payments
   */
  async findAll(limit?: number, offset?: number): Promise<Payment[]> {
    let sql = 'SELECT * FROM payments ORDER BY payment_date DESC';
    const params: any[] = [];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as Payment[];
  }

  /**
   * Get payment by ID
   */
  async findById(id: number): Promise<Payment | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM payments WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? (rows[0] as Payment) : null;
  }

  /**
   * Get payments by booking ID
   */
  async findByBookingId(bookingId: number): Promise<Payment[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_date DESC',
      [bookingId]
    );
    return rows as Payment[];
  }

  /**
   * Create new payment
   */
  async create(payment: CreatePaymentDTO): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO payments (
        booking_id, amount, payment_mode, payment_type,
        transaction_id, payment_date, notes, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
   * Get total payments for a booking
   */
  async getTotalByBooking(bookingId: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT SUM(amount) as total FROM payments WHERE booking_id = ?',
      [bookingId]
    );
    return rows[0]?.total || 0;
  }

  /**
   * Get payment statistics
   */
  async getStats() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_amount,
        payment_mode,
        COUNT(*) as count
      FROM payments
      GROUP BY payment_mode
    `);
    return rows;
  }
}
