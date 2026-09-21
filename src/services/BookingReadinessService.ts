import { BookingRepository } from '../repositories/BookingRepository';
import EmployeeRepository from '../repositories/EmployeeRepository';
import InventoryRepository from '../repositories/InventoryRepository';
import InvoiceRepository from '../repositories/InvoiceRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { getTenantId } from '../utils/tenantContext';

type ReadinessStatus = 'not_started' | 'needs_attention' | 'ready' | 'closed';

interface ReadinessSection {
  key: 'inventory' | 'staff' | 'payment' | 'invoice';
  label: string;
  status: ReadinessStatus;
  score: number;
  summary: string;
  action: string | null;
  meta: Record<string, number | string | boolean | null>;
}

export interface BookingReadinessSummary {
  booking_id: number;
  overall_status: ReadinessStatus;
  score: number;
  ready: boolean;
  closeout_ready: boolean;
  blockers: string[];
  warnings: string[];
  sections: ReadinessSection[];
}

export class BookingReadinessService {
  private bookingRepository = new BookingRepository();
  private settingsRepository = new SettingsRepository();

  async getReadiness(bookingId: number): Promise<BookingReadinessSummary | null> {
    const booking = await this.bookingRepository.getDetails(bookingId);
    if (!booking) return null;

    const operationSettings = await this.settingsRepository.getOperationSettings(getTenantId());
    if (!isEnabled(operationSettings?.enable_event_readiness)) {
      return {
        booking_id: bookingId,
        overall_status: 'ready',
        score: 100,
        ready: true,
        closeout_ready: false,
        blockers: [],
        warnings: ['Event readiness is disabled for this workspace.'],
        sections: [],
      };
    }

    const includeInventory = isEnabled(operationSettings?.include_inventory_in_readiness);
    const includeStaff =
      isEnabled(operationSettings?.include_staff_in_readiness) &&
      ['event_staffing', 'advanced'].includes(operationSettings?.employee_mode);
    const includePayment = isEnabled(operationSettings?.include_payment_in_readiness);
    const includeInvoice = isEnabled(operationSettings?.include_invoice_in_readiness);

    const [inventory, staff, invoices] = await Promise.all([
      includeInventory ? InventoryRepository.getReadinessSummary(bookingId) : Promise.resolve(null),
      includeStaff ? EmployeeRepository.getAssignments(bookingId) : Promise.resolve(null),
      includeInvoice ? InvoiceRepository.getAllInvoices({ booking_id: bookingId }) : Promise.resolve([]),
    ]);

    const balance = Math.max(Number(booking.balance_amount || 0), 0);
    const issuedInvoices = invoices.filter((invoice) => invoice.status !== 'cancelled' && invoice.status !== 'void');
    const paidInvoices = issuedInvoices.filter((invoice) => invoice.status === 'paid');
    const openInvoices = issuedInvoices.filter((invoice) =>
      ['draft', 'issued', 'sent', 'partially_paid', 'overdue'].includes(invoice.status)
    );

    const sections: ReadinessSection[] = [];
    if (includeInventory) sections.push(buildInventorySection(inventory));
    if (includeStaff) sections.push(buildStaffSection(staff));
    if (includePayment) sections.push(buildPaymentSection(balance));
    if (includeInvoice) sections.push(buildInvoiceSection(issuedInvoices.length, paidInvoices.length, openInvoices.length));

    if (sections.length === 0) {
      return {
        booking_id: bookingId,
        overall_status: 'ready',
        score: 100,
        ready: true,
        closeout_ready: false,
        blockers: [],
        warnings: ['Event readiness has no active checks for this workspace.'],
        sections,
      };
    }

    const blockers = sections
      .filter((section) => section.status === 'not_started' || section.status === 'needs_attention')
      .map((section) => section.summary);
    const warnings = sections
      .filter((section) => section.status === 'ready' && section.action)
      .map((section) => section.action as string);
    const score = Math.round(sections.reduce((total, section) => total + section.score, 0) / sections.length);
    const closeoutReady = sections.every((section) =>
      section.key === 'staff'
        ? section.status !== 'not_started' && section.status !== 'needs_attention'
        : section.status === 'ready' || section.status === 'closed'
    );
    const overallStatus: ReadinessStatus = closeoutReady
      ? 'closed'
      : blockers.length === 0
        ? 'ready'
        : sections.every((section) => section.status === 'not_started')
          ? 'not_started'
          : 'needs_attention';

    return {
      booking_id: bookingId,
      overall_status: overallStatus,
      score,
      ready: blockers.length === 0,
      closeout_ready: closeoutReady,
      blockers,
      warnings,
      sections,
    };
  }
}

function isEnabled(value: any): boolean {
  return value === undefined || value === null || value === true || value === 1;
}

function buildInventorySection(inventory: any): ReadinessSection {
  const total = Number(inventory.total_items || 0);
  const status = String(inventory.readiness_status || 'not_started');
  if (total === 0) {
    return {
      key: 'inventory',
      label: 'Inventory',
      status: 'not_started',
      score: 0,
      summary: 'No inventory requirements added',
      action: 'Add inventory requirements or setup kit',
      meta: { total_items: 0 },
    };
  }

  if (['short', 'needs_review', 'closed_with_issues'].includes(status)) {
    return {
      key: 'inventory',
      label: 'Inventory',
      status: 'needs_attention',
      score: 45,
      summary: 'Inventory needs review before event is ready',
      action: 'Resolve short, rental, damaged, or missing inventory lines',
      meta: inventory,
    };
  }

  if (['ready', 'dispatched', 'closed'].includes(status)) {
    return {
      key: 'inventory',
      label: 'Inventory',
      status: status === 'closed' ? 'closed' : 'ready',
      score: status === 'closed' ? 100 : 85,
      summary: status === 'dispatched' ? 'Inventory dispatched to venue' : 'Inventory ready',
      action: status === 'ready' ? 'Dispatch inventory on event day' : null,
      meta: inventory,
    };
  }

  return {
    key: 'inventory',
    label: 'Inventory',
    status: 'needs_attention',
    score: 35,
    summary: 'Inventory workflow is incomplete',
    action: 'Review inventory requirements',
    meta: inventory,
  };
}

function buildStaffSection(staff: any): ReadinessSection {
  const summary = staff.summary || {};
  const total = Number(summary.total || 0);
  const noShow = Number(summary.no_show || 0);
  const confirmed = Number(summary.confirmed || 0);
  const checkedIn = Number(summary.checked_in || 0);
  const completed = Number(summary.completed || 0);

  if (total === 0) {
    return {
      key: 'staff',
      label: 'Staff',
      status: 'not_started',
      score: 0,
      summary: 'No staff or vendor duties assigned',
      action: 'Assign event manager, vendor, or duty staff',
      meta: { total },
    };
  }

  if (noShow > 0) {
    return {
      key: 'staff',
      label: 'Staff',
      status: 'needs_attention',
      score: 55,
      summary: 'Staff roster has no-show records',
      action: 'Review no-show/replacement before closeout',
      meta: summary,
    };
  }

  if (completed === total) {
    return {
      key: 'staff',
      label: 'Staff',
      status: 'closed',
      score: 100,
      summary: 'All assigned duties completed',
      action: null,
      meta: summary,
    };
  }

  if (confirmed + checkedIn + completed === total) {
    return {
      key: 'staff',
      label: 'Staff',
      status: 'ready',
      score: checkedIn > 0 ? 90 : 80,
      summary: checkedIn > 0 ? 'Staff checked in for event' : 'Staff roster confirmed',
      action: checkedIn > 0 ? 'Complete duties after event' : 'Check in staff on event day',
      meta: summary,
    };
  }

  return {
    key: 'staff',
    label: 'Staff',
    status: 'needs_attention',
    score: 50,
    summary: 'Some staff duties are still only planned',
    action: 'Confirm staff/vendor duties',
    meta: summary,
  };
}

function buildPaymentSection(balance: number): ReadinessSection {
  return {
    key: 'payment',
    label: 'Payment',
    status: balance <= 0 ? 'ready' : 'needs_attention',
    score: balance <= 0 ? 100 : 55,
    summary: balance <= 0 ? 'Booking payment is clear' : 'Booking balance is pending',
    action: balance <= 0 ? null : 'Collect or record pending balance',
    meta: { balance_amount: balance },
  };
}

function buildInvoiceSection(total: number, paid: number, open: number): ReadinessSection {
  if (total === 0) {
    return {
      key: 'invoice',
      label: 'Invoice',
      status: 'not_started',
      score: 30,
      summary: 'No invoice created for this booking',
      action: 'Create invoice or receipt voucher',
      meta: { total, paid, open },
    };
  }

  if (open > 0) {
    return {
      key: 'invoice',
      label: 'Invoice',
      status: 'needs_attention',
      score: 65,
      summary: 'Invoice is open or partially paid',
      action: 'Issue/settle invoice before final closeout',
      meta: { total, paid, open },
    };
  }

  return {
    key: 'invoice',
    label: 'Invoice',
    status: 'ready',
    score: 100,
    summary: paid > 0 ? 'Invoice is paid' : 'Invoice workflow is clear',
    action: null,
    meta: { total, paid, open },
  };
}

export default new BookingReadinessService();
