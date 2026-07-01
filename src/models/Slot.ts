/**
 * Slot Model
 * Represents hall availability slots
 */

export interface Slot {
  id: number;
  hall_id: number;
  slot_date: Date;
  slot_type: 'morning' | 'afternoon' | 'night';
  status: 'available' | 'booked' | 'blocked';
  booking_id?: number | null;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SlotWithBookingDetails extends Slot {
  booking_details?: {
    customer_name: string;
    package_name: string;
    booking_id: number;
    total_amount: number;
    advance_paid: number;
  };
}

export interface CreateSlotDTO {
  hall_id: number;
  tenant_id: number;
  slot_date: string | Date;
  slot_type: 'morning' | 'afternoon' | 'night';
  status?: 'available' | 'booked' | 'blocked';
  booking_id?: number;
  notes?: string;
}

export interface UpdateSlotDTO {
  status?: 'available' | 'booked' | 'blocked';
  booking_id?: number | null;
  notes?: string;
}

export interface SlotSearchParams {
  hall_id?: number;
  date_from?: string;
  date_to?: string;
  status?: 'available' | 'booked' | 'blocked';
}
