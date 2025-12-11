/**
 * Slot Controller
 * Handles HTTP requests for slot management
 */

import { Request, Response } from 'express';
import { SlotService } from '../services/SlotService';

const slotService = new SlotService();

/**
 * GET /api/slots/:year/:month
 * Get all slots for a specific month
 * Query params: hall_id (optional)
 */
export const getSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month } = req.params;
    const { hall_id } = req.query;

    // Validate parameters
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid year or month parameter'
      });
      return;
    }

    if (monthNum < 1 || monthNum > 12) {
      res.status(400).json({
        success: false,
        message: 'Month must be between 1 and 12'
      });
      return;
    }

    const hallIdNum = hall_id ? parseInt(hall_id as string) : undefined;

    const slots = await slotService.getSlotsByMonth(yearNum, monthNum, hallIdNum);

    res.json({
      success: true,
      message: 'Slots retrieved successfully',
      data: slots
    });
  } catch (error) {
    console.error('Error in getSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve slots',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * PUT /api/slots/:id
 * Update slot status
 * Body: { status: 'available'|'booked'|'blocked', booking_id?: number }
 */
export const updateSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, booking_id } = req.body;

    const slotId = parseInt(id);

    if (isNaN(slotId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid slot ID'
      });
      return;
    }

    // Validate status
    const validStatuses = ['available', 'booked', 'blocked'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: available, booked, or blocked'
      });
      return;
    }

    // Check if slot exists
    const slot = await slotService.getSlotById(slotId);
    if (!slot) {
      res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
      return;
    }

    await slotService.updateSlotStatus(slotId, status, booking_id);

    res.json({
      success: true,
      message: 'Slot updated successfully'
    });
  } catch (error) {
    console.error('Error in updateSlot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update slot',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * POST /api/slots/generate
 * Generate slots for a month or all halls
 * Body: { year, month, hall_id } or { months }
 */
export const generateSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month, hall_id, months } = req.body;

    // Generate for all halls for N months
    if (months) {
      const monthsNum = parseInt(months);
      if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 12) {
        res.status(400).json({
          success: false,
          message: 'Months must be between 1 and 12'
        });
        return;
      }

      const result = await slotService.generateSlotsForAllHalls(monthsNum);

      res.json({
        success: true,
        message: `Generated slots for ${result.hallsProcessed} halls`,
        data: result
      });
      return;
    }

    // Generate for specific month and hall
    if (!year || !month || !hall_id) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: year, month, hall_id'
      });
      return;
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const hallIdNum = parseInt(hall_id);

    if (isNaN(yearNum) || isNaN(monthNum) || isNaN(hallIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid parameters'
      });
      return;
    }

    const slotsCreated = await slotService.generateSlotsForMonth(yearNum, monthNum, hallIdNum);

    res.json({
      success: true,
      message: `Generated ${slotsCreated} slots`,
      data: { slotsCreated }
    });
  } catch (error) {
    console.error('Error in generateSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate slots',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/slots/available
 * Get available slots for a date range
 * Query params: hall_id, date_from, date_to
 */
export const getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hall_id, date_from, date_to } = req.query;

    if (!hall_id || !date_from || !date_to) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: hall_id, date_from, date_to'
      });
      return;
    }

    const hallIdNum = parseInt(hall_id as string);

    if (isNaN(hallIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid hall_id'
      });
      return;
    }

    const slots = await slotService.getAvailableSlots(
      hallIdNum,
      date_from as string,
      date_to as string
    );

    res.json({
      success: true,
      message: 'Available slots retrieved successfully',
      data: slots
    });
  } catch (error) {
    console.error('Error in getAvailableSlots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve available slots',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * POST /api/slots/:id/block
 * Block or unblock a slot
 * Body: { block: boolean, notes?: string }
 */
export const blockSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { block, notes } = req.body;

    const slotId = parseInt(id);

    if (isNaN(slotId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid slot ID'
      });
      return;
    }

    if (typeof block !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'Block parameter must be a boolean'
      });
      return;
    }

    await slotService.blockSlot(slotId, block, notes);

    res.json({
      success: true,
      message: `Slot ${block ? 'blocked' : 'unblocked'} successfully`
    });
  } catch (error) {
    console.error('Error in blockSlot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block/unblock slot',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
