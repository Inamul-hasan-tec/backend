/**
 * Customer Model
 * Represents customers who book halls
 */

export interface Customer {
  id: number;
  tenant_id?: number;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  notes?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface CustomerDependencyStats {
  active_bookings: number;
  cancelled_bookings: number;
  payments_count: number;
  invoices_count: number;
  total_paid: number;
  outstanding_balance: number;
}

export interface CreateCustomerDTO {
  tenant_id?: number;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  notes?: string;
  status?: 'active' | 'inactive' | 'archived';
}

export interface UpdateCustomerDTO {
  tenant_id?: number;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  notes?: string;
  status?: 'active' | 'inactive' | 'archived';
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  status?: 'active' | 'inactive' | 'archived';
  limit?: number;
  offset?: number;
}
