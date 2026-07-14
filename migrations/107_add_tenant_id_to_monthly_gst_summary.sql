-- Migration: Recreate monthly_gst_summary VIEW with tenant_id
-- Description: Make GST summary tenant-specific
-- Date: 2026-01-05

-- Drop existing VIEW
DROP VIEW IF EXISTS monthly_gst_summary;

-- Recreate VIEW with tenant_id (fixed GROUP BY)
CREATE OR REPLACE VIEW monthly_gst_summary AS
SELECT 
  i.tenant_id,
  YEAR(i.invoice_date) AS invoice_year,
  MONTH(i.invoice_date) AS invoice_month,
  i.invoice_type,
  CASE 
    WHEN c.state = bc.state THEN 'Intra-State'
    ELSE 'Inter-State'
  END AS supply_type,
  COUNT(*) AS invoice_count,
  SUM(i.taxable_amount) AS total_taxable,
  SUM(i.cgst_amount) AS total_cgst,
  SUM(i.sgst_amount) AS total_sgst,
  SUM(i.igst_amount) AS total_igst,
  0 AS total_cess,
  SUM(i.total_tax) AS total_tax_amount,
  SUM(i.grand_total) AS total_amount
FROM invoices i
LEFT JOIN customers c ON i.customer_id = c.id AND i.tenant_id = c.tenant_id
LEFT JOIN business_config bc ON i.tenant_id = bc.tenant_id
GROUP BY 
  i.tenant_id,
  YEAR(i.invoice_date),
  MONTH(i.invoice_date),
  i.invoice_type,
  CASE 
    WHEN c.state = bc.state THEN 'Intra-State'
    ELSE 'Inter-State'
  END;

-- Migration complete
SELECT 'Migration 107 completed: monthly_gst_summary recreated with tenant_id' AS status;
