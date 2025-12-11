/**
 * Invoice Routes
 */

import { Router } from 'express';
import InvoiceController from '../controllers/InvoiceController';

const router = Router();

// Auth is already applied in routes/index.ts, no need to apply again

// GET /api/invoices/summary - Get invoice summary (must be before /:id)
router.get('/summary', InvoiceController.getInvoiceSummary.bind(InvoiceController));

// GET /api/invoices/generate-number/:type - Generate invoice number (must be before /:id)
router.get('/generate-number/:type', InvoiceController.generateInvoiceNumber.bind(InvoiceController));

// GET /api/invoices/number/:invoiceNumber - Get by invoice number (must be before /:id)
router.get('/number/:invoiceNumber', InvoiceController.getInvoiceByNumber.bind(InvoiceController));

// GET /api/invoices/booking/:bookingId - Get invoices for booking (must be before /:id)
router.get('/booking/:bookingId', InvoiceController.getInvoicesByBooking.bind(InvoiceController));

// GET /api/invoices/customer/:customerId - Get invoices for customer (must be before /:id)
router.get('/customer/:customerId', InvoiceController.getInvoicesByCustomer.bind(InvoiceController));

// GET /api/invoices - Get all invoices with filters
router.get('/', InvoiceController.getAllInvoices.bind(InvoiceController));

// GET /api/invoices/:id - Get invoice by ID
router.get('/:id', InvoiceController.getInvoiceById.bind(InvoiceController));

// POST /api/invoices - Create new invoice
router.post('/', InvoiceController.createInvoice.bind(InvoiceController));

// POST /api/invoices/payment - Record payment
router.post('/payment', InvoiceController.recordPayment.bind(InvoiceController));

// PUT /api/invoices/:id - Update invoice
router.put('/:id', InvoiceController.updateInvoice.bind(InvoiceController));

// POST /api/invoices/:id/issue - Issue invoice
router.post('/:id/issue', InvoiceController.issueInvoice.bind(InvoiceController));

// POST /api/invoices/:id/cancel - Cancel invoice
router.post('/:id/cancel', InvoiceController.cancelInvoice.bind(InvoiceController));

export default router;
