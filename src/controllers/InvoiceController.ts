/**
 * Invoice Controller
 * Handles HTTP requests for invoice management
 */

import { Request, Response } from 'express';
import InvoiceRepository from '../repositories/InvoiceRepository';
import { CreateInvoiceDTO, UpdateInvoiceDTO, InvoiceFilters, RecordPaymentDTO } from '../models/Invoice';
import InvoicePDFService from '../services/InvoicePDFService';
import InvoiceEmailService, {
  EmailConfigurationError,
} from '../services/InvoiceEmailService';
import AuditRepository from '../repositories/AuditRepository';

export class InvoiceController {
  /**
   * GET /api/invoices
   * Get all invoices with filters
   */
  async getAllInvoices(req: Request, res: Response): Promise<void> {
    try {
      const filters: InvoiceFilters = {
        invoice_type: req.query.invoice_type as any,
        status: req.query.status as any,
        customer_id: req.query.customer_id ? parseInt(req.query.customer_id as string) : undefined,
        booking_id: req.query.booking_id ? parseInt(req.query.booking_id as string) : undefined,
        from_date: req.query.from_date ? new Date(req.query.from_date as string) : undefined,
        to_date: req.query.to_date ? new Date(req.query.to_date as string) : undefined,
        search: req.query.search as string,
      };

      const invoices = await InvoiceRepository.getAllInvoices(filters);

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/summary
   * Get invoice statistics
   */
  async getInvoiceSummary(req: Request, res: Response): Promise<void> {
    try {
      const filters: InvoiceFilters = {
        from_date: req.query.from_date ? new Date(req.query.from_date as string) : undefined,
        to_date: req.query.to_date ? new Date(req.query.to_date as string) : undefined,
      };

      const summary = await InvoiceRepository.getSummary(filters);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching invoice summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/:id
   * Get invoice by ID
   */
  async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoice = await InvoiceRepository.getInvoiceById(parseInt(id));

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/number/:invoiceNumber
   * Get invoice by invoice number
   */
  async getInvoiceByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceNumber } = req.params;
      const invoice = await InvoiceRepository.getByInvoiceNumber(invoiceNumber);

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/booking/:bookingId
   * Get invoices for a booking
   */
  async getInvoicesByBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const invoices = await InvoiceRepository.getAllInvoices({ booking_id: parseInt(bookingId) });

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/customer/:customerId
   * Get invoices for a customer
   */
  async getInvoicesByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const invoices = await InvoiceRepository.getAllInvoices({ customer_id: parseInt(customerId) });

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/invoices
   * Create new invoice
   */
  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const invoiceData: CreateInvoiceDTO = req.body;

      // Validate required fields
      if (!invoiceData.invoice_type || !invoiceData.customer_id || !invoiceData.line_items || invoiceData.line_items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: invoice_type, customer_id, line_items',
        });
        return;
      }

      // Get user ID from auth middleware
      const userId = (req as any).user?.id || 1;

      const invoiceId = await InvoiceRepository.createInvoice(invoiceData, userId);
      const invoice = await InvoiceRepository.getInvoiceById(invoiceId);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice,
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Business configuration not found') {
        res.status(409).json({
          success: false,
          message: 'Invoice setup incomplete. Please complete the business profile before creating invoices.',
          error: errorMessage,
          setup_required: true,
          missing: ['business_profile'],
        });
        return;
      }

      if (errorMessage === 'Business GST state code must be configured before creating invoices') {
        res.status(409).json({
          success: false,
          message: 'Invoice setup incomplete. Please configure the business GST state code before creating invoices.',
          error: errorMessage,
          setup_required: true,
          missing: ['state_code'],
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create invoice',
        error: errorMessage,
      });
    }
  }

  /**
   * PUT /api/invoices/:id
   * Update invoice
   */
  async updateInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateInvoiceDTO = req.body;

      const updated = await InvoiceRepository.updateInvoice(parseInt(id), updateData);

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found or no changes made',
        });
        return;
      }

      const invoice = await InvoiceRepository.getInvoiceById(parseInt(id));

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: invoice,
      });
    } catch (error) {
      console.error('Error updating invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update invoice',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/invoices/:id/issue
   * Issue invoice (change from draft to issued)
   */
  async issueInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const issued = await InvoiceRepository.issue(parseInt(id));

      if (!issued) {
        res.status(400).json({
          success: false,
          message: 'Invoice not found or already issued',
        });
        return;
      }

      const invoice = await InvoiceRepository.getInvoiceById(parseInt(id));

      res.json({
        success: true,
        message: 'Invoice issued successfully',
        data: invoice,
      });
    } catch (error) {
      console.error('Error issuing invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to issue invoice',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/invoices/:id/cancel
   * Cancel invoice
   */
  async cancelInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({
          success: false,
          message: 'Cancellation reason is required',
        });
        return;
      }

      const cancelled = await InvoiceRepository.cancel(parseInt(id), reason);

      if (!cancelled) {
        res.status(400).json({
          success: false,
          message: 'Invoice not found or cannot be cancelled',
        });
        return;
      }

      const invoice = await InvoiceRepository.getInvoiceById(parseInt(id));

      res.json({
        success: true,
        message: 'Invoice cancelled successfully',
        data: invoice,
      });
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel invoice',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/invoices/payment
   * Record payment against invoice(s)
   */
  async recordPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentData: RecordPaymentDTO = req.body;
      paymentData.received_by = req.user?.id || null;
      paymentData.idempotency_key =
        String(req.headers['idempotency-key'] || req.body.idempotency_key || '').trim() || null;
      if (!paymentData.allocations && req.body.invoice_id && req.body.amount) {
        paymentData.allocations = [
          {
            invoice_id: parseInt(req.body.invoice_id),
            amount: Number(req.body.amount),
          },
        ];
      }

      // Validate required fields
      if (!paymentData.payment_date || !paymentData.amount || !paymentData.payment_mode || !paymentData.allocations || paymentData.allocations.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: payment_date, amount, payment_mode, invoice allocation',
        });
        return;
      }
      if (
        ['upi', 'bank_transfer', 'cheque', 'card'].includes(paymentData.payment_mode) &&
        !paymentData.transaction_reference
      ) {
        res.status(400).json({
          success: false,
          message: 'Transaction reference is required for this payment mode',
        });
        return;
      }

      // Validate total allocation matches payment amount
      const totalAllocated = paymentData.allocations.reduce((sum, a) => sum + a.amount, 0);
      if (Math.abs(totalAllocated - paymentData.amount) > 0.01) {
        res.status(400).json({
          success: false,
          message: 'Total allocated amount must match payment amount',
        });
        return;
      }

      const paymentId = await InvoiceRepository.recordPayment(paymentData);
      await AuditRepository.recordTenant({
        actorUserId: req.user?.id,
        action: 'payment.recorded_from_invoice',
        entityType: 'payment',
        entityId: paymentId,
        newValues: {
          amount: paymentData.amount,
          payment_mode: paymentData.payment_mode,
          payment_date: paymentData.payment_date,
          allocations: paymentData.allocations,
          idempotency_key: paymentData.idempotency_key ? '[PRESENT]' : null,
        },
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: { payment_id: paymentId },
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/generate-number/:type
   * Generate next invoice number (for preview)
   */
  async generateInvoiceNumber(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const invoiceNumber = await InvoiceRepository.generateInvoiceNumber(type);

      res.json({
        success: true,
        data: { invoice_number: invoiceNumber },
      });
    } catch (error) {
      console.error('Error generating invoice number:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice number',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/invoices/:id/pdf
   * Download invoice as PDF
   */
  async downloadInvoicePDF(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoice = await InvoiceRepository.getInvoiceById(parseInt(id));

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      const pdf = await InvoicePDFService.generate(invoice);
      const safeInvoiceNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeInvoiceNumber}.pdf"`
      );
      res.setHeader('Content-Length', pdf.length.toString());
      res.send(pdf);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/invoices/:id/email
   * Email invoice to customer
   */
  async emailInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const invoice = await InvoiceRepository.getInvoiceById(parseInt(id));

      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }

      if (!['issued', 'paid', 'partially_paid'].includes(invoice.status)) {
        res.status(400).json({
          success: false,
          message: 'Only issued invoices can be emailed',
        });
        return;
      }
      if (!invoice.customer_email) {
        res.status(400).json({
          success: false,
          message: 'Customer email address is required',
        });
        return;
      }

      const pdf = await InvoicePDFService.generate(invoice);
      const emailService = new InvoiceEmailService();
      await emailService.sendInvoice(invoice, pdf);
      res.json({
        success: true,
        message: 'Invoice emailed successfully',
        data: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_email: invoice.customer_email,
        },
      });
    } catch (error) {
      console.error('Error sending email:', error);
      const status = error instanceof EmailConfigurationError ? 503 : 500;
      res.status(status).json({
        success: false,
        message:
          error instanceof EmailConfigurationError
            ? error.message
            : 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default new InvoiceController();
