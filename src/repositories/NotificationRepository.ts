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
    try {
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
    } catch (error: any) {
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146) {
        return 0;
      }
      throw error;
    }
  }

  async createForTenantAdmins(input: NotifyAdminsInput): Promise<number[]> {
    const tenantId = getTenantId();
    const preferenceEventType = this.preferenceEventTypeFor(input.type);
    const [adminRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN user_tenants ut ON ut.user_id = u.id
       LEFT JOIN notification_preferences np
         ON np.user_id = u.id
        AND np.tenant_id = ut.tenant_id
        AND np.channel = 'in_app'
        AND np.event_type = ?
       WHERE ut.tenant_id = ?
         AND ut.role = 'admin'
         AND ut.is_active = TRUE
         AND u.status = 'active'
         AND (? IS NULL OR u.id <> ?)
         AND (? IS NULL OR COALESCE(np.enabled, TRUE) = TRUE)`,
      [
        preferenceEventType,
        tenantId,
        input.actorUserId || null,
        input.actorUserId || null,
        preferenceEventType,
      ]
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
    try {
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
    } catch (error: any) {
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146) {
        return [];
      }
      throw error;
    }
  }

  async unreadCountForCurrentUser(): Promise<number> {
    try {
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
    } catch (error: any) {
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.errno === 1146) {
        return 0;
      }
      throw error;
    }
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

  private preferenceEventTypeFor(type: string): string | null {
    if (type === 'booking.created') return 'booking_created';
    if (['booking.updated', 'booking.confirmed', 'booking.completed'].includes(type)) {
      return 'booking_updated';
    }
    if (type === 'booking.cancelled') return 'booking_cancelled';
    if (['payment.recorded', 'payment.verified', 'invoice.payment_recorded'].includes(type)) {
      return 'payment_received';
    }
    if (['payment.reversed', 'payment.failed'].includes(type)) {
      return 'payment_received';
    }
    if (type === 'invoice.created') return 'invoice_created';
    return null;
  }
}

export default new NotificationRepository();
