/**
 * Settings Repository
 * Database operations for settings, users, and business profiles with Strict Multi-Tenancy via ALS
 */

import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getTenantId } from '../utils/tenantContext';

export class SettingsRepository {
  // ============================================
  // User Operations
  // ============================================
  async getUserById(userId: number): Promise<any> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.phone, NULL AS last_active, ut.role, ut.tenant_id,
              u.is_super_admin, u.status as is_active, u.created_at
       FROM users u
       LEFT JOIN user_tenants ut ON u.id = ut.user_id AND ut.is_active = true
       WHERE u.id = ? AND ut.tenant_id = ?
       LIMIT 1`,
      [userId, tenantId]
    );
    return rows[0] || null;
  }

  async getUserWithPassword(userId: number): Promise<any> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.password 
       FROM users u
       LEFT JOIN user_tenants ut ON u.id = ut.user_id 
       WHERE u.id = ? AND ut.tenant_id = ?
       LIMIT 1`,
      [userId, tenantId]
    );
    return rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<any> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.email 
       FROM users u
       LEFT JOIN user_tenants ut ON u.id = ut.user_id 
       WHERE u.email = ? AND ut.tenant_id = ?
       LIMIT 1`,
      [email, tenantId]
    );
    return rows[0] || null;
  }

  async updateUser(userId: number, data: any): Promise<any> {
    const tenantId = getTenantId();
    
    // Update users table
    const userFields: string[] = [];
    const userValues: any[] = [];
    if (data.name !== undefined) {
      userFields.push('name = ?');
      userValues.push(data.name);
    }
    if (data.email !== undefined) {
      userFields.push('email = ?');
      userValues.push(data.email);
    }
    if (data.phone !== undefined) {
      userFields.push('phone = ?');
      userValues.push(data.phone || null);
    }

    if (userFields.length > 0) {
      userValues.push(userId);
      await pool.query(
        `UPDATE users SET ${userFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        userValues
      );
    }

    // Update user_tenants table
    if (data.role !== undefined) {
      await pool.query(
        'UPDATE user_tenants SET role = ?, updated_at = NOW() WHERE user_id = ? AND tenant_id = ?',
        [data.role, userId, tenantId]
      );
    }

    return await this.getUserById(userId);
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await pool.query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, userId]
    );
  }

  async createUser(data: any): Promise<any> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (name, email, phone, password, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [data.name, data.email, data.phone || null, data.password, data.is_active ? 'active' : 'inactive']
      );

      const userId = result.insertId;

      await connection.query<ResultSetHeader>(
        `INSERT INTO user_tenants (user_id, tenant_id, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [userId, tenantId, data.role || 'staff', true]
      );

      await connection.commit();
      return await this.getUserById(userId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteUser(userId: number): Promise<void> {
    const tenantId = getTenantId();
    // In V2, we delete from user_tenants junction. If it's the last one, optionally delete from users.
    await pool.query('DELETE FROM user_tenants WHERE user_id = ? AND tenant_id = ?', [userId, tenantId]);
  }

  // ============================================
  // Business Profile Operations
  // ============================================
  async getBusinessProfile(tenantId_ignored: number): Promise<any> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT business_config.*, gstin AS gst_number, tenants.domain AS subdomain
       FROM business_config
       JOIN tenants ON tenants.id = business_config.tenant_id
       WHERE business_config.tenant_id = ?`,
      [tenantId]
    );
    return rows[0] || null;
  }

  async createBusinessProfile(tenantId_ignored: number, data: any): Promise<any> {
    const tenantId = getTenantId();

    if (data.subdomain !== undefined) {
      await this.updateTenantSubdomain(tenantId, data.subdomain);
    }

    const insertableFields = [
      'business_name', 'email', 'phone', 'website', 'address', 'city', 'state',
      'state_code', 'pincode', 'gst_number', 'description', 'business_hours',
      'logo_url', 'primary_color', 'secondary_color', 'upi_id', 'upi_name'
    ];
    const columns = ['tenant_id'];
    const placeholders = ['?'];
    const values: any[] = [tenantId];

    for (const field of insertableFields) {
      if (data[field] !== undefined) {
        columns.push(field === 'gst_number' ? 'gstin' : field);
        placeholders.push('?');
        values.push(data[field]);
      }
    }

    if (!columns.includes('business_name')) {
      columns.push('business_name');
      placeholders.push('?');
      values.push('');
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO business_config (${columns.join(', ')}, created_at, updated_at)
       VALUES (${placeholders.join(', ')}, NOW(), NOW())`,
      values
    );
    return await this.getBusinessProfile(tenantId);
  }

  async updateBusinessProfile(tenantId_ignored: number, data: any): Promise<any> {
    const tenantId = getTenantId();
    const fields: string[] = [];
    const values: any[] = [];

    const allowedFields = [
      'business_name', 'email', 'phone', 'website', 'address', 'city', 'state',
      'state_code', 'pincode', 'gst_number', 'description', 'business_hours', 'logo_url',
      'primary_color', 'secondary_color', 'upi_id', 'upi_name'
    ];

    if (data.subdomain !== undefined) {
      await this.updateTenantSubdomain(tenantId, data.subdomain);
    }

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field === 'gst_number' ? 'gstin' : field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      return await this.getBusinessProfile(tenantId);
    }

    values.push(tenantId);

    await pool.query(
      `UPDATE business_config SET ${fields.join(', ')}, updated_at = NOW() WHERE tenant_id = ?`,
      values
    );

    return await this.getBusinessProfile(tenantId);
  }

  private async updateTenantSubdomain(tenantId: number, subdomain: string | null): Promise<void> {
    const normalized = typeof subdomain === 'string' ? subdomain.trim().toLowerCase() : null;
    const nextDomain = normalized || null;

    if (nextDomain) {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM tenants WHERE domain = ? AND id <> ? LIMIT 1',
        [nextDomain, tenantId]
      );

      if (existing.length > 0) {
        throw new Error('Subdomain is already in use. Please choose a different subdomain.');
      }
    }

    await pool.query(
      'UPDATE tenants SET domain = ?, updated_at = NOW() WHERE id = ?',
      [nextDomain, tenantId]
    );
  }

  // ============================================
  // Team Management Operations
  // ============================================
  async getTeamMembers(tenantId_ignored: number): Promise<any[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.phone, ut.role, u.status, u.created_at
       FROM users u
       JOIN user_tenants ut ON u.id = ut.user_id
       WHERE ut.tenant_id = ? AND u.is_super_admin = FALSE
       ORDER BY u.created_at DESC`,
      [tenantId]
    );
    return rows;
  }

  // ============================================
  // Notification Preferences Operations
  // ============================================
  async getNotificationPreferences(userId: number, tenantId_ignored: number): Promise<any[]> {
    const tenantId = getTenantId();
    // Assuming table exists
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM notification_preferences WHERE user_id = ? AND tenant_id = ?',
        [userId, tenantId]
      );
      return rows;
    } catch { return []; }
  }

  async createNotificationPreference(data: any): Promise<void> {
    const tenantId = getTenantId();
    try {
      await pool.query(
        `INSERT INTO notification_preferences (user_id, tenant_id, channel, event_type, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [data.user_id, tenantId, data.channel, data.event_type, data.enabled]
      );
    } catch {}
  }

  async upsertNotificationPreference(data: any): Promise<void> {
    const tenantId = getTenantId();
    try {
      await pool.query(
        `INSERT INTO notification_preferences (user_id, tenant_id, channel, event_type, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE enabled = ?, updated_at = NOW()`,
        [data.user_id, tenantId, data.channel, data.event_type, data.enabled, data.enabled]
      );
    } catch {}
  }
}
