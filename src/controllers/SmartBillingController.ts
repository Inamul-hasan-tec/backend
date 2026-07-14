import { Request, Response } from 'express';
import { SmartBillingCalculator } from '../utils/SmartBillingCalculator';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2';
import { getTenantId } from '../utils/tenantContext';

export class SmartBillingController {
  /**
   * Generate billing preview
   * POST /api/smart-billing/preview
   */
  static async generatePreview(req: Request, res: Response) {
    try {
      const {
        total_amount,
        supply_type = 'intrastate',
        billing_strategy = 'optimized'
      } = req.body;

      if (!total_amount || total_amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid total amount is required'
        });
      }

      const result = SmartBillingCalculator.calculateOptimizedBilling(
        parseFloat(total_amount),
        supply_type,
        billing_strategy
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error generating billing preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate billing preview',
        error: error.message
      });
    }
  }

  /**
   * Generate dual quotation (comparison)
   * POST /api/smart-billing/dual-quotation
   */
  static async generateDualQuotation(req: Request, res: Response) {
    try {
      const {
        total_amount,
        supply_type = 'intrastate'
      } = req.body;

      if (!total_amount || total_amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid total amount is required'
        });
      }

      const result = SmartBillingCalculator.generateDualQuotation(
        parseFloat(total_amount),
        supply_type
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error generating dual quotation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate dual quotation',
        error: error.message
      });
    }
  }

  /**
   * Get business billing configuration
   * GET /api/smart-billing/config
   */
  static async getConfig(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          billing_mode,
          composite_scheme_enabled,
          enable_tax_optimization,
          annual_turnover
        FROM business_config
        WHERE tenant_id = ?
        LIMIT 1`,
        [tenantId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Business configuration not found'
        });
      }

      res.json({
        success: true,
        data: rows[0]
      });
    } catch (error: any) {
      console.error('Error fetching billing config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch billing configuration',
        error: error.message
      });
    }
  }

  /**
   * Update business billing configuration
   * PUT /api/smart-billing/config
   */
  static async updateConfig(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const {
        billing_mode,
        composite_scheme_enabled,
        enable_tax_optimization
      } = req.body;

      await pool.query(
        `UPDATE business_config 
         SET billing_mode = ?,
             composite_scheme_enabled = ?,
             enable_tax_optimization = ?,
             updated_at = NOW()
         WHERE tenant_id = ?`,
        [billing_mode, composite_scheme_enabled, enable_tax_optimization, tenantId]
      );

      res.json({
        success: true,
        message: 'Billing configuration updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating billing config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update billing configuration',
        error: error.message
      });
    }
  }

  /**
   * Get tax optimization report
   * GET /api/smart-billing/tax-report
   */
  static async getTaxReport(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const { from_date, to_date } = req.query;

      let query = `
        SELECT 
          billing_strategy,
          COUNT(*) as invoice_count,
          SUM(grand_total) as total_revenue,
          SUM(total_tax) as total_tax_collected,
          SUM(tax_savings) as total_tax_saved,
          AVG(effective_gst_rate) as avg_effective_rate
        FROM invoices
        WHERE tenant_id = ? AND status != 'cancelled'
      `;

      const params: any[] = [tenantId];

      if (from_date) {
        query += ' AND invoice_date >= ?';
        params.push(from_date);
      }

      if (to_date) {
        query += ' AND invoice_date <= ?';
        params.push(to_date);
      }

      query += ' GROUP BY billing_strategy';

      const [rows] = await pool.query<RowDataPacket[]>(query, params);

      // Calculate totals
      const totals = rows.reduce((acc: any, row: any) => ({
        total_invoices: acc.total_invoices + row.invoice_count,
        total_revenue: acc.total_revenue + parseFloat(row.total_revenue || 0),
        total_tax: acc.total_tax + parseFloat(row.total_tax_collected || 0),
        total_savings: acc.total_savings + parseFloat(row.total_tax_saved || 0)
      }), {
        total_invoices: 0,
        total_revenue: 0,
        total_tax: 0,
        total_savings: 0
      });

      res.json({
        success: true,
        data: {
          by_strategy: rows,
          totals
        }
      });
    } catch (error: any) {
      console.error('Error generating tax report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate tax report',
        error: error.message
      });
    }
  }

  /**
   * Get available reimbursement services
   * GET /api/smart-billing/reimbursement-services
   */
  static async getReimbursementServices(req: Request, res: Response) {
    try {
      const tenantId = getTenantId();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          service_code,
          name,
          description,
          sac_code,
          gst_rate,
          is_taxable,
          tax_exemption_reason
        FROM service_catalog
        WHERE tenant_id = ? AND is_taxable = 0 AND is_active = 1
        ORDER BY name`,
        [tenantId]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (error: any) {
      console.error('Error fetching reimbursement services:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reimbursement services',
        error: error.message
      });
    }
  }
}
