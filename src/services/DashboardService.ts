/**
 * Dashboard Service
 * Business logic for dashboard statistics and analytics
 */

import { BookingRepository } from '../repositories/BookingRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { HallRepository } from '../repositories/HallRepository';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2';
import { validateLimit } from '../utils/validators';
import { getTenantId } from '../utils/tenantContext';

export class DashboardService {
  private bookingRepo: BookingRepository;
  private customerRepo: CustomerRepository;
  private hallRepo: HallRepository;

  constructor() {
    this.bookingRepo = new BookingRepository();
    this.customerRepo = new CustomerRepository();
    this.hallRepo = new HallRepository();
  }

  /**
   * Get complete dashboard statistics
   */
  async getDashboardStats() {
    const [bookingStats, customerStats, revenueStats, upcomingBookings] = await Promise.all([
      this.getBookingStats(),
      this.getCustomerStats(),
      this.getRevenueStats(),
      this.bookingRepo.getUpcoming(5),
    ]);

    return {
      bookings: bookingStats,
      customers: customerStats,
      revenue: revenueStats,
      upcomingBookings,
    };
  }

  /**
   * Get booking statistics
   */
  private async getBookingStats() {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN event_date = CURDATE() THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as thisWeek,
        SUM(CASE WHEN MONTH(event_date) = MONTH(CURDATE()) AND YEAR(event_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as thisMonth
      FROM bookings
      WHERE tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows[0];
  }

  /**
   * Get customer statistics
   */
  private async getCustomerStats() {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as newToday,
        SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as newThisMonth
      FROM customers
      WHERE tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows[0];
  }

  /**
   * Get revenue statistics
   */
  private async getRevenueStats() {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as totalRevenue,
        COALESCE(SUM(advance_amount), 0) as advanceCollected,
        COALESCE(SUM(total_amount - advance_amount), 0) as balancePending,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN total_amount ELSE 0 END), 0) as monthlyRevenue,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN advance_amount ELSE 0 END), 0) as monthlyAdvance
      FROM bookings
      WHERE status IN ('confirmed', 'completed') AND tenant_id = ?
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows[0];
  }

  /**
   * Get revenue chart data with flexible granularity (week, month, year) and timeframe
   */
  async getRevenueChart(options: { period?: 'week' | 'month' | 'year'; timeframe?: string; months?: number } = {}) {
    const tenantId = getTenantId();
    const period = options.period || 'month';
    const months = options.months || (options.timeframe === '12_months' ? 12 : 6);

    if (period === 'week') {
      const weeks = options.timeframe === '8_weeks' ? 8 : 12;
      const sql = `
        SELECT 
          CONCAT('W', WEEK(event_date, 1), ' (', DATE_FORMAT(MIN(event_date), '%b %d'), ')') as period_label,
          DATE_FORMAT(event_date, '%X-W%V') as period_key,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(advance_amount), 0) as advance_collected,
          COALESCE(SUM(total_amount - advance_amount), 0) as balance_pending,
          COUNT(*) as booking_count
        FROM bookings
        WHERE event_date >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
        AND status IN ('confirmed', 'completed')
        AND tenant_id = ?
        GROUP BY period_key
        ORDER BY period_key ASC
      `;
      const [rows] = await pool.execute<RowDataPacket[]>(sql, [weeks, tenantId]);
      return rows.map((r) => ({
        label: r.period_label || r.period_key,
        month: r.period_label || r.period_key,
        revenue: Number(r.total_revenue || 0),
        advance: Number(r.advance_collected || 0),
        balance: Number(r.balance_pending || 0),
        bookings: Number(r.booking_count || 0),
      }));
    }

    if (period === 'year') {
      const sql = `
        SELECT 
          DATE_FORMAT(event_date, '%Y') as period_label,
          DATE_FORMAT(event_date, '%Y') as period_key,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(advance_amount), 0) as advance_collected,
          COALESCE(SUM(total_amount - advance_amount), 0) as balance_pending,
          COUNT(*) as booking_count
        FROM bookings
        WHERE status IN ('confirmed', 'completed')
        AND tenant_id = ?
        GROUP BY period_key
        ORDER BY period_key ASC
      `;
      const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
      return rows.map((r) => ({
        label: r.period_label,
        month: r.period_label,
        revenue: Number(r.total_revenue || 0),
        advance: Number(r.advance_collected || 0),
        balance: Number(r.balance_pending || 0),
        bookings: Number(r.booking_count || 0),
      }));
    }

    // Default: month
    const sql = `
      SELECT 
        DATE_FORMAT(event_date, '%b %Y') as period_label,
        DATE_FORMAT(event_date, '%Y-%m') as period_key,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(advance_amount), 0) as advance_collected,
        COALESCE(SUM(total_amount - advance_amount), 0) as balance_pending,
        COUNT(*) as booking_count
      FROM bookings
      WHERE event_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      AND status IN ('confirmed', 'completed')
      AND tenant_id = ?
      GROUP BY period_key, period_label
      ORDER BY period_key ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [months, tenantId]);
    return rows.map((r) => ({
      label: r.period_label || r.period_key,
      month: r.period_label || r.period_key,
      revenue: Number(r.total_revenue || 0),
      advance: Number(r.advance_collected || 0),
      balance: Number(r.balance_pending || 0),
      bookings: Number(r.booking_count || 0),
    }));
  }

  /**
   * Get booking status distribution
   */
  async getBookingStatusDistribution() {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM bookings
      WHERE tenant_id = ?
      GROUP BY status
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows;
  }

  /**
   * Get popular halls
   */
  async getPopularHalls(limit: number = 5) {
    const tenantId = getTenantId();
    // Validate and sanitize limit to prevent SQL issues
    const validLimit = validateLimit(limit, 5, 50);
    
    const sql = `
      SELECT 
        h.id,
        h.name,
        h.capacity,
        h.location,
        COUNT(b.id) as booking_count,
        COALESCE(SUM(b.total_amount), 0) as total_revenue
      FROM halls h
      LEFT JOIN bookings b ON h.id = b.hall_id AND b.tenant_id = ? AND b.status IN ('confirmed', 'completed')
      WHERE h.status = 'active' AND h.tenant_id = ?
      GROUP BY h.id, h.name, h.capacity, h.location
      ORDER BY booking_count DESC
      LIMIT ${validLimit}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId, tenantId]);
    return rows;
  }

  /**
   * Get event type distribution
   */
  async getEventTypeDistribution() {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        event_type,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM bookings
      WHERE status IN ('confirmed', 'completed') AND tenant_id = ?
      GROUP BY event_type
      ORDER BY count DESC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows;
  }
}
