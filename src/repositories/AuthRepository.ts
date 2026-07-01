import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';

export interface SessionState {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  is_super_admin: boolean;
  auth_version: number;
  tenant_id?: number;
  role?: string;
}

export class AuthRepository {
  async getSessionState(userId: number, tenantId?: number): Promise<SessionState | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.status,
         u.is_super_admin,
         u.auth_version,
         ut.tenant_id,
         ut.role
       FROM users u
       LEFT JOIN user_tenants ut
         ON ut.user_id = u.id
        AND ut.is_active = true
        AND (? IS NULL OR ut.tenant_id = ?)
       WHERE u.id = ?
       LIMIT 1`,
      [tenantId || null, tenantId || null, userId]
    );

    return rows.length > 0 ? (rows[0] as SessionState) : null;
  }

  async revokeAllSessions(userId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE users SET auth_version = auth_version + 1 WHERE id = ?',
      [userId]
    );
    return result.affectedRows > 0;
  }
}

