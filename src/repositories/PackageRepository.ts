/**
 * Package Repository
 * Data access layer for packages
 */

import { RowDataPacket } from 'mysql2';
import { BaseRepository } from './BaseRepository';
import { Package, PackageSearchParams } from '../models/Package';
import pool from '../config/db';
import { validateLimit, validateOffset } from '../utils/validators';

export class PackageRepository extends BaseRepository<Package> {
  constructor() {
    super('packages');
  }

  /**
   * Search packages with filters
   */
  async search(params: PackageSearchParams): Promise<Package[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const values: any[] = [];

    if (params.name) {
      sql += ' AND name LIKE ?';
      values.push(`%${params.name}%`);
    }

    if (params.status) {
      sql += ' AND status = ?';
      values.push(params.status);
    }

    sql += ' ORDER BY base_price ASC';

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
    return rows as Package[];
  }

  /**
   * Get active packages
   */
  async getActive(): Promise<Package[]> {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'active'
      ORDER BY base_price ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql);
    return rows as Package[];
  }

  /**
   * Get popular packages (most booked)
   */
  async getPopular(limit: number = 5): Promise<Package[]> {
    // Validate and sanitize limit to prevent SQL issues
    const validLimit = validateLimit(limit, 5, 50);
    
    const sql = `
      SELECT p.*, COUNT(b.id) as booking_count
      FROM ${this.tableName} p
      LEFT JOIN bookings b ON p.id = b.package_id
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY booking_count DESC
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, []);
    return rows as Package[];
  }
}
