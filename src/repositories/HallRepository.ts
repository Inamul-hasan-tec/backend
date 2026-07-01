/**
 * Hall Repository
 * Data access layer for halls with Strict Multi-Tenancy via ALS
 */

import { RowDataPacket } from 'mysql2';
import { TenantBaseRepository } from './TenantBaseRepository';
import { Hall, HallSearchParams } from '../models/Hall';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';

export class HallRepository extends TenantBaseRepository<Hall> {
  constructor() {
    super('halls');
  }

  /**
   * Search halls with filters
   */
  async search(params: HallSearchParams): Promise<Hall[]> {
    const tenantId = getTenantId();
    let sql = `SELECT * FROM ${this.tableName} WHERE tenant_id = ?`;
    const values: any[] = [tenantId];

    if (params.name) {
      sql += ' AND name LIKE ?';
      values.push(`%${params.name}%`);
    }

    if (params.min_capacity) {
      sql += ' AND capacity >= ?';
      values.push(params.min_capacity);
    }

    if (params.max_capacity) {
      sql += ' AND capacity <= ?';
      values.push(params.max_capacity);
    }

    if (params.status) {
      sql += ' AND status = ?';
      values.push(params.status);
    }

    sql += ' ORDER BY capacity ASC';

    if (params.limit) {
      sql += ' LIMIT ?';
      values.push(params.limit);
    }

    if (params.offset) {
      sql += ' OFFSET ?';
      values.push(params.offset);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, values);
    return rows as Hall[];
  }

  /**
   * Get active halls
   */
  async getActive(): Promise<Hall[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'active' AND tenant_id = ?
      ORDER BY capacity ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Hall[];
  }

  /**
   * Check hall availability for a date
   */
  async isAvailable(hallId: number, date: string): Promise<boolean> {
    const tenantId = getTenantId();
    const sql = `
      SELECT COUNT(*) as count 
      FROM slots 
      WHERE hall_id = ? 
      AND slot_date = ? 
      AND status = 'booked'
      AND tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, date, tenantId]);
    return rows[0].count === 0;
  }

  /**
   * Get hall with availability for date range
   */
  async getWithAvailability(
    hallId: number,
    dateFrom: string,
    dateTo: string
  ): Promise<{
    hall: Hall;
    bookedDates: string[];
  } | null> {
    const tenantId = getTenantId();
    const hall = await this.findById(hallId);
    if (!hall) return null;

    const sql = `
      SELECT slot_date 
      FROM slots 
      WHERE hall_id = ? 
      AND slot_date BETWEEN ? AND ?
      AND status = 'booked'
      AND tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [
      hallId,
      dateFrom,
      dateTo,
      tenantId
    ]);

    const bookedDates = rows.map((row: any) => row.slot_date);

    return {
      hall,
      bookedDates,
    };
  }
}
