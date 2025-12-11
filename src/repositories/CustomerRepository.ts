/**
 * Customer Repository
 * Data access layer for customers
 */

import { RowDataPacket } from 'mysql2';
import { BaseRepository } from './BaseRepository';
import { Customer, CustomerSearchParams } from '../models/Customer';
import pool from '../config/db';
import { validateLimit, validateOffset } from '../utils/validators';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('customers');
  }

  /**
   * Search customers with filters
   */
  async search(params: CustomerSearchParams): Promise<Customer[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values: any[] = [];

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

    // Use template literals for LIMIT/OFFSET as MySQL doesn't support them as parameters
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
    const sql = `SELECT * FROM ${this.tableName} WHERE phone = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [phone]);
    return rows.length > 0 ? (rows[0] as Customer) : null;
  }

  /**
   * Find customer by email
   */
  async findByEmail(email: string): Promise<Customer | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE email = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [email]);
    return rows.length > 0 ? (rows[0] as Customer) : null;
  }

  /**
   * Get recent customers
   */
  async getRecent(limit: number = 10): Promise<Customer[]> {
    // Validate and sanitize limit to prevent SQL issues
    const validLimit = validateLimit(limit, 10, 100);
    
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'active'
      ORDER BY created_at DESC 
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, []);
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
    const [totalRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );

    const [activeRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'active'`
    );

    const [inactiveRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'inactive'`
    );

    const [eventTypeRows] = await pool.execute<RowDataPacket[]>(
      `SELECT event_type, COUNT(*) as count FROM ${this.tableName} GROUP BY event_type`
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
