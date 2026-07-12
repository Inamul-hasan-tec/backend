import PDFDocument from 'pdfkit';
import { Invoice, InvoiceLineItem } from '../models/Invoice';

type CompleteInvoice = Invoice & { line_items: InvoiceLineItem[] };

const PAGE_WIDTH = 595.28;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TABLE_COLUMNS = [26, 182, 56, 42, 70, 54, 81];

function money(value: number | string | null | undefined): string {
  return `INR ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function partyAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((part) => Boolean(part?.trim())).join(', ');
}

function documentTitle(invoice: CompleteInvoice): string {
  const labels: Record<string, string> = {
    tax_invoice: 'Tax Invoice',
    receipt_voucher: 'Receipt Voucher',
    credit_note: 'Credit Note',
    debit_note: 'Debit Note',
  };
  return labels[invoice.invoice_type] || invoice.invoice_type.replace(/_/g, ' ');
}

function bookingRef(bookingId: number | null | undefined): string {
  return bookingId ? `BK-${String(bookingId).padStart(6, '0')}` : '-';
}

export class InvoicePDFService {
  static async generate(invoice: CompleteInvoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, right: MARGIN, bottom: 54, left: MARGIN },
        bufferPages: true,
        info: {
          Title: `${invoice.invoice_type.replace(/_/g, ' ')} ${invoice.invoice_number}`,
          Author: invoice.business_name || 'Hall Sync',
          Subject: `Invoice ${invoice.invoice_number}`,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      this.drawHeader(doc, invoice);
      this.drawParties(doc, invoice);
      this.drawEventContext(doc, invoice);
      this.drawLineItems(doc, invoice);
      this.drawTotals(doc, invoice);
      this.drawAdditionalInformation(doc, invoice);
      this.drawSignatureBlock(doc, invoice);
      this.drawPageFooters(doc, invoice.invoice_number);
      doc.end();
    });
  }

  private static drawHeader(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    const title = documentTitle(invoice).toUpperCase();
    const balanceDue = Number(invoice.balance_amount || 0);
    const paidInFull = balanceDue <= 0;

    doc.roundedRect(MARGIN, MARGIN - 16, CONTENT_WIDTH, 94, 8).fill('#0f172a');
    doc.roundedRect(MARGIN + 16, MARGIN + 2, 42, 42, 8).fill('#2563eb');
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#ffffff')
      .text(
        String(invoice.business_name || 'HS')
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part.charAt(0))
          .join('')
          .toUpperCase(),
        MARGIN + 16,
        MARGIN + 15,
        { width: 42, align: 'center' }
      );
    doc
      .font('Helvetica-Bold')
      .fontSize(19)
      .fillColor('#ffffff')
      .text(invoice.business_name || 'Hall Sync', MARGIN + 72, MARGIN + 2, {
        width: 265,
      });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#cbd5e1')
      .text(
        partyAddress([
          invoice.business_address,
          invoice.business_city,
          invoice.business_state,
          invoice.business_pincode,
        ]) || 'Business address not provided',
        MARGIN + 72,
        MARGIN + 26,
        { width: 285, height: 22, ellipsis: true }
      );
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#cbd5e1')
      .text(
        [invoice.business_phone, invoice.business_email].filter(Boolean).join(' | ') || '-',
        MARGIN + 72,
        MARGIN + 51,
        { width: 285, ellipsis: true }
      );
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#ffffff')
      .text(title, PAGE_WIDTH - MARGIN - 190, MARGIN + 2, {
        width: 190,
        align: 'right',
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#cbd5e1')
      .text(invoice.invoice_number, PAGE_WIDTH - MARGIN - 190, MARGIN + 25, {
        width: 190,
        align: 'right',
      });
    doc
      .roundedRect(PAGE_WIDTH - MARGIN - 116, MARGIN + 47, 116, 18, 9)
      .fill(paidInFull ? '#dcfce7' : '#ffedd5');
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(paidInFull ? '#166534' : '#9a3412')
      .text(paidInFull ? 'PAID IN FULL' : 'BALANCE DUE', PAGE_WIDTH - MARGIN - 108, MARGIN + 53, {
        width: 100,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#cbd5e1')
      .text(invoice.business_gstin ? `GSTIN: ${invoice.business_gstin}` : 'GSTIN: Not provided', MARGIN + 72, MARGIN + 66)
      .text(`Status: ${String(invoice.status).replace(/_/g, ' ').toUpperCase()}`, PAGE_WIDTH - MARGIN - 190, MARGIN + 69, {
        width: 190,
        align: 'right',
      });

    const detailsY = 124;
    this.labelValue(doc, 'Invoice No.', invoice.invoice_number, MARGIN, detailsY, 225);
    this.labelValue(doc, 'Invoice Date', displayDate(invoice.invoice_date), MARGIN + 275, detailsY, 236);
    this.labelValue(doc, 'Due Date', displayDate(invoice.due_date), MARGIN, detailsY + 18, 225);
    this.labelValue(
      doc,
      'Supply',
      String(invoice.supply_type || '-').replace(/_/g, ' '),
      MARGIN + 275,
      detailsY + 18,
      236
    );
    if (invoice.booking_id) {
      this.labelValue(
        doc,
        'Booking Ref.',
        bookingRef(invoice.booking_id),
        MARGIN,
        detailsY + 36,
        225
      );
    }
    doc.y = detailsY + 56;
  }

  private static drawParties(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    const y = doc.y;
    const columnWidth = (CONTENT_WIDTH - 16) / 2;
    const seller = partyAddress([
      invoice.business_address,
      invoice.business_city,
      invoice.business_state,
      invoice.business_pincode,
    ]);
    const customer = partyAddress([
      invoice.customer_address,
      invoice.customer_city,
      invoice.customer_state,
      invoice.customer_pincode,
    ]);

    this.partyBox(doc, 'FROM', invoice.business_name, seller, invoice.business_phone, invoice.business_email, invoice.business_gstin, MARGIN, y, columnWidth);
    this.partyBox(doc, 'BILL TO', invoice.customer_name, customer, invoice.customer_phone, invoice.customer_email, invoice.customer_gstin, MARGIN + columnWidth + 16, y, columnWidth);
    doc.y = y + 110;
    this.drawPaymentSnapshot(doc, invoice);
  }

  private static drawEventContext(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    const y = doc.y;
    const values: Array<[string, string]> = [
      ['Document', documentTitle(invoice)],
      ['Booking Ref.', bookingRef(invoice.booking_id)],
      ['Place of Supply', invoice.place_of_supply || '-'],
    ];

    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 34, 5).fillAndStroke('#f8fafc', '#d1d5db');
    values.forEach(([label, value], index) => {
      const width = CONTENT_WIDTH / values.length;
      const x = MARGIN + index * width;
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(label, x + 10, y + 8, {
        width: width - 20,
      });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(value, x + 10, y + 20, {
        width: width - 20,
        ellipsis: true,
      });
    });
    doc.y = y + 48;
  }

  private static drawPaymentSnapshot(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    const y = doc.y;
    const boxWidth = (CONTENT_WIDTH - 16) / 3;
    const boxes: Array<[string, string, string, string]> = [
      ['Grand Total', money(invoice.grand_total), '#eff6ff', '#1e3a8a'],
      ['Amount Paid', money(invoice.amount_paid), '#ecfdf5', '#166534'],
      ['Balance Due', money(invoice.balance_amount), '#fff7ed', '#9a3412'],
    ];

    boxes.forEach(([label, value, fill, color], index) => {
      const x = MARGIN + index * (boxWidth + 8);
      doc.roundedRect(x, y, boxWidth, 42, 5).fillAndStroke(fill, '#d1d5db');
      doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(label, x + 10, y + 10, {
        width: boxWidth - 20,
      });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(color).text(value, x + 10, y + 23, {
        width: boxWidth - 20,
        ellipsis: true,
      });
    });
    doc.y = y + 56;
  }

  private static partyBox(
    doc: PDFKit.PDFDocument,
    heading: string,
    name: string,
    address: string,
    phone: string,
    email: string,
    gstin: string | null,
    x: number,
    y: number,
    width: number
  ): void {
    doc.roundedRect(x, y, width, 96, 4).fillAndStroke('#f8fafc', '#d1d5db');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#2563eb').text(heading, x + 10, y + 9);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(name || '-', x + 10, y + 24, {
      width: width - 20,
      ellipsis: true,
    });
    doc.font('Helvetica').fontSize(8).fillColor('#374151').text(address || '-', x + 10, y + 39, {
      width: width - 20,
      height: 22,
      ellipsis: true,
    });
    doc.text([phone, email].filter(Boolean).join(' | ') || '-', x + 10, y + 65, {
      width: width - 20,
      ellipsis: true,
    });
    doc.text(gstin ? `GSTIN: ${gstin}` : 'GSTIN: Not provided', x + 10, y + 79, {
      width: width - 20,
    });
  }

  private static drawLineItems(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    this.drawTableHeader(doc);
    invoice.line_items.forEach((item, index) => {
      const descriptionHeight = doc.heightOfString(item.description, {
        width: TABLE_COLUMNS[1] - 10,
      });
      const rowHeight = Math.max(28, descriptionHeight + 12);
      if (doc.y + rowHeight > doc.page.height - 120) {
        doc.addPage();
        this.drawTableHeader(doc);
      }

      const y = doc.y;
      if (index % 2 === 1) {
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill('#f8fafc');
      }
      const taxRate = Number(item.igst_rate || 0) ||
        Number(item.cgst_rate || 0) + Number(item.sgst_rate || 0);
      const cells = [
        String(index + 1),
        item.description,
        item.sac_hsn,
        `${Number(item.quantity)} ${item.unit}`,
        money(item.taxable_value),
        `${taxRate.toFixed(2)}%`,
        money(item.total_amount),
      ];
      this.drawTableRow(doc, cells, y, rowHeight);
      doc.y = y + rowHeight;
    });
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(PAGE_WIDTH - MARGIN, doc.y)
      .strokeColor('#9ca3af')
      .lineWidth(0.5)
      .stroke();
    doc.y += 12;
  }

  private static drawTableHeader(doc: PDFKit.PDFDocument): void {
    if (doc.y < 150) doc.y = MARGIN;
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill('#0f172a');
    this.drawTableRow(
      doc,
      ['#', 'Description', 'SAC/HSN', 'Qty', 'Taxable', 'GST', 'Total'],
      y,
      24,
      true
    );
    doc.y = y + 24;
  }

  private static drawTableRow(
    doc: PDFKit.PDFDocument,
    values: string[],
    y: number,
    height: number,
    header = false
  ): void {
    let x = MARGIN;
    values.forEach((value, index) => {
      doc
        .font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(header ? 8 : 7.5)
        .fillColor(header ? '#ffffff' : '#111827')
        .text(value, x + 5, y + (header ? 8 : 7), {
          width: TABLE_COLUMNS[index] - 10,
          height: height - 8,
          align: index >= 4 ? 'right' : index === 0 ? 'center' : 'left',
          ellipsis: true,
        });
      x += TABLE_COLUMNS[index];
    });
  }

  private static drawTotals(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    if (doc.y + 155 > doc.page.height - 60) doc.addPage();
    const x = PAGE_WIDTH - MARGIN - 245;
    const rows: Array<[string, number | string | null | undefined, boolean?]> = [
      ['Subtotal', invoice.subtotal],
      ['Discount', Number(invoice.discount_amount || 0) > 0 ? -Number(invoice.discount_amount || 0) : 0],
      ['Taxable Amount', invoice.taxable_amount],
      ['CGST', invoice.cgst_amount],
      ['SGST', invoice.sgst_amount],
      ['IGST', invoice.igst_amount],
      ['Total Tax', invoice.total_tax],
      ['Round Off', invoice.round_off],
      ['Grand Total', invoice.grand_total, true],
      ['Amount Paid', invoice.amount_paid],
      ['Balance Due', invoice.balance_amount, true],
    ];
    doc.roundedRect(x, doc.y - 6, 245, 186, 6).fillAndStroke('#ffffff', '#d1d5db');
    doc.y += 6;
    rows.forEach(([label, value, emphasized]) => {
      const y = doc.y;
      if (emphasized) {
        doc.roundedRect(x + 8, y - 2, 229, 18, 3).fill(label === 'Grand Total' ? '#dbeafe' : '#fef3c7');
      }
      doc
        .font(emphasized ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(emphasized ? 9.5 : 8.5)
        .fillColor('#111827')
        .text(label, x + 18, y + 2, { width: 105 })
        .text(money(value), x + 128, y + 2, { width: 100, align: 'right' });
      doc.y = y + (emphasized ? 20 : 16);
    });
    doc.y += 10;
  }

  private static drawAdditionalInformation(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    const sections = [
      ['Notes', invoice.notes],
      ['Terms and Conditions', invoice.terms_conditions],
      ['Payment Instructions', invoice.payment_instructions],
    ].filter(([, value]) => Boolean(value));

    sections.forEach(([heading, value]) => {
      const requiredHeight = doc.heightOfString(String(value), { width: CONTENT_WIDTH }) + 28;
      if (doc.y + requiredHeight > doc.page.height - 60) doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#111827')
        .text(String(heading), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.25);
      doc.font('Helvetica').fontSize(8).fillColor('#4b5563').text(String(value), MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });
      doc.moveDown(0.7);
    });
  }

  private static drawSignatureBlock(doc: PDFKit.PDFDocument, invoice: CompleteInvoice): void {
    const y = Math.min(doc.y + 8, doc.page.height - 150);
    const boxWidth = (CONTENT_WIDTH - 16) / 2;

    doc.roundedRect(MARGIN, y, boxWidth, 66, 5).fillAndStroke('#f8fafc', '#d1d5db');
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#111827')
      .text('Payment Status', MARGIN + 10, y + 10);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#4b5563')
      .text(`Amount paid: ${money(invoice.amount_paid)}`, MARGIN + 10, y + 27)
      .text(`Balance due: ${money(invoice.balance_amount)}`, MARGIN + 10, y + 41);

    const signX = MARGIN + boxWidth + 16;
    doc.roundedRect(signX, y, boxWidth, 66, 5).fillAndStroke('#ffffff', '#d1d5db');
    doc
      .moveTo(signX + 28, y + 42)
      .lineTo(signX + boxWidth - 28, y + 42)
      .strokeColor('#94a3b8')
      .lineWidth(0.7)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#111827')
      .text(`For ${invoice.business_name || 'Venue'}`, signX + 10, y + 12, {
        width: boxWidth - 20,
        align: 'right',
      })
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#64748b')
      .text('Authorised Signatory', signX + 10, y + 48, {
        width: boxWidth - 20,
        align: 'center',
      });

    doc.y = y + 78;
  }

  private static drawPageFooters(doc: PDFKit.PDFDocument, invoiceNumber: string): void {
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      const footerY = doc.page.height - 66;
      doc
        .moveTo(MARGIN, footerY - 8)
        .lineTo(PAGE_WIDTH - MARGIN, footerY - 8)
        .strokeColor('#d1d5db')
        .lineWidth(0.5)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#6b7280')
        .text(`Generated by HallSync | ${invoiceNumber}`, MARGIN, footerY, {
          width: CONTENT_WIDTH / 2,
          lineBreak: false,
        })
        .text(`Page ${index + 1} of ${range.count}`, PAGE_WIDTH / 2, footerY, {
          width: CONTENT_WIDTH / 2,
          align: 'right',
          lineBreak: false,
        });
    }
  }

  private static labelValue(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number
  ): void {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151').text(`${label}:`, x, y, {
      width: 70,
    });
    doc.font('Helvetica').fontSize(8).fillColor('#111827').text(value, x + 72, y, {
      width: width - 72,
      ellipsis: true,
    });
  }
}

export default InvoicePDFService;
