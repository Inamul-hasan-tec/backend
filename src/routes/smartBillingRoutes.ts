import express from 'express';
import { SmartBillingController } from '../controllers/SmartBillingController';
import { auth } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @route   POST /api/smart-billing/preview
 * @desc    Generate billing preview with tax optimization
 * @access  Private
 */
router.post('/preview', SmartBillingController.generatePreview);

/**
 * @route   POST /api/smart-billing/dual-quotation
 * @desc    Generate dual quotation (Standard vs Optimized vs Composite)
 * @access  Private
 */
router.post('/dual-quotation', SmartBillingController.generateDualQuotation);

/**
 * @route   GET /api/smart-billing/config
 * @desc    Get business billing configuration
 * @access  Private
 */
router.get('/config', SmartBillingController.getConfig);

/**
 * @route   PUT /api/smart-billing/config
 * @desc    Update business billing configuration
 * @access  Private
 */
router.put('/config', SmartBillingController.updateConfig);

/**
 * @route   GET /api/smart-billing/tax-report
 * @desc    Get tax optimization report
 * @access  Private
 */
router.get('/tax-report', SmartBillingController.getTaxReport);

/**
 * @route   GET /api/smart-billing/reimbursement-services
 * @desc    Get available reimbursement services
 * @access  Private
 */
router.get('/reimbursement-services', SmartBillingController.getReimbursementServices);

export default router;
