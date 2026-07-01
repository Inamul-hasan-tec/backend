/**
 * Invoice Routes
 * Protected with RBAC permissions
 */

import { Router } from 'express';
import InvoiceController from '../controllers/InvoiceController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = Router();

// GET routes - Require VIEW permission
router.get('/summary', 
  requirePermission(Permission.INVOICE_VIEW),
  InvoiceController.getInvoiceSummary.bind(InvoiceController)
);

router.get('/generate-number/:type', 
  requirePermission(Permission.INVOICE_CREATE),
  InvoiceController.generateInvoiceNumber.bind(InvoiceController)
);

router.get('/number/:invoiceNumber', 
  requirePermission(Permission.INVOICE_VIEW),
  InvoiceController.getInvoiceByNumber.bind(InvoiceController)
);

router.get('/booking/:bookingId', 
  requirePermission(Permission.INVOICE_LIST),
  InvoiceController.getInvoicesByBooking.bind(InvoiceController)
);

router.get('/customer/:customerId', 
  requirePermission(Permission.INVOICE_LIST),
  InvoiceController.getInvoicesByCustomer.bind(InvoiceController)
);

router.get('/', 
  requirePermission(Permission.INVOICE_LIST),
  InvoiceController.getAllInvoices.bind(InvoiceController)
);

router.get('/:id', 
  requirePermission(Permission.INVOICE_VIEW),
  InvoiceController.getInvoiceById.bind(InvoiceController)
);

// POST routes - Require CREATE permission
router.post('/', 
  requirePermission(Permission.INVOICE_CREATE),
  InvoiceController.createInvoice.bind(InvoiceController)
);

router.post('/payment', 
  requirePermission(Permission.PAYMENT_CREATE),
  InvoiceController.recordPayment.bind(InvoiceController)
);

// PUT routes - Require UPDATE permission
router.put('/:id', 
  requirePermission(Permission.INVOICE_UPDATE),
  InvoiceController.updateInvoice.bind(InvoiceController)
);

// Action routes - Require specific permissions
router.post('/:id/issue', 
  requirePermission(Permission.INVOICE_GENERATE),
  InvoiceController.issueInvoice.bind(InvoiceController)
);

router.post('/:id/cancel', 
  requirePermission(Permission.INVOICE_UPDATE),
  InvoiceController.cancelInvoice.bind(InvoiceController)
);

router.get('/:id/pdf', 
  requirePermission(Permission.INVOICE_GENERATE),
  InvoiceController.downloadInvoicePDF.bind(InvoiceController)
);

router.post('/:id/email', 
  requirePermission(Permission.INVOICE_GENERATE),
  InvoiceController.emailInvoice.bind(InvoiceController)
);

export default router;
