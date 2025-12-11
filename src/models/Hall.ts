/**
 * Hall Model
 * Represents marriage halls available for booking
 */

export interface Hall {
  id: number;
  name: string;
  capacity: number;
  base_price: number;
  description?: string;
  location?: string;
  amenities?: string;
  images?: string;
  features?: string;
  status: 'active' | 'inactive' | 'maintenance';
  created_at: Date;
  updated_at: Date;
}

export interface CreateHallDTO {
  name: string;
  capacity: number;
  base_price: number;
  description?: string;
  location?: string;
  amenities?: string;
  images?: string;
  features?: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface UpdateHallDTO {
  name?: string;
  capacity?: number;
  base_price?: number;
  description?: string;
  location?: string;
  amenities?: string;
  images?: string;
  features?: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface HallSearchParams {
  name?: string;
  min_capacity?: number;
  max_capacity?: number;
  status?: 'active' | 'inactive' | 'maintenance';
  limit?: number;
  offset?: number;
}
