import nodemailer from 'nodemailer';
import { Invoice, InvoiceLineItem } from '../models/Invoice';

type CompleteInvoice = Invoice & { line_items: InvoiceLineItem[] };

export interface SMTPConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class EmailConfigurationError extends Error {}

export function getSMTPConfig(): SMTPConfig {
  const user = process.env.SMTP_USER?.trim() || '';
  return {
    enabled: process.env.SMTP_ENABLED === 'true',
    host: process.env.SMTP_HOST?.trim() || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user,
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM?.trim() || user,
  };
}

function escapeHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: number | string | null | undefined): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export class InvoiceEmailService {
  private readonly config: SMTPConfig;
  private readonly transporter: nodemailer.Transporter;

  constructor(config = getSMTPConfig(), transporter?: nodemailer.Transporter) {
    this.config = config;
    this.transporter =
      transporter ||
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.enabled &&
        this.config.host &&
        Number.isInteger(this.config.port) &&
        this.config.port > 0 &&
        this.config.user &&
        this.config.pass &&
        this.config.from
    );
  }

  async sendInvoice(
    invoice: CompleteInvoice,
    pdf: Buffer
  ): Promise<nodemailer.SentMessageInfo> {
    if (!this.isConfigured()) {
      throw new EmailConfigurationError(
        'Invoice email is not available right now. Please download the PDF and share it manually.'
      );
    }
    if (!invoice.customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.customer_email)) {
      throw new Error('Customer email address is missing or invalid');
    }

    return this.transporter.sendMail({
      from: this.config.from,
      to: invoice.customer_email,
      subject: `Invoice ${invoice.invoice_number} from ${invoice.business_name}`,
      text: [
        `Dear ${invoice.customer_name},`,
        '',
        `Please find your venue booking invoice ${invoice.invoice_number} attached.`,
        `Invoice total: INR ${Number(invoice.grand_total).toFixed(2)}`,
        `Amount paid: INR ${Number(invoice.amount_paid).toFixed(2)}`,
        `Balance due: INR ${Number(invoice.balance_amount).toFixed(2)}`,
        invoice.payment_instructions ? `Payment instructions: ${invoice.payment_instructions}` : '',
        '',
        `Regards,`,
        invoice.business_name,
      ].join('\n'),
      html: this.buildInvoiceEmail(invoice),
      attachments: [
        {
          filename: `${invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  private buildInvoiceEmail(invoice: CompleteInvoice): string {
    const balanceDue = Number(invoice.balance_amount || 0);
    const paidInFull = balanceDue <= 0;
    const statusLabel = paidInFull ? 'Payment complete' : 'Balance pending';
    const statusColor = paidInFull ? '#166534' : '#92400e';
    const statusBg = paidInFull ? '#dcfce7' : '#fef3c7';

    return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
            <tr>
              <td style="padding:30px 34px 24px;border-bottom:1px solid #e2e8f0;background:#ffffff">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#2563eb">Official venue invoice</p>
                      <h1 style="margin:0;font-size:26px;line-height:1.2;color:#0f172a">${escapeHtml(invoice.business_name)}</h1>
                      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#475569">Your invoice PDF is attached for booking reference and payment follow-up.</p>
                    </td>
                    <td align="right" style="vertical-align:top">
                      <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:${statusBg};color:${statusColor};font-size:12px;font-weight:700">${statusLabel}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 34px">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155">Dear ${escapeHtml(invoice.customer_name)},</p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569">Thank you for choosing ${escapeHtml(invoice.business_name)}. Please keep the attached invoice for your records.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;margin:18px 0">
                  <tr>
                    <td style="width:42%;padding:13px 16px;background:#f8fafc;font-size:13px;color:#64748b">Invoice number</td>
                    <td style="padding:13px 16px;font-size:13px;font-weight:700;color:#0f172a">${escapeHtml(invoice.invoice_number)}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:13px;color:#64748b">Invoice total</td>
                    <td align="right" style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a">${formatCurrency(invoice.grand_total)}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:13px;color:#64748b">Amount paid</td>
                    <td align="right" style="padding:13px 16px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a">${formatCurrency(invoice.amount_paid)}</td>
                  </tr>
                  <tr>
                    <td style="padding:15px 16px;border-top:1px solid #e2e8f0;background:#eff6ff;font-size:15px;font-weight:700;color:#475569">Balance due</td>
                    <td align="right" style="padding:15px 16px;border-top:1px solid #e2e8f0;background:#eff6ff;font-size:16px;font-weight:700;color:#0f172a">${formatCurrency(invoice.balance_amount)}</td>
                  </tr>
                </table>
                ${invoice.payment_instructions ? `<div style="margin:18px 0 0;padding:14px 16px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff"><p style="margin:0;font-size:13px;font-weight:700;color:#1e3a8a">Payment instructions</p><p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#334155">${escapeHtml(invoice.payment_instructions)}</p></div>` : `<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155">Please use invoice number <strong>${escapeHtml(invoice.invoice_number)}</strong> as the payment reference.</p>`}
                <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155">Regards,<br><strong>${escapeHtml(invoice.business_name)}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 34px;border-top:1px solid #e2e8f0;background:#f8fafc">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b">This is an invoice email sent by ${escapeHtml(invoice.business_name)} using HallSync.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}

export default InvoiceEmailService;
