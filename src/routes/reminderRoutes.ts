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
  getReminderPreview,
} from '../controllers/reminderController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';
const router = express.Router();

// Note: Authentication is handled at the route aggregator level (index.ts)

// Preview reminder (Email HTML & WhatsApp text)
router.get('/preview/:bookingId', requirePermission(Permission.PAYMENT_LIST), getReminderPreview);

// Send payment reminder for specific booking
router.post('/send', requirePermission(Permission.PAYMENT_CREATE), sendPaymentReminder);

// Get all bookings with pending balance
router.get('/pending', requirePermission(Permission.PAYMENT_LIST), getPendingBalanceBookings);

// Get upcoming reminders (bookings within X days with pending balance)
router.get('/upcoming', requirePermission(Permission.PAYMENT_LIST), getUpcomingReminders);

// Send bulk reminders
router.post('/send-bulk', requirePermission(Permission.PAYMENT_CREATE), sendBulkReminders);

export default router;
