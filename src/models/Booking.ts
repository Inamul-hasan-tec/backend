/**
 * Booking Model
 * Represents hall bookings
 */

export interface Booking {
  id: number;
  customer_id: number;
  hall_id: number;
  package_id?: number;
  event_date: Date;
  time_slot?: 'morning' | 'afternoon' | 'night';
  slot_id?: number;
  event_type: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  guest_count?: number;
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBookingDTO {
  customer_id: number;
  hall_id: number;
  package_id?: number;
  event_date: string | Date;
  time_slot?: 'morning' | 'afternoon' | 'night';
  slot_id?: number;
  event_type: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  guest_count?: number;
  total_amount: number;
  advance_amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  notes?: string;
  created_by?: number;
}

export interface UpdateBookingDTO {
  customer_id?: number;
  hall_id?: number;
  package_id?: number;
  event_date?: string | Date;
  time_slot?: 'morning' | 'afternoon' | 'night';
  slot_id?: number;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  guest_count?: number;
  total_amount?: number;
  advance_amount?: number;
  payment_mode?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

export interface BookingDetails extends Booking {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  hall_name: string;
  hall_capacity: number;
  hall_location?: string;
  package_name?: string;
  package_price?: number;
  created_by_name?: string;
}

export interface BookingSearchParams {
  customer_id?: number;
  hall_id?: number;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  event_date_from?: string;
  event_date_to?: string;
  limit?: number;
  offset?: number;
}
