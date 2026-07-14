import assert from 'node:assert/strict';
import { Invoice, InvoiceLineItem } from '../src/models/Invoice';
import InvoicePDFService from '../src/services/InvoicePDFService';

export function buildInvoicePDFFixture() {
  return {
    id: 1,
    invoice_number: 'INV-202606-T1-0001',
    invoice_type: 'tax_invoice',
    invoice_date: new Date('2026-06-16T00:00:00.000Z'),
    due_date: new Date('2026-07-16T00:00:00.000Z'),
    booking_id: 10,
    customer_id: 20,
    customer_name: 'Test Customer',
    customer_gstin: '29ABCDE1234F1Z5',
    customer_pan: 'ABCDE1234F',
    customer_address: '1 Customer Road',
    customer_city: 'Bengaluru',
    customer_state: 'Karnataka',
    customer_state_code: '29',
    customer_pincode: '560001',
    customer_phone: '9999999999',
    customer_email: 'customer@example.com',
    business_name: 'Hall Sync Test Venue',
    business_gstin: '29ABCDE1234F1Z6',
    business_address: '2 Venue Road',
    business_city: 'Bengaluru',
    business_state: 'Karnataka',
    business_state_code: '29',
    business_pincode: '560002',
    business_phone: '8888888888',
    business_email: 'venue@example.com',
    supply_type: 'intrastate',
    place_of_supply: 'Karnataka',
    subtotal: 10000,
    discount_amount: 500,
    taxable_amount: 9500,
    cgst_amount: 855,
    sgst_amount: 855,
    igst_amount: 0,
    cess_amount: 0,
    total_tax: 1710,
    round_off: 0,
    grand_total: 11210,
    amount_paid: 2000,
    balance_amount: 9210,
    status: 'issued',
    notes: 'Thank you for choosing our venue.',
    terms_conditions: 'Payment is due by the stated due date.',
    payment_instructions: 'Pay by bank transfer using the invoice number.',
    reference_number: null,
    original_invoice_id: null,
    created_by: 1,
    created_at: new Date(),
    updated_at: new Date(),
    issued_at: new Date(),
    cancelled_at: null,
    cancellation_reason: null,
    line_items: [
      {
        id: 1,
        invoice_id: 1,
        line_number: 1,
        description: 'Venue rental and event services',
        sac_hsn: '997212',
        quantity: 1,
        unit: 'Service',
        unit_price: 10000,
        discount_percentage: 5,
        discount_amount: 500,
        taxable_value: 9500,
        cgst_rate: 9,
        sgst_rate: 9,
        igst_rate: 0,
        cess_rate: 0,
        cgst_amount: 855,
        sgst_amount: 855,
        igst_amount: 0,
        cess_amount: 0,
        total_tax: 1710,
        total_amount: 11210,
        service_id: null,
        created_at: new Date(),
      } as InvoiceLineItem,
    ],
  } as Invoice & { line_items: InvoiceLineItem[] };
}

export async function testInvoicePDFGeneration() {
  const invoice = buildInvoicePDFFixture();
  const pdf = await InvoicePDFService.generate(invoice);
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdf.length > 3000, 'Generated invoice PDF should contain rendered content');
  assert.ok(pdf.includes(Buffer.from('Hall Sync Test Venue')));
  assert.equal(
    (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length,
    1,
    'Standard invoice fixture should fit on one page'
  );

  const longInvoice = {
    ...invoice,
    line_items: Array.from({ length: 35 }, (_, index) => ({
      ...invoice.line_items[0],
      id: index + 1,
      line_number: index + 1,
      description: `Venue service line ${index + 1}`,
    })),
  };
  const longPdf = await InvoicePDFService.generate(longInvoice);
  assert.ok(
    (longPdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1,
    'Long invoices should paginate'
  );
}
