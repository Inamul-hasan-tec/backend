/**
 * Payment Model
 * Represents payment transactions
 */

export interface Payment {
  id: number;
  booking_id: number;
  amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  payment_type: 'advance' | 'balance' | 'full' | 'refund';
  transaction_id?: string;
  payment_date: Date;
  notes?: string;
  received_by?: number;
  created_at: Date;
}

export interface CreatePaymentDTO {
  booking_id: number;
  amount: number;
  payment_mode: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  payment_type: 'advance' | 'balance' | 'full' | 'refund';
  transaction_id?: string;
  payment_date: string | Date;
  notes?: string;
  received_by?: number;
}
