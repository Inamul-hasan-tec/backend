export type EmployeePersonType = 'employee' | 'vendor' | 'contractor';
export type EmployeeStatus = 'active' | 'inactive';
export type EmployeePaymentType = 'monthly' | 'daily' | 'hourly' | 'event' | 'vendor';
export type EventStaffStatus = 'planned' | 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';

export interface EmployeeProfile {
  id: number;
  tenant_id?: number;
  hall_id: number | null;
  hall_name?: string | null;
  person_type: EmployeePersonType;
  name: string;
  phone: string | null;
  email: string | null;
  primary_role: string;
  skills: string | null;
  payment_type: EmployeePaymentType;
  rate: number | null;
  vendor_company: string | null;
  status: EmployeeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeProfileDTO {
  hall_id?: number | null;
  person_type?: EmployeePersonType;
  name: string;
  phone?: string | null;
  email?: string | null;
  primary_role?: string;
  skills?: string | null;
  payment_type?: EmployeePaymentType;
  rate?: number | null;
  vendor_company?: string | null;
  status?: EmployeeStatus;
  notes?: string | null;
}

export interface EmployeeFilters {
  status?: EmployeeStatus;
  person_type?: EmployeePersonType;
  hall_id?: number | null;
  search?: string;
}

export interface EventStaffAssignment {
  id: number;
  tenant_id?: number;
  booking_id: number;
  employee_id: number | null;
  display_name: string;
  role: string;
  duty_area: string | null;
  shift_start: string | null;
  shift_end: string | null;
  status: EventStaffStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  payout_amount: number | null;
  notes: string | null;
  employee_phone?: string | null;
  employee_type?: EmployeePersonType | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventStaffAssignmentDTO {
  booking_id: number;
  employee_id?: number | null;
  display_name?: string;
  role: string;
  duty_area?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  status?: EventStaffStatus;
  payout_amount?: number | null;
  notes?: string | null;
}

export interface UpdateEventStaffAssignmentDTO {
  employee_id?: number | null;
  display_name?: string;
  role?: string;
  duty_area?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  status?: EventStaffStatus;
  payout_amount?: number | null;
  notes?: string | null;
}

export interface EventStaffConflict {
  assignment_id: number;
  booking_id: number;
  display_name: string;
  role: string;
  duty_area: string | null;
  status: EventStaffStatus;
  shift_start: string | null;
  shift_end: string | null;
  event_date: string;
  time_slot: string | null;
  customer_name: string | null;
  hall_name: string | null;
}

export interface EmployeeRosterSummary {
  total: number;
  planned: number;
  confirmed: number;
  checked_in: number;
  completed: number;
  no_show: number;
}
