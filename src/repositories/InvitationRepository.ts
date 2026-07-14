import crypto from 'crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';
import { hashPassword, validateEmail, validatePassword } from '../utils/auth';

export type InvitationRole = 'admin' | 'staff_1' | 'staff_2' | 'viewer';

interface CreateInvitationInput {
  name: string;
  email: string;
  phone?: string;
  role: InvitationRole;
  invitedBy: number;
  expiresInHours?: number;
}

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export class InvitationRepository {
  async listForTenant() {
    return this.listForTenantId(getTenantId());
  }

  async listForTenantId(tenantId: number, role?: InvitationRole) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, name, phone, role, invited_by, expires_at,
              accepted_at, revoked_at, created_at
       FROM user_invitations
       WHERE tenant_id = ? AND (? IS NULL OR role = ?)
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenantId, role || null, role || null]
    );
    return rows;
  }

  async create(input: CreateInvitationInput) {
    return this.createForTenant(getTenantId(), input);
  }

  async createForTenant(tenantId: number, input: CreateInvitationInput) {
    const email = input.email.trim().toLowerCase();
    if (!validateEmail(email)) throw new Error('Invalid email format');
    if (!['admin', 'staff_1', 'staff_2', 'viewer'].includes(input.role)) {
      throw new Error('Invalid invitation role');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingUsers] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
        [email]
      );
      if (existingUsers.length) throw new Error('A user with this email already exists');

      await connection.query(
        `UPDATE user_invitations
         SET revoked_at = NOW()
         WHERE tenant_id = ? AND LOWER(email) = ?
           AND accepted_at IS NULL AND revoked_at IS NULL`,
        [tenantId, email]
      );

      const token = createToken();
      const expiresInHours = Math.min(Math.max(input.expiresInHours || 48, 1), 168);
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO user_invitations
         (tenant_id, email, name, phone, role, token_hash, invited_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [tenantId, email, input.name.trim(), input.phone || null, input.role, tokenHash(token), input.invitedBy, expiresInHours]
      );
      await connection.query(
        `INSERT INTO audit_logs
         (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'user.invited', 'user_invitation', ?, ?)`,
        [tenantId, input.invitedBy, result.insertId, JSON.stringify({ email, role: input.role, expires_in_hours: expiresInHours })]
      );
      await connection.commit();
      return { id: result.insertId, token, email, name: input.name.trim(), role: input.role, expiresInHours };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async resend(invitationId: number, invitedBy: number) {
    return this.resendForTenant(getTenantId(), invitationId, invitedBy);
  }

  async resendForTenant(
    tenantId: number,
    invitationId: number,
    invitedBy: number,
    expectedRole?: InvitationRole
  ) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT name, email, phone, role
       FROM user_invitations
       WHERE id = ? AND tenant_id = ? AND accepted_at IS NULL
         AND (? IS NULL OR role = ?)`,
      [invitationId, tenantId, expectedRole || null, expectedRole || null]
    );
    if (!rows.length) throw new Error('Invitation is not available for resend');
    await pool.query(
      'UPDATE user_invitations SET revoked_at = NOW() WHERE id = ? AND tenant_id = ?',
      [invitationId, tenantId]
    );
    return this.createForTenant(tenantId, {
      name: rows[0].name,
      email: rows[0].email,
      phone: rows[0].phone,
      role: rows[0].role,
      invitedBy,
    });
  }

  async inspect(token: string) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ui.id, ui.email, ui.name, ui.role, ui.expires_at,
              t.name AS tenant_name
       FROM user_invitations ui
       JOIN tenants t ON t.id = ui.tenant_id
       WHERE ui.token_hash = ? AND ui.accepted_at IS NULL
         AND ui.revoked_at IS NULL AND ui.expires_at > NOW()
       LIMIT 1`,
      [tokenHash(token)]
    );
    return rows[0] || null;
  }

  async accept(token: string, password: string) {
    const validation = validatePassword(password);
    if (!validation.isValid) throw new Error(validation.message || 'Invalid password');
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM user_invitations
         WHERE token_hash = ? AND accepted_at IS NULL AND revoked_at IS NULL
           AND expires_at > NOW()
         FOR UPDATE`,
        [tokenHash(token)]
      );
      if (!rows.length) throw new Error('Invitation is invalid or expired');
      const invitation = rows[0];
      const [existing] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [invitation.email]
      );
      if (existing.length) throw new Error('A user with this email already exists');

      const passwordHash = await hashPassword(password);
      const [userResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (name, email, phone, password, status, auth_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', 0, NOW(), NOW())`,
        [invitation.name, invitation.email, invitation.phone || null, passwordHash]
      );
      await connection.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, TRUE, NOW(), NOW())`,
        [userResult.insertId, invitation.tenant_id, invitation.role]
      );
      await connection.query(
        'UPDATE user_invitations SET accepted_at = NOW() WHERE id = ?',
        [invitation.id]
      );
      await connection.query(
        `INSERT INTO audit_logs
         (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'user.invitation_accepted', 'user', ?, ?)`,
        [invitation.tenant_id, userResult.insertId, userResult.insertId, JSON.stringify({ email: invitation.email, role: invitation.role })]
      );
      await connection.commit();
      return { userId: userResult.insertId, email: invitation.email, tenantId: invitation.tenant_id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default new InvitationRepository();
