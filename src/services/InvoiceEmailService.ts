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
        'Invoice email is unavailable until SMTP is configured'
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
        `Please find invoice ${invoice.invoice_number} attached.`,
        `Grand total: INR ${Number(invoice.grand_total).toFixed(2)}`,
        `Balance due: INR ${Number(invoice.balance_amount).toFixed(2)}`,
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
    return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
            <tr>
              <td style="padding:28px 32px 22px;border-bottom:1px solid #e2e8f0;background:#ffffff">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#2563eb">Official document</p>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#0f172a">Invoice from ${escapeHtml(invoice.business_name)}</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#475569">Invoice ${escapeHtml(invoice.invoice_number)} is attached as a PDF for your booking record.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155">Dear ${escapeHtml(invoice.customer_name)},</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin:18px 0">
                  <tr>
                    <td style="width:42%;padding:13px 16px;background:#f8fafc;font-size:13px;color:#64748b">Invoice number</td>
                    <td style="padding:13px 16px;font-size:13px;font-weight:700;color:#0f172a">${escapeHtml(invoice.invoice_number)}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-top:1px solid #e2e8f0;background:#f8fafc;font-size:13px;color:#64748b">Grand total</td>
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
                <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155">Please use invoice number <strong>${escapeHtml(invoice.invoice_number)}</strong> as the payment reference.</p>
                <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155">Regards,<br><strong>${escapeHtml(invoice.business_name)}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b">This message was generated from HallSync for a venue invoice record.</p>
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
