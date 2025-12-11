/**
 * Smart Billing Calculator
 * Calculates optimized billing with legal tax optimization
 */

export interface BillingBreakdown {
  service_code: string;
  description: string;
  sac_hsn: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_subtotal: number;
  discount_percentage?: number;
  discount_amount?: number;
  taxable_value: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  category: 'primary' | 'support' | 'reimbursement' | 'deposit';
  is_taxable: boolean;
  legal_justification?: string;
}

export interface OptimizedBillingResult {
  billing_strategy: 'standard' | 'composite_scheme' | 'optimized';
  line_items: BillingBreakdown[];
  subtotal: number;
  taxable_amount: number;
  non_taxable_amount: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  grand_total: number;
  effective_gst_rate: number;
  tax_savings: number;
  savings_percentage: number;
  comparison: {
    standard_tax: number;
    standard_total: number;
    optimized_tax: number;
    optimized_total: number;
    savings: number;
  };
}

export class SmartBillingCalculator {
  /**
   * Calculate optimized billing breakdown
   */
  static calculateOptimizedBilling(
    totalAmount: number,
    supplyType: 'intrastate' | 'interstate',
    billingStrategy: 'standard' | 'composite_scheme' | 'optimized' = 'optimized'
  ): OptimizedBillingResult {
    
    if (billingStrategy === 'standard') {
      return this.calculateStandardBilling(totalAmount, supplyType);
    }
    
    if (billingStrategy === 'composite_scheme') {
      return this.calculateCompositeSchemeBilling(totalAmount);
    }
    
    return this.calculateOptimizedBreakdown(totalAmount, supplyType);
  }

  /**
   * Standard billing (100% at 18% GST)
   */
  private static calculateStandardBilling(
    totalAmount: number,
    supplyType: 'intrastate' | 'interstate'
  ): OptimizedBillingResult {
    const gstRate = 18;
    const taxAmount = totalAmount * (gstRate / 100);
    
    const lineItem: BillingBreakdown = {
      service_code: 'VENUE_STANDARD',
      description: 'Venue Rental',
      sac_hsn: '9972',
      quantity: 1,
      unit: 'day',
      unit_price: totalAmount,
      line_subtotal: totalAmount,
      taxable_value: totalAmount,
      gst_rate: gstRate,
      cgst_rate: supplyType === 'intrastate' ? 9 : 0,
      sgst_rate: supplyType === 'intrastate' ? 9 : 0,
      igst_rate: supplyType === 'interstate' ? 18 : 0,
      cgst_amount: supplyType === 'intrastate' ? taxAmount / 2 : 0,
      sgst_amount: supplyType === 'intrastate' ? taxAmount / 2 : 0,
      igst_amount: supplyType === 'interstate' ? taxAmount : 0,
      total_tax: taxAmount,
      total_amount: totalAmount + taxAmount,
      category: 'primary',
      is_taxable: true
    };

    return {
      billing_strategy: 'standard',
      line_items: [lineItem],
      subtotal: totalAmount,
      taxable_amount: totalAmount,
      non_taxable_amount: 0,
      discount_amount: 0,
      cgst_amount: lineItem.cgst_amount,
      sgst_amount: lineItem.sgst_amount,
      igst_amount: lineItem.igst_amount,
      total_tax: taxAmount,
      grand_total: totalAmount + taxAmount,
      effective_gst_rate: 18,
      tax_savings: 0,
      savings_percentage: 0,
      comparison: {
        standard_tax: taxAmount,
        standard_total: totalAmount + taxAmount,
        optimized_tax: taxAmount,
        optimized_total: totalAmount + taxAmount,
        savings: 0
      }
    };
  }

  /**
   * Composite scheme billing (6% flat GST)
   */
  private static calculateCompositeSchemeBilling(totalAmount: number): OptimizedBillingResult {
    const gstRate = 6;
    const taxAmount = totalAmount * (gstRate / 100);
    const standardTax = totalAmount * 0.18;
    
    const lineItem: BillingBreakdown = {
      service_code: 'COMPOSITE',
      description: 'Services (Composite Scheme)',
      sac_hsn: '9972',
      quantity: 1,
      unit: 'nos',
      unit_price: totalAmount,
      line_subtotal: totalAmount,
      taxable_value: totalAmount,
      gst_rate: gstRate,
      cgst_rate: 3,
      sgst_rate: 3,
      igst_rate: 0,
      cgst_amount: taxAmount / 2,
      sgst_amount: taxAmount / 2,
      igst_amount: 0,
      total_tax: taxAmount,
      total_amount: totalAmount + taxAmount,
      category: 'primary',
      is_taxable: true,
      legal_justification: 'Composite scheme under Section 10 of CGST Act, 2017'
    };

    return {
      billing_strategy: 'composite_scheme',
      line_items: [lineItem],
      subtotal: totalAmount,
      taxable_amount: totalAmount,
      non_taxable_amount: 0,
      discount_amount: 0,
      cgst_amount: lineItem.cgst_amount,
      sgst_amount: lineItem.sgst_amount,
      igst_amount: 0,
      total_tax: taxAmount,
      grand_total: totalAmount + taxAmount,
      effective_gst_rate: 6,
      tax_savings: standardTax - taxAmount,
      savings_percentage: ((standardTax - taxAmount) / standardTax) * 100,
      comparison: {
        standard_tax: standardTax,
        standard_total: totalAmount + standardTax,
        optimized_tax: taxAmount,
        optimized_total: totalAmount + taxAmount,
        savings: standardTax - taxAmount
      }
    };
  }

  /**
   * Optimized billing breakdown (Smart categorization)
   */
  private static calculateOptimizedBreakdown(
    totalAmount: number,
    supplyType: 'intrastate' | 'interstate'
  ): OptimizedBillingResult {
    
    // Smart breakdown percentages (can be customized)
    const breakdown = {
      venue: totalAmount * 0.30,           // 30% - 18% GST
      maintenance: totalAmount * 0.15,     // 15% - 18% GST
      coordination: totalAmount * 0.12,    // 12% - 18% GST
      catering: totalAmount * 0.25,        // 25% - 5% GST
      electricity: totalAmount * 0.08,     // 8% - 0% GST (Reimbursement)
      security: totalAmount * 0.10         // 10% - 0% GST (Refundable)
    };

    const lineItems: BillingBreakdown[] = [];

    // 1. Venue Rental (18% GST)
    const venueItem = this.createLineItem(
      'VENUE_RENTAL',
      'Venue Rental',
      '9972',
      breakdown.venue,
      18,
      supplyType,
      'primary',
      true
    );
    lineItems.push(venueItem);

    // 2. Maintenance & Cleaning (18% GST)
    const maintenanceItem = this.createLineItem(
      'MAINT_CLEAN',
      'Maintenance & Cleaning Services',
      '9973',
      breakdown.maintenance,
      18,
      supplyType,
      'support',
      true,
      'Pre-event cleaning, maintenance, and upkeep services'
    );
    lineItems.push(maintenanceItem);

    // 3. Event Coordination (18% GST)
    const coordItem = this.createLineItem(
      'EVENT_COORD',
      'Event Coordination & Management',
      '9972',
      breakdown.coordination,
      18,
      supplyType,
      'support',
      true,
      'Event planning and coordination services'
    );
    lineItems.push(coordItem);

    // 4. Catering (5% GST - Outdoor catering)
    const cateringItem = this.createLineItem(
      'CATERING',
      'Outdoor Catering Services',
      '9963',
      breakdown.catering,
      5,
      supplyType,
      'primary',
      true,
      'Outdoor catering service - 5% GST applicable'
    );
    lineItems.push(cateringItem);

    // 5. Electricity Reimbursement (0% GST)
    const electricityItem = this.createLineItem(
      'ELEC_REIMB',
      'Electricity Charges (Actual Cost Reimbursement)',
      'N/A',
      breakdown.electricity,
      0,
      supplyType,
      'reimbursement',
      false,
      'Reimbursement of actual electricity cost - No GST applicable. Meter reading based. Supporting document required.'
    );
    lineItems.push(electricityItem);

    // 6. Security Deposit (0% GST)
    const securityItem = this.createLineItem(
      'SEC_DEP',
      'Security Deposit (Refundable)',
      'N/A',
      breakdown.security,
      0,
      supplyType,
      'deposit',
      false,
      'Refundable security deposit - No GST applicable. Refunded within 7 days if no damages.'
    );
    lineItems.push(securityItem);

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_subtotal, 0);
    const taxableAmount = lineItems
      .filter(item => item.is_taxable)
      .reduce((sum, item) => sum + item.taxable_value, 0);
    const nonTaxableAmount = lineItems
      .filter(item => !item.is_taxable)
      .reduce((sum, item) => sum + item.line_subtotal, 0);
    
    const cgstAmount = lineItems.reduce((sum, item) => sum + item.cgst_amount, 0);
    const sgstAmount = lineItems.reduce((sum, item) => sum + item.sgst_amount, 0);
    const igstAmount = lineItems.reduce((sum, item) => sum + item.igst_amount, 0);
    const totalTax = lineItems.reduce((sum, item) => sum + item.total_tax, 0);
    const grandTotal = subtotal + totalTax;

    // Calculate standard billing for comparison
    const standardTax = totalAmount * 0.18;
    const standardTotal = totalAmount + standardTax;
    const savings = standardTax - totalTax;
    const effectiveGstRate = (totalTax / taxableAmount) * 100;

    return {
      billing_strategy: 'optimized',
      line_items: lineItems,
      subtotal,
      taxable_amount: taxableAmount,
      non_taxable_amount: nonTaxableAmount,
      discount_amount: 0,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_tax: totalTax,
      grand_total: grandTotal,
      effective_gst_rate: Math.round(effectiveGstRate * 100) / 100,
      tax_savings: Math.round(savings * 100) / 100,
      savings_percentage: Math.round((savings / standardTax) * 100 * 100) / 100,
      comparison: {
        standard_tax: standardTax,
        standard_total: standardTotal,
        optimized_tax: totalTax,
        optimized_total: grandTotal,
        savings: savings
      }
    };
  }

  /**
   * Helper: Create line item
   */
  private static createLineItem(
    serviceCode: string,
    description: string,
    sacHsn: string,
    amount: number,
    gstRate: number,
    supplyType: 'intrastate' | 'interstate',
    category: 'primary' | 'support' | 'reimbursement' | 'deposit',
    isTaxable: boolean,
    legalJustification?: string
  ): BillingBreakdown {
    
    const taxableValue = isTaxable ? amount : 0;
    let cgstRate = 0, sgstRate = 0, igstRate = 0;
    
    if (isTaxable) {
      if (supplyType === 'intrastate') {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
      } else {
        igstRate = gstRate;
      }
    }

    const cgstAmount = (taxableValue * cgstRate) / 100;
    const sgstAmount = (taxableValue * sgstRate) / 100;
    const igstAmount = (taxableValue * igstRate) / 100;
    const totalTax = cgstAmount + sgstAmount + igstAmount;

    return {
      service_code: serviceCode,
      description,
      sac_hsn: sacHsn,
      quantity: 1,
      unit: 'nos',
      unit_price: amount,
      line_subtotal: amount,
      taxable_value: taxableValue,
      gst_rate: gstRate,
      cgst_rate: cgstRate,
      sgst_rate: sgstRate,
      igst_rate: igstRate,
      cgst_amount: Math.round(cgstAmount * 100) / 100,
      sgst_amount: Math.round(sgstAmount * 100) / 100,
      igst_amount: Math.round(igstAmount * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      total_amount: Math.round((amount + totalTax) * 100) / 100,
      category,
      is_taxable: isTaxable,
      legal_justification: legalJustification
    };
  }

  /**
   * Generate dual quotation (Standard vs Optimized)
   */
  static generateDualQuotation(
    totalAmount: number,
    supplyType: 'intrastate' | 'interstate'
  ) {
    const standard = this.calculateStandardBilling(totalAmount, supplyType);
    const optimized = this.calculateOptimizedBreakdown(totalAmount, supplyType);
    const composite = this.calculateCompositeSchemeBilling(totalAmount);

    return {
      standard,
      optimized,
      composite,
      recommendation: {
        best_for_customer: optimized.grand_total < composite.grand_total ? 'optimized' : 'composite',
        max_savings: Math.max(optimized.tax_savings, composite.tax_savings),
        recommendation_text: optimized.tax_savings > composite.tax_savings
          ? 'Optimized billing recommended - Maximum savings with proper documentation'
          : 'Composite scheme recommended - Lowest tax rate'
      }
    };
  }
}
