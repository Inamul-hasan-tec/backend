import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';

/**
 * Tenant Base Repository
 * Automatically enforces tenant_id isolation using AsyncLocalStorage
 */
export class TenantBaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find all records for current tenant
   */
  async findAll(limit?: number, offset?: number): Promise<T[]> {
    const tenantId = getTenantId();
    let sql = `SELECT * FROM ${this.tableName} WHERE tenant_id = ?`;

    if (limit !== undefined && limit > 0) {
      const safeLimit = Math.floor(Math.abs(limit));
      sql += ` LIMIT ${safeLimit}`;
    }

    if (offset !== undefined && offset >= 0) {
      const safeOffset = Math.floor(Math.abs(offset));
      sql += ` OFFSET ${safeOffset}`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as T[];
  }

  /**
   * Find by ID and current tenant
   */
  async findById(id: number): Promise<T | null> {
    const tenantId = getTenantId();
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? AND tenant_id = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id, tenantId]);
    return rows.length > 0 ? (rows[0] as T) : null;
  }

  /**
   * Create new record for current tenant
   */
  async create(data: Partial<T>): Promise<number> {
    const tenantId = getTenantId();
    
    // Ensure tenant_id is set
    const dataWithTenant = { ...data, tenant_id: tenantId };
    
    const fields = Object.keys(dataWithTenant);
    const values = Object.values(dataWithTenant) as any[];
    const placeholders = fields.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    const [result] = await pool.execute<ResultSetHeader>(sql, values);
    return result.insertId;
  }

  /**
   * Update record by ID and current tenant
   */
  async update(id: number, data: Partial<T>): Promise<boolean> {
    const tenantId = getTenantId();
    
    // Prevent updating tenant_id
    const safeData = { ...data };
    delete (safeData as any).tenant_id;

    const fields = Object.keys(safeData);
    if (fields.length === 0) return false;

    const values = Object.values(safeData) as any[];
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ? AND tenant_id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [...values, id, tenantId]);
    return result.affectedRows > 0;
  }

  /**
   * Delete record by ID and current tenant
   */
  async delete(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const sql = `DELETE FROM ${this.tableName} WHERE id = ? AND tenant_id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [id, tenantId]);
    return result.affectedRows > 0;
  }

  /**
   * Count total records for current tenant
   */
  async count(additionalWhereClause?: string, params: any[] = []): Promise<number> {
    const tenantId = getTenantId();
    let sql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE tenant_id = ?`;
    
    if (additionalWhereClause) {
      sql += ` AND (${additionalWhereClause})`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId, ...params]);
    return rows[0].total;
  }

  /**
   * Check if record exists for current tenant
   */
  async exists(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = ? AND tenant_id = ? LIMIT 1`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id, tenantId]);
    return rows.length > 0;
  }
}
