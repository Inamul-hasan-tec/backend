/**
 * Reminder Service
 * Business logic for payment reminders
 */

import pool from '../config/db';
import { RowDataPacket } from 'mysql2';
import { EmailService } from './EmailService';
import { getTenantId } from '../utils/tenantContext';

interface BookingWithBalance {
  id: number;
  booking_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  hall_name: string;
  event_date: string;
  time_slot: string;
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  days_until_event: number;
}

interface ReminderSendResult {
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  email_sent: boolean;
  email_skipped?: boolean;
  email_error?: string;
  manual_fallback_available: boolean;
}

export class ReminderService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Get all bookings with pending balance
   */
  async getPendingBalanceBookings(): Promise<BookingWithBalance[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        b.id,
        CONCAT('BK', LPAD(b.id, 6, '0')) as booking_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        h.name as hall_name,
        b.event_date,
        b.time_slot,
        b.total_amount,
        b.advance_amount,
        (b.total_amount - b.advance_amount) as balance_amount,
        DATEDIFF(b.event_date, CURDATE()) as days_until_event
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      WHERE (b.total_amount - b.advance_amount) > 0
        AND b.tenant_id = ?
        AND b.status IN ('confirmed', 'pending')
        AND b.event_date >= CURDATE()
      ORDER BY b.event_date ASC
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId]);
    return rows as BookingWithBalance[];
  }

  /**
   * Get bookings with upcoming events and pending balance
   */
  async getUpcomingReminders(days: number = 7): Promise<BookingWithBalance[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        b.id,
        CONCAT('BK', LPAD(b.id, 6, '0')) as booking_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        h.name as hall_name,
        b.event_date,
        b.time_slot,
        b.total_amount,
        b.advance_amount,
        (b.total_amount - b.advance_amount) as balance_amount,
        DATEDIFF(b.event_date, CURDATE()) as days_until_event
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      WHERE (b.total_amount - b.advance_amount) > 0
        AND b.tenant_id = ?
        AND b.status IN ('confirmed', 'pending')
        AND b.event_date >= CURDATE()
        AND b.event_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY b.event_date ASC
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [tenantId, days]);
    return rows as BookingWithBalance[];
  }

  /**
   * Send payment reminder for a specific booking
   */
  async sendPaymentReminder(bookingId: number): Promise<ReminderSendResult> {
    const tenantId = getTenantId();
    // Get booking details
    const sql = `
      SELECT 
        b.id,
        CONCAT('BK', LPAD(b.id, 6, '0')) as booking_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        h.name as hall_name,
        b.event_date,
        b.time_slot,
        b.total_amount,
        b.advance_amount,
        (b.total_amount - b.advance_amount) as balance_amount,
        DATEDIFF(b.event_date, CURDATE()) as days_until_event
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id AND c.tenant_id = b.tenant_id
      JOIN halls h ON b.hall_id = h.id AND h.tenant_id = b.tenant_id
      WHERE b.id = ? AND b.tenant_id = ?
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [bookingId, tenantId]);

    if (rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = rows[0] as BookingWithBalance;

    if (booking.balance_amount <= 0) {
      throw new Error('No pending balance for this booking');
    }

    if (!booking.customer_email) {
      return {
        booking_id: booking.booking_id,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        customer_email: '',
        email_sent: false,
        email_skipped: true,
        email_error: 'Customer email is missing. Use WhatsApp/manual reminder.',
        manual_fallback_available: Boolean(booking.customer_phone),
      };
    }

    // Send email reminder
    const emailResult = await this.emailService.sendPaymentReminder({
      customer_email: booking.customer_email,
      customer_name: booking.customer_name,
      booking_id: booking.booking_id,
      hall_name: booking.hall_name,
      event_date: booking.event_date,
      time_slot: booking.time_slot,
      total_amount: booking.total_amount,
      advance_amount: booking.advance_amount,
      balance_amount: booking.balance_amount,
      days_until_event: booking.days_until_event,
    });

    // Log reminder sent
    if (emailResult.sent) {
      await this.logReminder(bookingId, 'manual');
    }

    return {
      booking_id: booking.booking_id,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email,
      email_sent: emailResult.sent,
      email_skipped: emailResult.skipped,
      email_error: emailResult.sent ? undefined : emailResult.reason,
      manual_fallback_available: Boolean(booking.customer_phone),
    };
  }

  /**
   * Send bulk reminders to all upcoming bookings with pending balance
   */
  async sendBulkReminders(daysBeforeEvent: number = 7): Promise<{ sent: number; failed: number }> {
    const bookings = await this.getUpcomingReminders(daysBeforeEvent);

    let sent = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        if (booking.customer_email) {
          const emailResult = await this.emailService.sendPaymentReminder({
            customer_email: booking.customer_email,
            customer_name: booking.customer_name,
            booking_id: booking.booking_id,
            hall_name: booking.hall_name,
            event_date: booking.event_date,
            time_slot: booking.time_slot,
            total_amount: booking.total_amount,
            advance_amount: booking.advance_amount,
            balance_amount: booking.balance_amount,
            days_until_event: booking.days_until_event,
          });

          if (emailResult.sent) {
            await this.logReminder(booking.id, 'automatic');
            sent++;
          } else {
            failed++;
          }
        }
      } catch (error) {
        console.error(`Failed to send reminder for booking ${booking.booking_id}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Log reminder sent
   */
  private async logReminder(bookingId: number, type: 'manual' | 'automatic'): Promise<void> {
    const sql = `
      INSERT INTO reminder_logs (booking_id, reminder_type, sent_at)
      VALUES (?, ?, NOW())
    `;

    try {
      await pool.execute(sql, [bookingId, type]);
    } catch (error) {
      // If table doesn't exist, just log to console
      console.log(`Reminder sent for booking ${bookingId} (${type})`);
    }
  }
}
