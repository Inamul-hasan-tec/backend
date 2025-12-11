import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class FlexibleBillingController {
  /**
   * Add private note to booking
   * POST /api/bookings/:id/private-notes
   */
  static async addPrivateNote(req: Request, res: Response) {
    try {
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
      const bookingId = parseInt(req.params.id);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM booking_private_notes 
         WHERE booking_id = ? 
         ORDER BY created_at DESC`,
        [bookingId]
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
      const noteId = parseInt(req.params.id);

      await pool.query(
        'DELETE FROM booking_private_notes WHERE id = ?',
        [noteId]
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
         WHERE id = ?`,
        [amount, bookingId]
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
      const bookingId = parseInt(req.params.id);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM additional_payments 
         WHERE booking_id = ? 
         ORDER BY payment_date DESC`,
        [bookingId]
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
    try {
      // Check if we should filter by active only
      const activeOnly = req.query.active_only === 'true';
      
      let query = 'SELECT * FROM discount_templates';
      
      if (activeOnly) {
        query += ' WHERE is_active = 1';
      }
      
      query += ' ORDER BY name';

      const [rows] = await pool.query<RowDataPacket[]>(query);

      res.json({
        success: true,
        data: rows
      });
    } catch (error: any) {
      console.error('Error fetching discount templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch discount templates',
        error: error.message
      });
    }
  }

  /**
   * Create discount template
   * POST /api/discount-templates
   */
  static async createDiscountTemplate(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        discount_type,
        discount_value,
        reason_template
      } = req.body;

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO discount_templates 
         (name, description, discount_type, discount_value, reason_template)
         VALUES (?, ?, ?, ?, ?)`,
        [name, description, discount_type, discount_value, reason_template]
      );

      res.status(201).json({
        success: true,
        message: 'Discount template created successfully',
        data: {
          id: result.insertId
        }
      });
    } catch (error: any) {
      console.error('Error creating discount template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create discount template',
        error: error.message
      });
    }
  }

  /**
   * Update discount template
   * PUT /api/discount-templates/:id
   */
  static async updateDiscountTemplate(req: Request, res: Response) {
    try {
      const templateId = parseInt(req.params.id);
      const {
        name,
        description,
        discount_type,
        discount_value,
        reason_template,
        is_active
      } = req.body;

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (discount_type !== undefined) {
        updates.push('discount_type = ?');
        values.push(discount_type);
      }
      if (discount_value !== undefined) {
        updates.push('discount_value = ?');
        values.push(discount_value);
      }
      if (reason_template !== undefined) {
        updates.push('reason_template = ?');
        values.push(reason_template);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      values.push(templateId);

      await pool.query(
        `UPDATE discount_templates 
         SET ${updates.join(', ')}
         WHERE id = ?`,
        values
      );

      res.json({
        success: true,
        message: 'Discount template updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating discount template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update discount template',
        error: error.message
      });
    }
  }

  /**
   * Delete discount template
   * DELETE /api/discount-templates/:id
   */
  static async deleteDiscountTemplate(req: Request, res: Response) {
    try {
      const templateId = parseInt(req.params.id);

      await pool.query(
        'DELETE FROM discount_templates WHERE id = ?',
        [templateId]
      );

      res.json({
        success: true,
        message: 'Discount template deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting discount template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete discount template',
        error: error.message
      });
    }
  }

  /**
   * Get booking summary (actual vs invoiced)
   * GET /api/bookings/:id/summary
   */
  static async getBookingSummary(req: Request, res: Response) {
    try {
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
         WHERE id = ?`,
        [bookingId]
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
         WHERE booking_id = ?
         ORDER BY created_at DESC`,
        [bookingId]
      );

      // Get private notes
      const [privateNotes] = await pool.query<RowDataPacket[]>(
        `SELECT 
          note_type,
          amount,
          description,
          created_at
         FROM booking_private_notes 
         WHERE booking_id = ? AND is_private = 1
         ORDER BY created_at DESC`,
        [bookingId]
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
         FROM additional_payments 
         WHERE booking_id = ?
         ORDER BY payment_date DESC`,
        [bookingId]
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

      let query = `
        SELECT 
          i.id,
          i.invoice_number,
          i.invoice_type,
          i.invoice_date,
          i.customer_name,
          i.customer_gstin,
          i.taxable_amount,
          i.cgst_amount,
          i.sgst_amount,
          i.igst_amount,
          i.total_tax,
          i.grand_total,
          i.billing_strategy,
          i.complimentary_value
        FROM invoices i
        WHERE i.status != 'cancelled'
      `;

      const params: any[] = [];

      if (from_date) {
        query += ' AND i.invoice_date >= ?';
        params.push(from_date);
      }

      if (to_date) {
        query += ' AND i.invoice_date <= ?';
        params.push(to_date);
      }

      // Apply filters based on preferences
      if (!include_advance_receipts) {
        query += " AND i.invoice_type != 'receipt_voucher'";
      }

      if (exclude_complimentary) {
        query += ' AND (i.complimentary_value IS NULL OR i.complimentary_value = 0)';
      }

      if (b2c_threshold_only) {
        query += ' AND i.grand_total > 250000'; // B2C threshold
      }

      query += ' ORDER BY i.invoice_date, i.invoice_number';

      const [invoices] = await pool.query<RowDataPacket[]>(query, params);

      // Calculate summary
      const summary = invoices.reduce((acc: any, inv: any) => ({
        total_invoices: acc.total_invoices + 1,
        total_taxable_value: acc.total_taxable_value + parseFloat(inv.taxable_amount || 0),
        total_cgst: acc.total_cgst + parseFloat(inv.cgst_amount || 0),
        total_sgst: acc.total_sgst + parseFloat(inv.sgst_amount || 0),
        total_igst: acc.total_igst + parseFloat(inv.igst_amount || 0),
        total_gst: acc.total_gst + parseFloat(inv.total_tax || 0)
      }), {
        total_invoices: 0,
        total_taxable_value: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        total_gst: 0
      });

      res.json({
        success: true,
        data: {
          period: `${from_date} to ${to_date}`,
          preferences,
          summary,
          invoices,
          disclaimer: 'This report is generated based on your invoice records. Please consult your CA for GST filing compliance.'
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
         WHERE id = ?`,
        [agreed_amount, invoiced_amount, additional_amount, bookingId]
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
