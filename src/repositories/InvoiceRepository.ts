/**
 * Invoice Repository
 * Handles database operations for invoices with Strict Multi-Tenancy via ALS
 */

import pool from '../config/db';
import { TenantBaseRepository } from './TenantBaseRepository';
import {
  Invoice,
  InvoiceLineItem,
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  InvoiceFilters,
  InvoiceSummary,
  RecordPaymentDTO,
} from '../models/Invoice';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import GSTCalculator from '../services/GSTCalculator';
import { getTenantId } from '../utils/tenantContext';
import {
  allocateExistingBookingPaymentsToInvoice,
  allocatePaymentToInvoices,
  assertSingleBookingForInvoices,
  assertUniqueTransactionReference,
  findPaymentByIdempotencyKey,
  generatePaymentReceiptNumber,
  insertBookingPayment,
  lockBookingAndValidatePayment,
  lockInvoicesForAllocation,
  updateBookingPaymentTotals,
  validateAllocationTotal,
  validatePositiveMoney,
} from './PaymentLedgerRepository';

export class InvoiceRepository extends TenantBaseRepository<Invoice> {
  constructor() {
    super('invoices');
  }

  /**
   * Generate next invoice number
   */
  async generateInvoiceNumber(invoiceType: string): Promise<string> {
    // In V2, we generate this via query or app logic since SP was dropped
    const tenantId = getTenantId();
    const prefix = invoiceType === 'tax_invoice' ? 'INV' : 'REC';

    // Find the latest invoice number for this type and tenant
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT invoice_number FROM invoices
       WHERE tenant_id = ? AND invoice_type = ?
       ORDER BY id DESC LIMIT 1`,
      [tenantId, invoiceType]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
      const lastNumberStr = rows[0].invoice_number.split('-').pop();
      nextNumber = parseInt(lastNumberStr, 10) + 1;
    }

    // Format: INV-YYYYMM-[TenantID]-0001
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    return `${prefix}-${dateStr}-T${tenantId}-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Get customer and business details for invoice
   */
  private async getInvoiceParties(customerId: number): Promise<{
    customer: any;
    business: any;
  }> {
    const tenantId = getTenantId();

    // Get customer details
    const [customerRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        id, name, gstin, pan, address, city, state, state_code,
        pincode, phone, email
      FROM customers
      WHERE id = ? AND tenant_id = ?`,
      [customerId, tenantId]
    );

    if (customerRows.length === 0) {
      throw new Error('Customer not found');
    }

    // Get business config
    const [businessRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        business_name, gstin, address, city, state, state_code,
        pincode, phone, email, invoice_prefix
      FROM business_config
      WHERE tenant_id = ?
      LIMIT 1`,
      [tenantId]
    );

    if (businessRows.length === 0) {
      throw new Error('Business configuration not found');
    }

    const business = businessRows[0];
    if (!business.state_code) {
      throw new Error('Business GST state code must be configured before creating invoices');
    }

    return {
      customer: customerRows[0],
      business,
    };
  }

  /**
   * Create new invoice
   */
  async createInvoice(data: CreateInvoiceDTO, createdBy: number): Promise<number> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get customer and business details
      const { customer, business } = await this.getInvoiceParties(data.customer_id);

      // Calculate GST (simplified for V2 schema mapping)
      const lineItems = data.line_items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_percentage
          ? (item.quantity * item.unit_price * item.discount_percentage) / 100
          : 0,
        gst_rate: item.gst_rate,
        sac_hsn: item.sac_hsn,
      }));

      const gstResult = GSTCalculator.calculateGST(
        lineItems,
        business.state_code,
        customer.state_code || business.state_code,
        true,
        data.discount_amount || 0
      );

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(data.invoice_type);

      // Calculate due date (30 days from invoice date if not provided)
      const invoiceDate = data.invoice_date || new Date();
      const dueDate = data.due_date || new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Insert invoice
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO invoices SET ?',
        [{
          tenant_id: tenantId,
          invoice_number: invoiceNumber,
          invoice_type: data.invoice_type,
          invoice_date: invoiceDate,
          due_date: dueDate,
          booking_id: data.booking_id || null,
          customer_id: data.customer_id,
          customer_name: customer.name,
          customer_gstin: customer.gstin || null,
          customer_pan: customer.pan || null,
          customer_address: customer.address || '',
          customer_city: customer.city || '',
          customer_state: customer.state || '',
          customer_state_code: GSTCalculator.normalizeStateCode(
            customer.state_code || business.state_code
          ),
          customer_pincode: customer.pincode || '',
          customer_phone: customer.phone || '',
          customer_email: customer.email || '',
          business_name: business.business_name,
          business_gstin: business.gstin || null,
          business_address: business.address || '',
          business_city: business.city || '',
          business_state: business.state || '',
          business_state_code: GSTCalculator.normalizeStateCode(business.state_code),
          business_pincode: business.pincode || '',
          business_phone: business.phone || '',
          business_email: business.email || '',
          supply_type: gstResult.supply_type,
          place_of_supply: customer.state || business.state || '',
          subtotal: gstResult.subtotal,
          discount_amount: gstResult.discount_amount,
          taxable_amount: gstResult.taxable_amount,
          cgst_amount: gstResult.cgst_amount,
          sgst_amount: gstResult.sgst_amount,
          igst_amount: gstResult.igst_amount,
          cess_amount: gstResult.cess_amount,
          total_tax: gstResult.total_tax,
          round_off: gstResult.round_off,
          grand_total: gstResult.grand_total,
          amount_paid: 0,
          balance_amount: gstResult.grand_total,
          payment_status: 'unpaid',
          status: 'draft',
          notes: data.notes || null,
          terms_conditions: data.terms_conditions || null,
          payment_instructions: data.payment_instructions || null,
          reference_number: data.reference_number || null,
          original_invoice_id: data.original_invoice_id || null,
          created_by: createdBy,
        }]
      );

      const invoiceId = result.insertId;
      for (let index = 0; index < gstResult.line_items.length; index += 1) {
        const item = gstResult.line_items[index];
        const sourceItem = data.line_items[index];
        await connection.query(
          'INSERT INTO invoice_line_items SET ?',
          [{
            tenant_id: tenantId,
            invoice_id: invoiceId,
            line_number: index + 1,
            description: item.description,
            sac_hsn: item.sac_hsn,
            quantity: item.quantity,
            unit: sourceItem.unit,
            unit_price: item.unit_price,
            line_subtotal: item.line_subtotal,
            gst_rate: sourceItem.gst_rate,
            discount_percentage: sourceItem.discount_percentage || 0,
            discount_amount: item.discount_amount || 0,
            taxable_value: item.taxable_value,
            cgst_rate: item.cgst_rate,
            sgst_rate: item.sgst_rate,
            igst_rate: item.igst_rate,
            cess_rate: sourceItem.cess_rate || 0,
            cgst_amount: item.cgst_amount,
            sgst_amount: item.sgst_amount,
            igst_amount: item.igst_amount,
            cess_amount: item.cess_amount,
            total_tax: item.total_tax,
            total_amount: item.total_amount,
            service_id: sourceItem.service_id || null,
          }]
        );
      }

      if (data.booking_id) {
        await allocateExistingBookingPaymentsToInvoice(
          connection,
          tenantId,
          data.booking_id,
          invoiceId,
          gstResult.grand_total
        );
      }

      await connection.commit();
      return invoiceId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get invoice by ID with line items
   */
  async getInvoiceById(id: number): Promise<(Invoice & { line_items: InvoiceLineItem[] }) | null> {
    const tenantId = getTenantId();
    const [invoiceRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (invoiceRows.length === 0) {
      return null;
    }

    const [lineItemRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM invoice_line_items
       WHERE invoice_id = ? AND tenant_id = ?
       ORDER BY line_number`,
      [id, tenantId]
    );

    return {
      ...invoiceRows[0] as Invoice,
      line_items: lineItemRows as InvoiceLineItem[],
    };
  }

  /**
   * Get invoice by invoice number
   */
  async getByInvoiceNumber(invoiceNumber: string): Promise<(Invoice & { line_items: InvoiceLineItem[] }) | null> {
    const tenantId = getTenantId();
    const [invoiceRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE invoice_number = ? AND tenant_id = ?',
      [invoiceNumber, tenantId]
    );

    if (invoiceRows.length === 0) {
      return null;
    }

    const invoice = invoiceRows[0] as Invoice;
    const [lineItemRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM invoice_line_items
       WHERE invoice_id = ? AND tenant_id = ?
       ORDER BY line_number`,
      [invoice.id, tenantId]
    );

    return {
      ...invoice,
      line_items: lineItemRows as InvoiceLineItem[],
    };
  }

  /**
   * Get all invoices with filters
   */
  async getAllInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    const tenantId = getTenantId();
    let query = 'SELECT * FROM invoices WHERE tenant_id = ?';
    const params: any[] = [tenantId];

    if (filters?.invoice_type) {
      query += ' AND invoice_type = ?';
      params.push(filters.invoice_type);
    }

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.customer_id) {
      query += ' AND customer_id = ?';
      params.push(filters.customer_id);
    }

    if (filters?.booking_id) {
      query += ' AND booking_id = ?';
      params.push(filters.booking_id);
    }

    if (filters?.from_date) {
      query += ' AND invoice_date >= ?';
      params.push(filters.from_date);
    }

    if (filters?.to_date) {
      query += ' AND invoice_date <= ?';
      params.push(filters.to_date);
    }

    if (filters?.search) {
      query += ' AND invoice_number LIKE ?';
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY invoice_date DESC, id DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows as Invoice[];
  }

  /**
   * Update invoice
   */
  async updateInvoice(id: number, data: UpdateInvoiceDTO): Promise<boolean> {
    const tenantId = getTenantId();
    const updates: string[] = [];
    const params: any[] = [];

    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }

    if (updates.length === 0) return false;

    params.push(id, tenantId);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE invoices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  /**
   * Issue invoice (change status from draft to issued)
   */
  async issue(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE invoices
       SET status = 'issued', updated_at = NOW()
       WHERE id = ? AND status = 'draft' AND tenant_id = ?`,
      [id, tenantId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Cancel invoice
   */
  async cancel(id: number, reason: string): Promise<boolean> {
    const tenantId = getTenantId();
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE invoices
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ? AND status IN ('draft', 'issued') AND tenant_id = ?`,
      [id, tenantId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Record payment against invoice(s)
   */
  async recordPayment(data: RecordPaymentDTO): Promise<number> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const existingPaymentId = await findPaymentByIdempotencyKey(
        connection,
        tenantId,
        data.idempotency_key
      );
      if (existingPaymentId) {
        await connection.commit();
        return existingPaymentId;
      }

      const paymentAmount = validatePositiveMoney(Number(data.amount));
      validateAllocationTotal(paymentAmount, data.allocations);
      const invoices = await lockInvoicesForAllocation(
        connection,
        tenantId,
        data.allocations
      );
      const bookingId = assertSingleBookingForInvoices(invoices);
      const { totalAmount, updatedTotalPaid } = await lockBookingAndValidatePayment(
        connection,
        tenantId,
        bookingId,
        paymentAmount
      );
      await assertUniqueTransactionReference(
        connection,
        tenantId,
        data.transaction_reference
      );
      const receiptNumber = await generatePaymentReceiptNumber(connection, tenantId);
      const paymentId = await insertBookingPayment(connection, {
        tenantId,
        bookingId,
        amount: paymentAmount,
        paymentMode: data.payment_mode,
        paymentType: 'balance',
        transactionId: data.transaction_reference || null,
        paymentDate: data.payment_date,
        notes: data.notes || null,
        receivedBy: data.received_by || null,
        status: 'recorded',
        idempotencyKey: data.idempotency_key || null,
        receiptNumber,
      });

      await allocatePaymentToInvoices(connection, tenantId, paymentId, data.allocations);
      await updateBookingPaymentTotals(
        connection,
        tenantId,
        bookingId,
        totalAmount,
        updatedTotalPaid
      );

      await connection.commit();
      return paymentId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get invoice summary/statistics
   */
  async getSummary(filters?: InvoiceFilters): Promise<InvoiceSummary> {
    const tenantId = getTenantId();
    let query = `
      SELECT
        COUNT(*) as total_invoices,
        SUM(grand_total) as total_amount,
        SUM(amount_paid) as total_paid,
        SUM(balance_amount) as total_pending,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN invoice_type = 'tax_invoice' THEN 1 ELSE 0 END) as tax_invoice_count,
        SUM(CASE WHEN invoice_type = 'receipt_voucher' THEN 1 ELSE 0 END) as receipt_count
      FROM invoices
      WHERE tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (filters?.from_date) {
      query += ' AND invoice_date >= ?';
      params.push(filters.from_date);
    }

    if (filters?.to_date) {
      query += ' AND invoice_date <= ?';
      params.push(filters.to_date);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    const row = rows[0];

    return {
      total_invoices: row.total_invoices || 0,
      total_amount: row.total_amount || 0,
      total_paid: row.total_paid || 0,
      total_pending: row.total_pending || 0,
      by_status: {
        draft: { count: row.draft_count || 0, amount: 0 },
        issued: { count: row.issued_count || 0, amount: 0 },
        paid: { count: row.paid_count || 0, amount: 0 },
        partially_paid: { count: 0, amount: 0 },
        cancelled: { count: row.cancelled_count || 0, amount: 0 },
      },
      by_type: {
        tax_invoice: { count: row.tax_invoice_count || 0, amount: 0 },
        receipt_voucher: { count: row.receipt_count || 0, amount: 0 },
        credit_note: { count: 0, amount: 0 },
        debit_note: { count: 0, amount: 0 },
      },
    };
  }
}

export default new InvoiceRepository();
