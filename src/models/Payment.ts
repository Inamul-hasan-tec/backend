/**
 * Payment Model
 * Represents payment transactions
 */

export interface Payment {
  id: number;
  tenant_id: number;
  booking_id: number;
  amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  payment_type: 'advance' | 'balance' | 'full' | 'refund' | 'correction';
  transaction_id?: string;
  payment_date: Date;
  notes?: string;
  received_by?: number;
  status?: PaymentStatus;
  idempotency_key?: string | null;
  receipt_number?: string | null;
  verified_by?: number | null;
  verified_at?: Date | null;
  reversed_by?: number | null;
  reversed_at?: Date | null;
  reversal_reason?: string | null;
  failure_reason?: string | null;
  created_at: Date;
  updated_at?: Date;
}

export type PaymentStatus = 'recorded' | 'verified' | 'reversed' | 'refunded' | 'failed';

export interface CreatePaymentDTO {
  booking_id: number;
  amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  payment_type: 'advance' | 'balance' | 'full' | 'refund' | 'correction';
  transaction_id?: string;
  payment_date: string | Date;
  notes?: string;
  received_by?: number;
  idempotency_key?: string;
}
