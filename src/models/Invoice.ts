/**
 * Invoice Model
 * Represents tax invoices, receipts, credit notes, and debit notes
 */

export type InvoiceType = 'tax_invoice' | 'receipt_voucher' | 'credit_note' | 'debit_note';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'cancelled' | 'void';
export type SupplyType = 'intrastate' | 'interstate';

export interface Invoice {
  id: number;
  invoice_number: string;
  invoice_type: InvoiceType;
  invoice_date: Date;
  due_date: Date | null;
  booking_id: number | null;
  customer_id: number;
  
  // Customer details (snapshot at time of invoice)
  customer_name: string;
  customer_gstin: string | null;
  customer_pan: string | null;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_state_code: string;
  customer_pincode: string;
  customer_phone: string;
  customer_email: string;
  
  // Business details (snapshot)
  business_name: string;
  business_gstin: string | null;
  business_address: string;
  business_city: string;
  business_state: string;
  business_state_code: string;
  business_pincode: string;
  business_phone: string;
  business_email: string;
  
  // Supply details
  supply_type: SupplyType;
  place_of_supply: string;
  
  // Amounts
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  round_off: number;
  grand_total: number;
  
  // Payment tracking
  amount_paid: number;
  balance_amount: number;
  status: InvoiceStatus;
  
  // Additional info
  notes: string | null;
  terms_conditions: string | null;
  payment_instructions: string | null;
  
  // References
  reference_number: string | null;
  original_invoice_id: number | null; // For credit/debit notes
  
  // Metadata
  created_by: number;
  created_at: Date;
  updated_at: Date;
  issued_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
}

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  line_number: number;
  description: string;
  sac_hsn: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  taxable_value: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  total_amount: number;
  service_id: number | null;
  created_at: Date;
}

export interface CreateInvoiceDTO {
  invoice_type: InvoiceType;
  invoice_date?: Date;
  due_date?: Date | null;
  booking_id?: number | null;
  customer_id: number;
  
  // Line items
  line_items: CreateInvoiceLineItemDTO[];
  
  // Optional overrides
  discount_amount?: number;
  notes?: string | null;
  terms_conditions?: string | null;
  payment_instructions?: string | null;
  reference_number?: string | null;
  original_invoice_id?: number | null;
}

export interface CreateInvoiceLineItemDTO {
  description: string;
  sac_hsn: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percentage?: number;
  gst_rate: number;
  cess_rate?: number;
  service_id?: number | null;
}

export interface UpdateInvoiceDTO {
  due_date?: Date | null;
  notes?: string | null;
  terms_conditions?: string | null;
  payment_instructions?: string | null;
  reference_number?: string | null;
}

export interface InvoiceFilters {
  invoice_type?: InvoiceType;
  status?: InvoiceStatus;
  customer_id?: number;
  booking_id?: number;
  from_date?: Date;
  to_date?: Date;
  search?: string;
}

export interface InvoiceSummary {
  total_invoices: number;
  total_amount: number;
  total_paid: number;
  total_pending: number;
  by_status: {
    [key in InvoiceStatus]?: {
      count: number;
      amount: number;
    };
  };
  by_type: {
    [key in InvoiceType]?: {
      count: number;
      amount: number;
    };
  };
}

export interface PaymentAllocation {
  invoice_id: number;
  amount: number;
}

export interface RecordPaymentDTO {
  payment_date: Date;
  amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'netbanking' | 'cheque' | 'other';
  transaction_reference: string | null;
  notes: string | null;
  allocations: PaymentAllocation[];
}
