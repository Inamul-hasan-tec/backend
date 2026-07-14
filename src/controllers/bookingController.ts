/**
 * Booking Controller
 * Handles HTTP requests for booking operations
 */

import { Request, Response } from 'express';
import { BookingService } from '../services/BookingService';
import { successResponse, errorResponse } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import EmailService from '../services/EmailService';

const bookingService = new BookingService();

/**
 * GET /api/bookings
 * Get all bookings
 */
export const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Default pagination to prevent fetching too much data
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  console.log(`📚 Fetching bookings with limit: ${limit}, offset: ${offset}`);
  
  const bookings = await bookingService.getAllBookings(limit, offset);
  
  console.log(`✅ Retrieved ${bookings.length} bookings in ${Date.now() - startTime}ms`);
  
  res.json(successResponse('Bookings retrieved successfully', bookings));
});

/**
 * GET /api/bookings/search
 * Search bookings
 */
export const searchBookings = asyncHandler(async (req: Request, res: Response) => {
  const params = {
    customer_id: req.query.customer_id ? parseInt(req.query.customer_id as string) : undefined,
    hall_id: req.query.hall_id ? parseInt(req.query.hall_id as string) : undefined,
    status: req.query.status as any,
    event_date_from: req.query.event_date_from as string,
    event_date_to: req.query.event_date_to as string,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const bookings = await bookingService.searchBookings(params);
  res.json(successResponse('Search completed', bookings));
});

/**
 * GET /api/bookings/upcoming
 * Get upcoming bookings
 */
export const getUpcomingBookings = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const bookings = await bookingService.getUpcomingBookings(limit);
  res.json(successResponse('Upcoming bookings retrieved', bookings));
});

/**
 * GET /api/bookings/today
 * Get today's bookings
 */
export const getTodaysBookings = asyncHandler(async (_req: Request, res: Response) => {
  const bookings = await bookingService.getTodaysBookings();
  res.json(successResponse("Today's bookings retrieved", bookings));
});

/**
 * GET /api/bookings/stats
 * Get booking statistics
 */
export const getBookingStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await bookingService.getBookingStats();
  res.json(successResponse('Statistics retrieved', stats));
});

/**
 * GET /api/bookings/:id
 * Get booking by ID
 */
export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const booking = await bookingService.getBookingById(id);

  if (!booking) {
    return res.status(404).json(errorResponse('Booking not found'));
  }

  res.json(successResponse('Booking retrieved successfully', booking));
});

/**
 * POST /api/bookings
 * Create new booking
 */
export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log('📝 Creating booking:', { customer_id: req.body.customer_id, hall_id: req.body.hall_id, event_date: req.body.event_date });
  
  try {
    // Create booking
    const bookingId = await bookingService.createBooking({
      ...req.body,
      created_by: req.user?.id,
    });
    console.log(`✅ Booking created with ID: ${bookingId} in ${Date.now() - startTime}ms`);
    
    // Fetch booking details
    const booking = await bookingService.getBookingById(bookingId);
    console.log(`📋 Booking details fetched in ${Date.now() - startTime}ms`);
    
    if (!booking) {
      console.error('❌ Booking not found after creation:', bookingId);
      return res.status(500).json(errorResponse('Failed to retrieve created booking'));
    }
    
    // Send confirmation email asynchronously (don't await)
    // This prevents email delays from blocking the response
    if (booking.customer_email) {
      EmailService.sendBookingConfirmation({
        customer_name: booking.customer_name || 'Customer',
        customer_email: booking.customer_email,
        booking_id: booking.id,
        hall_name: booking.hall_name || 'Hall',
        event_date: booking.event_date ? new Date(booking.event_date).toISOString() : new Date().toISOString(),
        time_slot: booking.time_slot || 'morning',
        package_name: booking.package_name || 'Standard Package',
        total_amount: typeof booking.total_amount === 'string' ? parseFloat(booking.total_amount) : booking.total_amount,
        advance_paid: typeof booking.advance_amount === 'string' ? parseFloat(booking.advance_amount) : booking.advance_amount,
        balance_amount: typeof booking.balance_amount === 'string' ? parseFloat(booking.balance_amount) : booking.balance_amount,
        payment_mode: booking.payment_mode || 'cash',
      }).catch(emailError => {
        console.error('❌ Failed to send confirmation email:', emailError.message);
        // Email failure doesn't affect booking creation
      });
    }
    
    console.log(`🎉 Booking creation completed in ${Date.now() - startTime}ms`);
    res.status(201).json(successResponse('Booking created successfully', booking));
    
  } catch (error: unknown) {
    const bookingError = error instanceof Error ? error : new Error('Unknown booking error');
    console.error('❌ Error creating booking:', {
      message: bookingError.message,
      stack: bookingError.stack,
      duration: `${Date.now() - startTime}ms`
    });
    throw error; // Let asyncHandler handle it
  }
});

/**
 * PUT /api/bookings/:id
 * Update booking
 */
export const updateBooking = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await bookingService.updateBooking(id, req.body);
  const booking = await bookingService.getBookingById(id);
  res.json(successResponse('Booking updated successfully', booking));
});

/**
 * POST /api/bookings/:id/confirm
 * Confirm booking
 */
export const confirmBooking = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await bookingService.confirmBooking(id);
  const booking = await bookingService.getBookingById(id);
  res.json(successResponse('Booking confirmed successfully', booking));
});

/**
 * POST /api/bookings/:id/cancel
 * Cancel booking
 */
export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await bookingService.cancelBooking(id);
  const booking = await bookingService.getBookingById(id);
  res.json(successResponse('Booking cancelled successfully', booking));
});

/**
 * POST /api/bookings/:id/complete
 * Complete booking
 */
export const completeBooking = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await bookingService.completeBooking(id);
  const booking = await bookingService.getBookingById(id);
  res.json(successResponse('Booking completed successfully', booking));
});
