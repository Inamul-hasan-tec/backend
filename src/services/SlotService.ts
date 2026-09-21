/**
 * Slot Service
 * Business logic for hall availability slots
 */

import { RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { SlotRepository } from '../repositories/SlotRepository';
import { Slot, SlotWithBookingDetails, CreateSlotDTO, UpdateSlotDTO, SlotType } from '../models/Slot';
import { getTenantId } from '../utils/tenantContext';
import SubscriptionRepository from '../repositories/SubscriptionRepository';
import TenantRepository from '../repositories/TenantRepository';

type CalendarSlotMode = 'three_slots' | 'two_slots' | 'full_day';
const DEFAULT_SLOT_MODE: CalendarSlotMode = 'three_slots';
const SLOT_TYPES_BY_MODE: Record<CalendarSlotMode, SlotType[]> = {
  three_slots: ['morning', 'afternoon', 'night'],
  two_slots: ['afternoon', 'night'],
  full_day: ['full_day'],
};
const SLOT_GENERATION_STATUSES = new Set(['trial', 'active']);
const MAX_PLATFORM_RANGE_DAYS = 731;

const toDateOnly = (value: string | Date): string => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const dateOnly = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date must be in YYYY-MM-DD format');
  }
  return value;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const daysBetweenInclusive = (from: string, to: string): number => {
  const start = parseDateOnly(from).getTime();
  const end = parseDateOnly(to).getTime();
  return Math.floor((end - start) / 86400000) + 1;
};

const normalizeSlotMode = (value?: string | null): CalendarSlotMode => {
  if (value === 'two_slots' || value === 'full_day' || value === 'three_slots') {
    return value;
  }
  return DEFAULT_SLOT_MODE;
};

interface SlotEntitlementWindow {
  canUseSlots: boolean;
  subscriptionEnd?: string;
  reason?: string;
}

export class SlotService {
  private slotRepository: SlotRepository;

  constructor() {
    this.slotRepository = new SlotRepository();
  }

  private async getSlotTypesForTenant(tenantId: number): Promise<SlotType[]> {
    const mode = normalizeSlotMode(
      await TenantRepository.getSetting(tenantId, 'calendar_slot_mode')
    );
    return SLOT_TYPES_BY_MODE[mode];
  }

  private async getSlotEntitlementWindow(tenantId: number): Promise<SlotEntitlementWindow> {
    const subscription = await SubscriptionRepository.ensureTrialSubscription(tenantId);
    const [tenantRows] = await pool.execute<RowDataPacket[]>(
      'SELECT status FROM tenants WHERE id = ? LIMIT 1',
      [tenantId]
    );
    const tenantStatus = tenantRows[0]?.status || 'inactive';
    const subscriptionStatus = subscription?.status || 'inactive';
    const subscriptionEnd = subscription?.current_period_end
      ? toDateOnly(new Date(subscription.current_period_end))
      : undefined;

    if (!SLOT_GENERATION_STATUSES.has(tenantStatus) || !SLOT_GENERATION_STATUSES.has(subscriptionStatus)) {
      return {
        canUseSlots: false,
        subscriptionEnd,
        reason: `Tenant/subscription status is not eligible for slot access (${tenantStatus}/${subscriptionStatus})`,
      };
    }

    if (!subscriptionEnd) {
      return { canUseSlots: false, reason: 'Subscription period is unavailable' };
    }

    const today = toDateOnly(new Date());
    if (daysBetweenInclusive(today, subscriptionEnd) < 1) {
      return {
        canUseSlots: false,
        subscriptionEnd,
        reason: 'Subscription period has ended',
      };
    }

    return { canUseSlots: true, subscriptionEnd };
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
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const monthEndExclusive = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

    await this.ensureSubscriptionSlotsForRequestedMonth(tenantId, year, month, hallId);
    const entitlement = await this.getSlotEntitlementWindow(tenantId);

    if (!entitlement.canUseSlots || !entitlement.subscriptionEnd || monthStart > entitlement.subscriptionEnd) {
      return [];
    }

    const effectiveMonthEndExclusive =
      monthEndExclusive <= entitlement.subscriptionEnd
        ? monthEndExclusive
        : addDays(parseDateOnly(entitlement.subscriptionEnd), 1).toISOString().slice(0, 10);

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
        AND s.slot_date >= ?
        AND s.slot_date < ?
        ${hallId ? 'AND s.hall_id = ?' : ''}
      ORDER BY s.slot_date, s.slot_type
    `;

    const params: any[] = [tenantId, monthStart, effectiveMonthEndExclusive];
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

  private shouldGenerateMissingSlots(year: number, month: number): boolean {
    const today = new Date();
    const requestedMonthEnd = new Date(Date.UTC(year, month, 0));
    const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    return requestedMonthEnd >= todayDateOnly;
  }

  private getSubscriptionGenerationStart(year: number, month: number): string | null {
    if (!this.shouldGenerateMissingSlots(year, month)) {
      return null;
    }

    const today = new Date();
    const todayDateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const generationStart = monthStart > todayDateOnly ? monthStart : todayDateOnly;

    return generationStart.toISOString().slice(0, 10);
  }

  /**
   * Calendar reads are allowed to self-heal missing future slots. This keeps
   * slot generation tied to subscription validity instead of each screen
   * manually creating one month at a time.
   */
  private async ensureSubscriptionSlotsForRequestedMonth(
    tenantId: number,
    year: number,
    month: number,
    hallId?: number
  ): Promise<void> {
    const generationStart = this.getSubscriptionGenerationStart(year, month);
    if (!generationStart) return;

    try {
      if (hallId) {
        await this.generateSlotsForHallUntilSubscriptionEnd(tenantId, hallId, generationStart);
        return;
      }

      await this.generateSlotsForTenantUntilSubscriptionEnd(tenantId, generationStart);
    } catch (error) {
      console.warn('Slot self-healing skipped during calendar read:', {
        tenantId,
        hallId,
        year,
        month,
        error: error instanceof Error ? error.message : error,
      });
    }
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

  async isDateWithinCurrentTenantSlotEntitlement(date: string): Promise<boolean> {
    const tenantId = getTenantId();
    const entitlement = await this.getSlotEntitlementWindow(tenantId);
    const dateOnly = toDateOnly(date);
    return Boolean(entitlement.canUseSlots && entitlement.subscriptionEnd && dateOnly <= entitlement.subscriptionEnd);
  }

  /**
   * Check if a specific slot is available
   */
  async isSlotAvailable(
    hallId: number,
    date: string,
    slotType: SlotType
  ): Promise<boolean> {
    const tenantId = getTenantId();
    const entitlement = await this.getSlotEntitlementWindow(tenantId);
    if (!entitlement.canUseSlots || !entitlement.subscriptionEnd || date > entitlement.subscriptionEnd) {
      return false;
    }
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
    slotType: SlotType
  ): Promise<Slot | null> {
    const tenantId = getTenantId();
    const entitlement = await this.getSlotEntitlementWindow(tenantId);
    if (!entitlement.canUseSlots || !entitlement.subscriptionEnd || date > entitlement.subscriptionEnd) {
      return null;
    }
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
    let createdCount = 0;

    const slotTypes = await this.getSlotTypesForTenant(tenantId);

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
   * Generate daily slots for a hall between two dates using the tenant's slot mode.
   *
   * This method is intentionally idempotent: existing slots are never updated,
   * deleted, or overwritten. It only creates missing configured
   * slots, preserving booked and manually blocked inventory.
   */
  async generateSlotsForHallRange(
    tenantId: number,
    hallId: number,
    dateFrom: string | Date,
    dateTo: string | Date
  ): Promise<{ slotsCreated: number; daysProcessed: number }> {
    const from = toDateOnly(dateFrom);
    const to = toDateOnly(dateTo);
    const totalDays = daysBetweenInclusive(from, to);

    if (totalDays < 1) {
      throw new Error('date_to must be on or after date_from');
    }
    if (totalDays > MAX_PLATFORM_RANGE_DAYS) {
      throw new Error(`Slot generation range cannot exceed ${MAX_PLATFORM_RANGE_DAYS} days`);
    }

    const [hallRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, status FROM halls WHERE id = ? AND tenant_id = ? LIMIT 1',
      [hallId, tenantId]
    );
    if (!hallRows.length) {
      throw new Error('Hall not found for tenant');
    }
    if (hallRows[0].status !== 'active') {
      throw new Error('Slots can only be generated for active halls');
    }

    let createdCount = 0;
    const slotTypes = await this.getSlotTypesForTenant(tenantId);
    let cursor = parseDateOnly(from);

    const values: any[] = [];
    const placeholders: string[] = [];

    for (let day = 0; day < totalDays; day++) {
      const slotDate = cursor.toISOString().slice(0, 10);

      for (const slotType of slotTypes) {
        placeholders.push('(?, ?, ?, ?, ?, NOW(), NOW())');
        values.push(tenantId, hallId, slotDate, slotType, 'available');
      }

      cursor = addDays(cursor, 1);
    }

    if (placeholders.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < placeholders.length; i += CHUNK_SIZE) {
        const chunkPlaceholders = placeholders.slice(i, i + CHUNK_SIZE);
        const chunkValues = values.slice(i * 5, (i + CHUNK_SIZE) * 5);
        const sql = `INSERT IGNORE INTO slots
           (tenant_id, hall_id, slot_date, slot_type, status, created_at, updated_at)
           VALUES ${chunkPlaceholders.join(', ')}`;
        const [result] = await pool.execute<any>(sql, chunkValues);
        createdCount += Number(result.affectedRows || 0);
      }
    }

    return { slotsCreated: createdCount, daysProcessed: totalDays };
  }

  /**
   * Generate slots for a hall until the tenant's paid/trial subscription end.
   * Returns skipped=true for unpaid/suspended/expired tenants so callers can
   * surface this safely without corrupting existing calendar data.
   */
  async generateSlotsForHallUntilSubscriptionEnd(
    tenantId: number,
    hallId: number,
    dateFrom: string | Date = new Date()
  ): Promise<{ slotsCreated: number; daysProcessed: number; skipped: boolean; reason?: string; subscriptionEnd?: string }> {
    const entitlement = await this.getSlotEntitlementWindow(tenantId);

    if (!entitlement.canUseSlots || !entitlement.subscriptionEnd) {
      return {
        slotsCreated: 0,
        daysProcessed: 0,
        skipped: true,
        reason: entitlement.reason || 'Subscription is not eligible for slot generation',
        subscriptionEnd: entitlement.subscriptionEnd,
      };
    }

    const today = toDateOnly(dateFrom);
    const subscriptionEnd = entitlement.subscriptionEnd;
    if (daysBetweenInclusive(today, subscriptionEnd) < 1) {
      return {
        slotsCreated: 0,
        daysProcessed: 0,
        skipped: true,
        reason: 'Subscription period has ended',
        subscriptionEnd,
      };
    }

    const result = await this.generateSlotsForHallRange(tenantId, hallId, today, subscriptionEnd);
    return { ...result, skipped: false, subscriptionEnd };
  }

  /**
   * Tenant-facing manual generation for a selected hall/month. It uses the
   * requested month only as the start point, then fills through subscription
   * end so the calendar never depends on month-by-month setup.
   */
  async generateCurrentTenantHallSlotsFromMonthUntilSubscriptionEnd(
    year: number,
    month: number,
    hallId: number
  ): Promise<{ slotsCreated: number; daysProcessed: number; skipped: boolean; reason?: string; subscriptionEnd?: string }> {
    const tenantId = getTenantId();
    const generationStart = this.getSubscriptionGenerationStart(year, month);

    if (!generationStart) {
      return {
        slotsCreated: 0,
        daysProcessed: 0,
        skipped: true,
        reason: 'Requested month is in the past',
      };
    }

    return this.generateSlotsForHallUntilSubscriptionEnd(tenantId, hallId, generationStart);
  }

  /**
   * Tenant-facing all-hall generation through subscription end.
   */
  async generateCurrentTenantSlotsUntilSubscriptionEnd(
    dateFrom: string | Date = new Date()
  ): Promise<{ hallsProcessed: number; slotsCreated: number; skipped: boolean; reason?: string; subscriptionEnd?: string }> {
    return this.generateSlotsForTenantUntilSubscriptionEnd(getTenantId(), dateFrom);
  }

  async generateCurrentTenantHallSlotsForCurrentMonthUntilSubscriptionEnd(
    hallId: number
  ): Promise<{ slotsCreated: number; daysProcessed: number; skipped: boolean; reason?: string; subscriptionEnd?: string }> {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return this.generateSlotsForHallUntilSubscriptionEnd(
      getTenantId(),
      hallId,
      currentMonthStart.toISOString().slice(0, 10)
    );
  }

  /**
   * Generate slots for every active hall in a tenant through subscription end.
   * Used after subscription approval/renewal and by platform maintenance.
   */
  async generateSlotsForTenantUntilSubscriptionEnd(
    tenantId: number,
    dateFrom: string | Date = new Date()
  ): Promise<{ hallsProcessed: number; slotsCreated: number; skipped: boolean; reason?: string; subscriptionEnd?: string }> {
    const [halls] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM halls WHERE tenant_id = ? AND status = ? ORDER BY id',
      [tenantId, 'active']
    );

    let totalSlotsCreated = 0;
    let subscriptionEnd: string | undefined;
    let firstSkipReason: string | undefined;

    for (const hall of halls) {
      const result = await this.generateSlotsForHallUntilSubscriptionEnd(tenantId, hall.id, dateFrom);
      totalSlotsCreated += result.slotsCreated;
      subscriptionEnd = result.subscriptionEnd || subscriptionEnd;
      firstSkipReason = result.reason || firstSkipReason;
      if (result.skipped) {
        return {
          hallsProcessed: 0,
          slotsCreated: totalSlotsCreated,
          skipped: true,
          reason: firstSkipReason,
          subscriptionEnd,
        };
      }
    }

    return {
      hallsProcessed: halls.length,
      slotsCreated: totalSlotsCreated,
      skipped: false,
      subscriptionEnd,
    };
  }

  /**
   * Platform-admin read model for a tenant/hall slot range.
   */
  async getSlotsForPlatform(
    tenantId: number,
    dateFrom: string | Date,
    dateTo: string | Date,
    hallId?: number
  ): Promise<SlotWithBookingDetails[]> {
    const from = toDateOnly(dateFrom);
    const to = toDateOnly(dateTo);
    if (daysBetweenInclusive(from, to) < 1) {
      throw new Error('date_to must be on or after date_from');
    }

    const params: any[] = [tenantId, from, to];
    let hallFilter = '';
    if (hallId) {
      hallFilter = 'AND s.hall_id = ?';
      params.push(hallId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         s.id,
         s.hall_id,
         h.name AS hall_name,
         DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS date,
         s.slot_type,
         s.status,
         s.booking_id,
         s.notes,
         c.name AS customer_name,
         p.name AS package_name,
         b.total_amount,
         b.advance_amount AS advance_paid
       FROM slots s
       JOIN halls h ON h.id = s.hall_id AND h.tenant_id = s.tenant_id
       LEFT JOIN bookings b ON s.booking_id = b.id AND b.tenant_id = s.tenant_id
       LEFT JOIN customers c ON b.customer_id = c.id AND c.tenant_id = s.tenant_id
       LEFT JOIN packages p ON b.package_id = p.id AND p.tenant_id = s.tenant_id
       WHERE s.tenant_id = ?
         AND s.slot_date BETWEEN ? AND ?
         ${hallFilter}
       ORDER BY s.slot_date, h.name, s.slot_type`,
      params
    );

    return rows.map((row: any) => ({
      id: row.id,
      hall_id: row.hall_id,
      hall_name: row.hall_name,
      date: row.date,
      slot_date: new Date(row.date),
      slot_type: row.slot_type,
      status: row.status === 'available' ? 'vacant' : row.status,
      booking_id: row.booking_id,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      booking_details: row.booking_id ? {
        customer_name: row.customer_name || 'N/A',
        package_name: row.package_name || 'N/A',
        booking_id: row.booking_id,
        total_amount: parseFloat(row.total_amount) || 0,
        advance_paid: parseFloat(row.advance_paid) || 0
      } : undefined
    } as SlotWithBookingDetails & { hall_name?: string }));
  }

  /**
   * Platform-admin block/unblock guard. Booked slots cannot be changed here.
   */
  async blockSlotForPlatform(tenantId: number, slotId: number, block: boolean, notes?: string): Promise<void> {
    const status = block ? 'blocked' : 'available';
    const [slotRows] = await pool.execute<RowDataPacket[]>(
      'SELECT status FROM slots WHERE id = ? AND tenant_id = ? LIMIT 1',
      [slotId, tenantId]
    );
    if (!slotRows.length) {
      throw new Error('Slot not found for tenant');
    }
    if (slotRows[0].status === 'booked') {
      throw new Error('Booked slots cannot be blocked or unblocked from slot management');
    }
    await pool.execute(
      `UPDATE slots
       SET status = ?, notes = ?, booking_id = NULL, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [status, notes || null, slotId, tenantId]
    );
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
    const entitlement = await this.getSlotEntitlementWindow(tenantId);
    if (!entitlement.canUseSlots || !entitlement.subscriptionEnd) {
      return [];
    }

    const effectiveDateTo = dateTo <= entitlement.subscriptionEnd ? dateTo : entitlement.subscriptionEnd;
    if (daysBetweenInclusive(dateFrom, effectiveDateTo) < 1) {
      return [];
    }

    const sql = `
      SELECT *
      FROM slots
      WHERE hall_id = ?
        AND tenant_id = ?
        AND slot_date BETWEEN ? AND ?
        AND status = 'available'
      ORDER BY slot_date, slot_type
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, [hallId, tenantId, dateFrom, effectiveDateTo]);
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

  /**
   * Get availability health diagnostics for tenant
   * Computes expected vs actual slots per active hall up to subscription end
   */
  async getAvailabilityHealth(tenantId: number): Promise<{
    can_use_slots: boolean;
    subscription_end?: string;
    slot_mode: CalendarSlotMode;
    slot_types: SlotType[];
    active_halls_count: number;
    days_in_entitlement: number;
    total_expected_slots: number;
    total_existing_slots: number;
    total_missing_slots: number;
    total_booked_slots: number;
    total_blocked_slots: number;
    total_vacant_slots: number;
    status: 'healthy' | 'needs_repair' | 'subscription_ended';
    halls: Array<{
      id: number;
      name: string;
      expected_slots: number;
      existing_slots: number;
      missing_slots: number;
      vacant_slots: number;
      booked_slots: number;
      blocked_slots: number;
    }>;
  }> {
    const entitlement = await this.getSlotEntitlementWindow(tenantId);
    const slotMode = normalizeSlotMode(
      await TenantRepository.getSetting(tenantId, 'calendar_slot_mode')
    );
    const slotTypes = SLOT_TYPES_BY_MODE[slotMode];

    const [hallRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name FROM halls WHERE tenant_id = ? AND is_active = true ORDER BY name ASC',
      [tenantId]
    );

    if (!entitlement.canUseSlots || !entitlement.subscriptionEnd) {
      return {
        can_use_slots: false,
        subscription_end: entitlement.subscriptionEnd,
        slot_mode: slotMode,
        slot_types: slotTypes,
        active_halls_count: hallRows.length,
        days_in_entitlement: 0,
        total_expected_slots: 0,
        total_existing_slots: 0,
        total_missing_slots: 0,
        total_booked_slots: 0,
        total_blocked_slots: 0,
        total_vacant_slots: 0,
        status: 'subscription_ended',
        halls: [],
      };
    }

    const today = toDateOnly(new Date());
    const daysInEntitlement = Math.max(0, daysBetweenInclusive(today, entitlement.subscriptionEnd));
    const expectedSlotsPerHall = daysInEntitlement * slotTypes.length;

    const [slotStats] = await pool.query<RowDataPacket[]>(
      `SELECT hall_id, status, COUNT(*) as count
       FROM slots
       WHERE tenant_id = ?
         AND slot_date >= ?
         AND slot_date <= ?
         AND slot_type IN (?)
       GROUP BY hall_id, status`,
      [tenantId, today, entitlement.subscriptionEnd, slotTypes]
    );

    const statsByHall: Record<number, { vacant: number; booked: number; blocked: number; total: number }> = {};
    for (const stat of slotStats) {
      const hallId = Number(stat.hall_id);
      if (!statsByHall[hallId]) {
        statsByHall[hallId] = { vacant: 0, booked: 0, blocked: 0, total: 0 };
      }
      const count = Number(stat.count || 0);
      statsByHall[hallId].total += count;
      if (stat.status === 'vacant' || stat.status === 'available') {
        statsByHall[hallId].vacant += count;
      } else if (stat.status === 'booked') {
        statsByHall[hallId].booked += count;
      } else if (stat.status === 'blocked') {
        statsByHall[hallId].blocked += count;
      }
    }

    let totalExpected = 0;
    let totalExisting = 0;
    let totalMissing = 0;
    let totalBooked = 0;
    let totalBlocked = 0;
    let totalVacant = 0;

    const halls = hallRows.map((hall) => {
      const hallId = Number(hall.id);
      const stats = statsByHall[hallId] || { vacant: 0, booked: 0, blocked: 0, total: 0 };
      const missing = Math.max(0, expectedSlotsPerHall - stats.total);

      totalExpected += expectedSlotsPerHall;
      totalExisting += stats.total;
      totalMissing += missing;
      totalBooked += stats.booked;
      totalBlocked += stats.blocked;
      totalVacant += stats.vacant;

      return {
        id: hallId,
        name: String(hall.name),
        expected_slots: expectedSlotsPerHall,
        existing_slots: stats.total,
        missing_slots: missing,
        vacant_slots: stats.vacant,
        booked_slots: stats.booked,
        blocked_slots: stats.blocked,
      };
    });

    return {
      can_use_slots: true,
      subscription_end: entitlement.subscriptionEnd,
      slot_mode: slotMode,
      slot_types: slotTypes,
      active_halls_count: hallRows.length,
      days_in_entitlement: daysInEntitlement,
      total_expected_slots: totalExpected,
      total_existing_slots: totalExisting,
      total_missing_slots: totalMissing,
      total_booked_slots: totalBooked,
      total_blocked_slots: totalBlocked,
      total_vacant_slots: totalVacant,
      status: totalMissing === 0 ? 'healthy' : 'needs_repair',
      halls,
    };
  }
}
