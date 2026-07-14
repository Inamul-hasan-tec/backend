/**
 * Service Catalog Repository
 * Handles database operations for service catalog with Strict Multi-Tenancy via ALS
 */

import pool from '../config/db';
import { TenantBaseRepository } from './TenantBaseRepository';
import { 
  ServiceCatalog, 
  CreateServiceDTO, 
  UpdateServiceDTO,
  ServiceListFilters 
} from '../models/ServiceCatalog';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getTenantId } from '../utils/tenantContext';

export class ServiceCatalogRepository extends TenantBaseRepository<ServiceCatalog> {
  constructor() {
    super('service_catalog');
  }

  /**
   * Get all services with optional filters
   */
  async getAllServices(filters?: ServiceListFilters): Promise<ServiceCatalog[]> {
    const tenantId = getTenantId();
    let query = 'SELECT * FROM service_catalog WHERE tenant_id = ?';
    const params: any[] = [tenantId];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    if (filters?.search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR service_code LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY display_order ASC, name ASC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows as ServiceCatalog[];
  }

  /**
   * Get service by service code
   */
  async getByCode(serviceCode: string): Promise<ServiceCatalog | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM service_catalog WHERE service_code = ? AND tenant_id = ?',
      [serviceCode, tenantId]
    );

    return rows.length > 0 ? (rows[0] as ServiceCatalog) : null;
  }

  /**
   * Create new service
   */
  async createService(data: CreateServiceDTO): Promise<number> {
    const tenantId = getTenantId();
    const query = `
      INSERT INTO service_catalog (
        tenant_id, service_code, name, category, base_price, unit,
        min_quantity, max_quantity, sac_code, hsn_code,
        gst_rate, is_taxable, tax_exemption_reason,
        description, inclusions, terms, is_active, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      tenantId,
      data.service_code,
      data.name,
      data.category,
      data.base_price,
      data.unit,
      data.min_quantity || 1,
      data.max_quantity || null,
      data.sac_code,
      data.hsn_code || null,
      data.gst_rate,
      data.is_taxable !== undefined ? data.is_taxable : true,
      data.tax_exemption_reason || null,
      data.description || null,
      data.inclusions || null,
      data.terms || null,
      data.is_active !== undefined ? data.is_active : true,
      data.display_order || 0,
    ];

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.insertId;
  }

  /**
   * Update service
   */
  async updateService(id: number, data: UpdateServiceDTO): Promise<boolean> {
    const tenantId = getTenantId();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'tenant_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return false;
    }

    values.push(id, tenantId);

    const query = `
      UPDATE service_catalog 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  /**
   * Delete service (soft delete by setting is_active = false)
   */
  async delete(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE service_catalog SET is_active = FALSE WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Hard delete service
   */
  async hardDelete(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM service_catalog WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Check if service code is unique (per tenant)
   */
  async isServiceCodeUnique(serviceCode: string, excludeId?: number): Promise<boolean> {
    const tenantId = getTenantId();
    let query = 'SELECT COUNT(*) as count FROM service_catalog WHERE service_code = ? AND tenant_id = ?';
    const params: any[] = [serviceCode, tenantId];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count === 0;
  }

  /**
   * Get services by category
   */
  async getByCategory(category: string): Promise<ServiceCatalog[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM service_catalog WHERE category = ? AND is_active = TRUE AND tenant_id = ? ORDER BY display_order ASC, name ASC',
      [category, tenantId]
    );

    return rows as ServiceCatalog[];
  }

  /**
   * Get active services only
   */
  async getActive(): Promise<ServiceCatalog[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM service_catalog WHERE is_active = TRUE AND tenant_id = ? ORDER BY display_order ASC, name ASC',
      [tenantId]
    );

    return rows as ServiceCatalog[];
  }

  /**
   * Bulk update display order
   */
  async updateDisplayOrder(updates: { id: number; display_order: number }[]): Promise<boolean> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const update of updates) {
        await connection.query(
          'UPDATE service_catalog SET display_order = ? WHERE id = ? AND tenant_id = ?',
          [update.display_order, update.id, tenantId]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default new ServiceCatalogRepository();
