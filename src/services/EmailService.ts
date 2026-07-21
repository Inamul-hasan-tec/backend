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
      html: `
        <h2>Hello ${escapeHtml(data.name)},</h2>
        <p>You have been invited to join Hall Sync.</p>
        <p><a href="${escapeHtml(data.inviteUrl)}">Set your password and activate your account</a></p>
        <p>This one-time link expires in ${data.expiresInHours} hours.</p>
        <p>If you were not expecting this invitation, ignore this email.</p>
      `,
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
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">HALL SYNC</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">Premium Event Management</p>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 30px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #10B981; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <span style="color: #ffffff; font-size: 40px;">✓</span>
              </div>
              <h2 style="color: #1F2937; margin: 20px 0 10px 0; font-size: 24px;">Booking Confirmed!</h2>
              <p style="color: #6B7280; margin: 0; font-size: 16px;">Your event booking has been successfully confirmed.</p>
            </td>
          </tr>
          
          <!-- Booking Details -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <h3 style="color: #1F2937; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">Booking Details</h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6B7280; font-size: 14px; width: 40%;">Booking ID:</td>
                        <td style="color: #1F2937; font-size: 14px; font-weight: bold;">BK-${String(data.booking_id).padStart(6, '0')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6B7280; font-size: 14px; width: 40%;">Hall:</td>
                        <td style="color: #1F2937; font-size: 14px; font-weight: bold;">${data.hall_name}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6B7280; font-size: 14px; width: 40%;">Date:</td>
                        <td style="color: #1F2937; font-size: 14px; font-weight: bold;">${eventDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6B7280; font-size: 14px; width: 40%;">Time:</td>
                        <td style="color: #1F2937; font-size: 14px; font-weight: bold;">${timeSlotText}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6B7280; font-size: 14px; width: 40%;">Package:</td>
                        <td style="color: #1F2937; font-size: 14px; font-weight: bold;">${data.package_name}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Payment Summary -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF3C7; border-radius: 8px; padding: 20px; border-left: 4px solid #F59E0B;">
                <tr>
                  <td style="padding-bottom: 15px;">
                    <h3 style="color: #92400E; margin: 0 0 15px 0; font-size: 18px;">Payment Summary</h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #78350F; font-size: 14px;">Total Amount:</td>
                        <td align="right" style="color: #78350F; font-size: 14px; font-weight: bold;">₹${data.total_amount.toLocaleString('en-IN')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table width="100%">
                      <tr>
                        <td style="color: #78350F; font-size: 14px;">Advance Paid:</td>
                        <td align="right" style="color: #10B981; font-size: 14px; font-weight: bold;">₹${data.advance_paid.toLocaleString('en-IN')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 2px solid #FCD34D;">
                    <table width="100%">
                      <tr>
                        <td style="color: #78350F; font-size: 16px; font-weight: bold;">Balance Due:</td>
                        <td align="right" style="color: #DC2626; font-size: 18px; font-weight: bold;">₹${data.balance_amount.toLocaleString('en-IN')}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${data.balance_amount > 0 ? `
                <tr>
                  <td style="padding: 15px 0 0 0;">
                    <div style="background-color: #FEE2E2; padding: 12px; border-radius: 6px; text-align: center;">
                      <p style="color: #991B1B; margin: 0; font-size: 14px; font-weight: bold;">⚠️ Please pay the balance by ${dueDateText}</p>
                    </div>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          <!-- Contact Info -->
          <tr>
            <td style="padding: 0 40px 30px 40px; text-align: center;">
              <p style="color: #6B7280; margin: 0 0 10px 0; font-size: 14px;">Need help? Contact us:</p>
              <p style="color: #3B82F6; margin: 0; font-size: 14px;">
                📧 info@hallsync.com | 📞 +91 1234567890
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                © 2025 Hall Sync. All rights reserved.<br>
                123 Event Street, Mumbai, Maharashtra 400001
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Payment reminder email template
   */
  private getPaymentReminderTemplate(
    data: PaymentReminderData,
    timeSlotText: string,
    eventDate: string
  ): string {
    const urgencyLevel = data.days_until_event <= 3 ? 'HIGH' : data.days_until_event <= 7 ? 'MEDIUM' : 'LOW';
    const urgencyColor = urgencyLevel === 'HIGH' ? '#DC2626' : urgencyLevel === 'MEDIUM' ? '#F59E0B' : '#10B981';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #F59E0B 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">💰 PAYMENT REMINDER</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">Hall Sync</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 22px;">Dear ${data.customer_name},</h2>
              <p style="color: #4B5563; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                This is a friendly reminder that you have a balance payment due for your upcoming event booking.
              </p>
              
              <!-- Booking Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF3C7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #F59E0B;">
                <tr>
                  <td>
                    <p style="color: #92400E; margin: 0 0 10px 0; font-size: 14px;"><strong>Booking ID:</strong> ${data.booking_id}</p>
                    <p style="color: #92400E; margin: 0 0 10px 0; font-size: 14px;"><strong>Hall:</strong> ${data.hall_name}</p>
                    <p style="color: #92400E; margin: 0 0 10px 0; font-size: 14px;"><strong>Event Date:</strong> ${eventDate}</p>
                    <p style="color: #92400E; margin: 0 0 10px 0; font-size: 14px;"><strong>Time Slot:</strong> ${timeSlotText}</p>
                    <p style="color: #92400E; margin: 0 0 10px 0; font-size: 14px;"><strong>Days Until Event:</strong> ${data.days_until_event} days</p>
                  </td>
                </tr>
              </table>
              
              <!-- Payment Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <tr>
                  <td>
                    <p style="color: #4B5563; margin: 0 0 10px 0; font-size: 14px;">Total Amount: <strong>₹${data.total_amount.toLocaleString('en-IN')}</strong></p>
                    <p style="color: #10B981; margin: 0 0 10px 0; font-size: 14px;">Advance Paid: <strong>₹${data.advance_amount.toLocaleString('en-IN')}</strong></p>
                    <hr style="border: none; border-top: 1px solid #D1D5DB; margin: 10px 0;">
                    <p style="color: #DC2626; margin: 0; font-size: 20px; font-weight: bold;">Balance Due: ₹${data.balance_amount.toLocaleString('en-IN')}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Urgency Alert -->
              <div style="background-color: ${urgencyLevel === 'HIGH' ? '#FEE2E2' : '#FEF3C7'}; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid ${urgencyColor};">
                <p style="color: ${urgencyColor}; margin: 0; font-size: 16px; font-weight: bold;">
                  ${urgencyLevel === 'HIGH' ? '🚨 URGENT: ' : urgencyLevel === 'MEDIUM' ? '⚠️ REMINDER: ' : '📅 NOTICE: '}
                  Your event is ${data.days_until_event} days away!
                </p>
              </div>
              
              <p style="color: #4B5563; margin: 20px 0; font-size: 16px; line-height: 1.6;">
                Please make the payment at your earliest convenience to ensure your booking remains confirmed.
              </p>
              
              <p style="color: #4B5563; margin: 0; font-size: 16px; line-height: 1.6;">
                If you have already made the payment, please ignore this reminder.
              </p>
            </td>
          </tr>
          
          <!-- Contact -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <p style="color: #6B7280; margin: 0 0 10px 0; font-size: 14px;">Questions? Contact us:</p>
              <p style="color: #3B82F6; margin: 0; font-size: 14px;">
                📧 info@hallsync.com | 📞 +91 1234567890
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; margin: 0; font-size: 12px;">
                © 2025 Hall Sync. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}

export default new EmailService();
