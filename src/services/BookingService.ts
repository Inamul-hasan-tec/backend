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
      'total_amount',
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

    // Validate package if provided
    if (data.package_id) {
      const pkg = await this.packageRepo.findById(data.package_id);
      if (!pkg) {
        throw new Error('Package not found');
      }
      if (pkg.status !== 'active') {
        throw new Error('Package is not available');
      }
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

    // Validate amounts
    if (!isPositiveNumber(data.total_amount)) {
      throw new Error('Total amount must be a positive number');
    }
    if (data.advance_amount < 0) {
      throw new Error('Advance amount cannot be negative');
    }
    if (data.advance_amount > data.total_amount) {
      throw new Error('Advance amount cannot exceed total amount');
    }

    // Calculate balance
    const balance_amount = data.total_amount - data.advance_amount;

    // Create booking
    const bookingData = {
      ...data,
      event_date: eventDate as any,
      balance_amount,
      status: 'confirmed' as const, // Auto-confirm bookings
    };

    const bookingId = await this.bookingRepo.createWithSlot(bookingData as any);

    // Update slot status if slot_id provided
    if (data.slot_id) {
      await this.slotService.updateSlotStatus(data.slot_id, 'booked', bookingId);
    }

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

    // Validate customer if provided
    if (data.customer_id) {
      const customer = await this.customerRepo.findById(data.customer_id);
      if (!customer) {
        throw new Error('Customer not found');
      }
    }

    // Validate hall if provided
    if (data.hall_id) {
      const hall = await this.hallRepo.findById(data.hall_id);
      if (!hall) {
        throw new Error('Hall not found');
      }
    }

    // Validate package if provided
    if (data.package_id) {
      const pkg = await this.packageRepo.findById(data.package_id);
      if (!pkg) {
        throw new Error('Package not found');
      }
    }

    // Validate event date if provided
    if (data.event_date) {
      const eventDate = typeof data.event_date === 'string' ? data.event_date : data.event_date.toISOString().split('T')[0];
      if (!isValidDate(eventDate)) {
        throw new Error('Invalid event date format');
      }
    }

    // Recalculate balance if amounts changed
    if (data.total_amount !== undefined || data.advance_amount !== undefined) {
      const total = data.total_amount ?? existing.total_amount;
      const advance = data.advance_amount ?? existing.advance_amount;
      
      if (advance > total) {
        throw new Error('Advance amount cannot exceed total amount');
      }
    }

    return await this.bookingRepo.update(id, data as any);
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
