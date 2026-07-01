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
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
            <tr>
              <td style="padding:24px;background:#1e3a8a;color:#ffffff">
                <h1 style="margin:0;font-size:24px">${escapeHtml(invoice.business_name)}</h1>
                <p style="margin:8px 0 0">Invoice ${escapeHtml(invoice.invoice_number)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px">
                <p>Dear ${escapeHtml(invoice.customer_name)},</p>
                <p>Your invoice is attached as a PDF.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="margin:20px 0;background:#f8fafc">
                  <tr><td>Grand total</td><td align="right"><strong>INR ${Number(invoice.grand_total).toFixed(2)}</strong></td></tr>
                  <tr><td>Amount paid</td><td align="right">INR ${Number(invoice.amount_paid).toFixed(2)}</td></tr>
                  <tr><td>Balance due</td><td align="right"><strong>INR ${Number(invoice.balance_amount).toFixed(2)}</strong></td></tr>
                </table>
                <p>Please use invoice number <strong>${escapeHtml(invoice.invoice_number)}</strong> as the payment reference.</p>
                <p style="margin-bottom:0">Regards,<br>${escapeHtml(invoice.business_name)}</p>
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
