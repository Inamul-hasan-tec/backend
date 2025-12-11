/**
 * Business Configuration Controller
 * Handles HTTP requests for business configuration
 */

import { Request, Response } from 'express';
import BusinessConfigRepository from '../repositories/BusinessConfigRepository';
import { UpdateBusinessConfigDTO } from '../models/BusinessConfig';

export class BusinessConfigController {
  /**
   * GET /api/business-config
   * Get active business configuration
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = await BusinessConfigRepository.getActiveConfig();

      if (!config) {
        res.status(404).json({
          success: false,
          message: 'Business configuration not found. Please complete setup.',
        });
        return;
      }

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error('Error fetching business config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch business configuration',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * PUT /api/business-config/:id
   * Update business configuration
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateBusinessConfigDTO = req.body;

      // Validate GSTIN format if provided
      if (updateData.gstin) {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(updateData.gstin)) {
          res.status(400).json({
            success: false,
            message: 'Invalid GSTIN format',
          });
          return;
        }

        // Check if GSTIN is unique
        const isUnique = await BusinessConfigRepository.isGstinUnique(
          updateData.gstin,
          parseInt(id)
        );

        if (!isUnique) {
          res.status(400).json({
            success: false,
            message: 'GSTIN already exists',
          });
          return;
        }
      }

      // Validate PAN format if provided
      if (updateData.pan) {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(updateData.pan)) {
          res.status(400).json({
            success: false,
            message: 'Invalid PAN format',
          });
          return;
        }
      }

      // Validate state code
      if (updateData.state_code) {
        const stateCode = parseInt(updateData.state_code);
        if (isNaN(stateCode) || stateCode < 1 || stateCode > 38) {
          res.status(400).json({
            success: false,
            message: 'Invalid state code. Must be between 01 and 38',
          });
          return;
        }
      }

      const updated = await BusinessConfigRepository.update(parseInt(id), updateData);

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Business configuration not found',
        });
        return;
      }

      // Fetch updated config
      const config = await BusinessConfigRepository.getById(parseInt(id));

      res.json({
        success: true,
        message: 'Business configuration updated successfully',
        data: config,
      });
    } catch (error) {
      console.error('Error updating business config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update business configuration',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/business-config/validate-gstin/:gstin
   * Validate GSTIN format
   */
  async validateGstin(req: Request, res: Response): Promise<void> {
    try {
      const { gstin } = req.params;

      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      const isValidFormat = gstinRegex.test(gstin);

      if (!isValidFormat) {
        res.json({
          success: false,
          valid: false,
          message: 'Invalid GSTIN format',
        });
        return;
      }

      const isUnique = await BusinessConfigRepository.isGstinUnique(gstin);

      res.json({
        success: true,
        valid: isValidFormat && isUnique,
        message: isUnique ? 'GSTIN is valid and available' : 'GSTIN already exists',
      });
    } catch (error) {
      console.error('Error validating GSTIN:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate GSTIN',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/business-config/state-codes
   * Get list of Indian state codes
   */
  async getStateCodes(req: Request, res: Response): Promise<void> {
    const stateCodes = [
      { code: '01', name: 'Jammu and Kashmir' },
      { code: '02', name: 'Himachal Pradesh' },
      { code: '03', name: 'Punjab' },
      { code: '04', name: 'Chandigarh' },
      { code: '05', name: 'Uttarakhand' },
      { code: '06', name: 'Haryana' },
      { code: '07', name: 'Delhi' },
      { code: '08', name: 'Rajasthan' },
      { code: '09', name: 'Uttar Pradesh' },
      { code: '10', name: 'Bihar' },
      { code: '11', name: 'Sikkim' },
      { code: '12', name: 'Arunachal Pradesh' },
      { code: '13', name: 'Nagaland' },
      { code: '14', name: 'Manipur' },
      { code: '15', name: 'Mizoram' },
      { code: '16', name: 'Tripura' },
      { code: '17', name: 'Meghalaya' },
      { code: '18', name: 'Assam' },
      { code: '19', name: 'West Bengal' },
      { code: '20', name: 'Jharkhand' },
      { code: '21', name: 'Odisha' },
      { code: '22', name: 'Chhattisgarh' },
      { code: '23', name: 'Madhya Pradesh' },
      { code: '24', name: 'Gujarat' },
      { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
      { code: '27', name: 'Maharashtra' },
      { code: '29', name: 'Karnataka' },
      { code: '30', name: 'Goa' },
      { code: '31', name: 'Lakshadweep' },
      { code: '32', name: 'Kerala' },
      { code: '33', name: 'Tamil Nadu' },
      { code: '34', name: 'Puducherry' },
      { code: '35', name: 'Andaman and Nicobar Islands' },
      { code: '36', name: 'Telangana' },
      { code: '37', name: 'Andhra Pradesh' },
      { code: '38', name: 'Ladakh' },
    ];

    res.json({
      success: true,
      data: stateCodes,
    });
  }
}

export default new BusinessConfigController();
