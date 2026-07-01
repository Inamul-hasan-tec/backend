import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';

export class SubscriptionRepository {
  async getPlans() {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT code, name, monthly_price, annual_price, hall_limit, user_limit,
              booking_limit, storage_gb, features
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY monthly_price`
    );
    return rows;
  }

  async getTenantSubscription(tenantId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, p.name AS plan_name, p.hall_limit, p.user_limit,
              p.booking_limit, p.storage_gb, p.features
       FROM subscriptions s
       LEFT JOIN subscription_plans p ON p.code = s.plan
       WHERE s.tenant_id = ?
       ORDER BY s.id DESC
       LIMIT 1`,
      [tenantId]
    );
    return rows[0] || null;
  }

  async ensureTrialSubscription(tenantId: number) {
    const existing = await this.getTenantSubscription(tenantId);
    if (existing) return existing;

    await pool.query(
      `INSERT INTO subscriptions
       (tenant_id, plan, price, billing_cycle, status, trial_ends_at,
        current_period_start, current_period_end)
       VALUES (?, 'starter', 1999, 'monthly', 'trial',
               DATE_ADD(NOW(), INTERVAL 14 DAY), NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))`,
      [tenantId]
    );
    return this.getTenantSubscription(tenantId);
  }

  async createRenewalOrder(
    tenantId: number,
    userId: number,
    planCode: string,
    billingCycle: 'monthly' | 'annual'
  ) {
    const [planRows] = await pool.query<RowDataPacket[]>(
      `SELECT code, monthly_price, annual_price
       FROM subscription_plans
       WHERE code = ? AND is_active = TRUE`,
      [planCode]
    );
    if (!planRows[0]) throw new Error('Selected subscription plan is unavailable');

    const subscription = await this.ensureTrialSubscription(tenantId);
    const amount =
      billingCycle === 'annual'
        ? planRows[0].annual_price
        : planRows[0].monthly_price;
    const orderNumber = `HS-${tenantId}-${Date.now()}`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO subscription_orders
       (order_number, tenant_id, subscription_id, plan_code, billing_cycle,
        amount, status, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 48 HOUR), ?)`,
      [
        orderNumber,
        tenantId,
        subscription.id,
        planCode,
        billingCycle,
        amount,
        userId,
      ]
    );

    return this.getOrderForTenant(result.insertId, tenantId);
  }

  async getOrderForTenant(orderId: number, tenantId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM subscription_orders WHERE id = ? AND tenant_id = ?`,
      [orderId, tenantId]
    );
    return rows[0] || null;
  }

  async getLatestOpenOrder(tenantId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM subscription_orders
       WHERE tenant_id = ?
         AND status IN ('pending', 'payment_submitted')
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [tenantId]
    );
    return rows[0] || null;
  }

  async listTenantPayments(tenantId: number, limit: number, offset: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sp.id, sp.amount, sp.method, sp.transaction_reference AS transaction_id,
              sp.status, sp.created_at AS payment_date, so.order_number,
              so.plan_code, so.billing_cycle
       FROM subscription_payments sp
       JOIN subscription_orders so ON so.id = sp.order_id
       WHERE sp.tenant_id = ?
       ORDER BY sp.created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
    return rows;
  }

  async countTenantPayments(tenantId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM subscription_payments WHERE tenant_id = ?',
      [tenantId]
    );
    return Number(rows[0].count);
  }

  async submitPayment(
    orderId: number,
    tenantId: number,
    userId: number,
    method: string,
    transactionReference: string,
    proofPublicId: string
  ) {
    const order = await this.getOrderForTenant(orderId, tenantId);
    if (!order || order.status !== 'pending' || new Date(order.expires_at) <= new Date()) {
      throw new Error('Subscription order is unavailable or expired');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO subscription_payments
         (order_id, tenant_id, amount, method, transaction_reference,
          proof_url, status, submitted_by)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          order.id,
          tenantId,
          order.amount,
          method,
          transactionReference,
          proofPublicId,
          userId,
        ]
      );
      await connection.query(
        `UPDATE subscription_orders
         SET status = 'payment_submitted'
         WHERE id = ? AND tenant_id = ?`,
        [order.id, tenantId]
      );
      await connection.commit();
      return { id: result.insertId, order_number: order.order_number };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listPendingPayments() {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sp.id, sp.tenant_id, t.name AS tenant_name, sp.amount, sp.method,
              sp.transaction_reference, sp.status, sp.created_at,
              so.order_number, so.plan_code, so.billing_cycle
       FROM subscription_payments sp
       JOIN subscription_orders so ON so.id = sp.order_id
       JOIN tenants t ON t.id = sp.tenant_id
       WHERE sp.status = 'pending'
       ORDER BY sp.created_at`
    );
    return rows;
  }

  async getPaymentForPlatform(paymentId: number) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sp.id, sp.proof_url
       FROM subscription_payments sp
       WHERE sp.id = ?`,
      [paymentId]
    );
    return rows[0] || null;
  }

  async approvePayment(paymentId: number, verifierId: number) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT sp.*, so.subscription_id, so.plan_code, so.billing_cycle,
                so.order_number
         FROM subscription_payments sp
         JOIN subscription_orders so ON so.id = sp.order_id
         WHERE sp.id = ? FOR UPDATE`,
        [paymentId]
      );
      const payment = rows[0];
      if (!payment || payment.status !== 'pending') {
        throw new Error('Payment is not available for approval');
      }

      const interval =
        payment.billing_cycle === 'annual' ? 'INTERVAL 1 YEAR' : 'INTERVAL 1 MONTH';
      await connection.query(
        `UPDATE subscriptions
         SET plan = ?, price = ?, billing_cycle = ?, status = 'active',
             current_period_start = GREATEST(NOW(), current_period_end),
             current_period_end = DATE_ADD(GREATEST(NOW(), current_period_end), ${interval}),
             trial_ends_at = NULL
         WHERE id = ?`,
        [
          payment.plan_code,
          payment.amount,
          payment.billing_cycle,
          payment.subscription_id,
        ]
      );
      await connection.query(
        `UPDATE subscription_payments
         SET status = 'approved', verified_by = ?, verified_at = NOW()
         WHERE id = ?`,
        [verifierId, paymentId]
      );
      await connection.query(
        `UPDATE subscription_orders
         SET status = 'approved', approved_by = ?, approved_at = NOW()
         WHERE id = ?`,
        [verifierId, payment.order_id]
      );
      await connection.query(
        `UPDATE tenants SET status = 'active', updated_at = NOW() WHERE id = ?`,
        [payment.tenant_id]
      );
      await connection.query(
        `INSERT INTO platform_audit_logs
         (actor_user_id, action, target_type, target_id, metadata)
         VALUES (?, 'subscription.payment_approved', 'tenant', ?, ?)`,
        [
          verifierId,
          String(payment.tenant_id),
          JSON.stringify({
            payment_id: paymentId,
            order_number: payment.order_number,
          }),
        ]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async rejectPayment(paymentId: number, verifierId: number, reason: string) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [paymentRows] = await connection.query<RowDataPacket[]>(
        `SELECT so.tenant_id, so.order_number
         FROM subscription_payments sp
         JOIN subscription_orders so ON so.id = sp.order_id
         WHERE sp.id = ? AND sp.status = 'pending'
         FOR UPDATE`,
        [paymentId]
      );
      if (!paymentRows.length) throw new Error('Payment is not available for rejection');
      const payment = paymentRows[0];
      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE subscription_payments sp
       JOIN subscription_orders so ON so.id = sp.order_id
       SET sp.status = 'rejected', sp.verified_by = ?, sp.verified_at = NOW(),
           sp.rejection_reason = ?, so.status = 'rejected'
       WHERE sp.id = ? AND sp.status = 'pending'`,
        [verifierId, reason, paymentId]
      );
      if (!result.affectedRows) throw new Error('Payment is not available for rejection');
      await connection.query(
        `INSERT INTO platform_audit_logs
         (actor_user_id, action, target_type, target_id, reason, metadata)
         VALUES (?, 'subscription.payment_rejected', 'tenant', ?, ?, ?)`,
        [
          verifierId,
          String(payment.tenant_id),
          reason,
          JSON.stringify({ payment_id: paymentId, order_number: payment.order_number }),
        ]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default new SubscriptionRepository();
