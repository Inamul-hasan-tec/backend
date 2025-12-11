/**
 * Service Catalog Model
 * Represents services offered by the business with GST details
 */

export interface ServiceCatalog {
  id: number;
  service_code: string;
  name: string;
  category: ServiceCategory;
  
  // Pricing
  base_price: number;
  unit: ServiceUnit;
  min_quantity: number;
  max_quantity: number | null;
  
  // GST Details
  sac_code: string;
  hsn_code: string | null;
  gst_rate: number;
  is_taxable: boolean;
  tax_exemption_reason: string | null;
  
  // Description
  description: string | null;
  inclusions: string | null;
  terms: string | null;
  
  // Availability
  is_active: boolean;
  display_order: number;
  
  created_at: string;
  updated_at: string;
}

export type ServiceCategory = 
  | 'VENUE_RENTAL'
  | 'CATERING_INHOUSE'
  | 'CATERING_EXTERNAL'
  | 'DECORATION'
  | 'AV_EQUIPMENT'
  | 'PARKING'
  | 'ACCOMMODATION'
  | 'PHOTOGRAPHY'
  | 'DJ_MUSIC'
  | 'SECURITY'
  | 'OTHER';

export type ServiceUnit = 
  | 'day'
  | 'hour'
  | 'plate'
  | 'person'
  | 'set'
  | 'nos'
  | 'sqft';

export interface CreateServiceDTO {
  service_code: string;
  name: string;
  category: ServiceCategory;
  base_price: number;
  unit: ServiceUnit;
  min_quantity?: number;
  max_quantity?: number | null;
  sac_code: string;
  hsn_code?: string | null;
  gst_rate: number;
  is_taxable?: boolean;
  tax_exemption_reason?: string | null;
  description?: string | null;
  inclusions?: string | null;
  terms?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateServiceDTO {
  name?: string;
  category?: ServiceCategory;
  base_price?: number;
  unit?: ServiceUnit;
  min_quantity?: number;
  max_quantity?: number | null;
  sac_code?: string;
  hsn_code?: string | null;
  gst_rate?: number;
  is_taxable?: boolean;
  tax_exemption_reason?: string | null;
  description?: string | null;
  inclusions?: string | null;
  terms?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export interface ServiceListFilters {
  category?: ServiceCategory;
  is_active?: boolean;
  search?: string;
}
