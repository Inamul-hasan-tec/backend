/**
 * Customer Repository
 * Data access layer for customers with Strict Multi-Tenancy via ALS
 */

import { RowDataPacket } from 'mysql2';
import { TenantBaseRepository } from './TenantBaseRepository';
import { Customer, CustomerSearchParams, CustomerDependencyStats } from '../models/Customer';
import pool from '../config/db';
import { validateLimit, validateOffset } from '../utils/validators';
import { getTenantId } from '../utils/tenantContext';

export class CustomerRepository extends TenantBaseRepository<Customer> {
  constructor() {
    super('customers');
  }

  /**
   * Find all customers
   */
  async findAllCustomers(limit?: number, offset?: number): Promise<Customer[]> {
    return this.findAll(limit, offset);
  }

  /**
   * Search customers with filters
   */
  async search(params: CustomerSearchParams): Promise<Customer[]> {
    const tenantId = getTenantId();
    let sql = `SELECT * FROM ${this.tableName} WHERE tenant_id = ?`;
    const values: any[] = [tenantId];

    if (params.name) {
      sql += ' AND name LIKE ?';
      values.push(`%${params.name}%`);
    }

    if (params.phone) {
      sql += ' AND phone LIKE ?';
      values.push(`%${params.phone}%`);
    }

    if (params.email) {
      sql += ' AND email LIKE ?';
      values.push(`%${params.email}%`);
    }

    if (params.city) {
      sql += ' AND city LIKE ?';
      values.push(`%${params.city}%`);
    }

    if (params.status) {
      sql += ' AND status = ?';
      values.push(params.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (params.limit) {
      const validLimit = validateLimit(params.limit, 10, 100);
      sql += ` LIMIT ${validLimit}`;
    }

    if (params.offset) {
      const validOffset = validateOffset(params.offset, 0, 10000);
      sql += ` OFFSET ${validOffset}`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, values);
    return rows as Customer[];
  }

  /**
   * Find customer by phone
   */
  async findByPhone(phone: string): Promise<Customer | null> {
    const tenantId = getTenantId();
    const sql = `SELECT * FROM ${this.tableName} WHERE phone = ? AND tenant_id = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [phone, tenantId]);
    return rows.length > 0 ? (rows[0] as Customer) : null;
  }

  /**
   * Find customer by email
   */
  async findByEmail(email: string): Promise<Customer | null> {
    const tenantId = getTenantId();
    const sql = `SELECT * FROM ${this.tableName} WHERE email = ? AND tenant_id = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [email, tenantId]);
    return rows.length > 0 ? (rows[0] as Customer) : null;
  }

  /**
   * Get recent customers
   */
  async getRecent(limit: number = 10): Promise<Customer[]> {
    const tenantId = getTenantId();
    const validLimit = validateLimit(limit, 10, 100);
    
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'active' AND tenant_id = ?
      ORDER BY created_at DESC 
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Customer[];
  }

  /**
   * Get customer statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byEventType: Record<string, number>;
  }> {
    const tenantId = getTenantId();
    
    const [totalRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = ?`,
      [tenantId]
    );

    const [activeRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'active' AND tenant_id = ?`,
      [tenantId]
    );

    const [inactiveRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'inactive' AND tenant_id = ?`,
      [tenantId]
    );

    const [eventTypeRows] = await pool.execute<RowDataPacket[]>(
      `SELECT event_type, COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = ? GROUP BY event_type`,
      [tenantId]
    );

    const byEventType: Record<string, number> = {};
    eventTypeRows.forEach((row: any) => {
      if (row.event_type) {
        byEventType[row.event_type] = row.count;
      }
    });

    return {
      total: totalRows[0].count,
      active: activeRows[0].count,
      inactive: inactiveRows[0].count,
      byEventType,
    };
  }

  /**
   * Get customer dependency counts and financial summary
   */
  async getCustomerDependencies(id: number): Promise<CustomerDependencyStats> {
    const tenantId = getTenantId();

    const [bookingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) as active_bookings,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
        SUM(CASE WHEN status != 'cancelled' THEN GREATEST(0, (total_amount - COALESCE(advance_amount, 0))) ELSE 0 END) as outstanding_balance,
        SUM(CASE WHEN status != 'cancelled' THEN COALESCE(advance_amount, 0) ELSE 0 END) as total_paid_bookings
       FROM bookings WHERE customer_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    const [paymentRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as payments_count, SUM(p.amount) as total_payments 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE b.customer_id = ? AND b.tenant_id = ?`,
      [id, tenantId]
    );

    const [invoiceRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as invoices_count 
       FROM invoices WHERE customer_id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    const active_bookings = Number(bookingRows[0]?.active_bookings || 0);
    const cancelled_bookings = Number(bookingRows[0]?.cancelled_bookings || 0);
    const outstanding_balance = Math.max(0, Number(bookingRows[0]?.outstanding_balance || 0));
    const payments_count = Number(paymentRows[0]?.payments_count || 0);
    const invoices_count = Number(invoiceRows[0]?.invoices_count || 0);
    const total_paid = Number(paymentRows[0]?.total_payments || bookingRows[0]?.total_paid_bookings || 0);

    return {
      active_bookings,
      cancelled_bookings,
      payments_count,
      invoices_count,
      total_paid,
      outstanding_balance,
    };
  }

  /**
   * Archive customer and log audit entry
   */
  async archiveCustomer(id: number, reason: string, actorId: number): Promise<boolean> {
    const tenantId = getTenantId();

    const [result] = await pool.execute<any>(
      `UPDATE ${this.tableName} SET status = 'archived', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    if (result.affectedRows > 0) {
      try {
        await pool.execute(
          `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_values, created_at)
           VALUES (?, ?, 'archive_customer', 'customer', ?, ?, NOW())`,
          [
            tenantId,
            actorId || null,
            id,
            JSON.stringify({ status: 'archived', reason: reason || 'Customer archived by staff' })
          ]
        );
      } catch (err) {
        console.error('Failed to write customer archive audit log:', err);
      }
      return true;
    }

    return false;
  }
}
