import assert from 'node:assert/strict';
import { validatePaymentTotal } from '../src/repositories/PaymentRepository';
import {
  getTenantId,
  runWithTenantContext,
} from '../src/utils/tenantContext';
import {
  normalizeBookingDate,
  validateBookingAmounts,
} from '../src/services/BookingService';

export function testPaymentTotals() {
  assert.equal(validatePaymentTotal(250, 500, 1000), 750);
  assert.throws(
    () => validatePaymentTotal(0, 0, 1000),
    /must be positive/i
  );
  assert.throws(
    () => validatePaymentTotal(501, 500, 1000),
    /exceeds the booking balance/i
  );
}

export function testTenantContextIsolation() {
  assert.throws(() => getTenantId(), /tenant context is missing/i);

  const tenantOne = runWithTenantContext(
    { tenantId: 11, userId: 101, role: 'admin' },
    () => getTenantId()
  );
  const tenantTwo = runWithTenantContext(
    { tenantId: 22, userId: 202, role: 'admin' },
    () => getTenantId()
  );

  assert.equal(tenantOne, 11);
  assert.equal(tenantTwo, 22);
}

export function testBookingUpdateInvariants() {
  assert.equal(validateBookingAmounts(1000, 250), 750);
  assert.throws(
    () => validateBookingAmounts(0, 0),
    /must be a positive number/i
  );
  assert.throws(
    () => validateBookingAmounts(1000, -1),
    /cannot be negative/i
  );
  assert.throws(
    () => validateBookingAmounts(1000, 1001),
    /cannot exceed total/i
  );
  assert.equal(normalizeBookingDate('2026-07-10T00:00:00.000Z'), '2026-07-10');
  assert.equal(
    normalizeBookingDate(new Date('2026-07-10T00:00:00.000Z')),
    '2026-07-10'
  );
}
