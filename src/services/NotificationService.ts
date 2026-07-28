import NotificationRepository, {
  NotifyAdminsInput,
  NotificationPriority,
} from '../repositories/NotificationRepository';

type NotificationEntityType = 'booking' | 'payment' | 'invoice' | 'system';

interface ActivityInput {
  actorUserId?: number | null;
  type: string;
  title: string;
  message: string;
  entityType?: NotificationEntityType;
  entityId?: number | null;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown> | null;
}

class NotificationService {
  async notifyTenantAdmins(input: ActivityInput): Promise<number[]> {
    const payload: NotifyAdminsInput = {
      actorUserId: input.actorUserId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      priority: input.priority || 'normal',
      metadata: input.metadata || null,
    };

    return NotificationRepository.createForTenantAdmins(payload);
  }

  /**
   * Notifications must never break bookings, payments, or invoices.
   * If this side-channel fails, the primary business action remains successful
   * and the failure is logged for Sentry/server logs.
   */
  safeNotifyTenantAdmins(input: ActivityInput): void {
    this.notifyTenantAdmins(input).catch((error) => {
      console.warn('Owner activity notification failed:', {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }

  bookingCreated(actorUserId: number | undefined, booking: any): void {
    this.safeNotifyTenantAdmins({
      actorUserId,
      type: 'booking.created',
      title: 'New booking created',
      message: `${booking.customer_name || 'A customer'} booked ${booking.hall_name || 'a hall'} for ${this.formatDate(booking.event_date)}.`,
      entityType: 'booking',
      entityId: Number(booking.id),
      priority: 'normal',
      metadata: this.bookingMetadata(booking),
    });
  }

  bookingUpdated(actorUserId: number | undefined, booking: any, action: 'updated' | 'confirmed' | 'cancelled' | 'completed'): void {
    const titles: Record<typeof action, string> = {
      updated: 'Booking updated',
      confirmed: 'Booking confirmed',
      cancelled: 'Booking cancelled',
      completed: 'Booking completed',
    };

    this.safeNotifyTenantAdmins({
      actorUserId,
      type: `booking.${action}`,
      title: titles[action],
      message: `${booking.booking_id || `Booking #${booking.id}`} for ${booking.customer_name || 'customer'} was ${action}.`,
      entityType: 'booking',
      entityId: Number(booking.id),
      priority: action === 'cancelled' ? 'high' : 'normal',
      metadata: this.bookingMetadata(booking),
    });
  }

  paymentChanged(actorUserId: number | undefined, payment: any, action: 'recorded' | 'verified' | 'reversed' | 'failed'): void {
    const titles: Record<typeof action, string> = {
      recorded: 'Payment recorded',
      verified: 'Payment verified',
      reversed: 'Payment reversed',
      failed: 'Payment marked failed',
    };

    const amount = this.formatCurrency(payment.amount);
    const bookingLabel = payment.booking_id ? ` for booking ${payment.booking_id}` : '';

    this.safeNotifyTenantAdmins({
      actorUserId,
      type: `payment.${action}`,
      title: titles[action],
      message: `${amount} payment${bookingLabel} was ${action}.`,
      entityType: 'payment',
      entityId: Number(payment.id),
      priority: action === 'reversed' || action === 'failed' ? 'high' : 'normal',
      metadata: {
        payment_id: payment.id,
        booking_id: payment.booking_id || null,
        amount: payment.amount,
        payment_mode: payment.payment_mode || null,
        payment_type: payment.payment_type || null,
        status: payment.status || null,
        transaction_id: payment.transaction_id || null,
      },
    });
  }

  invoiceCreated(actorUserId: number | undefined, invoice: any): void {
    this.safeNotifyTenantAdmins({
      actorUserId,
      type: 'invoice.created',
      title: 'Invoice created',
      message: `${invoice.invoice_number || 'Invoice'} was created for ${this.formatCurrency(invoice.grand_total || invoice.total_amount)}.`,
      entityType: 'invoice',
      entityId: Number(invoice.id),
      priority: 'normal',
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        booking_id: invoice.booking_id || null,
        grand_total: invoice.grand_total || invoice.total_amount || null,
        status: invoice.status || null,
      },
    });
  }

  invoicePaymentRecorded(actorUserId: number | undefined, invoiceId: number, payment: any): void {
    this.safeNotifyTenantAdmins({
      actorUserId,
      type: 'invoice.payment_recorded',
      title: 'Invoice payment recorded',
      message: `${this.formatCurrency(payment.amount)} was recorded against an invoice.`,
      entityType: 'invoice',
      entityId: invoiceId,
      priority: 'normal',
      metadata: {
        invoice_id: invoiceId,
        payment_id: payment.id,
        amount: payment.amount,
        payment_mode: payment.payment_mode || null,
      },
    });
  }

  private bookingMetadata(booking: any): Record<string, unknown> {
    return {
      booking_id: booking.id,
      booking_number: booking.booking_id || null,
      customer_name: booking.customer_name || null,
      customer_phone: booking.customer_phone || null,
      hall_name: booking.hall_name || null,
      event_date: booking.event_date || null,
      time_slot: booking.time_slot || null,
      total_amount: booking.total_amount || null,
      advance_amount: booking.advance_amount || null,
      balance_amount: booking.balance_amount || null,
      status: booking.status || null,
    };
  }

  private formatDate(value: unknown): string {
    if (!value) return 'the selected date';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatCurrency(value: unknown): string {
    const amount = Number(value || 0);
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
}

export default new NotificationService();
