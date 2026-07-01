import {
  testPlatformAccountRejectedFromTenantMiddleware,
  testRolePermissions,
} from './authorization-boundaries.test';
import {
  testBookingUpdateInvariants,
  testPaymentTotals,
  testTenantContextIsolation,
} from './core-invariants.test';
import {
  testInvoiceCalculations,
  testInvoiceCalculationValidation,
} from './invoice-calculations.test';
import { testInvoicePDFGeneration } from './invoice-pdf.test';
import { testInvoiceEmailComposition } from './invoice-email.test';
import { testPaymentLedgerInvariants } from './payment-ledger.test';
import { testAuditRedaction } from './audit-redaction.test';
import { testSubscriptionPolicy } from './subscription-policy.test';
import { testRequestLogging } from './request-logging.test';
import { testLoginRateLimiter } from './login-rate-limiter.test';
import { testAuthSessionPolicy } from './auth-session-policy.test';
import { testLoggerRedaction } from './logger-redaction.test';
import { testErrorMonitor } from './error-monitor.test';
import { testProofPrivacy, testProofAuthorizationMiddleware } from './proof-privacy.test';

async function run() {
  testRolePermissions();
  await testPlatformAccountRejectedFromTenantMiddleware();
  testPaymentTotals();
  testTenantContextIsolation();
  testBookingUpdateInvariants();
  testInvoiceCalculations();
  testInvoiceCalculationValidation();
  await testInvoicePDFGeneration();
  await testInvoiceEmailComposition();
  testPaymentLedgerInvariants();
  testAuditRedaction();
  testSubscriptionPolicy();
  testRequestLogging();
  testLoginRateLimiter();
  await testAuthSessionPolicy();
  testLoggerRedaction();
  testErrorMonitor();
  testProofPrivacy();
  await testProofAuthorizationMiddleware();
  console.log('Hall Sync reliability tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
