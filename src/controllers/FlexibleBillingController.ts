import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getTenantId } from '../utils/tenantContext';

export class FlexibleBillingController {
  /**
   * Add private note to booking
   * POST /api/bookings/:id/private-notes
   */
  static async addPrivateNote(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const bookingId = parseInt(req.params.id);
      const {
        note_type,
        amount,
        payment_mode,
        description,
        show_in_gst_reports = false,
        is_private = true
      } = req.body;

      const userId = (req as any).user?.id;

      const [bookingRows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1',
        [bookingId, tenantId]
      );
      if (bookingRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO booking_private_notes 
         (booking_id, note_type, amount, payment_mode, description, 
          show_in_gst_reports, is_private, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingId, note_type, amount || 0, payment_mode, description,
         show_in_gst_reports, is_private, userId]
      );

      res.status(201).json({
        success: true,
        message: 'Private note added successfully',
        data: {
          id: result.insertId,
          booking_id: bookingId
        }
      });
    } catch (error: any) {
      console.error('Error adding private note:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add private note',
        error: error.message
      });
    }
  }

  /**
   * Get private notes for booking
   * GET /api/bookings/:id/private-notes
   */
  static async getPrivateNotes(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const bookingId = parseInt(req.params.id);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT bpn.*
         FROM booking_private_notes bpn
         INNER JOIN bookings b ON b.id = bpn.booking_id
         WHERE bpn.booking_id = ? AND b.tenant_id = ?
         ORDER BY bpn.created_at DESC`,
        [bookingId, tenantId]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (error: any) {
      console.error('Error fetching private notes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch private notes',
        error: error.message
      });
    }
  }

  /**
   * Delete private note
   * DELETE /api/bookings/private-notes/:id
   */
  static async deletePrivateNote(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const noteId = parseInt(req.params.id);

      await pool.query(
        `DELETE bpn
         FROM booking_private_notes bpn
         INNER JOIN bookings b ON b.id = bpn.booking_id
         WHERE bpn.id = ? AND b.tenant_id = ?`,
        [noteId, tenantId]
      );

      res.json({
        success: true,
        message: 'Private note deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting private note:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete private note',
        error: error.message
      });
    }
  }

  /**
   * Add additional payment (undisclosed)
   * POST /api/bookings/:id/additional-payments
   */
  static async addAdditionalPayment(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const bookingId = parseInt(req.params.id);
      const {
        invoice_id,
        amount,
        payment_date,
        payment_mode,
        category,
        description,
        show_in_gst_reports = false,
        is_official = false
      } = req.body;

      const userId = (req as any).user?.id;

      const [bookingRows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1',
        [bookingId, tenantId]
      );
      if (bookingRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO additional_payments 
         (booking_id, invoice_id, amount, payment_date, payment_mode, 
          category, description, show_in_gst_reports, is_official, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingId, invoice_id || null, amount, payment_date, payment_mode,
         category, description, show_in_gst_reports, is_official, userId]
      );

      // Update booking additional_amount
      await pool.query(
        `UPDATE bookings 
         SET additional_amount = additional_amount + ?
         WHERE id = ? AND tenant_id = ?`,
        [amount, bookingId, tenantId]
      );

      res.status(201).json({
        success: true,
        message: 'Additional payment recorded successfully',
        data: {
          id: result.insertId,
          booking_id: bookingId,
          amount
        }
      });
    } catch (error: any) {
      console.error('Error adding additional payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add additional payment',
        error: error.message
      });
    }
  }

  /**
   * Get additional payments for booking
   * GET /api/bookings/:id/additional-payments
   */
  static async getAdditionalPayments(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const bookingId = parseInt(req.params.id);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ap.*
         FROM additional_payments ap
         INNER JOIN bookings b ON b.id = ap.booking_id
         WHERE ap.booking_id = ? AND b.tenant_id = ?
         ORDER BY ap.payment_date DESC`,
        [bookingId, tenantId]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (error: any) {
      console.error('Error fetching additional payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch additional payments',
        error: error.message
      });
    }
  }

  /**
   * Get discount templates
   * GET /api/discount-templates
   * Query params: ?active_only=true (optional, default: false)
   */
  static async getDiscountTemplates(req: Request, res: Response) {
    // Discount templates were an early flexible-billing idea, but the current
    // production invoice builder uses simple per-invoice discounts instead.
    // Keep this endpoint safe for older clients without requiring an unused
    // discount_templates table in production.
    res.json({
      success: true,
      data: [],
      message: 'Reusable discount templates are currently disabled. Use the invoice builder discount section.'
    });
  }

  /**
   * Create discount template
   * POST /api/discount-templates
   */
  static async createDiscountTemplate(req: Request, res: Response) {
    res.status(410).json({
      success: false,
      message: 'Reusable discount templates are disabled. Apply discounts directly while creating an estimate or invoice.'
    });
  }

  /**
   * Update discount template
   * PUT /api/discount-templates/:id
   */
  static async updateDiscountTemplate(req: Request, res: Response) {
    res.status(410).json({
      success: false,
      message: 'Reusable discount templates are disabled. Apply discounts directly while creating an estimate or invoice.'
    });
  }

  /**
   * Delete discount template
   * DELETE /api/discount-templates/:id
   */
  static async deleteDiscountTemplate(req: Request, res: Response) {
    res.status(410).json({
      success: false,
      message: 'Reusable discount templates are disabled. Apply discounts directly while creating an estimate or invoice.'
    });
  }

  /**
   * Get booking summary (actual vs invoiced)
   * GET /api/bookings/:id/summary
   */
  static async getBookingSummary(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const bookingId = parseInt(req.params.id);

      // Get booking details
      const [bookingRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          id,
          booking_number,
          customer_id,
          agreed_amount,
          invoiced_amount,
          additional_amount,
          status
         FROM bookings 
         WHERE id = ? AND tenant_id = ?`,
        [bookingId, tenantId]
      );

      if (bookingRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      const booking = bookingRows[0];

      // Get invoices
      const [invoices] = await pool.query<RowDataPacket[]>(
        `SELECT 
          id,
          invoice_number,
          invoice_type,
          grand_total,
          balance_amount,
          status,
          is_partial_invoice
         FROM invoices 
         WHERE booking_id = ? AND tenant_id = ?
         ORDER BY created_at DESC`,
        [bookingId, tenantId]
      );

      // Get private notes
      const [privateNotes] = await pool.query<RowDataPacket[]>(
        `SELECT 
          note_type,
          amount,
          description,
          created_at
         FROM booking_private_notes bpn
         INNER JOIN bookings b ON b.id = bpn.booking_id
         WHERE bpn.booking_id = ? AND b.tenant_id = ? AND bpn.is_private = 1
         ORDER BY bpn.created_at DESC`,
        [bookingId, tenantId]
      );

      // Get additional payments
      const [additionalPayments] = await pool.query<RowDataPacket[]>(
        `SELECT 
          amount,
          payment_date,
          payment_mode,
          category,
          description,
          show_in_gst_reports
         FROM additional_payments ap
         INNER JOIN bookings b ON b.id = ap.booking_id
         WHERE ap.booking_id = ? AND b.tenant_id = ?
         ORDER BY ap.payment_date DESC`,
        [bookingId, tenantId]
      );

      res.json({
        success: true,
        data: {
          booking: {
            id: booking.id,
            booking_number: booking.booking_number,
            agreed_amount: parseFloat(booking.agreed_amount || 0),
            invoiced_amount: parseFloat(booking.invoiced_amount || 0),
            additional_amount: parseFloat(booking.additional_amount || 0),
            total_received: parseFloat(booking.invoiced_amount || 0) + parseFloat(booking.additional_amount || 0),
            status: booking.status
          },
          invoices,
          private_notes: privateNotes,
          additional_payments: additionalPayments,
          summary: {
            official_records: {
              invoiced: parseFloat(booking.invoiced_amount || 0),
              gst_reportable: parseFloat(booking.invoiced_amount || 0)
            },
            internal_tracking: {
              agreed_total: parseFloat(booking.agreed_amount || 0),
              additional_received: parseFloat(booking.additional_amount || 0),
              private_notes_count: privateNotes.length,
              undisclosed_payments: additionalPayments
                .filter((p: any) => !p.show_in_gst_reports)
                .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0)
            }
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching booking summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking summary',
        error: error.message
      });
    }
  }

  /**
   * Generate flexible GST report
   * POST /api/gst-reports/generate
   */
  static async generateGSTReport(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const {
        from_date,
        to_date,
        preferences = {}
      } = req.body;

      const {
        include_advance_receipts = true,
        include_non_taxable = false,
        include_security_deposits = false,
        b2c_threshold_only = false,
        exclude_complimentary = true
      } = preferences;

      // Get business details
      const [bizRows] = await pool.query<RowDataPacket[]>(
        `SELECT business_name, gstin, is_gst_registered, state, state_code
         FROM business_config WHERE tenant_id = ? LIMIT 1`,
        [tenantId]
      );
      const business = bizRows[0] || null;

      let query = `
        SELECT 
          i.id,
          i.invoice_number,
          i.invoice_type,
          DATE_FORMAT(i.invoice_date, '%Y-%m-%d') as invoice_date,
          i.customer_name,
          i.customer_gstin,
          i.customer_state,
          i.customer_state_code,
          i.supply_type,
          i.place_of_supply,
          i.place_of_supply_state_code,
          i.tax_mode,
          i.taxable_amount,
          i.cgst_amount,
          i.sgst_amount,
          i.igst_amount,
          i.total_tax,
          i.grand_total,
          i.status,
          i.booking_id
        FROM invoices i
        WHERE i.tenant_id = ? AND i.status NOT IN ('cancelled', 'void')
      `;

      const params: any[] = [tenantId];

      if (from_date) {
        query += ' AND i.invoice_date >= ?';
        params.push(from_date);
      }

      if (to_date) {
        query += ' AND i.invoice_date <= ?';
        params.push(to_date);
      }

      if (!include_advance_receipts) {
        query += " AND i.invoice_type != 'receipt_voucher'";
      }

      if (b2c_threshold_only) {
        query += ' AND i.grand_total > 250000';
      }

      query += ' ORDER BY i.invoice_date ASC, i.invoice_number ASC';

      const [invoices] = await pool.query<RowDataPacket[]>(query, params);

      // Fetch HSN / SAC summary for the selected period
      let hsnQuery = `
        SELECT 
          COALESCE(ili.sac_hsn, '998599') as sac_hsn,
          MAX(ili.description) as description,
          COUNT(ili.id) as line_count,
          SUM(ili.quantity) as total_quantity,
          MAX(ili.unit) as unit,
          SUM(ili.taxable_value) as taxable_value,
          SUM(ili.cgst_amount) as cgst_amount,
          SUM(ili.sgst_amount) as sgst_amount,
          SUM(ili.igst_amount) as igst_amount,
          SUM(ili.total_tax) as total_tax,
          SUM(ili.total_amount) as total_amount
        FROM invoice_line_items ili
        INNER JOIN invoices i ON i.id = ili.invoice_id
        WHERE i.tenant_id = ? AND i.status NOT IN ('cancelled', 'void')
      `;
      const hsnParams: any[] = [tenantId];
      if (from_date) {
        hsnQuery += ' AND i.invoice_date >= ?';
        hsnParams.push(from_date);
      }
      if (to_date) {
        hsnQuery += ' AND i.invoice_date <= ?';
        hsnParams.push(to_date);
      }
      hsnQuery += ' GROUP BY COALESCE(ili.sac_hsn, "998599") ORDER BY taxable_value DESC';

      const [hsnRows] = await pool.query<RowDataPacket[]>(hsnQuery, hsnParams);

      // Segment into GSTR-1 style groups
      const b2bInvoices = invoices.filter(
        (inv) =>
          inv.customer_gstin &&
          inv.customer_gstin.trim().length === 15 &&
          inv.invoice_type === 'tax_invoice'
      );

      const b2cLargeInvoices = invoices.filter(
        (inv) =>
          (!inv.customer_gstin || inv.customer_gstin.trim().length !== 15) &&
          inv.supply_type === 'interstate' &&
          Number(inv.grand_total || 0) > 250000 &&
          inv.invoice_type === 'tax_invoice'
      );

      const b2cSmallInvoices = invoices.filter(
        (inv) =>
          (!inv.customer_gstin || inv.customer_gstin.trim().length !== 15) &&
          !(inv.supply_type === 'interstate' && Number(inv.grand_total || 0) > 250000) &&
          inv.invoice_type === 'tax_invoice'
      );

      const creditDebitNotes = invoices.filter(
        (inv) => inv.invoice_type === 'credit_note' || inv.invoice_type === 'debit_note'
      );

      const otherVouchers = invoices.filter(
        (inv) => inv.invoice_type === 'receipt_voucher'
      );

      // Pre-export exception diagnostics
      const missingPosInvoices = invoices.filter(
        (inv) => !inv.place_of_supply_state_code || String(inv.place_of_supply_state_code).trim() === ''
      );

      const suspiciousGstinInvoices = invoices.filter(
        (inv) =>
          inv.customer_gstin &&
          inv.customer_gstin.trim().length > 0 &&
          inv.customer_gstin.trim().length !== 15
      );

      const diagnostics = {
        venue_gst_registered: Boolean(business?.is_gst_registered && business?.gstin),
        venue_gstin: business?.gstin || null,
        missing_place_of_supply_count: missingPosInvoices.length,
        missing_pos_invoice_numbers: missingPosInvoices.map((inv) => inv.invoice_number),
        suspicious_gstin_count: suspiciousGstinInvoices.length,
        suspicious_gstin_invoice_numbers: suspiciousGstinInvoices.map((inv) => inv.invoice_number),
      };

      // Calculate overall summary
      const summary = invoices.reduce((acc: any, inv: any) => ({
        total_invoices: acc.total_invoices + 1,
        total_taxable_value: Math.round((acc.total_taxable_value + parseFloat(inv.taxable_amount || 0)) * 100) / 100,
        total_cgst: Math.round((acc.total_cgst + parseFloat(inv.cgst_amount || 0)) * 100) / 100,
        total_sgst: Math.round((acc.total_sgst + parseFloat(inv.sgst_amount || 0)) * 100) / 100,
        total_igst: Math.round((acc.total_igst + parseFloat(inv.igst_amount || 0)) * 100) / 100,
        total_gst: Math.round((acc.total_gst + parseFloat(inv.total_tax || 0)) * 100) / 100,
        total_grand_total: Math.round((acc.total_grand_total + parseFloat(inv.grand_total || 0)) * 100) / 100,
      }), {
        total_invoices: 0,
        total_taxable_value: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        total_gst: 0,
        total_grand_total: 0,
      });

      res.json({
        success: true,
        data: {
          title: 'Accountant Review Export - GSTR-1 style grouping',
          period: `${from_date} to ${to_date}`,
          preferences,
          summary,
          sections: {
            b2b: {
              title: 'Table 4: Taxable outward supplies to registered persons (B2B)',
              count: b2bInvoices.length,
              invoices: b2bInvoices,
            },
            b2c_large: {
              title: 'Table 5: Taxable outward interstate supplies to unregistered persons > ₹2.5 Lakhs (B2CL)',
              count: b2cLargeInvoices.length,
              invoices: b2cLargeInvoices,
            },
            b2c_small: {
              title: 'Table 7: Taxable outward supplies to unregistered persons (B2CS)',
              count: b2cSmallInvoices.length,
              invoices: b2cSmallInvoices,
            },
            credit_debit_notes: {
              title: 'Table 9B: Credit / Debit Notes issued to registered & unregistered persons (CDNR/CDNUR)',
              count: creditDebitNotes.length,
              invoices: creditDebitNotes,
            },
            receipt_vouchers: {
              title: 'Table 11: Advance Receipts & Vouchers',
              count: otherVouchers.length,
              invoices: otherVouchers,
            },
            hsn_summary: {
              title: 'Table 12: HSN/SAC Summary of Outward Supplies',
              items: hsnRows,
            },
          },
          invoices,
          diagnostics,
          disclaimer:
            'Accountant Review Export - GSTR-1 style grouping. This document is provided for review, reconciliation, and audit by your Chartered Accountant. It is not an automated statutory filing with the GSTN portal.',
        }
      });
    } catch (error: any) {
      console.error('Error generating GST report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate GST report',
        error: error.message
      });
    }
  }

  /**
   * Update booking amounts
   * PUT /api/bookings/:id/amounts
   */
  static async updateBookingAmounts(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const bookingId = parseInt(req.params.id);
      const {
        agreed_amount,
        invoiced_amount,
        additional_amount
      } = req.body;

      await pool.query(
        `UPDATE bookings 
         SET agreed_amount = ?,
             invoiced_amount = ?,
             additional_amount = ?,
             updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [agreed_amount, invoiced_amount, additional_amount, bookingId, tenantId]
      );

      res.json({
        success: true,
        message: 'Booking amounts updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating booking amounts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update booking amounts',
        error: error.message
      });
    }
  }
}
