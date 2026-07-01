-- Link canonical booking payments to invoices without creating a second ledger.

CREATE TABLE IF NOT EXISTS invoice_payment_allocations (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  invoice_id INT NOT NULL,
  payment_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_payment_allocation (invoice_id, payment_id),
  KEY idx_invoice_payment_allocations_tenant (tenant_id),
  KEY idx_invoice_payment_allocations_payment (payment_id),
  CONSTRAINT fk_invoice_payment_allocations_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_payment_allocations_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_payment_allocations_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT chk_invoice_payment_allocation_amount
    CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
