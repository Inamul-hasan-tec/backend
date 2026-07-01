/**
 * Slot Service
 * Business logic for hall availability slots
 */

import { RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { SlotRepository } from '../repositories/SlotRepository';
import { Slot, SlotWithBookingDetails, CreateSlotDTO, UpdateSlotDTO } from '../models/Slot';
import { getTenantId } from '../utils/tenantContext';

export class SlotService {
  private slotRepository: SlotRepository;

  constructor() {
    this.slotRepository = new SlotRepository();
  }

  /**
   * Get slots for a specific month with booking details
   * This is the main method used by the Calendar component
   */
  async getSlotsByMonth(
    year: number,
    month: number,
    hallId?: number
  ): Promise<SlotWithBookingDetails[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT 
        s.id,
        s.hall_id,
        DATE_FORMAT(s.slot_date, '%Y-%m-%d') as date,
        s.slot_type,
        s.status,
        s.booking_id,
        s.notes,
        b.id as booking_id,
        c.name as customer_name,
        p.name as package_name,
        b.total_amount,
        b.advance_amount as advance_paid
      FROM slots s
      LEFT JOIN bookings b ON s.booking_id = b.id AND b.tenant_id = s.tenant_id
      LEFT JOIN customers c ON b.customer_id = c.id AND c.tenant_id = s.tenant_id
      LEFT JOIN packages p ON b.package_id = p.id AND p.tenant_id = s.tenant_id
      WHERE s.tenant_id = ?
        AND YEAR(s.slot_date) = ?
        AND MONTH(s.slot_date) = ?
        ${hallId ? 'AND s.hall_id = ?' : ''}
      ORDER BY s.slot_date, s.slot_type
    `;

    const params: any[] = [tenantId, year, month];
    if (hallId) {
      params.push(hallId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);

    // Format response to match frontend expectations
    return rows.map((row: any) => ({
      id: row.id,
      hall_id: row.hall_id,
      date: row.date,
      slot_date: new Date(row.date),
      slot_type: row.slot_type,
      // Map 'available' to 'vacant' for frontend compatibility
      status: row.status === 'available' ? 'vacant' : row.status,
      booking_id: row.booking_id,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Include booking details if slot is booked
      booking_details: row.booking_id ? {
        customer_name: row.customer_name || 'N/A',
        package_name: row.package_name || 'N/A',
        booking_id: row.booking_id,
        total_amount: parseFloat(row.total_amount) || 0,
        advance_paid: parseFloat(row.advance_paid) || 0
      } : undefined
    }));
  }

  /**
   * Update slot status
   * Used when admin changes slot status or when booking is created
   */
  async updateSlotStatus(
    slotId: number,
    status: 'available' | 'booked' | 'blocked',
    bookingId?: number
  ): Promise<void> {
    const updateData: UpdateSlotDTO = {
      status,
      // Only include booking_id if it's provided, otherwise set to null
      booking_id: bookingId !== undefined ? bookingId : null
    };

    await this.slotRepository.update(slotId, updateData);
  }

  /**
   * Get slot by ID
   */
  async getSlotById(id: number): Promise<Slot | null> {
    return await this.slotRepository.findById(id);
  }

  /**
   * Check if a specific slot is available
   */
  async isSlotAvailable(
    hallId: number,
    date: string,
    slotType: 'morning' | 'afternoon' | 'night'
  ): Promise<boolean> {
    const tenantId = getTenantId();
    const sql = `
      SELECT COUNT(*) as count
      FROM slots
      WHERE hall_id = ?
        AND tenant_id = ?
        AND slot_date = ?
        AND slot_type = ?
        AND status = 'available'
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, tenantId, date, slotType]);
    return rows[0].count > 0;
  }

  /**
   * Get slot by hall, date, and type
   */
  async getSlotByHallDateType(
    hallId: number,
    date: string,
    slotType: 'morning' | 'afternoon' | 'night'
  ): Promise<Slot | null> {
    const tenantId = getTenantId();
    const sql = `
      SELECT *
      FROM slots
      WHERE hall_id = ?
        AND tenant_id = ?
        AND slot_date = ?
        AND slot_type = ?
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, tenantId, date, slotType]);
    return rows.length > 0 ? (rows[0] as Slot) : null;
  }

  /**
   * Generate slots for a specific month and hall
   * Useful for admin to create slots in advance
   */
  async generateSlotsForMonth(
    year: number,
    month: number,
    hallId: number
  ): Promise<number> {
    const currentTenantId = getTenantId();
    // Get tenant_id from the hall
    const [hallRows] = await pool.execute<RowDataPacket[]>(
      'SELECT tenant_id FROM halls WHERE id = ? AND tenant_id = ?',
      [hallId, currentTenantId]
    );
    
    if (hallRows.length === 0 || !hallRows[0].tenant_id) {
      throw new Error('Hall not found or tenant_id is missing');
    }
    
    const tenantId = hallRows[0].tenant_id;

    const daysInMonth = new Date(year, month, 0).getDate();
    const slotTypes: ('morning' | 'afternoon' | 'night')[] = ['morning', 'afternoon', 'night'];
    let createdCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      for (const slotType of slotTypes) {
        // Check if slot already exists
        const existing = await this.getSlotByHallDateType(hallId, date, slotType);

        if (!existing) {
          const slotData: CreateSlotDTO = {
            hall_id: hallId,
            tenant_id: tenantId, // Include tenant_id from hall
            slot_date: date, // Use string directly to avoid timezone conversion
            slot_type: slotType,
            status: 'available' as const
          };

          await this.slotRepository.create(slotData as any);
          createdCount++;
        }
      }
    }

    return createdCount;
  }

  /**
   * Generate slots for all active halls for next N months
   */
  async generateSlotsForAllHalls(months: number = 6): Promise<{ hallsProcessed: number; slotsCreated: number }> {
    const tenantId = getTenantId();
    // Get all active halls
    const [halls] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM halls WHERE tenant_id = ? AND status = ?',
      [tenantId, 'active']
    );

    let totalSlotsCreated = 0;
    const currentDate = new Date();

    for (const hall of halls) {
      for (let i = 0; i < months; i++) {
        const targetDate = new Date(currentDate);
        targetDate.setMonth(currentDate.getMonth() + i);

        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;

        const slotsCreated = await this.generateSlotsForMonth(year, month, hall.id);
        totalSlotsCreated += slotsCreated;
      }
    }

    return {
      hallsProcessed: halls.length,
      slotsCreated: totalSlotsCreated
    };
  }

  /**
   * Get available slots for a specific date range
   */
  async getAvailableSlots(
    hallId: number,
    dateFrom: string,
    dateTo: string
  ): Promise<Slot[]> {
    const tenantId = getTenantId();
    const sql = `
      SELECT *
      FROM slots
      WHERE hall_id = ?
        AND tenant_id = ?
        AND slot_date BETWEEN ? AND ?
        AND status = 'available'
      ORDER BY slot_date, slot_type
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, tenantId, dateFrom, dateTo]);
    return rows as Slot[];
  }

  /**
   * Block/Unblock slot
   * Used by admin to mark slots as unavailable
   */
  async blockSlot(slotId: number, block: boolean, notes?: string): Promise<void> {
    const tenantId = getTenantId();
    const status = block ? 'blocked' : 'available';
    const sql = `
      UPDATE slots
      SET status = ?, notes = ?, updated_at = NOW()
      WHERE id = ? AND tenant_id = ?
    `;
    await pool.execute(sql, [status, notes || null, slotId, tenantId]);
  }
}
