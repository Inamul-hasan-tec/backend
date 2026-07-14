/**
 * Booking Service
 * Business logic for booking operations
 * Handles complex booking workflow with transactions
 */

import { BookingRepository } from '../repositories/BookingRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { HallRepository } from '../repositories/HallRepository';
import { PackageRepository } from '../repositories/PackageRepository';
import { SlotService } from './SlotService';
import { Booking, BookingDetails, CreateBookingDTO, UpdateBookingDTO, BookingSearchParams } from '../models/Booking';
import { validateRequired, isValidDate, isPositiveNumber } from '../utils/validation';

export class BookingService {
  private bookingRepo: BookingRepository;
  private customerRepo: CustomerRepository;
  private hallRepo: HallRepository;
  private packageRepo: PackageRepository;

  private slotService: SlotService;

  constructor() {
    this.bookingRepo = new BookingRepository();
    this.customerRepo = new CustomerRepository();
    this.hallRepo = new HallRepository();
    this.packageRepo = new PackageRepository();
    this.slotService = new SlotService();
  }

  /**
   * Get all bookings
   */
  async getAllBookings(limit?: number, offset?: number): Promise<Booking[]> {
    return await this.bookingRepo.findAll(limit, offset);
  }

  /**
   * Get booking by ID with details
   */
  async getBookingById(id: number): Promise<BookingDetails | null> {
    return await this.bookingRepo.getDetails(id);
  }

  /**
   * Create new booking
   */
  async createBooking(data: CreateBookingDTO): Promise<number> {
    // Validate required fields
    const validation = validateRequired(data, [
      'customer_id',
      'hall_id',
      'event_date',
      'event_type',
      'advance_amount',
      'payment_mode',
    ]);
    if (!validation.valid) {
      throw new Error(`Missing required fields: ${validation.missing.join(', ')}`);
    }

    // Validate customer exists
    const customer = await this.customerRepo.findById(data.customer_id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Validate hall exists and is active
    const hall = await this.hallRepo.findById(data.hall_id);
    if (!hall) {
      throw new Error('Hall not found');
    }
    if (hall.status !== 'active') {
      throw new Error('Hall is not available for booking');
    }
    
    // Get tenant_id from hall
    if (!hall.tenant_id) {
      throw new Error('Hall does not have a tenant_id assigned');
    }

    let packagePrice = 0;
    // Validate package if provided
    if (data.package_id) {
      const pkg = await this.packageRepo.findById(data.package_id);
      if (!pkg) {
        throw new Error('Package not found');
      }
      if (pkg.status !== 'active') {
        throw new Error('Package is not available');
      }
      if (pkg.hall_id && Number(pkg.hall_id) !== Number(data.hall_id)) {
        throw new Error('Selected package is not available for this hall');
      }
      packagePrice = Number(pkg.base_price || 0);
    }

    // Validate event date
    const eventDate = typeof data.event_date === 'string' ? data.event_date : data.event_date.toISOString().split('T')[0];
    if (!isValidDate(eventDate)) {
      throw new Error('Invalid event date format');
    }

    // Check if date is in the future or today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(eventDate + 'T00:00:00');
    if (bookingDate < today) {
      throw new Error('Event date must be in the future');
    }

    // Slot ID and slot type form one selection and must be supplied together.
    if ((data.slot_id && !data.time_slot) || (!data.slot_id && data.time_slot)) {
      throw new Error('Slot and time slot must be selected together');
    }

    // Validate slot if provided
    if (data.slot_id && data.time_slot) {
      const slot = await this.slotService.getSlotById(data.slot_id);
      if (!slot) {
        throw new Error('Slot not found');
      }
      if (slot.status !== 'available') {
        throw new Error('Slot is not available');
      }
      if (slot.hall_id !== data.hall_id) {
        throw new Error('Slot does not belong to selected hall');
      }
      if (slot.slot_type !== data.time_slot) {
        throw new Error('Slot type mismatch');
      }
    } else {
      // Check hall availability (legacy check if no slot specified)
      const isAvailable = await this.hallRepo.isAvailable(data.hall_id, eventDate);
      if (!isAvailable) {
        throw new Error('Hall is not available on the selected date');
      }
    }

    // Server-authoritative pricing:
    // hall base rent + selected package/service add-on price.
    const totalAmount = Number(hall.base_price || 0) + packagePrice;
    if (!isPositiveNumber(totalAmount)) {
      throw new Error('Booking total must be a positive number');
    }
    if (data.advance_amount < 0) {
      throw new Error('Advance amount cannot be negative');
    }
    if (data.advance_amount > totalAmount) {
      throw new Error('Advance amount cannot exceed total amount');
    }

    // Calculate balance
    const balance_amount = totalAmount - data.advance_amount;

    // Create booking with tenant_id from hall
    const bookingData = {
      ...data,
      tenant_id: hall.tenant_id, // Include tenant_id from hall
      event_date: eventDate as any,
      total_amount: totalAmount,
      balance_amount,
      status: 'confirmed' as const, // Auto-confirm bookings
    };

    const bookingId = await this.bookingRepo.createWithSlot(bookingData as any);

    return bookingId;
  }

  /**
   * Update booking
   */
  async updateBooking(id: number, data: UpdateBookingDTO): Promise<boolean> {
    // Check if booking exists
    const existing = await this.bookingRepo.findById(id);
    if (!existing) {
      throw new Error('Booking not found');
    }

    // Don't allow updates to cancelled bookings
    if (existing.status === 'cancelled') {
      throw new Error('Cannot update cancelled booking');
    }
    if (existing.status === 'completed') {
      throw new Error('Cannot update completed booking');
    }
    if (data.status !== undefined) {
      throw new Error('Use the booking status actions to change status');
    }

    const customerId = data.customer_id ?? existing.customer_id;
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const hallId = data.hall_id ?? existing.hall_id;
    const hall = await this.hallRepo.findById(hallId);
    if (!hall) {
      throw new Error('Hall not found');
    }
    if (hall.status !== 'active') {
      throw new Error('Hall is not available for booking');
    }

    const packageId = data.package_id ?? existing.package_id;
    let packagePrice = 0;
    if (packageId) {
      const pkg = await this.packageRepo.findById(packageId);
      if (!pkg) {
        throw new Error('Package not found');
      }
      if (pkg.status !== 'active') {
        throw new Error('Package is not available');
      }
      if (pkg.hall_id && Number(pkg.hall_id) !== Number(hallId)) {
        throw new Error('Selected package is not available for this hall');
      }
      packagePrice = Number(pkg.base_price || 0);
    }

    const eventDate = normalizeBookingDate(data.event_date ?? existing.event_date);
    if (!isValidDate(eventDate)) {
      throw new Error('Invalid event date format');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(`${eventDate}T00:00:00`) < today) {
      throw new Error('Event date must be in the future');
    }

    const timeSlot = data.time_slot ?? existing.time_slot ?? 'full_day';
    if (!['morning', 'afternoon', 'night', 'full_day'].includes(timeSlot)) {
      throw new Error('Invalid time slot');
    }

    const total = Number(hall.base_price || 0) + packagePrice;
    const advance = Number(data.advance_amount ?? existing.advance_amount);
    const balanceAmount = validateBookingAmounts(total, advance);

    return this.bookingRepo.updateWithSlot(
      id,
      {
        ...data,
        event_date: eventDate as any,
        total_amount: total,
        balance_amount: balanceAmount,
      },
      { hallId, eventDate, timeSlot }
    );
  }

  /**
   * Cancel booking
   */
  async cancelBooking(id: number): Promise<boolean> {
    const existing = await this.bookingRepo.findById(id);
    if (!existing) {
      throw new Error('Booking not found');
    }

    if (existing.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    if (existing.status === 'completed') {
      throw new Error('Cannot cancel completed booking');
    }

    return await this.bookingRepo.cancel(id);
  }

  /**
   * Search bookings
   */
  async searchBookings(params: BookingSearchParams): Promise<BookingDetails[]> {
    return await this.bookingRepo.search(params);
  }

  /**
   * Get upcoming bookings
   */
  async getUpcomingBookings(limit: number = 10): Promise<BookingDetails[]> {
    return await this.bookingRepo.getUpcoming(limit);
  }

  /**
   * Get today's bookings
   */
  async getTodaysBookings(): Promise<BookingDetails[]> {
    return await this.bookingRepo.getToday();
  }

  /**
   * Get booking statistics
   */
  async getBookingStats() {
    return await this.bookingRepo.getStats();
  }

  /**
   * Confirm booking
   */
  async confirmBooking(id: number): Promise<boolean> {
    const existing = await this.bookingRepo.findById(id);
    if (!existing) {
      throw new Error('Booking not found');
    }

    if (existing.status !== 'pending') {
      throw new Error('Only pending bookings can be confirmed');
    }

    return await this.bookingRepo.update(id, { status: 'confirmed' });
  }

  /**
   * Complete booking
   */
  async completeBooking(id: number): Promise<boolean> {
    const existing = await this.bookingRepo.findById(id);
    if (!existing) {
      throw new Error('Booking not found');
    }

    if (existing.status !== 'confirmed') {
      throw new Error('Only confirmed bookings can be completed');
    }

    return await this.bookingRepo.update(id, { status: 'completed' });
  }
}

export function normalizeBookingDate(value: string | Date): string {
  return typeof value === 'string'
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

export function validateBookingAmounts(
  totalAmount: number,
  advanceAmount: number
): number {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Total amount must be a positive number');
  }
  if (!Number.isFinite(advanceAmount) || advanceAmount < 0) {
    throw new Error('Advance amount cannot be negative');
  }
  if (advanceAmount > totalAmount) {
    throw new Error('Advance amount cannot exceed total amount');
  }
  return totalAmount - advanceAmount;
}
