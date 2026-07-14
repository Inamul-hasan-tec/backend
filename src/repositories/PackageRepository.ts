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
    let sql = `
      SELECT p.*, h.name AS hall_name
      FROM ${this.tableName} p
      LEFT JOIN halls h ON h.id = p.hall_id AND h.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
    `;
    const values: any[] = [tenantId];

    if (params.name) {
      sql += ' AND p.name LIKE ?';
      values.push(`%${params.name}%`);
    }

    if (params.hall_id) {
      sql += ' AND (p.hall_id IS NULL OR p.hall_id = ?)';
      values.push(params.hall_id);
    }

    if (params.status) {
      sql += ' AND p.status = ?';
      values.push(params.status);
    }

    sql += ' ORDER BY p.hall_id IS NOT NULL DESC, p.base_price ASC';

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
      SELECT p.*, h.name AS hall_name
      FROM ${this.tableName} p
      LEFT JOIN halls h ON h.id = p.hall_id AND h.tenant_id = p.tenant_id
      WHERE p.status = 'active' AND p.tenant_id = ?
      ORDER BY p.hall_id IS NOT NULL DESC, p.base_price ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Package[];
  }

  /**
   * Get active packages available for a hall.
   * Global packages (hall_id NULL) are available for every hall.
   */
  async getActiveForHall(hallId: number): Promise<Package[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT p.*, h.name AS hall_name
      FROM ${this.tableName} p
      LEFT JOIN halls h ON h.id = p.hall_id AND h.tenant_id = p.tenant_id
      WHERE p.status = 'active'
        AND p.tenant_id = ?
        AND (p.hall_id IS NULL OR p.hall_id = ?)
      ORDER BY p.hall_id IS NOT NULL DESC, p.base_price ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId, hallId]);
    return rows as Package[];
  }

  /**
   * Get popular packages (most booked)
   */
  async getPopular(limit: number = 5): Promise<Package[]> {
    const tenantId = getTenantId();
    const validLimit = validateLimit(limit, 5, 50);
    
    const sql = `
      SELECT p.*, h.name AS hall_name, COUNT(b.id) as booking_count
      FROM ${this.tableName} p
      LEFT JOIN halls h ON h.id = p.hall_id AND h.tenant_id = p.tenant_id
      LEFT JOIN bookings b ON p.id = b.package_id AND b.tenant_id = p.tenant_id
      WHERE p.status = 'active' AND p.tenant_id = ?
      GROUP BY p.id
      ORDER BY booking_count DESC
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as Package[];
  }
}
