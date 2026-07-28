/**
 * Email Service
 * Handles all email notifications
 */

import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { smtpReadiness } from '../utils/integrationReadiness';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] || character));
}

function currency(value: number | string | null | undefined): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function bookingCode(value: number | string): string {
  const raw = String(value);
  if (raw.startsWith('BK-') || raw.startsWith('BK')) return escapeHtml(raw);
  return `BK-${String(value).padStart(6, '0')}`;
}

interface BookingEmailData {
  customer_name: string;
  customer_email: string;
  booking_id: number;
  hall_name: string;
  event_date: string;
  time_slot: string;
  package_name: string;
  total_amount: number;
  advance_paid: number;
  balance_amount: number;
  payment_mode: string;
}

interface PaymentReminderData {
  customer_name: string;
  customer_email: string;
  booking_id: string;
  hall_name: string;
  event_date: string;
  time_slot: string;
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  days_until_event: number;
}

export interface EmailSendResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  providerCode?: string | number;
}

interface UserInvitationEmailData {
  to: string;
  name: string;
  inviteUrl: string;
  expiresInHours: number;
}

function senderAddress(): string {
  const configured = process.env.SMTP_FROM?.trim();
  if (configured) {
    return configured.includes('<') ? configured : `"Hall Sync" <${configured}>`;
  }

  const user = process.env.SMTP_USER?.trim();
  return user ? `"Hall Sync" <${user}>` : '"Hall Sync" <noreply@hallsync.com>';
}

function sanitizeEmailError(error: any): string {
  const response = String(error?.response || error?.message || 'Email provider rejected the request');
  if (/535|authentication failed|invalid login/i.test(response)) {
    return 'SMTP authentication failed. Check Brevo SMTP login/key and authorized VPS IP.';
  }
  if (/sender|from|domain|not verified|unauthorized/i.test(response)) {
    return 'SMTP sender/domain is not verified or authorized.';
  }
  if (/timeout|etimedout|econnrefused|enotfound/i.test(response)) {
    return 'SMTP provider connection failed. Check host, port, firewall, and provider status.';
  }
  return response.replace(/(password|pass|token|secret|key)=\S+/gi, '$1=[REDACTED]');
}

function emailShell(options: {
  title: string;
  eyebrow: string;
  intro: string;
  body: string;
  footer?: string;
}): string {
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 22px;border-bottom:1px solid #e2e8f0;background:#ffffff;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#2563eb;">${escapeHtml(options.eyebrow)}</p>
              <h1 style="margin:0;font-size:26px;line-height:1.2;color:#0f172a;">${escapeHtml(options.title)}</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(options.intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              ${options.body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                ${options.footer || 'This message was generated from HallSync for a venue booking record.'}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function keyValueTable(rows: Array<[string, string]>): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:18px 0;">
  ${rows
    .map(
      ([label, value], index) => `
  <tr>
    <td style="width:42%;padding:13px 16px;border-top:${index === 0 ? '0' : '1px solid #e2e8f0'};background:#f8fafc;font-size:13px;color:#64748b;">${escapeHtml(label)}</td>
    <td style="padding:13px 16px;border-top:${index === 0 ? '0' : '1px solid #e2e8f0'};font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(value)}</td>
  </tr>`
    )
    .join('')}
</table>`;
}

function paymentSummary(rows: Array<[string, string, boolean?]>): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:18px 0;">
  ${rows
    .map(
      ([label, value, strong], index) => `
  <tr>
    <td style="padding:13px 16px;border-top:${index === 0 ? '0' : '1px solid #e2e8f0'};background:${strong ? '#eff6ff' : '#ffffff'};font-size:${strong ? '15px' : '13px'};font-weight:${strong ? '700' : '400'};color:#475569;">${escapeHtml(label)}</td>
    <td align="right" style="padding:13px 16px;border-top:${index === 0 ? '0' : '1px solid #e2e8f0'};background:${strong ? '#eff6ff' : '#ffffff'};font-size:${strong ? '16px' : '13px'};font-weight:700;color:#0f172a;">${escapeHtml(value)}</td>
  </tr>`
    )
    .join('')}
</table>`;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure email transporter
    // For development, use ethereal.email or mailtrap.io
    // For production, use your SMTP service (Gmail, SendGrid, etc.)
    
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password',
      },
    });
  }

  private canSendEmail(action: string): { ok: boolean; reason?: string } {
    const readiness = smtpReadiness();
    if (readiness.status === 'configured') return { ok: true };

    console.warn(`📧 Skipping ${action}: ${readiness.message}`);
    return { ok: false, reason: readiness.message };
  }

  async sendUserInvitation(data: UserInvitationEmailData): Promise<boolean> {
    if (!this.canSendEmail('user invitation email').ok) return false;
    await this.transporter.sendMail({
      from: senderAddress(),
      to: data.to,
      subject: 'Set up your Hall Sync account',
      html: emailShell({
        eyebrow: 'Account invitation',
        title: 'Set up your HallSync account',
        intro: `Hello ${data.name}, you have been invited to join a venue workspace on HallSync.`,
        body: `
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">Use the secure one-time link below to set your password and activate your account.</p>
          <p style="margin:0 0 22px;">
            <a href="${escapeHtml(data.inviteUrl)}" style="display:inline-block;border-radius:12px;background:#0f172a;color:#ffffff;text-decoration:none;padding:13px 18px;font-size:14px;font-weight:700;">Activate account</a>
          </p>
          <div style="border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;padding:14px 16px;color:#475569;font-size:13px;line-height:1.6;">
            This link expires in <strong>${data.expiresInHours} hours</strong>. If you were not expecting this invitation, you can safely ignore this email.
          </div>
        `,
      }),
    });
    return true;
  }

  /**
   * Send booking confirmation email with timeout
   */
  async sendBookingConfirmation(data: BookingEmailData): Promise<void> {
    const timeout = 10000; // 10 second timeout
    
    try {
      // Check if email is explicitly enabled. Booking should not hang or fail
      // because SMTP is not configured during pilot setup.
      if (!this.canSendEmail('booking confirmation email').ok) {
        return;
      }

      // Validate email address
      if (!data.customer_email || !data.customer_email.includes('@')) {
        console.warn(`⚠️ Invalid email address: ${data.customer_email}`);
        return; // Skip sending email
      }

      const timeSlotText = data.time_slot === 'morning' ? 'Morning (6AM-12PM)' :
                          data.time_slot === 'afternoon' ? 'Afternoon (12PM-6PM)' :
                          'Night (6PM-12AM)';

      const eventDate = format(new Date(data.event_date), 'MMMM dd, yyyy');
      const dueDate = new Date(data.event_date);
      dueDate.setDate(dueDate.getDate() - 7);
      const dueDateText = format(dueDate, 'MMMM dd, yyyy');

      const mailOptions = {
        from: senderAddress(),
        to: data.customer_email,
        subject: `Booking Confirmed - ${data.hall_name} - ${eventDate}`,
        html: this.getBookingConfirmationTemplate(data, timeSlotText, eventDate, dueDateText),
      };

      // Add timeout to prevent hanging
      const emailPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email timeout')), timeout)
      );

      await Promise.race([emailPromise, timeoutPromise]);
      console.log(`✅ Booking confirmation email sent to ${data.customer_email}`);
    } catch (error: any) {
      console.error('❌ Error sending booking confirmation email:', error.message);
      // Don't throw - let the booking succeed even if email fails
    }
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminder(data: PaymentReminderData): Promise<EmailSendResult> {
    try {
      const readiness = this.canSendEmail('payment reminder email');
      if (!readiness.ok) {
        return { sent: false, skipped: true, reason: readiness.reason };
      }

      const timeSlotText = data.time_slot === 'morning' ? 'Morning (6AM-12PM)' :
                          data.time_slot === 'afternoon' ? 'Afternoon (12PM-6PM)' :
                          'Night (6PM-12AM)';
      const eventDate = format(new Date(data.event_date), 'MMMM dd, yyyy');

      const mailOptions = {
        from: senderAddress(),
        to: data.customer_email,
        subject: `Payment Reminder - Balance Due ₹${data.balance_amount.toLocaleString('en-IN')}`,
        html: this.getPaymentReminderTemplate(data, timeSlotText, eventDate),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Payment reminder email sent to ${data.customer_email}`);
      return { sent: true };
    } catch (error: any) {
      console.error('❌ Error sending payment reminder email:', error);
      // Payment reminder dispatch should not break the reminders screen.
      return {
        sent: false,
        reason: sanitizeEmailError(error),
        providerCode: error?.code || error?.responseCode,
      };
    }
  }

  /**
   * Booking confirmation email template
   */
  private getBookingConfirmationTemplate(
    data: BookingEmailData,
    timeSlotText: string,
    eventDate: string,
    dueDateText: string
  ): string {
    return emailShell({
      eyebrow: 'Booking confirmation',
      title: 'Your booking is confirmed',
      intro: `Hello ${data.customer_name}, your booking for ${data.hall_name} has been recorded.`,
      body: `
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Booking details</h2>
        ${keyValueTable([
          ['Booking ID', bookingCode(data.booking_id)],
          ['Hall', data.hall_name],
          ['Event date', eventDate],
          ['Time slot', timeSlotText],
          ['Package', data.package_name],
        ])}
        <h2 style="margin:22px 0 12px;font-size:16px;color:#0f172a;">Payment summary</h2>
        ${paymentSummary([
          ['Total amount', currency(data.total_amount)],
          ['Advance paid', currency(data.advance_paid)],
          ['Balance due', currency(data.balance_amount), true],
          ['Payment mode', data.payment_mode.toUpperCase()],
        ])}
        ${
          data.balance_amount > 0
            ? `<div style="border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;padding:14px 16px;color:#1e3a8a;font-size:13px;line-height:1.6;">
                Suggested balance due date: <strong>${escapeHtml(dueDateText)}</strong>.
              </div>`
            : ''
        }
      `,
    });
  }

  /**
   * Payment reminder email template
   */
  private getPaymentReminderTemplate(
    data: PaymentReminderData,
    timeSlotText: string,
    eventDate: string
  ): string {
    const timingText =
      data.days_until_event <= 0
        ? 'The event date is today or has arrived.'
        : `The event is in ${data.days_until_event} day${data.days_until_event === 1 ? '' : 's'}.`;
    
    return emailShell({
      eyebrow: 'Payment reminder',
      title: 'Balance payment reminder',
      intro: `Hello ${data.customer_name}, this is a reminder for your upcoming booking. ${timingText}`,
      body: `
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Booking details</h2>
        ${keyValueTable([
          ['Booking ID', data.booking_id],
          ['Hall', data.hall_name],
          ['Event date', eventDate],
          ['Time slot', timeSlotText],
          ['Event timing', timingText],
        ])}
        <h2 style="margin:22px 0 12px;font-size:16px;color:#0f172a;">Amount pending</h2>
        ${paymentSummary([
          ['Total amount', currency(data.total_amount)],
          ['Advance paid', currency(data.advance_amount)],
          ['Balance due', currency(data.balance_amount), true],
        ])}
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155;">
          Please complete the pending balance as agreed with the venue. If the payment is already completed, please ignore this message.
        </p>
      `,
    });
  }
}

export default new EmailService();
