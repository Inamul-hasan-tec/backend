/**
 * Package Model
 * Represents service packages for events
 */

export interface Package {
  id: number;
  name: string;
  base_price: number;
  description?: string;
  inclusions?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreatePackageDTO {
  name: string;
  base_price: number;
  description?: string;
  inclusions?: string;
  status?: 'active' | 'inactive';
}

export interface UpdatePackageDTO {
  name?: string;
  base_price?: number;
  description?: string;
  inclusions?: string;
  status?: 'active' | 'inactive';
}

export interface PackageSearchParams {
  name?: string;
  status?: 'active' | 'inactive';
  limit?: number;
  offset?: number;
}
