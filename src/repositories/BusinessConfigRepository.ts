/**
 * Business Configuration Repository
 * Handles database operations for business configuration
 */

import pool from '../config/db';
import { BusinessConfig, UpdateBusinessConfigDTO } from '../models/BusinessConfig';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class BusinessConfigRepository {
  /**
   * Get the active business configuration
   */
  async getActiveConfig(): Promise<BusinessConfig | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM business_config WHERE is_active = TRUE LIMIT 1`
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
   * Get business configuration by ID
   */
  async getById(id: number): Promise<BusinessConfig | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM business_config WHERE id = ?`,
      [id]
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
  async update(id: number, data: UpdateBusinessConfigDTO): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic UPDATE query
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
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

    values.push(id);

    const query = `
      UPDATE business_config 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  /**
   * Create new business configuration
   */
  async create(data: Partial<BusinessConfig>): Promise<number> {
    const fields = Object.keys(data).filter(key => data[key as keyof typeof data] !== undefined);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(key => {
      const value = data[key as keyof typeof data];
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
   * Check if GSTIN is valid and unique
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
    const counterField = `${counterType}_counter`;
    
    // Get current counter
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${counterField} as counter FROM business_config WHERE id = ?`,
      [configId]
    );

    if (rows.length === 0) {
      throw new Error('Business configuration not found');
    }

    const currentCounter = rows[0].counter + 1;

    // Increment counter
    await pool.query(
      `UPDATE business_config SET ${counterField} = ? WHERE id = ?`,
      [currentCounter, configId]
    );

    return currentCounter;
  }
}

export default new BusinessConfigRepository();
