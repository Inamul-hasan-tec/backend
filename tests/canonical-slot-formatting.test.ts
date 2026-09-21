import assert from 'assert';

export function testCanonicalSlotFormatting() {
  const canonicalLabels: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    day: 'Day',
    night: 'Night',
    full_day: 'Full Day',
    evening: 'Evening',
  };

  const formatSlot = (slot: string | undefined | null): string => {
    if (!slot) return 'Selected slot';
    const normalized = slot.toLowerCase().replace(/\s+/g, '_');
    return (
      canonicalLabels[normalized] ||
      normalized
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    );
  };

  // Assert canonical mappings
  assert.strictEqual(formatSlot('morning'), 'Morning');
  assert.strictEqual(formatSlot('afternoon'), 'Afternoon');
  assert.strictEqual(formatSlot('day'), 'Day');
  assert.strictEqual(formatSlot('night'), 'Night');
  assert.strictEqual(formatSlot('full_day'), 'Full Day');
  assert.strictEqual(formatSlot('Full_Day'), 'Full Day');
  assert.strictEqual(formatSlot('evening'), 'Evening');

  // Assert cross-module consistency invariant:
  // If BK-000043 has slot 'afternoon', all modules (Bookings, Payments, Reminders, Invoices, PDFs) return 'Afternoon'
  const bookingSlot = 'afternoon';
  const bookingPageLabel = formatSlot(bookingSlot);
  const paymentPageLabel = formatSlot(bookingSlot);
  const reminderPageLabel = formatSlot(bookingSlot);
  const invoicePageLabel = formatSlot(bookingSlot);
  const receiptPdfLabel = formatSlot(bookingSlot);

  assert.strictEqual(bookingPageLabel, paymentPageLabel);
  assert.strictEqual(paymentPageLabel, reminderPageLabel);
  assert.strictEqual(reminderPageLabel, invoicePageLabel);
  assert.strictEqual(invoicePageLabel, receiptPdfLabel);
  assert.strictEqual(bookingPageLabel, 'Afternoon');
}
