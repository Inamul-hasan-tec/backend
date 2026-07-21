import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { productionIntegrationsReadiness } from '../utils/integrationReadiness';

export class PlatformOperationsController {
  async overview(_req: Request, res: Response): Promise<void> {
    try {
      const [metricRows] = await pool.query<RowDataPacket[]>(
        `SELECT
          (SELECT COUNT(*) FROM tenants) AS total_tenants,
          (SELECT COUNT(*) FROM tenants WHERE status IN ('trial', 'active', 'past_due')) AS accessible_tenants,
          (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants,
          (SELECT COUNT(*) FROM tenants WHERE status = 'suspended') AS suspended_tenants,
          (SELECT COUNT(*) FROM bookings) AS total_bookings,
          (SELECT COALESCE(SUM(amount), 0) FROM payments) AS recorded_payments,
          (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS active_subscriptions,
          (SELECT COUNT(*) FROM subscription_payments WHERE status = 'pending') AS pending_subscription_payments`
      );
      const [onboardingRows] = await pool.query<RowDataPacket[]>(
        `SELECT
          t.id, t.name, t.slug, t.status,
          EXISTS(
            SELECT 1 FROM user_tenants ut JOIN users u ON u.id = ut.user_id
            WHERE ut.tenant_id = t.id AND ut.role = 'admin' AND ut.is_active = TRUE AND u.status = 'active'
          ) AS owner_ready,
          EXISTS(
            SELECT 1 FROM business_config bc
            WHERE bc.tenant_id = t.id AND bc.business_name <> '' AND bc.state_code <> ''
          ) AS business_profile_ready,
          EXISTS(SELECT 1 FROM halls h WHERE h.tenant_id = t.id AND h.status = 'active') AS halls_ready,
          EXISTS(SELECT 1 FROM packages p WHERE p.tenant_id = t.id AND p.status = 'active') AS packages_ready,
          EXISTS(
            SELECT 1 FROM user_tenants ut JOIN users u ON u.id = ut.user_id
            WHERE ut.tenant_id = t.id AND ut.role <> 'admin' AND ut.is_active = TRUE AND u.status = 'active'
          ) AS staff_ready,
          EXISTS(SELECT 1 FROM bookings b WHERE b.tenant_id = t.id) AS first_booking_ready
        FROM tenants t
        ORDER BY t.name`
      );

      const onboarding = onboardingRows.map((row) => {
        const checks = {
          owner: Boolean(row.owner_ready),
          business_profile: Boolean(row.business_profile_ready),
          halls: Boolean(row.halls_ready),
          packages: Boolean(row.packages_ready),
          staff: Boolean(row.staff_ready),
          first_booking: Boolean(row.first_booking_ready),
        };
        const completed = Object.values(checks).filter(Boolean).length;
        return {
          id: Number(row.id),
          name: row.name,
          slug: row.slug,
          status: row.status,
          checks,
          completed,
          total: Object.keys(checks).length,
          percentage: Math.round((completed / Object.keys(checks).length) * 100),
        };
      });

      res.json({ success: true, data: { metrics: metricRows[0], onboarding } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load platform overview';
      res.status(500).json({ success: false, error: message });
    }
  }

  async operations(_req: Request, res: Response): Promise<void> {
    try {
      await pool.query('SELECT 1');
      const heartbeatPath = path.resolve(__dirname, '../../../backups/database/scheduler-heartbeat.json');
      let heartbeat: Record<string, unknown> | null = null;
      try {
        heartbeat = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));
      } catch {
        heartbeat = null;
      }
      const integrations = productionIntegrationsReadiness();

      res.json({
        success: true,
        data: {
          api: { status: 'healthy' },
          database: { status: 'healthy', tls: process.env.DB_SSL === 'true' },
          storage: integrations.cloudinary,
          email: integrations.smtp,
          error_monitoring: integrations.error_monitoring,
          uptime_monitoring: integrations.uptime_monitoring,
          backups: {
            status: heartbeat?.status === 'success' ? 'healthy' : 'not_active',
            recorded_at: heartbeat?.recorded_at || null,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load operations status';
      res.status(500).json({ success: false, error: message });
    }
  }

  async auditLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const action = String(req.query.action || '').trim();
      const targetType = String(req.query.target_type || '').trim();
      const search = String(req.query.search || '').trim();
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (action) {
        conditions.push('pal.action = ?');
        values.push(action);
      }
      if (targetType) {
        conditions.push('pal.target_type = ?');
        values.push(targetType);
      }
      if (search) {
        conditions.push('(pal.action LIKE ? OR pal.target_id LIKE ? OR pal.reason LIKE ?)');
        const pattern = `%${search}%`;
        values.push(pattern, pattern, pattern);
      }
      values.push(limit);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT pal.id, pal.actor_user_id, u.name AS actor_name, pal.action,
                pal.target_type, pal.target_id, pal.reason, pal.metadata,
                pal.request_id, pal.ip_address, pal.created_at
         FROM platform_audit_logs pal
         LEFT JOIN users u ON u.id = pal.actor_user_id
         ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY pal.created_at DESC
         LIMIT ?`,
        values
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load audit logs';
      res.status(500).json({ success: false, error: message });
    }
  }

  async tenantAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const tenantId = Number(req.query.tenant_id || 0);
      const action = String(req.query.action || '').trim();
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (tenantId > 0) {
        conditions.push('al.tenant_id = ?');
        values.push(tenantId);
      }
      if (action) {
        conditions.push('al.action = ?');
        values.push(action);
      }
      values.push(limit);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT al.id, al.tenant_id, t.name AS tenant_name, al.user_id,
                u.name AS actor_name, al.action, al.entity_type, al.entity_id,
                al.ip_address, al.created_at
         FROM audit_logs al
         JOIN tenants t ON t.id = al.tenant_id
         LEFT JOIN users u ON u.id = al.user_id
         ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY al.created_at DESC
         LIMIT ?`,
        values
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load tenant audit logs';
      res.status(500).json({ success: false, error: message });
    }
  }
}

export default new PlatformOperationsController();
