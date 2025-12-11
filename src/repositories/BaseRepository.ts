/**
 * Base Repository
 * Generic CRUD operations for all entities
 * Implements Repository Pattern for clean architecture
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';

export class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find all records
   */
  async findAll(limit?: number, offset?: number): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    if (offset) {
      sql += ' OFFSET ?';
      params.push(offset);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  /**
   * Find by ID
   */
  async findById(id: number): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
    return rows.length > 0 ? (rows[0] as T) : null;
  }

  /**
   * Create new record
   */
  async create(data: Partial<T>): Promise<number> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.execute<ResultSetHeader>(sql, values);
    return result.insertId;
  }

  /**
   * Update record by ID
   */
  async update(id: number, data: Partial<T>): Promise<boolean> {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [...values, id]);
    return result.affectedRows > 0;
  }

  /**
   * Delete record by ID
   */
  async delete(id: number): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [id]);
    return result.affectedRows > 0;
  }

  /**
   * Count total records
   */
  async count(whereClause?: string, params?: any[]): Promise<number> {
    let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params || []);
    return rows[0].total;
  }

  /**
   * Check if record exists
   */
  async exists(id: number): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
    return rows.length > 0;
  }

  /**
   * Execute custom query
   */
  async query<R = any>(sql: string, params?: any[]): Promise<R[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as R[];
  }
}
