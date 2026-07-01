/**
 * Business Configuration Repository
 * Handles database operations for business configuration with Strict Multi-Tenancy via ALS
 */

import pool from '../config/db';
import { TenantBaseRepository } from './TenantBaseRepository';
import { BusinessConfig, UpdateBusinessConfigDTO } from '../models/BusinessConfig';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getTenantId } from '../utils/tenantContext';

export class BusinessConfigRepository extends TenantBaseRepository<BusinessConfig> {
  constructor() {
    super('business_config');
  }

  /**
   * Get the active business configuration for the current tenant
   */
  async getActiveConfig(): Promise<BusinessConfig | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM business_config WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );

    if (rows.length === 0) {
      return null;
    }

    const config = rows[0];
    
    // Parse JSON fields
    return {
      ...config,
      services_offered: typeof config.services_offered === 'string' 
        ? JSON.parse(config.services_offered) 
        : config.services_offered,
      cancellation_rules: typeof config.cancellation_rules === 'string'
        ? JSON.parse(config.cancellation_rules)
        : config.cancellation_rules,
    } as BusinessConfig;
  }

  /**
   * Get business configuration by ID (Tenant Scoped)
   */
  async getById(id: number): Promise<BusinessConfig | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM business_config WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );

    if (rows.length === 0) {
      return null;
    }

    const config = rows[0];
    
    return {
      ...config,
      services_offered: typeof config.services_offered === 'string'
        ? JSON.parse(config.services_offered)
        : config.services_offered,
      cancellation_rules: typeof config.cancellation_rules === 'string'
        ? JSON.parse(config.cancellation_rules)
        : config.cancellation_rules,
    } as BusinessConfig;
  }

  /**
   * Update business configuration
   */
  async updateConfig(id: number, data: UpdateBusinessConfigDTO): Promise<boolean> {
    const tenantId = getTenantId();
    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic UPDATE query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'tenant_id') {
        fields.push(`${key} = ?`);
        
        // Stringify JSON fields
        if (key === 'services_offered' || key === 'cancellation_rules') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });

    if (fields.length === 0) {
      return false;
    }

    values.push(id, tenantId);

    const query = `
      UPDATE business_config 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  /**
   * Create new business configuration
   */
  async createConfig(data: Partial<BusinessConfig>): Promise<number> {
    const tenantId = getTenantId();
    
    // Inject tenant ID
    const dataWithTenant = { ...data, tenant_id: tenantId };
    
    const fields = Object.keys(dataWithTenant).filter(key => dataWithTenant[key as keyof typeof dataWithTenant] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(key => {
      const value = dataWithTenant[key as keyof typeof dataWithTenant];
      // Stringify JSON fields
      if (key === 'services_offered' || key === 'cancellation_rules') {
        return JSON.stringify(value);
      }
      return value;
    });

    const query = `
      INSERT INTO business_config (${fields.join(', ')})
      VALUES (${placeholders})
    `;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.insertId;
  }

  /**
   * Check if GSTIN is valid and unique globally across all tenants
   * Note: GSTIN usually should be unique per business, but we allow same GSTIN for different branches?
   * Actually, let's keep it scoped to tenant or globally unique depending on business rule.
   */
  async isGstinUnique(gstin: string, excludeId?: number): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM business_config WHERE gstin = ?';
    const params: any[] = [gstin];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count === 0;
  }

  /**
   * Get invoice counter and increment
   */
  async getAndIncrementCounter(
    configId: number,
    counterType: 'invoice' | 'receipt' | 'credit_note' | 'debit_note'
  ): Promise<number> {
    const tenantId = getTenantId();
    const counterField = `${counterType}_counter`;
    
    // Get current counter
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${counterField} as counter FROM business_config WHERE id = ? AND tenant_id = ?`,
      [configId, tenantId]
    );

    if (rows.length === 0) {
      throw new Error('Business configuration not found');
    }

    const currentCounter = rows[0].counter + 1;

    // Increment counter
    await pool.query(
      `UPDATE business_config SET ${counterField} = ? WHERE id = ? AND tenant_id = ?`,
      [currentCounter, configId, tenantId]
    );

    return currentCounter;
  }
}

export default new BusinessConfigRepository();
