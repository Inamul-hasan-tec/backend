/**
 * User Repository
 * Data access layer for users (Tenant Isolated via user_tenants)
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/db';
import { User, CreateUserDTO } from '../models/User';
import { getTenantId } from '../utils/tenantContext';

export class UserRepository {
  private tableName = 'users';

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT u.*, ut.tenant_id, ut.role
      FROM users u
      LEFT JOIN user_tenants ut ON u.id = ut.user_id AND ut.is_active = true
      WHERE u.email = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [email]);
    return rows.length > 0 ? (rows[0] as User) : null;
  }

  /**
   * Find user by ID safely (includes tenant from context)
   */
  async findByIdSafe(id: number): Promise<Omit<User, 'password'> | null> {
    try {
      const tenantId = getTenantId();
      const sql = `
        SELECT u.id, u.name, u.email, u.is_super_admin, u.status, u.auth_version, u.created_at, u.updated_at,
               ut.tenant_id, ut.role
        FROM users u
        INNER JOIN user_tenants ut ON u.id = ut.user_id
        WHERE u.id = ? AND ut.tenant_id = ? AND ut.is_active = true
      `;
      const [rows] = await pool.execute<RowDataPacket[]>(sql, [id, tenantId]);
      return rows.length > 0 ? (rows[0] as Omit<User, 'password'>) : null;
    } catch (err) {
      // If called without tenant context (like during login when token is being created)
      const sql = `
        SELECT u.id, u.name, u.email, u.is_super_admin, u.status, u.auth_version, u.created_at, u.updated_at,
               ut.tenant_id, ut.role
        FROM users u
        LEFT JOIN user_tenants ut ON u.id = ut.user_id AND ut.is_active = true
        WHERE u.id = ?
        LIMIT 1
      `;
      const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
      return rows.length > 0 ? (rows[0] as Omit<User, 'password'>) : null;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | null> {
    try {
      const tenantId = getTenantId();
      const sql = `
        SELECT u.*, ut.tenant_id, ut.role
        FROM users u
        INNER JOIN user_tenants ut ON u.id = ut.user_id
        WHERE u.id = ? AND ut.tenant_id = ? AND ut.is_active = true
      `;
      const [rows] = await pool.execute<RowDataPacket[]>(sql, [id, tenantId]);
      return rows.length > 0 ? (rows[0] as User) : null;
    } catch (err) {
      const sql = `
        SELECT u.*, ut.tenant_id, ut.role
        FROM users u
        LEFT JOIN user_tenants ut ON u.id = ut.user_id AND ut.is_active = true
        WHERE u.id = ?
        LIMIT 1
      `;
      const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
      return rows.length > 0 ? (rows[0] as User) : null;
    }
  }

  /**
   * Create a new user and map to tenant
   */
  async create(userData: CreateUserDTO): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Create in users table
      const sql = `
        INSERT INTO users (name, email, password, is_super_admin, status)
        VALUES (?, ?, ?, ?, ?)
      `;
      const [result] = await connection.execute<ResultSetHeader>(sql, [
        userData.name,
        userData.email,
        userData.password,
        userData.is_super_admin || false,
        userData.status || 'active',
      ]);

      const userId = result.insertId;

      // Extract tenant_id from context or payload
      let tenantId = userData.tenant_id;
      try {
        if (!tenantId) tenantId = getTenantId();
      } catch (e) {
        // Fallback or skip if super admin
      }

      if (tenantId) {
        // Link to tenant
        const linkSql = `
          INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
          VALUES (?, ?, ?, true)
        `;
        await connection.execute<ResultSetHeader>(linkSql, [
          userId,
          tenantId,
          userData.role || 'staff_2',
        ]);
      }

      await connection.commit();
      return userId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all active users
   */
  async getActive(): Promise<User[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT u.id, u.name, u.email, u.is_super_admin, u.status, u.created_at, u.updated_at,
             ut.tenant_id, ut.role
      FROM users u
      INNER JOIN user_tenants ut ON u.id = ut.user_id
      WHERE ut.tenant_id = ? AND u.status = 'active' AND ut.is_active = true
      ORDER BY u.created_at DESC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as User[];
  }

  /**
   * Get all users for a specific tenant
   */
  async getAllByTenant(): Promise<User[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT u.id, u.name, u.email, u.is_super_admin, u.status, u.created_at, u.updated_at,
             ut.tenant_id, ut.role
      FROM users u
      INNER JOIN user_tenants ut ON u.id = ut.user_id
      WHERE ut.tenant_id = ? AND ut.is_active = true
      ORDER BY u.created_at DESC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as User[];
  }

  /**
   * Update user status (with tenant isolation)
   */
  async updateStatus(id: number, status: 'active' | 'inactive'): Promise<boolean> {
    const tenantId = getTenantId();
    // Verify user belongs to tenant first
    const user = await this.findById(id);
    if (!user || user.tenant_id !== tenantId) return false;

    const sql = `UPDATE users SET status = ?, auth_version = auth_version + 1 WHERE id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [status, id]);
    return result.affectedRows > 0;
  }

  /**
   * Update user password (with tenant isolation)
   */
  async updatePassword(id: number, hashedPassword: string): Promise<boolean> {
    const tenantId = getTenantId();
    // Verify user belongs to tenant first
    const user = await this.findById(id);
    if (!user || user.tenant_id !== tenantId) return false;

    const sql = `UPDATE users SET password = ?, auth_version = auth_version + 1 WHERE id = ?`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [hashedPassword, id]);
    return result.affectedRows > 0;
  }

  /**
   * Update user
   */
  async update(id: number, data: Partial<CreateUserDTO>): Promise<boolean> {
    const tenantId = getTenantId();
    // Verify user belongs to tenant first
    const user = await this.findById(id);
    if (!user || user.tenant_id !== tenantId) return false;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const userFields: string[] = [];
      const userValues: any[] = [];

      if (data.name !== undefined) { userFields.push('name = ?'); userValues.push(data.name); }
      if (data.email !== undefined) { userFields.push('email = ?'); userValues.push(data.email); }
      if (data.status !== undefined) { userFields.push('status = ?'); userValues.push(data.status); }

      if (userFields.length > 0) {
        userValues.push(id);
        const sql = `UPDATE users SET ${userFields.join(', ')} WHERE id = ?`;
        await connection.execute(sql, userValues);
      }

      if (data.role !== undefined) {
        const roleSql = `UPDATE user_tenants SET role = ? WHERE user_id = ? AND tenant_id = ?`;
        await connection.execute(roleSql, [data.role, id, tenantId]);
        await connection.execute(
          'UPDATE users SET auth_version = auth_version + 1 WHERE id = ?',
          [id]
        );
      }

      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if user is super admin
   */
  async isSuperAdmin(id: number): Promise<boolean> {
    const sql = `SELECT is_super_admin FROM users WHERE id = ?`;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [id]);
    return rows.length > 0 && rows[0].is_super_admin === 1;
  }

  /**
   * Delete user (Hard delete from user_tenants to revoke access)
   */
  async delete(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        'DELETE FROM user_tenants WHERE user_id = ? AND tenant_id = ?',
        [id, tenantId]
      );
      if (result.affectedRows > 0) {
        await connection.execute(
          'UPDATE users SET auth_version = auth_version + 1 WHERE id = ?',
          [id]
        );
      }
      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

}
