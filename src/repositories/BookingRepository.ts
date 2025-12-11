/**
 * Booking Repository
 * Data access layer for bookings
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { BaseRepository } from './BaseRepository';
import { Booking, BookingDetails, BookingSearchParams } from '../models/Booking';
import pool, { getConnection } from '../config/db';
import { validateLimit, validateOffset } from '../utils/validators';

export class BookingRepository extends BaseRepository<Booking> {
  constructor() {
    super('bookings');
  }

  /**
   * Create booking with slot (transaction)
   */
  async createWithSlot(bookingData: Partial<Booking>): Promise<number> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();

      // Create booking
      const fields = Object.keys(bookingData);
      const values = Object.values(bookingData);
      const placeholders = fields.map(() => '?').join(', ');

      const bookingSql = `INSERT INTO bookings (${fields.join(', ')}) VALUES (${placeholders})`;
      const [bookingResult] = await connection.execute<ResultSetHeader>(bookingSql, values);
      const bookingId = bookingResult.insertId;

      // Create or update slot
      const slotSql = `
        INSERT INTO slots (hall_id, slot_date, status, booking_id)
        VALUES (?, ?, 'booked', ?)
        ON DUPLICATE KEY UPDATE status = 'booked', booking_id = ?
      `;
      await connection.execute(slotSql, [
        bookingData.hall_id,
        bookingData.event_date,
        bookingId,
        bookingId,
      ]);

      await connection.commit();
      return bookingId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get booking with full details
   */
  async getDetails(id: number): Promise<BookingDetails | null> {
    const sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        h.name as hall_name,
        h.capacity as hall_capacity,
        h.location as hall_location,
        p.name as package_name,
        p.base_price as package_price,
        u.name as created_by_name
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN halls h ON b.hall_id = h.id
      LEFT JOIN packages p ON b.package_id = p.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
    return rows.length > 0 ? (rows[0] as BookingDetails) : null;
  }

  /**
   * Search bookings with filters
   */
  async search(params: BookingSearchParams): Promise<BookingDetails[]> {
    let sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        h.name as hall_name,
        h.capacity as hall_capacity,
        h.location as hall_location,
        p.name as package_name,
        p.base_price as package_price,
        u.name as created_by_name
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN halls h ON b.hall_id = h.id
      LEFT JOIN packages p ON b.package_id = p.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (params.customer_id) {
      sql += ' AND b.customer_id = ?';
      values.push(params.customer_id);
    }

    if (params.hall_id) {
      sql += ' AND b.hall_id = ?';
      values.push(params.hall_id);
    }

    if (params.status) {
      sql += ' AND b.status = ?';
      values.push(params.status);
    }

    if (params.event_date_from) {
      sql += ' AND b.event_date >= ?';
      values.push(params.event_date_from);
    }

    if (params.event_date_to) {
      sql += ' AND b.event_date <= ?';
      values.push(params.event_date_to);
    }

    sql += ' ORDER BY b.event_date DESC, b.created_at DESC';

    if (params.limit) {
      sql += ' LIMIT ?';
      values.push(params.limit);
    }

    if (params.offset) {
      sql += ' OFFSET ?';
      values.push(params.offset);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, values);
    return rows as BookingDetails[];
  }

  /**
   * Get upcoming bookings
   */
  async getUpcoming(limit: number = 10): Promise<BookingDetails[]> {
    // Validate and sanitize limit to prevent SQL issues
    const validLimit = validateLimit(limit, 10, 100);
    
    const sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        h.name as hall_name,
        h.capacity as hall_capacity,
        h.location as hall_location
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN halls h ON b.hall_id = h.id
      WHERE b.event_date >= CURDATE()
      AND b.status IN ('pending', 'confirmed')
      ORDER BY b.event_date ASC
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, []);
    return rows as BookingDetails[];
  }

  /**
   * Get today's bookings
   */
  async getToday(): Promise<BookingDetails[]> {
    const sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        h.name as hall_name
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN halls h ON b.hall_id = h.id
      WHERE b.event_date = CURDATE()
      ORDER BY b.created_at DESC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql);
    return rows as BookingDetails[];
  }

  /**
   * Cancel booking and release slot
   */
  async cancel(id: number): Promise<boolean> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();

      // Update booking status
      const bookingSql = `UPDATE bookings SET status = 'cancelled' WHERE id = ?`;
      await connection.execute(bookingSql, [id]);

      // Release slot
      const slotSql = `
        UPDATE slots 
        SET status = 'available', booking_id = NULL 
        WHERE booking_id = ?
      `;
      await connection.execute(slotSql, [id]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get booking statistics
   */
  async getStats(): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    completed: number;
    totalRevenue: number;
    advanceCollected: number;
    balancePending: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COALESCE(SUM(total_amount), 0) as totalRevenue,
        COALESCE(SUM(advance_amount), 0) as advanceCollected,
        COALESCE(SUM(balance_amount), 0) as balancePending
      FROM bookings
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql);
    return rows[0] as any;
  }
}
