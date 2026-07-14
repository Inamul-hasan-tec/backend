import { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface PaymentAllocationInput {
  invoice_id: number;
  amount: number;
}

export interface LockedInvoiceRow extends RowDataPacket {
  id: number;
  booking_id: number | null;
  grand_total: number;
  amount_paid: number;
  balance_amount: number;
  status: string;
}

const ACTIVE_PAYMENT_STATUS_SQL = `COALESCE(status, 'recorded') NOT IN ('reversed', 'refunded', 'failed')`;

export function isActivePaymentStatus(status?: string | null): boolean {
  return !['reversed', 'refunded', 'failed'].includes(status || 'recorded');
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validatePositiveMoney(amount: number, label = 'Payment amount'): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be positive`);
  }
  return roundMoney(amount);
}

export function validateAllocationTotal(
  paymentAmount: number,
  allocations: PaymentAllocationInput[]
): void {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error('At least one invoice allocation is required');
  }

  const totalAllocated = roundMoney(
    allocations.reduce((sum, allocation) => {
      return sum + validatePositiveMoney(Number(allocation.amount), 'Allocation amount');
    }, 0)
  );

  if (Math.abs(totalAllocated - paymentAmount) > 0.01) {
    throw new Error('Total allocated amount must match payment amount');
  }
}

export async function assertUniqueTransactionReference(
  connection: PoolConnection,
  tenantId: number,
  transactionId?: string | null
): Promise<void> {
  if (!transactionId) {
    return;
  }

  const [duplicateRows] = await connection.execute<RowDataPacket[]>(
    `SELECT id
     FROM payments
     WHERE tenant_id = ? AND transaction_id = ?
     LIMIT 1`,
    [tenantId, transactionId]
  );
  if (duplicateRows.length > 0) {
    throw new Error('Transaction reference has already been recorded');
  }
}

export async function findPaymentByIdempotencyKey(
  connection: PoolConnection,
  tenantId: number,
  idempotencyKey?: string | null
): Promise<number | null> {
  if (!idempotencyKey) {
    return null;
  }

  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id
     FROM payments
     WHERE tenant_id = ? AND idempotency_key = ?
     LIMIT 1`,
    [tenantId, idempotencyKey]
  );

  return rows[0]?.id ? Number(rows[0].id) : null;
}

export async function generatePaymentReceiptNumber(
  connection: PoolConnection,
  tenantId: number
): Promise<string> {
  const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT receipt_number
     FROM payments
     WHERE tenant_id = ? AND receipt_number LIKE ?
     ORDER BY id DESC
     LIMIT 1`,
    [tenantId, `RCPT-${datePrefix}-T${tenantId}-%`]
  );

  const lastReceipt = rows[0]?.receipt_number;
  const nextSequence = lastReceipt
    ? Number(String(lastReceipt).split('-').pop() || '0') + 1
    : 1;

  return `RCPT-${datePrefix}-T${tenantId}-${String(nextSequence).padStart(4, '0')}`;
}

export async function insertBookingPayment(
  connection: PoolConnection,
  data: {
    tenantId: number;
    bookingId: number;
    amount: number;
    paymentMode: string;
    paymentType: string;
    transactionId?: string | null;
    paymentDate: string | Date;
    notes?: string | null;
    receivedBy?: number | null;
    status?: string;
    idempotencyKey?: string | null;
    receiptNumber?: string | null;
  }
): Promise<number> {
  const [paymentResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO payments (
      tenant_id, booking_id, amount, payment_mode, payment_type,
      transaction_id, payment_date, notes, received_by, status,
      idempotency_key, receipt_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tenantId,
      data.bookingId,
      data.amount,
      data.paymentMode,
      data.paymentType,
      data.transactionId || null,
      data.paymentDate,
      data.notes || null,
      data.receivedBy || null,
      data.status || 'recorded',
      data.idempotencyKey || null,
      data.receiptNumber || null,
    ]
  );

  return paymentResult.insertId;
}

export async function lockBookingAndValidatePayment(
  connection: PoolConnection,
  tenantId: number,
  bookingId: number,
  paymentAmount: number
): Promise<{ totalAmount: number; updatedTotalPaid: number }> {
  const [bookingRows] = await connection.execute<RowDataPacket[]>(
    `SELECT id, total_amount
     FROM bookings
     WHERE id = ? AND tenant_id = ?
     FOR UPDATE`,
    [bookingId, tenantId]
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new Error('Booking not found');
  }

  const [paymentRows] = await connection.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments
     WHERE booking_id = ? AND tenant_id = ?
       AND ${ACTIVE_PAYMENT_STATUS_SQL}`,
    [bookingId, tenantId]
  );
  const totalPaid = Number(paymentRows[0]?.total_paid || 0);
  const totalAmount = Number(booking.total_amount);
  const updatedTotalPaid = roundMoney(totalPaid + paymentAmount);

  if (updatedTotalPaid > totalAmount) {
    throw new Error('Payment amount exceeds the booking balance');
  }

  return { totalAmount, updatedTotalPaid };
}

export async function recalculateBookingPaymentTotals(
  connection: PoolConnection,
  tenantId: number,
  bookingId: number
): Promise<{ totalAmount: number; totalPaid: number; balanceAmount: number }> {
  const [bookingRows] = await connection.execute<RowDataPacket[]>(
    `SELECT id, total_amount
     FROM bookings
     WHERE id = ? AND tenant_id = ?
     FOR UPDATE`,
    [bookingId, tenantId]
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new Error('Booking not found');
  }

  const [paymentRows] = await connection.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments
     WHERE booking_id = ? AND tenant_id = ?
       AND ${ACTIVE_PAYMENT_STATUS_SQL}`,
    [bookingId, tenantId]
  );
  const totalAmount = Number(booking.total_amount);
  const totalPaid = roundMoney(Number(paymentRows[0]?.total_paid || 0));
  await updateBookingPaymentTotals(connection, tenantId, bookingId, totalAmount, totalPaid);

  return {
    totalAmount,
    totalPaid,
    balanceAmount: roundMoney(totalAmount - totalPaid),
  };
}

export async function updateBookingPaymentTotals(
  connection: PoolConnection,
  tenantId: number,
  bookingId: number,
  totalAmount: number,
  updatedTotalPaid: number
): Promise<void> {
  const balanceAmount = roundMoney(totalAmount - updatedTotalPaid);
  await connection.execute(
    `UPDATE bookings
     SET advance_amount = ?,
         balance_amount = ?,
         payment_status = CASE
           WHEN ? <= 0 THEN 'paid'
           WHEN ? > 0 THEN 'partial'
           ELSE 'unpaid'
         END,
         updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [
      updatedTotalPaid,
      balanceAmount,
      balanceAmount,
      updatedTotalPaid,
      bookingId,
      tenantId,
    ]
  );
}

export async function lockInvoicesForAllocation(
  connection: PoolConnection,
  tenantId: number,
  allocations: PaymentAllocationInput[]
): Promise<LockedInvoiceRow[]> {
  const invoices: LockedInvoiceRow[] = [];
  for (const allocation of allocations) {
    const [invoiceRows] = await connection.execute<LockedInvoiceRow[]>(
      `SELECT id, booking_id, grand_total, amount_paid, balance_amount, status
       FROM invoices
       WHERE id = ? AND tenant_id = ?
       FOR UPDATE`,
      [allocation.invoice_id, tenantId]
    );
    const invoice = invoiceRows[0];
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (!invoice.booking_id) {
      throw new Error('Invoice must be linked to a booking before payment can be recorded');
    }
    if (['cancelled', 'void'].includes(invoice.status)) {
      throw new Error('Cancelled invoices cannot receive payments');
    }
    if (Number(allocation.amount) > Number(invoice.balance_amount)) {
      throw new Error('Payment allocation exceeds invoice balance');
    }
    invoices.push(invoice);
  }
  return invoices;
}

export function assertSingleBookingForInvoices(invoices: LockedInvoiceRow[]): number {
  const bookingId = invoices[0]?.booking_id;
  if (!bookingId) {
    throw new Error('Invoice allocation requires a booking-linked invoice');
  }
  if (invoices.some((invoice) => invoice.booking_id !== bookingId)) {
    throw new Error('One payment can only be allocated to invoices from the same booking');
  }
  return bookingId;
}

export async function allocatePaymentToInvoices(
  connection: PoolConnection,
  tenantId: number,
  paymentId: number,
  allocations: PaymentAllocationInput[]
): Promise<void> {
  for (const allocation of allocations) {
    const amount = validatePositiveMoney(Number(allocation.amount), 'Allocation amount');
    await connection.execute(
      `INSERT INTO invoice_payment_allocations (
        tenant_id, invoice_id, payment_id, amount
      ) VALUES (?, ?, ?, ?)`,
      [tenantId, allocation.invoice_id, paymentId, amount]
    );
    await connection.execute(
      `UPDATE invoices
       SET amount_paid = ROUND(amount_paid + ?, 2),
           balance_amount = ROUND(balance_amount - ?, 2),
           payment_status = CASE
             WHEN ROUND(balance_amount - ?, 2) <= 0 THEN 'paid'
             WHEN ROUND(amount_paid + ?, 2) > 0 THEN 'partial'
             ELSE 'unpaid'
           END,
           status = CASE
             WHEN ROUND(balance_amount - ?, 2) <= 0 THEN 'paid'
             WHEN ROUND(amount_paid + ?, 2) > 0 THEN 'partially_paid'
             ELSE status
           END,
           updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        amount,
        amount,
        amount,
        amount,
        amount,
        amount,
        allocation.invoice_id,
        tenantId,
      ]
    );
  }
}

export async function allocatePaymentToOpenBookingInvoices(
  connection: PoolConnection,
  tenantId: number,
  bookingId: number,
  paymentId: number,
  amount: number
): Promise<void> {
  let remaining = validatePositiveMoney(amount);
  const [invoiceRows] = await connection.execute<LockedInvoiceRow[]>(
    `SELECT id, booking_id, grand_total, amount_paid, balance_amount, status
     FROM invoices
     WHERE tenant_id = ?
       AND booking_id = ?
       AND balance_amount > 0
       AND status NOT IN ('cancelled', 'void')
     ORDER BY invoice_date ASC, id ASC
     FOR UPDATE`,
    [tenantId, bookingId]
  );

  for (const invoice of invoiceRows) {
    if (remaining <= 0) {
      break;
    }
    const allocationAmount = roundMoney(
      Math.min(remaining, Number(invoice.balance_amount))
    );
    await allocatePaymentToInvoices(connection, tenantId, paymentId, [
      { invoice_id: invoice.id, amount: allocationAmount },
    ]);
    remaining = roundMoney(remaining - allocationAmount);
  }
}

export async function allocateExistingBookingPaymentsToInvoice(
  connection: PoolConnection,
  tenantId: number,
  bookingId: number,
  invoiceId: number,
  invoiceBalance: number
): Promise<void> {
  let remainingInvoiceBalance = roundMoney(invoiceBalance);
  const [paymentRows] = await connection.execute<RowDataPacket[]>(
    `SELECT p.id, p.amount, COALESCE(SUM(ipa.amount), 0) AS allocated_amount
     FROM payments p
     LEFT JOIN invoice_payment_allocations ipa
       ON ipa.payment_id = p.id
      AND ipa.tenant_id = p.tenant_id
     WHERE p.tenant_id = ?
       AND p.booking_id = ?
       AND ${ACTIVE_PAYMENT_STATUS_SQL.replace(/status/g, 'p.status')}
     GROUP BY p.id, p.amount
     HAVING ROUND(p.amount - allocated_amount, 2) > 0
     ORDER BY p.payment_date ASC, p.id ASC`,
    [tenantId, bookingId]
  );

  for (const payment of paymentRows) {
    if (remainingInvoiceBalance <= 0) {
      break;
    }
    const unallocatedAmount = roundMoney(
      Number(payment.amount) - Number(payment.allocated_amount || 0)
    );
    const allocationAmount = roundMoney(
      Math.min(unallocatedAmount, remainingInvoiceBalance)
    );
    await allocatePaymentToInvoices(connection, tenantId, Number(payment.id), [
      { invoice_id: invoiceId, amount: allocationAmount },
    ]);
    remainingInvoiceBalance = roundMoney(remainingInvoiceBalance - allocationAmount);
  }
}
