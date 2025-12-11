/**
 * Reminder Routes
 * API routes for payment reminders
 */

import express from 'express';
import {
  sendPaymentReminder,
  getPendingBalanceBookings,
  getUpcomingReminders,
  sendBulkReminders,
} from '../controllers/reminderController';
const router = express.Router();

// Note: Authentication is handled at the route aggregator level (index.ts)

// Send payment reminder for specific booking
router.post('/send', sendPaymentReminder);

// Get all bookings with pending balance
router.get('/pending', getPendingBalanceBookings);

// Get upcoming reminders (bookings within X days with pending balance)
router.get('/upcoming', getUpcomingReminders);

// Send bulk reminders
router.post('/send-bulk', sendBulkReminders);

export default router;
