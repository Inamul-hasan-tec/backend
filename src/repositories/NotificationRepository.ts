import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { getTenantContext, getTenantId } from '../utils/tenantContext';

export type NotificationPriority = 'low' | 'normal' | 'high';

export interface CreateNotificationInput {
  tenantId: number;
  userId: number;
  actorUserId?: number | null;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown> | null;
}

export interface NotifyAdminsInput {
  actorUserId?: number | null;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown> | null;
}

class NotificationRepository {
  async create(input: CreateNotificationInput): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO notifications
       (tenant_id, user_id, actor_user_id, type, title, message, entity_type, entity_id, priority, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tenantId,
        input.userId,
        input.actorUserId || null,
        input.type,
        input.title,
        input.message,
        input.entityType || null,
        input.entityId || null,
        input.priority || 'normal',
        input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    );

    return result.insertId;
  }

  async createForTenantAdmins(input: NotifyAdminsInput): Promise<number[]> {
    const tenantId = getTenantId();
    const [adminRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN user_tenants ut ON ut.user_id = u.id
       WHERE ut.tenant_id = ?
         AND ut.role = 'admin'
         AND ut.is_active = TRUE
         AND u.status = 'active'
         AND (? IS NULL OR u.id <> ?)`,
      [tenantId, input.actorUserId || null, input.actorUserId || null]
    );

    const notificationIds: number[] = [];
    for (const row of adminRows) {
      const id = await this.create({
        tenantId,
        userId: Number(row.id),
        actorUserId: input.actorUserId || null,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        priority: input.priority || 'normal',
        metadata: input.metadata || null,
      });
      notificationIds.push(id);
    }

    return notificationIds;
  }

  async listForCurrentUser(limit = 20, onlyUnread = false): Promise<RowDataPacket[]> {
    const tenantId = getTenantId();
    const safeLimit = Math.min(Math.max(Math.floor(limit || 20), 1), 50);
    const userId = this.getCurrentUserId();
    const unreadClause = onlyUnread ? 'AND n.read_at IS NULL' : '';

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.message,
         n.entity_type,
         n.entity_id,
         n.priority,
         n.metadata,
         n.read_at,
         n.created_at,
         n.actor_user_id,
         actor.name AS actor_name,
         actor.email AS actor_email
       FROM notifications n
       LEFT JOIN users actor ON actor.id = n.actor_user_id
       WHERE n.tenant_id = ?
         AND n.user_id = ?
         ${unreadClause}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ${safeLimit}`,
      [tenantId, userId]
    );

    return rows;
  }

  async unreadCountForCurrentUser(): Promise<number> {
    const tenantId = getTenantId();
    const userId = this.getCurrentUserId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE tenant_id = ?
         AND user_id = ?
         AND read_at IS NULL`,
      [tenantId, userId]
    );

    return Number(rows[0]?.count || 0);
  }

  async markReadForCurrentUser(notificationId: number): Promise<boolean> {
    const tenantId = getTenantId();
    const userId = this.getCurrentUserId();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = ? AND tenant_id = ? AND user_id = ?`,
      [notificationId, tenantId, userId]
    );

    return result.affectedRows > 0;
  }

  async markAllReadForCurrentUser(): Promise<number> {
    const tenantId = getTenantId();
    const userId = this.getCurrentUserId();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE tenant_id = ? AND user_id = ? AND read_at IS NULL`,
      [tenantId, userId]
    );

    return result.affectedRows;
  }

  private getCurrentUserId(): number {
    const context = getTenantContext();
    if (!context?.userId) {
      throw new Error('User context is missing. Cannot execute notification query.');
    }
    return Number(context.userId);
  }
}

export default new NotificationRepository();
