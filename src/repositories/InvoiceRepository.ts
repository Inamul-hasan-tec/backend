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
  syncAllBookingInvoiceBalances,
  syncBookingInvoiceBalances,
  updateBookingPaymentTotals,
  validateAllocationTotal,
  validatePositiveMoney,
} from './PaymentLedgerRepository';

export class InvoiceRepository extends TenantBaseRepository<Invoice> {
  constructor() {
    super('invoices');
  }

  /**
   * Helper to calculate Indian Financial Year (e.g., '26-27')
   */
  static getIndianFinancialYear(date: Date = new Date()): string {
    const d = date instanceof Date ? date : new Date(date);
    const month = d.getMonth(); // 0 = Jan, 3 = April
    const year = d.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    const startStr = String(startYear).slice(-2);
    const endStr = String(endYear).slice(-2);
    return `${startStr}-${endStr}`;
  }

  /**
   * Generate next invoice number for preview (non-mutating)
   */
  async generateInvoiceNumber(invoiceType: string, date: Date = new Date()): Promise<string> {
    const tenantId = getTenantId();
    const fy = InvoiceRepository.getIndianFinancialYear(date);
    const typeMap: Record<string, string> = {
      tax_invoice: 'INV',
      receipt_voucher: 'REC',
      credit_note: 'CN',
      debit_note: 'DN',
    };
    const docType = typeMap[invoiceType] || 'DOC';

    // Get prefix from business_config
    const [bizRows] = await pool.query<RowDataPacket[]>(
      `SELECT invoice_prefix FROM business_config WHERE tenant_id = ? LIMIT 1`,
      [tenantId]
    );
    const prefix = (bizRows[0]?.invoice_prefix || 'HS').toUpperCase().trim();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT current_val FROM invoice_sequences
       WHERE tenant_id = ? AND doc_type = ? AND financial_year = ?
       LIMIT 1`,
      [tenantId, docType, fy]
    );

    const nextVal = (rows[0]?.current_val || 0) + 1;
    return `${prefix}/${fy}/${docType}/${nextVal.toString().padStart(4, '0')}`;
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
        business_name, gstin, is_gst_registered, address, city, state, state_code,
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

      // GST Registration gate: Unregistered venues cannot issue Tax Invoices
      const isRegistered = Boolean(
        business.is_gst_registered &&
        business.gstin &&
        business.gstin.trim().length === 15
      );

      if (data.invoice_type === 'tax_invoice' && !isRegistered) {
        throw new Error(
          'This venue is not configured as GST registered. Unregistered businesses cannot issue official Tax Invoices. Please issue a Bill of Supply or Receipt Voucher instead.'
        );
      }

      // Determine Place of Supply. Official tax invoices must receive an
      // explicit POS from the caller; the UI may prefill venue state only when
      // the operator confirms a local unregistered customer.
      const explicitPosStateCode = data.place_of_supply_state_code?.trim();
      if (data.invoice_type === 'tax_invoice' && !explicitPosStateCode) {
        throw new Error(
          'Place of Supply state code is mandatory for official Tax Invoices. Select the customer state or confirm local unregistered customer.'
        );
      }
      const posStateCode = GSTCalculator.normalizeStateCode(
        explicitPosStateCode || customer.state_code || business.state_code
      );
      if (!GSTCalculator.isValidStateCode(posStateCode)) {
        throw new Error('A valid 2-digit Place of Supply state code is mandatory for invoice creation');
      }
      const posStateName = GSTCalculator.getStateName(posStateCode);
      const posReason = data.place_of_supply_reason || (
        !customer.gstin && posStateCode === GSTCalculator.normalizeStateCode(business.state_code)
          ? 'Local supply to unregistered recipient'
          : null
      );

      // Determine tax mode
      const taxMode = data.tax_mode || (isRegistered ? 'inclusive' : 'no_gst');

      // Calculate GST
      const lineItems = data.line_items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_percentage
          ? (item.quantity * item.unit_price * item.discount_percentage) / 100
          : 0,
        gst_rate: item.gst_rate,
        sac_hsn: item.sac_hsn,
        tax_treatment: item.tax_treatment || 'taxable',
      }));

      const gstResult = GSTCalculator.calculateGST(
        lineItems,
        business.state_code,
        posStateCode,
        true,
        data.discount_amount || 0,
        taxMode
      );

      if (data.booking_id && data.invoice_type === 'tax_invoice') {
        const [existingInvoices] = await connection.query<RowDataPacket[]>(
          `SELECT id, invoice_number, status
           FROM invoices
           WHERE tenant_id = ? AND booking_id = ? AND invoice_type = 'tax_invoice' AND status NOT IN ('cancelled', 'void')`,
          [tenantId, data.booking_id]
        );
        if (existingInvoices.length > 0) {
          if (data.original_invoice_id && existingInvoices.some((inv) => inv.id === data.original_invoice_id)) {
            // Atomic replacement: Cancel previous invoice and clear its allocations
            await connection.execute(
              `UPDATE invoices
               SET status = 'cancelled',
                   cancellation_reason = ?,
                   cancelled_at = NOW(),
                   updated_at = NOW()
               WHERE id = ? AND tenant_id = ?`,
              [
                data.notes?.includes('Cancellation reason:')
                  ? data.notes
                  : 'Superseded by replacement invoice',
                data.original_invoice_id,
                tenantId,
              ]
            );
            await connection.execute(
              `DELETE FROM invoice_payment_allocations WHERE invoice_id = ? AND tenant_id = ?`,
              [data.original_invoice_id, tenantId]
            );
          } else {
            throw new Error(
              `An active official tax invoice (${existingInvoices[0].invoice_number}) already exists for this booking. Please cancel or replace the existing invoice first.`
            );
          }
        }
      }

      // Concurrency-safe Financial Year invoice numbering using invoice_sequences row lock
      const invoiceDate = data.invoice_date || new Date();
      const financialYear = data.financial_year || InvoiceRepository.getIndianFinancialYear(invoiceDate);
      const typeMap: Record<string, string> = {
        tax_invoice: 'INV',
        receipt_voucher: 'REC',
        credit_note: 'CN',
        debit_note: 'DN',
      };
      const docType = typeMap[data.invoice_type] || 'DOC';
      const prefix = (business.invoice_prefix || 'HS').toUpperCase().trim();

      await connection.query(
        `INSERT INTO invoice_sequences (tenant_id, doc_type, financial_year, current_val)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE current_val = current_val + 1`,
        [tenantId, docType, financialYear]
      );

      const [seqRows] = await connection.query<RowDataPacket[]>(
        `SELECT current_val FROM invoice_sequences
         WHERE tenant_id = ? AND doc_type = ? AND financial_year = ?
         FOR UPDATE`,
        [tenantId, docType, financialYear]
      );
      const nextSequence = seqRows[0]?.current_val || 1;
      const invoiceNumber = `${prefix}/${financialYear}/${docType}/${nextSequence.toString().padStart(4, '0')}`;

      // Calculate due date (30 days from invoice date if not provided)
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
          place_of_supply: posStateName,
          place_of_supply_state_code: posStateCode,
          place_of_supply_reason: posReason,
          financial_year: financialYear,
          tax_mode: taxMode,
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
            tax_treatment: item.tax_treatment || 'taxable',
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
    let [invoiceRows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, bc.logo_url AS business_logo_url
       FROM invoices i
       LEFT JOIN business_config bc ON bc.tenant_id = i.tenant_id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [id, tenantId]
    );

    if (invoiceRows.length === 0) {
      return null;
    }

    if (invoiceRows[0].booking_id && !['cancelled', 'void'].includes(invoiceRows[0].status)) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await syncBookingInvoiceBalances(conn, tenantId, Number(invoiceRows[0].booking_id));
        await conn.commit();
      } catch (syncErr) {
        await conn.rollback();
      } finally {
        conn.release();
      }

      const [refreshedRows] = await pool.query<RowDataPacket[]>(
        `SELECT i.*, bc.logo_url AS business_logo_url
         FROM invoices i
         LEFT JOIN business_config bc ON bc.tenant_id = i.tenant_id
         WHERE i.id = ? AND i.tenant_id = ?`,
        [id, tenantId]
      );
      if (refreshedRows.length > 0) {
        invoiceRows = refreshedRows;
      }
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
      `SELECT i.*, bc.logo_url AS business_logo_url
       FROM invoices i
       LEFT JOIN business_config bc ON bc.tenant_id = i.tenant_id
       WHERE i.invoice_number = ? AND i.tenant_id = ?`,
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
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (filters?.booking_id) {
        await syncBookingInvoiceBalances(conn, tenantId, Number(filters.booking_id));
      } else {
        await syncAllBookingInvoiceBalances(conn, tenantId);
      }
      await conn.commit();
    } catch (syncErr) {
      await conn.rollback();
    } finally {
      conn.release();
    }

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
  async cancel(id: number, reason?: string): Promise<boolean> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const cancelReason = (reason && reason.trim()) ? reason.trim() : 'Cancelled by user';
      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE invoices
         SET status = 'cancelled',
             notes = CONCAT(COALESCE(notes, ''), '\nCancellation reason: ', ?),
             updated_at = NOW()
         WHERE id = ? AND status IN ('draft', 'issued') AND tenant_id = ?`,
        [cancelReason, id, tenantId]
      );

      if (result.affectedRows > 0) {
        const [invRows] = await connection.query<RowDataPacket[]>(
          `SELECT booking_id FROM invoices WHERE id = ? AND tenant_id = ?`,
          [id, tenantId]
        );
        const bookingId = invRows[0]?.booking_id;

        await connection.query(
          `DELETE FROM invoice_payment_allocations WHERE invoice_id = ? AND tenant_id = ?`,
          [id, tenantId]
        );

        if (bookingId) {
          await syncBookingInvoiceBalances(connection, tenantId, Number(bookingId));
        }
      }

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
      const transactionReference = data.transaction_reference?.trim() || null;
      const notes = data.notes?.trim() || null;

      if (['upi', 'bank_transfer', 'cheque', 'card'].includes(data.payment_mode)) {
        await assertUniqueTransactionReference(
          connection,
          tenantId,
          transactionReference
        );
      }
      const receiptNumber = await generatePaymentReceiptNumber(connection, tenantId);
      const paymentDate = typeof data.payment_date === 'string'
        ? data.payment_date.slice(0, 10)
        : data.payment_date;

      const paymentId = await insertBookingPayment(connection, {
        tenantId,
        bookingId,
        amount: paymentAmount,
        paymentMode: data.payment_mode,
        paymentType: 'balance',
        transactionId: transactionReference,
        paymentDate,
        notes,
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
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await syncAllBookingInvoiceBalances(conn, tenantId);
      await conn.commit();
    } catch (syncErr) {
      await conn.rollback();
    } finally {
      conn.release();
    }

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
