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

  // Inclusive GST test (Audit requirement: Rs 90,000 inclusive @ 18% = 76,271.19 taxable + 6,864.41 CGST + 6,864.40 SGST)
  const inclusiveIntra = GSTCalculator.calculateGST(
    [{ ...baseLine, unit_price: 90000, quantity: 1, gst_rate: 18 }],
    '29',
    '29',
    true,
    0,
    'inclusive'
  );
  assert.equal(inclusiveIntra.subtotal, 90000);
  assert.equal(inclusiveIntra.taxable_amount, 76271.19);
  assert.equal(inclusiveIntra.cgst_amount, 6864.41);
  assert.equal(inclusiveIntra.sgst_amount, 6864.40);
  assert.equal(inclusiveIntra.total_tax, 13728.81);
  assert.equal(inclusiveIntra.grand_total, 90000);
  assert.equal(inclusiveIntra.round_off, 0);

  // Interstate inclusive test
  const inclusiveInter = GSTCalculator.calculateGST(
    [{ ...baseLine, unit_price: 90000, quantity: 1, gst_rate: 18 }],
    '29',
    '33',
    true,
    0,
    'inclusive'
  );
  assert.equal(inclusiveInter.subtotal, 90000);
  assert.equal(inclusiveInter.taxable_amount, 76271.19);
  assert.equal(inclusiveInter.cgst_amount, 0);
  assert.equal(inclusiveInter.sgst_amount, 0);
  assert.equal(inclusiveInter.igst_amount, 13728.81);
  assert.equal(inclusiveInter.total_tax, 13728.81);
  assert.equal(inclusiveInter.grand_total, 90000);

  // Exempt tax treatment test
  const exemptItem = GSTCalculator.calculateGST(
    [{ ...baseLine, unit_price: 50000, quantity: 1, gst_rate: 18, tax_treatment: 'exempt' }],
    '29',
    '29',
    true,
    0,
    'inclusive'
  );
  assert.equal(exemptItem.taxable_amount, 50000);
  assert.equal(exemptItem.total_tax, 0);
  assert.equal(exemptItem.grand_total, 50000);
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
