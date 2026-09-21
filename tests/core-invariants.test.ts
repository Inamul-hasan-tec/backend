import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

export function testBookingCreationPilotGuards() {
  const source = readFileSync(
    join(__dirname, '..', 'src', 'services', 'BookingService.ts'),
    'utf8'
  );

  assert.match(
    source,
    /RateService\.preview\(\{[\s\S]*?totalAmount[\s\S]*?isPositiveNumber\(totalAmount\)/,
    'Booking creation must use server-side rate preview and reject non-positive totals'
  );

  assert.match(
    source,
    /isDateWithinCurrentTenantSlotEntitlement\(eventDate\)/,
    'Booking creation must reject dates outside the active subscription period'
  );

  assert.match(
    source,
    /findIdByIdempotencyKey\(idempotencyKey\)/,
    'Booking creation must return the existing booking for a repeated idempotency key'
  );

  assert.match(
    source,
    /existing\.status === 'cancelled'[\s\S]*?return true/,
    'Booking cancellation must be idempotent after the booking is already cancelled'
  );
}
