/**
 * Customer Model
 * Represents customers who book halls
 */

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  notes?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreateCustomerDTO {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  event_type?: 'wedding' | 'reception' | 'engagement' | 'birthday' | 'corporate' | 'other';
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface CustomerSearchParams {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  status?: 'active' | 'inactive';
  limit?: number;
  offset?: number;
}
