/**
 * Booking Repository
 * Data access layer for bookings with Strict Multi-Tenancy via ALS
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { TenantBaseRepository } from './TenantBaseRepository';
import { Booking, BookingDetails, BookingSearchParams } from '../models/Booking';
import pool, { getConnection } from '../config/db';
import { validateLimit } from '../utils/validators';
import { getTenantId } from '../utils/tenantContext';

export class BookingRepository extends TenantBaseRepository<Booking> {
  constructor() {
    super('bookings');
  }

  /**
   * Update a booking and move its slot as one transaction.
   */
  async updateWithSlot(
    id: number,
    updates: Partial<Booking>,
    target: { hallId: number; eventDate: string; timeSlot: string }
  ): Promise<boolean> {
    const tenantId = getTenantId();
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [bookingRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, hall_id, event_date, time_slot
         FROM bookings
         WHERE id = ? AND tenant_id = ?
         FOR UPDATE`,
        [id, tenantId]
      );
      const current = bookingRows[0];
      if (!current) {
        throw new Error('Booking not found');
      }

      const currentDate = formatDatabaseDate(current.event_date);
      const slotChanged =
        Number(current.hall_id) !== target.hallId ||
        currentDate !== target.eventDate ||
        current.time_slot !== target.timeSlot;

      if (slotChanged) {
        const [targetRows] = await connection.execute<RowDataPacket[]>(
          `SELECT id, status, booking_id
           FROM slots
           WHERE tenant_id = ? AND hall_id = ? AND slot_date = ? AND slot_type = ?
           FOR UPDATE`,
          [tenantId, target.hallId, target.eventDate, target.timeSlot]
        );

        let targetSlotId: number;
        const targetSlot = targetRows[0];
        if (targetSlot) {
          if (
            Number(targetSlot.booking_id) !== id &&
            (targetSlot.status !== 'available' || targetSlot.booking_id !== null)
          ) {
            throw new Error('Selected slot is no longer available');
          }

          const [claimResult] = await connection.execute<ResultSetHeader>(
            `UPDATE slots
             SET status = 'booked', booking_id = ?
             WHERE id = ? AND tenant_id = ?
               AND (booking_id = ? OR (status = 'available' AND booking_id IS NULL))`,
            [id, targetSlot.id, tenantId, id]
          );
          if (claimResult.affectedRows !== 1) {
            throw new Error('Selected slot is no longer available');
          }
          targetSlotId = Number(targetSlot.id);
        } else {
          const [insertResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO slots
             (tenant_id, hall_id, slot_date, slot_type, status, booking_id)
             VALUES (?, ?, ?, ?, 'booked', ?)`,
            [tenantId, target.hallId, target.eventDate, target.timeSlot, id]
          );
          targetSlotId = insertResult.insertId;
        }

        await connection.execute(
          `UPDATE slots
           SET status = 'available', booking_id = NULL
           WHERE tenant_id = ? AND booking_id = ? AND id <> ?`,
          [tenantId, id, targetSlotId]
        );
      }

      const allowedFields = [
        'customer_id',
        'hall_id',
        'package_id',
        'event_date',
        'time_slot',
        'event_type',
        'guest_count',
        'total_amount',
        'advance_amount',
        'balance_amount',
        'payment_mode',
        'notes',
      ];
      const safeUpdates = Object.entries(updates).filter(
        ([field, value]) => allowedFields.includes(field) && value !== undefined
      );

      if (safeUpdates.length > 0) {
        const setClause = safeUpdates.map(([field]) => `${field} = ?`).join(', ');
        const values = safeUpdates.map(([, value]) => value);
        await connection.execute(
          `UPDATE bookings
           SET ${setClause}, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [...values, id, tenantId]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        throw new Error('Hall is already booked for the selected date and slot');
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Create booking with slot (transaction)
   */
  async createWithSlot(bookingData: Partial<Booking>): Promise<number> {
    const tenantId = getTenantId();
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();

      // Clean up frontend-specific fields before DB insert
      const { slot_id, ...cleanBookingData } = bookingData as any;

      // Create booking
      const dataWithTenant = { ...cleanBookingData, tenant_id: tenantId };
      const fields = Object.keys(dataWithTenant);
      const values = Object.values(dataWithTenant) as any[];
      const placeholders = fields.map(() => '?').join(', ');

      const bookingSql = `INSERT INTO bookings (${fields.join(', ')}) VALUES (${placeholders})`;
      const [bookingResult] = await connection.execute<ResultSetHeader>(bookingSql, values);
      const bookingId = bookingResult.insertId;

      if (slot_id) {
        const [slotResult] = await connection.execute<ResultSetHeader>(
          `UPDATE slots
           SET status = 'booked', booking_id = ?
           WHERE id = ? AND tenant_id = ? AND hall_id = ? AND slot_date = ?
             AND slot_type = ? AND status = 'available' AND booking_id IS NULL`,
          [
            bookingId,
            slot_id,
            tenantId,
            bookingData.hall_id,
            bookingData.event_date,
            bookingData.time_slot,
          ]
        );

        if (slotResult.affectedRows !== 1) {
          throw new Error('Selected slot is no longer available');
        }
      } else {
        await connection.execute(
          `INSERT INTO slots
           (hall_id, tenant_id, slot_date, slot_type, status, booking_id)
           VALUES (?, ?, ?, ?, 'booked', ?)`,
          [
            bookingData.hall_id,
            tenantId,
            bookingData.event_date,
            bookingData.time_slot || 'full_day',
            bookingId,
          ]
        );
      }

      await connection.commit();
      return bookingId;
    } catch (error) {
      await connection.rollback();
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ER_DUP_ENTRY'
      ) {
        throw new Error('Hall is already booked for the selected date and slot');
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get booking with full details
   */
  async getDetails(id: number): Promise<BookingDetails | null> {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        h.name as hall_name,
        h.capacity as hall_capacity,
        h.base_price as hall_base_price,
        p.name as package_name,
        p.base_price as package_price,
        u.name as created_by_name
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      LEFT JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      LEFT JOIN packages p ON b.package_id = p.id AND p.tenant_id = b.tenant_id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ? AND b.tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id, tenantId]);
    return rows.length > 0 ? (rows[0] as BookingDetails) : null;
  }

  /**
   * Search bookings with filters
   */
  async search(params: BookingSearchParams): Promise<BookingDetails[]> {
    const tenantId = getTenantId();
    let sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        h.name as hall_name,
        h.capacity as hall_capacity,
        h.base_price as hall_base_price,
        p.name as package_name,
        p.base_price as package_price,
        u.name as created_by_name
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      LEFT JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      LEFT JOIN packages p ON b.package_id = p.id AND p.tenant_id = b.tenant_id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.tenant_id = ?
    `;
    const values: any[] = [tenantId];

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
    const tenantId = getTenantId();
    const validLimit = validateLimit(limit, 10, 100);
    
    const sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        h.name as hall_name,
        h.capacity as hall_capacity
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      LEFT JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      WHERE b.tenant_id = ? AND b.event_date >= CURDATE()
      AND b.status IN ('pending', 'confirmed')
      ORDER BY b.event_date ASC
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as BookingDetails[];
  }

  /**
   * Get today's bookings
   */
  async getToday(): Promise<BookingDetails[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        b.*,
        c.name as customer_name,
        c.phone as customer_phone,
        h.name as hall_name
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      LEFT JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      WHERE b.tenant_id = ? AND b.event_date = CURDATE()
      ORDER BY b.created_at DESC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as BookingDetails[];
  }

  /**
   * Cancel booking and release slot
   */
  async cancel(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if booking belongs to tenant
      const checkSql = `SELECT id FROM bookings WHERE id = ? AND tenant_id = ?`;
      const [checkRows] = await connection.execute<RowDataPacket[]>(checkSql, [id, tenantId]);
      
      if (checkRows.length === 0) {
        throw new Error('Booking not found or unauthorized');
      }

      // Update booking status
      const bookingSql = `UPDATE bookings SET status = 'cancelled' WHERE id = ? AND tenant_id = ?`;
      await connection.execute(bookingSql, [id, tenantId]);

      // Release slot
      const slotSql = `
        UPDATE slots 
        SET status = 'available', booking_id = NULL 
        WHERE booking_id = ? AND tenant_id = ?
      `;
      await connection.execute(slotSql, [id, tenantId]);

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
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COALESCE(SUM(total_amount), 0) as totalRevenue,
        COALESCE(SUM(advance_amount), 0) as advanceCollected,
        COALESCE(SUM(total_amount - advance_amount), 0) as balancePending
      FROM bookings
      WHERE tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows[0] as any;
  }
}

function formatDatabaseDate(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}
