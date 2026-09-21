# HallSync Payment Machine

Payments are financial records. They must be append-friendly, tenant-scoped, auditable, and reversible without deleting history.

## Six-step operating model

1. **Record**
   - A payment can be recorded only against a tenant-owned booking or booking-linked invoice.
   - Amount must be positive and cannot exceed the active booking balance.
   - UPI, bank transfer, card, and cheque payments require a transaction/reference number.
   - Each write can include an idempotency key so accidental double-clicks/retries do not create duplicate payments.
   - Each payment receives a tenant-scoped receipt number.

2. **Validate**
   - The booking/invoice rows are locked during payment writes.
   - Duplicate transaction references are rejected per tenant.
   - Cross-tenant rows are never selected or updated.

3. **Allocate**
   - Booking payments update booking paid/balance totals.
   - Invoice payments allocate the received amount against invoice balances.
   - Existing booking payments are allocated to newly created booking-linked invoices where possible.

4. **Verify**
   - Owners/admins can mark a recorded payment as verified after checking bank/UPI/cash/cheque evidence.
   - Verification does not change the amount; it strengthens trust in the record.

5. **Reverse / Fail**
   - Payments are not deleted from the ledger.
   - A mistaken payment can be reversed with a reason.
   - A cheque/UPI/bank/card payment can be marked failed with a reason.
   - Reversal/failure recalculates booking and invoice paid/balance totals from active payments only.

6. **Audit & Report**
   - Payment record, verify, reverse, and fail actions are written to the tenant audit log.
   - Reports and totals exclude inactive statuses: `reversed`, `refunded`, and `failed`.

## Current status

Implemented:

- Payment status lifecycle: `recorded`, `verified`, `reversed`, `failed`.
- Idempotency keys for direct booking and invoice payment recording.
- Tenant-scoped receipt numbers.
- Transaction reference validation for non-cash modes.
- Reversal/failure with required reason.
- Booking/invoice total recalculation after reversal/failure.
- Tenant audit entries for payment actions.
- Frontend confirmation step before recording payments.
- Frontend actions to verify, reverse, or mark payments failed.

Planned next:

- A dedicated correction/refund workflow with approval rules.
- Better reason modal UI instead of browser prompts.
- Payment proof upload/review when object storage is configured.
- Reconciliation dashboard for unverified, failed, reversed, and overdue payment records.
