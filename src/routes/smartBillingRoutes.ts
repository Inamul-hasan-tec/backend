import express from 'express';
import { SmartBillingController } from '../controllers/SmartBillingController';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @route   POST /api/smart-billing/preview
 * @desc    Generate billing preview with tax optimization
 * @access  Private
 */
router.post('/preview', requirePermission(Permission.INVOICE_CREATE), SmartBillingController.generatePreview);

/**
 * @route   POST /api/smart-billing/dual-quotation
 * @desc    Generate dual quotation (Standard vs Optimized vs Composite)
 * @access  Private
 */
router.post('/dual-quotation', requirePermission(Permission.INVOICE_CREATE), SmartBillingController.generateDualQuotation);

/**
 * @route   GET /api/smart-billing/config
 * @desc    Get business billing configuration
 * @access  Private
 */
router.get('/config', requirePermission(Permission.SETTINGS_VIEW), SmartBillingController.getConfig);

/**
 * @route   PUT /api/smart-billing/config
 * @desc    Update business billing configuration
 * @access  Private
 */
router.put('/config', requirePermission(Permission.SETTINGS_UPDATE), SmartBillingController.updateConfig);

/**
 * @route   GET /api/smart-billing/tax-report
 * @desc    Get tax optimization report
 * @access  Private
 */
router.get('/tax-report', requirePermission(Permission.REPORT_VIEW), SmartBillingController.getTaxReport);

/**
 * @route   GET /api/smart-billing/reimbursement-services
 * @desc    Get available reimbursement services
 * @access  Private
 */
router.get('/reimbursement-services', requirePermission(Permission.INVOICE_VIEW), SmartBillingController.getReimbursementServices);

export default router;
