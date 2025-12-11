/**
 * Business Configuration Model
 * Represents the business GST configuration and settings
 */

export interface BusinessConfig {
  id: number;
  business_name: string;
  gstin: string | null;
  pan: string | null;
  state: string;
  state_code: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  website: string | null;
  
  // Business Model Configuration
  business_type: 'hall_rental' | 'hotel_with_hall' | 'banquet' | 'resort';
  services_offered: string[]; // JSON array
  pricing_model: 'package' | 'itemized' | 'hourly';
  
  // GST Configuration
  is_gst_registered: boolean;
  annual_turnover: number;
  gst_registration_date: string | null;
  composition_scheme: boolean;
  
  // Payment Terms
  advance_percentage: number;
  allow_multiple_payments: boolean;
  cancellation_policy: 'tiered' | 'full_refund' | 'no_refund' | 'custom';
  cancellation_rules: CancellationRule[];
  
  // Bank Details
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  
  // Branding
  logo_url: string | null;
  invoice_prefix: string;
  receipt_prefix: string;
  credit_note_prefix: string;
  debit_note_prefix: string;
  
  // Counters
  invoice_counter: number;
  receipt_counter: number;
  credit_note_counter: number;
  debit_note_counter: number;
  financial_year_start: number;
  
  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CancellationRule {
  days_before_event: number;
  refund_percentage: number;
}

export interface UpdateBusinessConfigDTO {
  business_name?: string;
  gstin?: string | null;
  pan?: string | null;
  state?: string;
  state_code?: string;
  address?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string | null;
  business_type?: 'hall_rental' | 'hotel_with_hall' | 'banquet' | 'resort';
  services_offered?: string[];
  pricing_model?: 'package' | 'itemized' | 'hourly';
  is_gst_registered?: boolean;
  annual_turnover?: number;
  gst_registration_date?: string | null;
  composition_scheme?: boolean;
  advance_percentage?: number;
  allow_multiple_payments?: boolean;
  cancellation_policy?: 'tiered' | 'full_refund' | 'no_refund' | 'custom';
  cancellation_rules?: CancellationRule[];
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  logo_url?: string | null;
  invoice_prefix?: string;
  receipt_prefix?: string;
  credit_note_prefix?: string;
  debit_note_prefix?: string;
  financial_year_start?: number;
}
