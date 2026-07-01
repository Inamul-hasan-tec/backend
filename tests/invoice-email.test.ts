import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {
  EmailConfigurationError,
  InvoiceEmailService,
  SMTPConfig,
} from '../src/services/InvoiceEmailService';
import InvoicePDFService from '../src/services/InvoicePDFService';
import { buildInvoicePDFFixture } from './invoice-pdf.test';

const configuredSMTP: SMTPConfig = {
  enabled: true,
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  user: 'mailer@example.com',
  pass: 'test-secret',
  from: 'Hall Sync <mailer@example.com>',
};

export async function testInvoiceEmailComposition() {
  const invoice = buildInvoicePDFFixture();
  const pdf = await InvoicePDFService.generate(invoice);
  const transporter = nodemailer.createTransport({ jsonTransport: true });
  const service = new InvoiceEmailService(configuredSMTP, transporter);

  const info = await service.sendInvoice(invoice, pdf);
  const message = JSON.parse(String(info.message));
  assert.equal(message.to[0].address, invoice.customer_email);
  assert.match(message.subject, new RegExp(invoice.invoice_number));
  assert.equal(message.attachments[0].contentType, 'application/pdf');
  assert.match(message.attachments[0].filename, /\.pdf$/);
  assert.equal(service.isConfigured(), true);

  const disabledService = new InvoiceEmailService(
    { ...configuredSMTP, enabled: false },
    transporter
  );
  await assert.rejects(
    () => disabledService.sendInvoice(invoice, pdf),
    EmailConfigurationError
  );
}
