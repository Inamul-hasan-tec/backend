/**
 * GST Calculation Engine
 * Handles all GST-related calculations for invoices
 */

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  gst_rate: number;
  sac_hsn: string;
}

export interface GSTCalculationResult {
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
  supply_type: 'intrastate' | 'interstate';
  line_items: CalculatedLineItem[];
}

export interface CalculatedLineItem extends LineItem {
  line_subtotal: number;
  taxable_value: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_tax: number;
  total_amount: number;
}

export class GSTCalculator {
  /**
   * Calculate GST for invoice
   * @param lineItems - Array of line items
   * @param businessStateCode - Business state code (e.g., '29' for Karnataka)
   * @param customerStateCode - Customer state code
   * @param roundOffEnabled - Whether to apply round-off
   */
  static calculateGST(
    lineItems: LineItem[],
    businessStateCode: string,
    customerStateCode: string,
    roundOffEnabled: boolean = true,
    invoiceDiscountAmount: number = 0
  ): GSTCalculationResult {
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      throw new Error('At least one invoice line item is required');
    }

    const normalizedBusinessStateCode = this.normalizeStateCode(businessStateCode);
    const normalizedCustomerStateCode = this.normalizeStateCode(customerStateCode);
    if (!this.isValidStateCode(normalizedBusinessStateCode)) {
      throw new Error('Business state code is invalid');
    }
    if (!this.isValidStateCode(normalizedCustomerStateCode)) {
      throw new Error('Customer state code is invalid');
    }

    lineItems.forEach((item, index) => this.validateLineItem(item, index));

    if (!Number.isFinite(invoiceDiscountAmount) || invoiceDiscountAmount < 0) {
      throw new Error('Invoice discount must be a non-negative number');
    }

    const taxableBeforeInvoiceDiscount = lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.unit_price - (item.discount_amount || 0);
    }, 0);
    if (invoiceDiscountAmount > taxableBeforeInvoiceDiscount) {
      throw new Error('Invoice discount cannot exceed the taxable amount');
    }

    const discountedLineItems = this.allocateInvoiceDiscount(
      lineItems,
      invoiceDiscountAmount,
      taxableBeforeInvoiceDiscount
    );

    // Determine supply type
    const supplyType =
      normalizedBusinessStateCode === normalizedCustomerStateCode
        ? 'intrastate'
        : 'interstate';

    // Calculate each line item
    const calculatedLineItems: CalculatedLineItem[] = discountedLineItems.map((item) => {
      return this.calculateLineItem(item, supplyType);
    });

    // Sum up all amounts
    const subtotal = calculatedLineItems.reduce((sum, item) => sum + item.line_subtotal, 0);
    const discount_amount = calculatedLineItems.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    const taxable_amount = calculatedLineItems.reduce((sum, item) => sum + item.taxable_value, 0);
    const cgst_amount = calculatedLineItems.reduce((sum, item) => sum + item.cgst_amount, 0);
    const sgst_amount = calculatedLineItems.reduce((sum, item) => sum + item.sgst_amount, 0);
    const igst_amount = calculatedLineItems.reduce((sum, item) => sum + item.igst_amount, 0);
    const cess_amount = calculatedLineItems.reduce((sum, item) => sum + item.cess_amount, 0);
    const total_tax = calculatedLineItems.reduce((sum, item) => sum + item.total_tax, 0);

    // Calculate invoice total before round-off
    const invoice_total_before_roundoff = taxable_amount + total_tax;

    // Apply round-off
    let round_off = 0;
    let grand_total = invoice_total_before_roundoff;

    if (roundOffEnabled) {
      grand_total = Math.round(invoice_total_before_roundoff);
      round_off = grand_total - invoice_total_before_roundoff;
    }

    return {
      subtotal: this.roundTo2Decimals(subtotal),
      discount_amount: this.roundTo2Decimals(discount_amount),
      taxable_amount: this.roundTo2Decimals(taxable_amount),
      cgst_amount: this.roundTo2Decimals(cgst_amount),
      sgst_amount: this.roundTo2Decimals(sgst_amount),
      igst_amount: this.roundTo2Decimals(igst_amount),
      cess_amount: this.roundTo2Decimals(cess_amount),
      total_tax: this.roundTo2Decimals(total_tax),
      round_off: this.roundTo2Decimals(round_off),
      grand_total: this.roundTo2Decimals(grand_total),
      supply_type: supplyType,
      line_items: calculatedLineItems,
    };
  }

  private static validateLineItem(item: LineItem, index: number): void {
    const lineNumber = index + 1;
    if (!item.description?.trim()) {
      throw new Error(`Line ${lineNumber} description is required`);
    }
    if (!item.sac_hsn?.trim()) {
      throw new Error(`Line ${lineNumber} SAC/HSN is required`);
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`Line ${lineNumber} quantity must be positive`);
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      throw new Error(`Line ${lineNumber} unit price cannot be negative`);
    }
    if (!this.isValidGSTRate(item.gst_rate)) {
      throw new Error(`Line ${lineNumber} GST rate is invalid`);
    }

    const discount = item.discount_amount || 0;
    const subtotal = item.quantity * item.unit_price;
    if (!Number.isFinite(discount) || discount < 0) {
      throw new Error(`Line ${lineNumber} discount cannot be negative`);
    }
    if (discount > subtotal) {
      throw new Error(`Line ${lineNumber} discount cannot exceed its subtotal`);
    }
  }

  private static allocateInvoiceDiscount(
    lineItems: LineItem[],
    invoiceDiscountAmount: number,
    taxableBeforeInvoiceDiscount: number
  ): LineItem[] {
    if (invoiceDiscountAmount === 0) {
      return lineItems.map((item) => ({ ...item }));
    }

    let allocated = 0;
    return lineItems.map((item, index) => {
      const existingDiscount = item.discount_amount || 0;
      const lineTaxable = item.quantity * item.unit_price - existingDiscount;
      const isLastLine = index === lineItems.length - 1;
      const allocation = isLastLine
        ? this.roundTo2Decimals(invoiceDiscountAmount - allocated)
        : this.roundTo2Decimals(
            invoiceDiscountAmount * (lineTaxable / taxableBeforeInvoiceDiscount)
          );
      allocated += allocation;

      return {
        ...item,
        discount_amount: this.roundTo2Decimals(existingDiscount + allocation),
      };
    });
  }

  /**
   * Calculate single line item
   */
  private static calculateLineItem(
    item: LineItem,
    supplyType: 'intrastate' | 'interstate'
  ): CalculatedLineItem {
    // Calculate line subtotal
    const line_subtotal = item.quantity * item.unit_price;

    // Apply discount
    const discount = item.discount_amount || 0;
    const taxable_value = line_subtotal - discount;

    // Calculate GST based on supply type
    let cgst_rate = 0;
    let sgst_rate = 0;
    let igst_rate = 0;
    let cgst_amount = 0;
    let sgst_amount = 0;
    let igst_amount = 0;

    if (supplyType === 'intrastate') {
      // Intrastate: CGST + SGST (split GST rate equally)
      cgst_rate = item.gst_rate / 2;
      sgst_rate = item.gst_rate / 2;
      cgst_amount = (taxable_value * cgst_rate) / 100;
      sgst_amount = (taxable_value * sgst_rate) / 100;
    } else {
      // Interstate: IGST (full GST rate)
      igst_rate = item.gst_rate;
      igst_amount = (taxable_value * igst_rate) / 100;
    }

    // Cess (if applicable) - currently 0 for most services
    const cess_amount = 0;

    // Total tax for this line
    const total_tax = cgst_amount + sgst_amount + igst_amount + cess_amount;

    // Total amount including tax
    const total_amount = taxable_value + total_tax;

    return {
      ...item,
      line_subtotal: this.roundTo2Decimals(line_subtotal),
      taxable_value: this.roundTo2Decimals(taxable_value),
      cgst_rate: this.roundTo2Decimals(cgst_rate),
      sgst_rate: this.roundTo2Decimals(sgst_rate),
      igst_rate: this.roundTo2Decimals(igst_rate),
      cgst_amount: this.roundTo2Decimals(cgst_amount),
      sgst_amount: this.roundTo2Decimals(sgst_amount),
      igst_amount: this.roundTo2Decimals(igst_amount),
      cess_amount: this.roundTo2Decimals(cess_amount),
      total_tax: this.roundTo2Decimals(total_tax),
      total_amount: this.roundTo2Decimals(total_amount),
    };
  }

  /**
   * Round to 2 decimal places
   */
  private static roundTo2Decimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate refund amount based on cancellation policy
   * @param totalAmount - Total booking amount
   * @param daysBeforeEvent - Days before event date
   * @param cancellationRules - Cancellation policy rules
   */
  static calculateRefund(
    totalAmount: number,
    daysBeforeEvent: number,
    cancellationRules: { days_before_event: number; refund_percentage: number }[]
  ): {
    refund_amount: number;
    refund_percentage: number;
    deduction_amount: number;
  } {
    // Sort rules by days_before_event in descending order
    const sortedRules = [...cancellationRules].sort(
      (a, b) => b.days_before_event - a.days_before_event
    );

    // Find applicable rule
    let refund_percentage = 0;
    for (const rule of sortedRules) {
      if (daysBeforeEvent >= rule.days_before_event) {
        refund_percentage = rule.refund_percentage;
        break;
      }
    }

    // Calculate amounts
    const refund_amount = (totalAmount * refund_percentage) / 100;
    const deduction_amount = totalAmount - refund_amount;

    return {
      refund_amount: this.roundTo2Decimals(refund_amount),
      refund_percentage,
      deduction_amount: this.roundTo2Decimals(deduction_amount),
    };
  }

  /**
   * Generate tax calculation explanation
   * @param result - GST calculation result
   */
  static generateTaxExplanation(result: GSTCalculationResult): string {
    const lines: string[] = [];

    lines.push(`Supply Type: ${result.supply_type === 'intrastate' ? 'Intrastate (Same State)' : 'Interstate (Different States)'}`);
    lines.push(`Subtotal: ₹${result.subtotal.toFixed(2)}`);

    if (result.discount_amount > 0) {
      lines.push(`Discount: -₹${result.discount_amount.toFixed(2)}`);
    }

    lines.push(`Taxable Amount: ₹${result.taxable_amount.toFixed(2)}`);

    if (result.supply_type === 'intrastate') {
      lines.push(`CGST: ₹${result.cgst_amount.toFixed(2)}`);
      lines.push(`SGST: ₹${result.sgst_amount.toFixed(2)}`);
    } else {
      lines.push(`IGST: ₹${result.igst_amount.toFixed(2)}`);
    }

    if (result.cess_amount > 0) {
      lines.push(`Cess: ₹${result.cess_amount.toFixed(2)}`);
    }

    lines.push(`Total Tax: ₹${result.total_tax.toFixed(2)}`);

    if (result.round_off !== 0) {
      lines.push(`Round Off: ${result.round_off >= 0 ? '+' : ''}₹${result.round_off.toFixed(2)}`);
    }

    lines.push(`Grand Total: ₹${result.grand_total.toFixed(2)}`);

    return lines.join('\n');
  }

  /**
   * Validate state code
   */
  static isValidStateCode(stateCode: string): boolean {
    if (!/^\d{1,2}$/.test(String(stateCode).trim())) {
      return false;
    }
    const code = Number.parseInt(stateCode, 10);
    return code >= 1 && code <= 38;
  }

  static normalizeStateCode(stateCode: string): string {
    return String(stateCode || '').trim().padStart(2, '0');
  }

  /**
   * Validate GST rate
   */
  static isValidGSTRate(rate: number): boolean {
    const validRates = [0, 0.25, 3, 5, 12, 18, 28];
    return validRates.includes(rate);
  }

  /**
   * Get state name from code
   */
  static getStateName(stateCode: string): string {
    const stateMap: { [key: string]: string } = {
      '01': 'Jammu and Kashmir',
      '02': 'Himachal Pradesh',
      '03': 'Punjab',
      '04': 'Chandigarh',
      '05': 'Uttarakhand',
      '06': 'Haryana',
      '07': 'Delhi',
      '08': 'Rajasthan',
      '09': 'Uttar Pradesh',
      '10': 'Bihar',
      '11': 'Sikkim',
      '12': 'Arunachal Pradesh',
      '13': 'Nagaland',
      '14': 'Manipur',
      '15': 'Mizoram',
      '16': 'Tripura',
      '17': 'Meghalaya',
      '18': 'Assam',
      '19': 'West Bengal',
      '20': 'Jharkhand',
      '21': 'Odisha',
      '22': 'Chhattisgarh',
      '23': 'Madhya Pradesh',
      '24': 'Gujarat',
      '26': 'Dadra and Nagar Haveli and Daman and Diu',
      '27': 'Maharashtra',
      '29': 'Karnataka',
      '30': 'Goa',
      '31': 'Lakshadweep',
      '32': 'Kerala',
      '33': 'Tamil Nadu',
      '34': 'Puducherry',
      '35': 'Andaman and Nicobar Islands',
      '36': 'Telangana',
      '37': 'Andhra Pradesh',
      '38': 'Ladakh',
    };

    return stateMap[stateCode] || 'Unknown';
  }
}

export default GSTCalculator;
