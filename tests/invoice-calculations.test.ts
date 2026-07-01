import assert from 'node:assert/strict';
import GSTCalculator, { LineItem } from '../src/services/GSTCalculator';

const baseLine: LineItem = {
  description: 'Hall rental',
  quantity: 1,
  unit_price: 10000,
  gst_rate: 18,
  sac_hsn: '997212',
};

export function testInvoiceCalculations() {
  const intrastate = GSTCalculator.calculateGST([baseLine], '29', '29', false);
  assert.deepEqual(
    {
      supply_type: intrastate.supply_type,
      subtotal: intrastate.subtotal,
      taxable_amount: intrastate.taxable_amount,
      cgst_amount: intrastate.cgst_amount,
      sgst_amount: intrastate.sgst_amount,
      igst_amount: intrastate.igst_amount,
      grand_total: intrastate.grand_total,
    },
    {
      supply_type: 'intrastate',
      subtotal: 10000,
      taxable_amount: 10000,
      cgst_amount: 900,
      sgst_amount: 900,
      igst_amount: 0,
      grand_total: 11800,
    }
  );

  const interstate = GSTCalculator.calculateGST([baseLine], '29', '33', false);
  assert.equal(interstate.supply_type, 'interstate');
  assert.equal(interstate.cgst_amount, 0);
  assert.equal(interstate.sgst_amount, 0);
  assert.equal(interstate.igst_amount, 1800);
  assert.equal(interstate.grand_total, 11800);

  const discounted = GSTCalculator.calculateGST(
    [{ ...baseLine, quantity: 2, unit_price: 1000, discount_amount: 200 }],
    '1',
    '01',
    false,
    300
  );
  assert.equal(discounted.supply_type, 'intrastate');
  assert.equal(discounted.subtotal, 2000);
  assert.equal(discounted.discount_amount, 500);
  assert.equal(discounted.taxable_amount, 1500);
  assert.equal(discounted.total_tax, 270);
  assert.equal(discounted.grand_total, 1770);

  const rounded = GSTCalculator.calculateGST(
    [{ ...baseLine, unit_price: 100.01 }],
    '29',
    '29',
    true
  );
  assert.equal(rounded.total_tax, 18);
  assert.equal(rounded.round_off, -0.01);
  assert.equal(rounded.grand_total, 118);
}

export function testInvoiceCalculationValidation() {
  assert.throws(
    () => GSTCalculator.calculateGST([], '29', '29'),
    /at least one invoice line item/i
  );
  assert.throws(
    () => GSTCalculator.calculateGST([{ ...baseLine, quantity: 0 }], '29', '29'),
    /quantity must be positive/i
  );
  assert.throws(
    () => GSTCalculator.calculateGST([{ ...baseLine, gst_rate: 7 }], '29', '29'),
    /GST rate is invalid/i
  );
  assert.throws(
    () =>
      GSTCalculator.calculateGST(
        [{ ...baseLine, discount_amount: 10001 }],
        '29',
        '29'
      ),
    /discount cannot exceed/i
  );
  assert.throws(
    () => GSTCalculator.calculateGST([baseLine], '99', '29'),
    /business state code is invalid/i
  );
  assert.throws(
    () => GSTCalculator.calculateGST([baseLine], '29', '29', true, 10001),
    /invoice discount cannot exceed/i
  );
}
