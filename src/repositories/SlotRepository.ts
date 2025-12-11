/**
 * Slot Repository
 * Data access layer for hall availability slots
 */

import { RowDataPacket } from 'mysql2';
import { BaseRepository } from './BaseRepository';
import { Slot, SlotSearchParams } from '../models/Slot';
import pool from '../config/db';

export class SlotRepository extends BaseRepository<Slot> {
  constructor() {
    super('slots');
  }

  /**
   * Get slots with filters
   */
  async search(params: SlotSearchParams): Promise<Slot[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values: any[] = [];

    if (params.hall_id) {
      sql += ' AND hall_id = ?';
      values.push(params.hall_id);
    }

    if (params.date_from) {
      sql += ' AND slot_date >= ?';
      values.push(params.date_from);
    }

    if (params.date_to) {
      sql += ' AND slot_date <= ?';
      values.push(params.date_to);
    }

    if (params.status) {
      sql += ' AND status = ?';
      values.push(params.status);
    }

    sql += ' ORDER BY slot_date ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, values);
    return rows as Slot[];
  }

  /**
   * Get available slots for a hall
   */
  async getAvailable(hallId: number, dateFrom: string, dateTo: string): Promise<Slot[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE hall_id = ?
      AND slot_date BETWEEN ? AND ?
      AND status = 'available'
      ORDER BY slot_date ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, dateFrom, dateTo]);
    return rows as Slot[];
  }

  /**
   * Check if slot is available
   */
  async isAvailable(hallId: number, date: string): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as count 
      FROM ${this.tableName}
      WHERE hall_id = ? 
      AND slot_date = ? 
      AND status = 'booked'
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, date]);
    return rows[0].count === 0;
  }

  /**
   * Get slot by hall and date
   */
  async findByHallAndDate(hallId: number, date: string): Promise<Slot | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE hall_id = ? AND slot_date = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, date]);
    return rows.length > 0 ? (rows[0] as Slot) : null;
  }
}
