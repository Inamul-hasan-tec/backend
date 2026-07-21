/**
 * Reminder Controller
 * Handles HTTP requests for payment reminders
 */

import { Request, Response } from 'express';
import { ReminderService } from '../services/ReminderService';
import { asyncHandler } from '../middleware/errorHandler';

const reminderService = new ReminderService();

/**
 * POST /api/reminders/send
 * Send payment reminder for a specific booking
 * Body: { booking_id: number }
 */
export const sendPaymentReminder = asyncHandler(async (req: Request, res: Response) => {
  const { booking_id } = req.body;

  if (!booking_id) {
    res.status(400).json({
      success: false,
      message: 'Booking ID is required'
    });
    return;
  }

  const bookingId = parseInt(booking_id);
  if (isNaN(bookingId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid booking ID'
    });
    return;
  }

  const result = await reminderService.sendPaymentReminder(bookingId);

  res.status(result.email_sent ? 200 : 202).json({
    success: true,
    message: result.email_sent
      ? 'Payment reminder email sent successfully'
      : 'Email reminder could not be sent. Use WhatsApp/manual reminder while SMTP is fixed.',
    data: result,
  });
});

/**
 * GET /api/reminders/pending
 * Get all bookings with pending balance
 */
export const getPendingBalanceBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await reminderService.getPendingBalanceBookings();

  res.json({
    success: true,
    message: 'Pending balance bookings retrieved',
    data: bookings
  });
});

/**
 * GET /api/reminders/upcoming
 * Get bookings with upcoming events (within 7 days) and pending balance
 */
export const getUpcomingReminders = asyncHandler(async (req: Request, res: Response) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 7;
  const bookings = await reminderService.getUpcomingReminders(days);

  res.json({
    success: true,
    message: 'Upcoming reminders retrieved',
    data: bookings
  });
});

/**
 * POST /api/reminders/send-bulk
 * Send reminders to all bookings with pending balance
 */
export const sendBulkReminders = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.body;
  const daysBeforeEvent = days ? parseInt(days) : 7;

  const result = await reminderService.sendBulkReminders(daysBeforeEvent);

  res.json({
    success: true,
    message: `Sent ${result.sent} reminders successfully`,
    data: result
  });
});
