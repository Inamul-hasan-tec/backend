/**
 * Customer Repository
 * Data access layer for customers with Strict Multi-Tenancy via ALS
 */

import { RowDataPacket } from 'mysql2';
import { TenantBaseRepository } from './TenantBaseRepository';
import { Customer, CustomerSearchParams } from '../models/Customer';
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
}
