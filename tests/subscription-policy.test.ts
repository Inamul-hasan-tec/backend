import assert from 'assert';

const { policyForDays } = require('../scripts/run_subscription_maintenance.js');

export function testSubscriptionPolicy(): void {
  assert.strictEqual(policyForDays(14, 7), 'current');
  assert.strictEqual(policyForDays(0, 7), 'current');
  assert.strictEqual(policyForDays(-1, 7), 'past_due');
  assert.strictEqual(policyForDays(-7, 7), 'past_due');
  assert.strictEqual(policyForDays(-8, 7), 'suspended');
}
