/**
 * Invoice Repository
 * Handles database operations for invoices
 */

import pool from '../config/db';
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

export class InvoiceRepository {
  /**
   * Generate next invoice number
   */
  async generateInvoiceNumber(invoiceType: string): Promise<string> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'CALL generate_invoice_number(?)',
      [invoiceType]
    );
    // Stored procedure returns result set, not OUT parameter
    return rows[0][0].invoice_number;
  }

  /**
   * Get customer and business details for invoice
   */
  private async getInvoiceParties(customerId: number): Promise<{
    customer: any;
    business: any;
  }> {
    // Get customer details
    const [customerRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id, name, gstin, pan, address, city, state, state_code, 
        pincode, phone, email
      FROM customers 
      WHERE id = ?`,
      [customerId]
    );

    if (customerRows.length === 0) {
      throw new Error('Customer not found');
    }

    // Get business config
    const [businessRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        business_name, gstin, address, city, state, state_code,
        pincode, phone, email
      FROM business_config 
      WHERE is_active = TRUE 
      LIMIT 1`
    );

    if (businessRows.length === 0) {
      throw new Error('Business configuration not found');
    }

    return {
      customer: customerRows[0],
      business: businessRows[0],
    };
  }

  /**
   * Create new invoice
   */
  async create(data: CreateInvoiceDTO, createdBy: number): Promise<number> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get customer and business details
      const { customer, business } = await this.getInvoiceParties(data.customer_id);

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
      }));

      const gstResult = GSTCalculator.calculateGST(
        lineItems,
        business.state_code,
        customer.state_code || business.state_code,
        true // Enable round-off
      );

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(data.invoice_type);

      // Calculate due date (30 days from invoice date if not provided)
      const invoiceDate = data.invoice_date || new Date();
      const dueDate = data.due_date || new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Insert invoice
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO invoices (
          invoice_number, invoice_type, invoice_date, due_date,
          booking_id, customer_id,
          customer_name, customer_gstin, customer_pan, customer_address,
          customer_city, customer_state, customer_state_code, customer_pincode,
          customer_phone, customer_email,
          business_name, business_gstin, business_address, business_city,
          business_state, business_state_code, business_pincode,
          business_phone, business_email,
          supply_type, place_of_supply, place_of_supply_code,
          subtotal, discount_amount, taxable_amount,
          cgst_amount, sgst_amount, igst_amount, cess_amount,
          total_tax, round_off, grand_total,
          amount_paid, balance_amount, status,
          notes, terms_conditions, payment_instructions,
          reference_number, original_invoice_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber,
          data.invoice_type,
          invoiceDate,
          dueDate,
          data.booking_id || null,
          data.customer_id,
          customer.name,
          customer.gstin || null,
          customer.pan || null,
          customer.address,
          customer.city,
          customer.state,
          customer.state_code || business.state_code,
          customer.pincode,
          customer.phone,
          customer.email,
          business.business_name,
          business.gstin || null,
          business.address,
          business.city,
          business.state,
          business.state_code,
          business.pincode,
          business.phone,
          business.email,
          gstResult.supply_type,
          customer.state || business.state,
          customer.state_code || business.state_code,
          gstResult.subtotal,
          data.discount_amount || gstResult.discount_amount,
          gstResult.taxable_amount,
          gstResult.cgst_amount,
          gstResult.sgst_amount,
          gstResult.igst_amount,
          gstResult.cess_amount,
          gstResult.total_tax,
          gstResult.round_off,
          gstResult.grand_total,
          0, // amount_paid
          gstResult.grand_total, // balance_amount
          'draft',
          data.notes || null,
          data.terms_conditions || null,
          data.payment_instructions || null,
          data.reference_number || null,
          data.original_invoice_id || null,
          createdBy,
        ]
      );

      const invoiceId = result.insertId;

      // Insert line items
      for (let i = 0; i < data.line_items.length; i++) {
        const item = data.line_items[i];
        const calculatedItem = gstResult.line_items[i];

        await connection.query(
          `INSERT INTO invoice_line_items (
            invoice_id, line_number, description, sac_hsn,
            quantity, unit, unit_price,
            discount_percentage, line_subtotal, discount_amount, taxable_value,
            gst_rate, cgst_rate, sgst_rate, igst_rate, cess_rate,
            cgst_amount, sgst_amount, igst_amount, cess_amount,
            total_tax, total_amount, service_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            i + 1,
            item.description,
            item.sac_hsn,
            item.quantity,
            item.unit,
            item.unit_price,
            item.discount_percentage || 0,
            calculatedItem.line_subtotal,
            calculatedItem.discount_amount || 0,
            calculatedItem.taxable_value,
            item.gst_rate,
            calculatedItem.cgst_rate,
            calculatedItem.sgst_rate,
            calculatedItem.igst_rate,
            item.cess_rate || 0,
            calculatedItem.cgst_amount,
            calculatedItem.sgst_amount,
            calculatedItem.igst_amount,
            calculatedItem.cess_amount,
            calculatedItem.total_tax,
            calculatedItem.total_amount,
            item.service_id || null,
          ]
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
  async getById(id: number): Promise<(Invoice & { line_items: InvoiceLineItem[] }) | null> {
    const [invoiceRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );

    if (invoiceRows.length === 0) {
      return null;
    }

    const [lineItemRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY line_number',
      [id]
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
    const [invoiceRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE invoice_number = ?',
      [invoiceNumber]
    );

    if (invoiceRows.length === 0) {
      return null;
    }

    const invoice = invoiceRows[0];
    const [lineItemRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY line_number',
      [invoice.id]
    );

    return {
      ...invoice as Invoice,
      line_items: lineItemRows as InvoiceLineItem[],
    };
  }

  /**
   * Get all invoices with filters
   */
  async getAll(filters?: InvoiceFilters): Promise<Invoice[]> {
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params: any[] = [];

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
      query += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR reference_number LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY invoice_date DESC, id DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows as Invoice[];
  }

  /**
   * Update invoice
   */
  async update(id: number, data: UpdateInvoiceDTO): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(data.due_date);
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    if (data.terms_conditions !== undefined) {
      updates.push('terms_conditions = ?');
      params.push(data.terms_conditions);
    }

    if (data.payment_instructions !== undefined) {
      updates.push('payment_instructions = ?');
      params.push(data.payment_instructions);
    }

    if (data.reference_number !== undefined) {
      updates.push('reference_number = ?');
      params.push(data.reference_number);
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(id);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE invoices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return result.affectedRows > 0;
  }

  /**
   * Issue invoice (change status from draft to issued)
   */
  async issue(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE invoices 
       SET status = 'issued', issued_at = NOW(), updated_at = NOW() 
       WHERE id = ? AND status = 'draft'`,
      [id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Cancel invoice
   */
  async cancel(id: number, reason: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE invoices 
       SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = ?, updated_at = NOW() 
       WHERE id = ? AND status IN ('draft', 'issued')`,
      [reason, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Record payment against invoice(s)
   */
  async recordPayment(data: RecordPaymentDTO): Promise<number> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert payment transaction
      const [paymentResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO payment_transactions (
          payment_date, amount, payment_mode, transaction_reference, notes
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          data.payment_date,
          data.amount,
          data.payment_mode,
          data.transaction_reference || null,
          data.notes || null,
        ]
      );

      const paymentId = paymentResult.insertId;

      // Allocate payment to invoices
      for (const allocation of data.allocations) {
        // Update invoice amounts
        await connection.query(
          `UPDATE invoices 
           SET amount_paid = amount_paid + ?,
               balance_amount = balance_amount - ?,
               status = CASE 
                 WHEN balance_amount - ? <= 0 THEN 'paid'
                 WHEN amount_paid + ? > 0 THEN 'partially_paid'
                 ELSE status
               END,
               updated_at = NOW()
           WHERE id = ?`,
          [allocation.amount, allocation.amount, allocation.amount, allocation.amount, allocation.invoice_id]
        );

        // Link payment to invoice (you may want to create a payment_allocations table)
        // For now, we'll update the invoice directly
      }

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
    let query = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(grand_total) as total_amount,
        SUM(amount_paid) as total_paid,
        SUM(balance_amount) as total_pending,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) as partially_paid_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN invoice_type = 'tax_invoice' THEN 1 ELSE 0 END) as tax_invoice_count,
        SUM(CASE WHEN invoice_type = 'receipt_voucher' THEN 1 ELSE 0 END) as receipt_count,
        SUM(CASE WHEN invoice_type = 'credit_note' THEN 1 ELSE 0 END) as credit_note_count,
        SUM(CASE WHEN invoice_type = 'debit_note' THEN 1 ELSE 0 END) as debit_note_count
      FROM invoices
      WHERE 1=1
    `;
    const params: any[] = [];

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
        draft: row.draft_count || 0,
        issued: row.issued_count || 0,
        paid: row.paid_count || 0,
        partially_paid: row.partially_paid_count || 0,
        cancelled: row.cancelled_count || 0,
      },
      by_type: {
        tax_invoice: row.tax_invoice_count || 0,
        receipt_voucher: row.receipt_count || 0,
        credit_note: row.credit_note_count || 0,
        debit_note: row.debit_note_count || 0,
      },
    };
  }

  /**
   * Get invoices for a booking
   */
  async getByBookingId(bookingId: number): Promise<Invoice[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE booking_id = ? ORDER BY invoice_date DESC',
      [bookingId]
    );

    return rows as Invoice[];
  }

  /**
   * Get invoices for a customer
   */
  async getByCustomerId(customerId: number): Promise<Invoice[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM invoices WHERE customer_id = ? ORDER BY invoice_date DESC',
      [customerId]
    );

    return rows as Invoice[];
  }
}

export default new InvoiceRepository();
