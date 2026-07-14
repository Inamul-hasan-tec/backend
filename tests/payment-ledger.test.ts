import assert from 'node:assert/strict';
import {
  assertSingleBookingForInvoices,
  isActivePaymentStatus,
  validateAllocationTotal,
  validatePositiveMoney,
} from '../src/repositories/PaymentLedgerRepository';

export function testPaymentLedgerInvariants() {
  assert.equal(validatePositiveMoney(100.005), 100.01);
  assert.throws(
    () => validatePositiveMoney(0),
    /must be positive/i
  );

  assert.doesNotThrow(() =>
    validateAllocationTotal(500, [
      { invoice_id: 1, amount: 200 },
      { invoice_id: 2, amount: 300 },
    ])
  );
  assert.throws(
    () => validateAllocationTotal(500, [{ invoice_id: 1, amount: 499 }]),
    /must match payment amount/i
  );

  assert.equal(
    assertSingleBookingForInvoices([
      {
        id: 1,
        booking_id: 10,
        grand_total: 1000,
        amount_paid: 0,
        balance_amount: 1000,
        status: 'issued',
        constructor: { name: 'RowDataPacket' },
      } as any,
      {
        id: 2,
        booking_id: 10,
        grand_total: 2000,
        amount_paid: 0,
        balance_amount: 2000,
        status: 'issued',
        constructor: { name: 'RowDataPacket' },
      } as any,
    ]),
    10
  );
  assert.throws(
    () =>
      assertSingleBookingForInvoices([
        {
          id: 1,
          booking_id: 10,
          grand_total: 1000,
          amount_paid: 0,
          balance_amount: 1000,
          status: 'issued',
          constructor: { name: 'RowDataPacket' },
        } as any,
        {
          id: 2,
          booking_id: 20,
          grand_total: 2000,
          amount_paid: 0,
          balance_amount: 2000,
          status: 'issued',
          constructor: { name: 'RowDataPacket' },
        } as any,
      ]),
    /same booking/i
  );

  assert.equal(isActivePaymentStatus(undefined), true);
  assert.equal(isActivePaymentStatus(null), true);
  assert.equal(isActivePaymentStatus('recorded'), true);
  assert.equal(isActivePaymentStatus('verified'), true);
  assert.equal(isActivePaymentStatus('reversed'), false);
  assert.equal(isActivePaymentStatus('refunded'), false);
  assert.equal(isActivePaymentStatus('failed'), false);
}
