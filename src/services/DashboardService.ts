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
   * Get monthly revenue chart data
   */
  async getMonthlyRevenueChart(months: number = 6) {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      AND status IN ('confirmed', 'completed')
      AND tenant_id = ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, [months, tenantId]);
    return rows;
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
      LEFT JOIN bookings b ON h.id = b.hall_id AND b.tenant_id = ?
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
