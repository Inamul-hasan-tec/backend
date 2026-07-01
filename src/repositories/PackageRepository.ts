/**
 * Package Repository
 * Data access layer for packages with Strict Multi-Tenancy via ALS
 */

import { RowDataPacket } from 'mysql2';
import { TenantBaseRepository } from './TenantBaseRepository';
import { Package, PackageSearchParams } from '../models/Package';
import pool from '../config/db';
import { validateLimit, validateOffset } from '../utils/validators';
import { getTenantId } from '../utils/tenantContext';

export class PackageRepository extends TenantBaseRepository<Package> {
  constructor() {
    super('packages');
  }

  /**
   * Search packages with filters
   */
  async search(params: PackageSearchParams): Promise<Package[]> {
    const tenantId = getTenantId();
    let sql = `SELECT * FROM ${this.tableName} WHERE tenant_id = ?`;
    const values: any[] = [tenantId];

    if (params.name) {
      sql += ' AND name LIKE ?';
      values.push(`%${params.name}%`);
    }

    if (params.status) {
      sql += ' AND status = ?';
      values.push(params.status);
    }

    sql += ' ORDER BY base_price ASC';

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
    const tenantId = getTenantId();
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE status = 'active' AND tenant_id = ?
      ORDER BY base_price ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Package[];
  }

  /**
   * Get popular packages (most booked)
   */
  async getPopular(limit: number = 5): Promise<Package[]> {
    const tenantId = getTenantId();
    const validLimit = validateLimit(limit, 5, 50);
    
    const sql = `
      SELECT p.*, COUNT(b.id) as booking_count
      FROM ${this.tableName} p
      LEFT JOIN bookings b ON p.id = b.package_id
      WHERE p.status = 'active' AND p.tenant_id = ?
      GROUP BY p.id
      ORDER BY booking_count DESC
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Package[];
  }
}
