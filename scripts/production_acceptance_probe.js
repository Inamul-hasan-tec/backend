const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const credentialsPath = path.join(__dirname, '../.acceptance-credentials.local.json');
const localCredentials = fs.existsSync(credentialsPath)
  ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
  : {};

const baseUrl = (
  process.env.ACCEPTANCE_API_BASE_URL ||
  localCredentials.api_base_url ||
  'http://localhost:5000/api'
).replace(/\/$/, '');

const accounts = {
  platform: {
    email: process.env.ACCEPTANCE_SUPER_ADMIN_EMAIL || localCredentials.platform?.email,
    password: process.env.ACCEPTANCE_SUPER_ADMIN_PASSWORD || localCredentials.platform?.password,
  },
  tenantA: {
    email: process.env.ACCEPTANCE_TENANT_A_EMAIL || localCredentials.tenantA?.email,
    password: process.env.ACCEPTANCE_TENANT_A_PASSWORD || localCredentials.tenantA?.password,
  },
  tenantB: {
    email: process.env.ACCEPTANCE_TENANT_B_EMAIL || localCredentials.tenantB?.email,
    password: process.env.ACCEPTANCE_TENANT_B_PASSWORD || localCredentials.tenantB?.password,
  },
  tenantAStaff2: {
    email: process.env.ACCEPTANCE_TENANT_A_STAFF2_EMAIL || localCredentials.tenantAStaff2?.email,
    password: process.env.ACCEPTANCE_TENANT_A_STAFF2_PASSWORD || localCredentials.tenantAStaff2?.password,
  },
  tenantAViewer: {
    email: process.env.ACCEPTANCE_TENANT_A_VIEWER_EMAIL || localCredentials.tenantAViewer?.email,
    password: process.env.ACCEPTANCE_TENANT_A_VIEWER_PASSWORD || localCredentials.tenantAViewer?.password,
  },
};

const results = [];

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  const marker = status === 'pass' ? 'PASS' : status === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`${marker} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
}

async function requestMultipart(path, token, formData) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
}

async function expectMultipartStatus(name, path, token, formData, allowedStatuses) {
  const { response, body } = await requestMultipart(path, token, formData);
  if (allowedStatuses.includes(response.status)) {
    record(name, 'pass', `HTTP ${response.status}`);
    return { ok: true, response, body };
  }

  record(
    name,
    'fail',
    `expected ${allowedStatuses.join('/')} got HTTP ${response.status}: ${JSON.stringify(body)}`
  );
  return { ok: false, response, body };
}

async function requestBinary(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/pdf',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer };
}

async function expectStatus(name, path, token, allowedStatuses, options = {}) {
  const { response, body } = await request(path, { ...options, token });
  if (allowedStatuses.includes(response.status)) {
    record(name, 'pass', `HTTP ${response.status}`);
    return { ok: true, response, body };
  }

  record(
    name,
    'fail',
    `expected ${allowedStatuses.join('/')} got HTTP ${response.status}: ${JSON.stringify(body)}`
  );
  return { ok: false, response, body };
}

async function login(label, account) {
  if (!account.email || !account.password) {
    record(`${label} login`, 'skip', 'credentials not configured');
    return null;
  }

  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });

  if (!response.ok || !body?.data?.token) {
    record(`${label} login`, 'fail', `HTTP ${response.status}: ${JSON.stringify(body)}`);
    return null;
  }

  record(`${label} login`, 'pass', body.data.user?.role || 'authenticated');
  return {
    token: body.data.token,
    user: body.data.user,
  };
}

function firstArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.data)) return value.data.data;
  return [];
}

function dataOf(body) {
  return body?.data?.data || body?.data || body;
}

function isoDateDaysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function uniqueAcceptanceSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function dateOffsetFromSuffix(suffix, baseDays) {
  return baseDays + Number(BigInt(suffix) % 3000n);
}

async function createJson(name, path, token, payload, allowedStatuses = [201]) {
  const result = await expectStatus(name, path, token, allowedStatuses, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.ok ? dataOf(result.body) : null;
}

async function putJson(name, path, token, payload, allowedStatuses = [200]) {
  return expectStatus(name, path, token, allowedStatuses, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async function postJson(name, path, token, payload = {}, allowedStatuses = [200]) {
  return expectStatus(name, path, token, allowedStatuses, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function acceptanceWriteWorkflow(tenantA, tenantAStaff2, tenantAViewer) {
  const suffix = uniqueAcceptanceSuffix();
  const phone = `9${suffix.slice(-9)}`;

  const customer = await createJson('tenant A admin can create acceptance customer', '/customers', tenantA.token, {
    name: `Acceptance Workflow Customer ${suffix}`,
    phone,
    email: `acceptance.workflow.${suffix}@hallsync.local`,
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    address: 'Acceptance workflow address',
    event_type: 'wedding',
    status: 'active',
  });
  if (!customer?.id) {
    record('tenant A workflow customer available', 'fail', 'customer creation did not return an ID');
    return;
  }

  if (tenantAViewer) {
    await createJson('tenant A viewer cannot create customers', '/customers', tenantAViewer.token, {
      name: `Blocked Viewer Customer ${suffix}`,
      phone: `8${suffix.slice(-9)}`,
    }, [403]);
  }

  if (tenantAStaff2) {
    await putJson(
      'tenant A staff_2 cannot update customers',
      `/customers/${customer.id}`,
      tenantAStaff2.token,
      { notes: 'staff_2 update must be blocked' },
      [403]
    );
    await createJson('tenant A staff_2 cannot create invoices', '/invoices', tenantAStaff2.token, {
      invoice_type: 'tax_invoice',
      customer_id: customer.id,
      line_items: [
        {
          description: 'Blocked staff invoice',
          sac_hsn: '9983',
          quantity: 1,
          unit: 'service',
          unit_price: 100,
          gst_rate: 18,
        },
      ],
    }, [403]);
  }

  const hallsResult = await expectStatus('tenant A can list active halls for workflow', '/halls/active', tenantA.token, [200]);
  const packagesResult = await expectStatus('tenant A can list active packages for workflow', '/packages/active', tenantA.token, [200]);
  const hall = firstArray(hallsResult.body)[0];
  const pkg = firstArray(packagesResult.body)[0];
  if (!hall?.id || !pkg?.id) {
    record('tenant A workflow fixtures available', 'fail', 'active hall/package fixture missing');
    return;
  }

  const eventDate = isoDateDaysFromNow(dateOffsetFromSuffix(suffix, 400));
  const bookingPayload = {
    customer_id: customer.id,
    hall_id: hall.id,
    package_id: pkg.id,
    event_date: eventDate,
    event_type: 'wedding',
    guest_count: 120,
    total_amount: 5000,
    advance_amount: 0,
    payment_mode: 'upi',
    notes: `Acceptance workflow booking ${suffix}`,
  };

  const racePayload = {
    ...bookingPayload,
    event_date: isoDateDaysFromNow(dateOffsetFromSuffix(suffix, 4000)),
    notes: `Acceptance concurrent booking ${suffix}`,
  };
  const bookingRace = await Promise.all([
    request('/bookings', {
      method: 'POST',
      token: tenantA.token,
      body: JSON.stringify(racePayload),
    }),
    request('/bookings', {
      method: 'POST',
      token: tenantA.token,
      body: JSON.stringify(racePayload),
    }),
  ]);
  const bookingRaceStatuses = bookingRace.map((item) => item.response.status).sort();
  const raceWinner = bookingRace.find((item) => item.response.status === 201);
  if (
    bookingRaceStatuses.filter((status) => status === 201).length === 1 &&
    bookingRaceStatuses.filter((status) => [400, 409].includes(status)).length === 1
  ) {
    record('concurrent booking race allows exactly one slot claim', 'pass', bookingRaceStatuses.join('/'));
  } else {
    record('concurrent booking race allows exactly one slot claim', 'fail', bookingRaceStatuses.join('/'));
  }

  const raceBooking = dataOf(raceWinner?.body);
  if (raceBooking?.id) {
    const concurrentPaymentPayload = (transactionId) => ({
      booking_id: raceBooking.id,
      amount: 3000,
      payment_mode: 'upi',
      payment_type: 'balance',
      transaction_id: transactionId,
      payment_date: new Date().toISOString(),
    });
    const paymentRace = await Promise.all([
      request('/payments', {
        method: 'POST',
        token: tenantA.token,
        body: JSON.stringify(concurrentPaymentPayload(`ACC-RACE-A-${suffix}`)),
      }),
      request('/payments', {
        method: 'POST',
        token: tenantA.token,
        body: JSON.stringify(concurrentPaymentPayload(`ACC-RACE-B-${suffix}`)),
      }),
    ]);
    const paymentRaceStatuses = paymentRace.map((item) => item.response.status).sort();
    if (
      paymentRaceStatuses.filter((status) => status === 201).length === 1 &&
      paymentRaceStatuses.filter((status) => [400, 409].includes(status)).length === 1
    ) {
      record('concurrent overpayment race commits exactly one payment', 'pass', paymentRaceStatuses.join('/'));
    } else {
      record('concurrent overpayment race commits exactly one payment', 'fail', paymentRaceStatuses.join('/'));
    }

    const raceBookingResult = await expectStatus(
      'concurrent payment race booking remains readable',
      `/bookings/${raceBooking.id}`,
      tenantA.token,
      [200]
    );
    const racePaymentsResult = await expectStatus(
      'concurrent payment race ledger remains readable',
      `/payments/booking/${raceBooking.id}`,
      tenantA.token,
      [200]
    );
    const racePayments = firstArray(racePaymentsResult.body);
    const raceBalance = Number(dataOf(raceBookingResult.body)?.balance_amount);
    if (racePayments.length === 1 && Number(racePayments[0].amount) === 3000 && raceBalance === 2000) {
      record('concurrent payment rollback preserves ledger and balance', 'pass', '1 payment, balance 2000');
    } else {
      record(
        'concurrent payment rollback preserves ledger and balance',
        'fail',
        `${racePayments.length} payments, balance ${raceBalance}`
      );
    }
  } else {
    record('concurrent payment race has booking fixture', 'fail', 'booking race produced no winner');
  }

  const booking = await createJson('tenant A admin can create booking workflow', '/bookings', tenantA.token, bookingPayload);
  if (!booking?.id) {
    record('tenant A workflow booking available', 'fail', 'booking creation did not return an ID');
    return;
  }

  await createJson(
    'duplicate booking for same hall/date/slot is rejected',
    '/bookings',
    tenantA.token,
    bookingPayload,
    [400, 409]
  );

  const transactionId = `ACC-PAY-${suffix}`;
  const payment = await createJson('tenant A admin can record valid booking payment', '/payments', tenantA.token, {
    booking_id: booking.id,
    amount: 1500,
    payment_mode: 'upi',
    payment_type: 'balance',
    transaction_id: transactionId,
    payment_date: new Date().toISOString(),
    notes: `Acceptance payment ${suffix}`,
  });
  if (!payment?.id) {
    record('tenant A workflow payment available', 'fail', 'payment creation did not return an ID');
    return;
  }

  const refreshedBooking = await expectStatus('tenant A booking totals update after payment', `/bookings/${booking.id}`, tenantA.token, [200]);
  const bookingAfterPayment = dataOf(refreshedBooking.body);
  const paymentsResult = await expectStatus('tenant A can list payments for booking', `/payments/booking/${booking.id}`, tenantA.token, [200]);
  const bookingPayments = firstArray(paymentsResult.body);
  const totalPaid = bookingPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = Number(bookingAfterPayment?.balance_amount || 0);
  if (totalPaid === 1500 && balance === 3500) {
    record('booking payment totals are correct', 'pass', 'paid 1500, balance 3500');
  } else {
    record('booking payment totals are correct', 'fail', `paid ${totalPaid}, balance ${balance}`);
  }

  await createJson('duplicate payment transaction reference is rejected', '/payments', tenantA.token, {
    booking_id: booking.id,
    amount: 100,
    payment_mode: 'upi',
    payment_type: 'balance',
    transaction_id: transactionId,
    payment_date: new Date().toISOString(),
  }, [400, 409]);

  await createJson('overpayment against booking is rejected', '/payments', tenantA.token, {
    booking_id: booking.id,
    amount: 6000,
    payment_mode: 'cash',
    payment_type: 'balance',
    transaction_id: `ACC-OVER-${suffix}`,
    payment_date: new Date().toISOString(),
  }, [400, 409]);

  const invoice = await createJson('tenant A admin can create tax invoice', '/invoices', tenantA.token, {
    invoice_type: 'tax_invoice',
    booking_id: booking.id,
    customer_id: customer.id,
    line_items: [
      {
        description: 'Acceptance workflow venue service',
        sac_hsn: '9983',
        quantity: 1,
        unit: 'service',
        unit_price: 1000,
        gst_rate: 18,
      },
    ],
    notes: `Acceptance invoice ${suffix}`,
  });
  if (!invoice?.id) {
    record('tenant A workflow invoice available', 'fail', 'invoice creation did not return an ID');
    return;
  }

  const invoiceTotal = Number(invoice.grand_total || 0);
  if (Math.abs(invoiceTotal - 1180) <= 1) {
    record('invoice GST total is correct', 'pass', `grand_total ${invoiceTotal}`);
  } else {
    record('invoice GST total is correct', 'fail', `expected about 1180 got ${invoiceTotal}`);
  }

  if (invoice.status === 'draft') {
    await expectStatus('tenant A admin can issue draft invoice', `/invoices/${invoice.id}/issue`, tenantA.token, [200], {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } else if (['issued', 'paid', 'partially_paid'].includes(invoice.status)) {
    record('invoice status supports downstream delivery', 'pass', invoice.status);
  } else {
    record('invoice status supports downstream delivery', 'fail', invoice.status || 'missing status');
  }

  const pdfResult = await requestBinary(`/invoices/${invoice.id}/pdf`, { token: tenantA.token });
  const contentType = pdfResult.response.headers.get('content-type') || '';
  if (pdfResult.response.status === 200 && contentType.includes('application/pdf') && pdfResult.buffer.length > 1000) {
    record('tenant A admin can download invoice PDF', 'pass', `PDF ${pdfResult.buffer.length} bytes`);
  } else {
    record(
      'tenant A admin can download invoice PDF',
      'fail',
      `HTTP ${pdfResult.response.status}, content-type ${contentType}, bytes ${pdfResult.buffer.length}`
    );
  }

  const emailAllowed = process.env.SMTP_ENABLED === 'true' ? [200] : [503];
  await expectStatus('invoice email respects SMTP configuration', `/invoices/${invoice.id}/email`, tenantA.token, emailAllowed, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const eventDateObject = new Date(`${eventDate}T00:00:00`);
  const slotsResult = await expectStatus(
    'tenant A can list workflow slots',
    `/slots/${eventDateObject.getFullYear()}/${eventDateObject.getMonth() + 1}?hall_id=${hall.id}`,
    tenantA.token,
    [200]
  );
  const workflowSlot = firstArray(slotsResult.body).find(
    (slot) => Number(slot.booking_id) === Number(booking.id)
  );

  return {
    customer,
    hall,
    package: pkg,
    booking,
    payment,
    invoice,
    slot: workflowSlot || null,
  };
}

async function acceptanceCrossTenantResourceMatrix(tenantA, tenantB, resources) {
  const probes = [
    ['customer', `/customers/${resources.customer.id}`],
    ['hall', `/halls/${resources.hall.id}`],
    ['package', `/packages/${resources.package.id}`],
    ['booking', `/bookings/${resources.booking.id}`],
    ['payment', `/payments/${resources.payment.id}`],
    ['invoice', `/invoices/${resources.invoice.id}`],
  ];
  for (const [resource, path] of probes) {
    await expectStatus(
      `tenant B cannot read tenant A ${resource} by guessed ID`,
      path,
      tenantB.token,
      [403, 404]
    );
  }

  if (resources.slot?.id) {
    const slotDateValue = String(resources.slot.date || resources.slot.slot_date).slice(0, 10);
    const slotDate = new Date(`${slotDateValue}T00:00:00`);
    const tenantBSlots = await expectStatus(
      'tenant B can list only its own slot context',
      `/slots/${slotDate.getFullYear()}/${slotDate.getMonth() + 1}`,
      tenantB.token,
      [200]
    );
    const leakedSlot = firstArray(tenantBSlots.body).some(
      (slot) => Number(slot.id) === Number(resources.slot.id)
    );
    record(
      'tenant A slot is absent from tenant B slot listing',
      leakedSlot ? 'fail' : 'pass',
      leakedSlot ? `slot ${resources.slot.id} leaked` : `slot ${resources.slot.id} isolated`
    );
  }

  const [tenantASettings, tenantBSettings] = await Promise.all([
    expectStatus('tenant A can read own business settings', '/settings/business', tenantA.token, [200]),
    expectStatus('tenant B can read own business settings', '/settings/business', tenantB.token, [200]),
  ]);
  const tenantASettingsId = Number(dataOf(tenantASettings.body)?.tenant_id);
  const tenantBSettingsId = Number(dataOf(tenantBSettings.body)?.tenant_id);
  record(
    'tenant settings remain separated by tenant context',
    tenantASettingsId > 0 && tenantBSettingsId > 0 && tenantASettingsId !== tenantBSettingsId ? 'pass' : 'fail',
    `${tenantASettingsId}/${tenantBSettingsId}`
  );
}

async function acceptanceAuditedStaffWorkflow(platform, tenantA) {
  const tenant = await getCurrentTenant(tenantA, 'tenant A staff audit');
  if (!tenant?.id) {
    record('audited staff workflow has tenant ID', 'fail', 'tenant ID missing');
    return;
  }
  const suffix = uniqueAcceptanceSuffix();
  await createJson(
    'team creation rejects missing password',
    '/settings/team',
    tenantA.token,
    { name: `Missing Password ${suffix}`, email: `missing.password.${suffix}@hallsync.local`, role: 'viewer' },
    [400]
  );

  const created = await createJson(
    'tenant admin can create audited staff user',
    '/users',
    tenantA.token,
    {
      name: `Acceptance Audit User ${suffix}`,
      email: `acceptance.audit.${suffix}@hallsync.local`,
      password: `Audit-${suffix}-Aa1!`,
      role: 'viewer',
    }
  );
  const userId = Number(created?.user?.id);
  if (!userId) {
    record('audited staff user fixture exists', 'fail', 'user ID missing');
    return;
  }

  await putJson('tenant admin can audit staff role change', `/users/${userId}/role`, tenantA.token, { role: 'staff_2' });
  await putJson('tenant admin can audit staff status change', `/users/${userId}/status`, tenantA.token, { status: 'inactive' });
  await expectStatus('tenant admin can audit staff deletion', `/users/${userId}`, tenantA.token, [200], { method: 'DELETE' });

  const auditResult = await expectStatus(
    'platform owner can query tenant staff audit rows',
    `/platform/tenant-audit-logs?tenant_id=${tenant.id}&limit=100`,
    platform.token,
    [200]
  );
  const actions = new Set(
    firstArray(auditResult.body)
      .filter((event) => Number(event.entity_id) === userId)
      .map((event) => event.action)
  );
  const requiredActions = ['user.created', 'user.role_changed', 'user.status_changed', 'user.deleted'];
  const missing = requiredActions.filter((action) => !actions.has(action));
  record(
    'staff lifecycle audit records are complete',
    missing.length === 0 ? 'pass' : 'fail',
    missing.length === 0 ? requiredActions.join(', ') : `missing ${missing.join(', ')}`
  );
}

async function acceptanceInvitationWorkflow(tenantA) {
  const suffix = uniqueAcceptanceSuffix();
  const email = `acceptance.invited.${suffix}@hallsync.local`;
  const password = `Invite-${suffix}-Aa1`;
  const phone = `7${suffix.slice(-9)}`;
  const invitation = await createJson(
    'tenant admin can create one-time staff invitation',
    '/settings/team/invitations',
    tenantA.token,
    { name: `Acceptance Invited User ${suffix}`, email, phone, role: 'viewer' }
  );
  const token = invitation?.invite_url
    ? new URL(invitation.invite_url).searchParams.get('token')
    : null;
  if (!token) {
    record('staff invitation returns one-time token link', 'fail', JSON.stringify(invitation));
    return;
  }
  record('staff invitation returns one-time token link', 'pass', `invitation ${invitation.id}`);

  const inspected = await expectStatus(
    'public invitation token can be inspected',
    `/auth/invitations/${encodeURIComponent(token)}`,
    undefined,
    [200]
  );
  const inspectedInvitation = dataOf(inspected.body);
  record(
    'invitation inspection preserves tenant role and email',
    inspectedInvitation?.email === email && inspectedInvitation?.role === 'viewer' ? 'pass' : 'fail',
    `${inspectedInvitation?.email || 'missing'} / ${inspectedInvitation?.role || 'missing'}`
  );

  const accepted = await expectStatus(
    'invited staff can set password exactly once',
    `/auth/invitations/${encodeURIComponent(token)}/accept`,
    undefined,
    [200],
    { method: 'POST', body: JSON.stringify({ password }) }
  );
  const userId = Number(dataOf(accepted.body)?.userId);
  await expectStatus(
    'accepted invitation token cannot be reused',
    `/auth/invitations/${encodeURIComponent(token)}/accept`,
    undefined,
    [400],
    { method: 'POST', body: JSON.stringify({ password }) }
  );

  const invitedLogin = await login('invited tenant viewer', { email, password });
  if (invitedLogin) {
    record(
      'invited user receives intended tenant role',
      invitedLogin.user?.role === 'viewer' &&
        Number(invitedLogin.user?.tenant_id) === Number(tenantA.user?.tenant_id)
        ? 'pass'
        : 'fail',
      `${invitedLogin.user?.role || 'missing'} / tenant ${invitedLogin.user?.tenant_id || 'missing'}`
    );
  }

  const teamResult = await expectStatus(
    'tenant team list remains available after invitation acceptance',
    '/settings/team',
    tenantA.token,
    [200]
  );
  const invitedMember = firstArray(teamResult.body).find((member) => Number(member.id) === userId);
  record(
    'invited staff phone is preserved',
    invitedMember?.phone === phone ? 'pass' : 'fail',
    invitedMember?.phone || 'missing'
  );

  if (userId) {
    await putJson(
      'tenant admin can deactivate invited account',
      `/users/${userId}/status`,
      tenantA.token,
      { status: 'inactive' },
      [200]
    );
    await expectStatus(
      'inactive tenant account cannot log in',
      '/auth/login',
      undefined,
      [403],
      { method: 'POST', body: JSON.stringify({ email, password }) }
    );
    await putJson(
      'tenant admin can reactivate invited account',
      `/users/${userId}/status`,
      tenantA.token,
      { status: 'active' },
      [200]
    );
    const reactivatedLogin = await login('reactivated invited tenant viewer', { email, password });
    if (reactivatedLogin) {
      record('reactivated account receives a fresh valid session', 'pass', reactivatedLogin.user?.role || 'authenticated');
    }
  }

  if (userId) {
    await expectStatus(
      'acceptance invited user is cleaned up',
      `/settings/team/${userId}`,
      tenantA.token,
      [200],
      { method: 'DELETE' }
    );
  } else {
    record('acceptance invited user is cleaned up', 'fail', 'accepted user ID missing');
  }
}

async function acceptanceStaff1Workflow(tenantA, resources) {
  if (!resources?.customer?.id) {
    record('staff_1 acceptance has customer fixture', 'skip', 'workflow customer unavailable');
    return;
  }
  const suffix = uniqueAcceptanceSuffix();
  const email = `acceptance.staff1.${suffix}@hallsync.local`;
  const password = `Staff1-${suffix}-Aa1`;
  const invitation = await createJson(
    'tenant admin can invite staff_1',
    '/settings/team/invitations',
    tenantA.token,
    { name: `Acceptance Staff 1 ${suffix}`, email, role: 'staff_1' }
  );
  const token = invitation?.invite_url
    ? new URL(invitation.invite_url).searchParams.get('token')
    : null;
  if (!token) {
    record('staff_1 invitation returns token', 'fail', JSON.stringify(invitation));
    return;
  }
  const accepted = await expectStatus(
    'staff_1 invitation can be accepted',
    `/auth/invitations/${encodeURIComponent(token)}/accept`,
    undefined,
    [200],
    { method: 'POST', body: JSON.stringify({ password }) }
  );
  const userId = Number(dataOf(accepted.body)?.userId);
  const staff1 = await login('tenant A staff_1', { email, password });
  if (staff1) {
    await putJson(
      'staff_1 can update tenant customers',
      `/customers/${resources.customer.id}`,
      staff1.token,
      { notes: `staff_1 acceptance ${suffix}` },
      [200]
    );
    await expectStatus(
      'staff_1 cannot delete tenant customers',
      `/customers/${resources.customer.id}`,
      staff1.token,
      [403],
      { method: 'DELETE' }
    );
    await expectStatus(
      'staff_1 cannot manage tenant users',
      '/settings/team',
      staff1.token,
      [403]
    );
  }
  if (userId) {
    await expectStatus(
      'acceptance staff_1 user is cleaned up',
      `/settings/team/${userId}`,
      tenantA.token,
      [200],
      { method: 'DELETE' }
    );
  }
}

async function acceptancePlatformOwnerInvitationWorkflow(platform, tenantA) {
  const tenantId = Number(tenantA.user?.tenant_id);
  if (!tenantId) {
    record('platform owner invitation has tenant fixture', 'fail', 'tenant ID missing');
    return;
  }
  const suffix = uniqueAcceptanceSuffix();
  const email = `acceptance.owner.${suffix}@hallsync.local`;
  const password = `Owner-${suffix}-Aa1`;
  const created = await createJson(
    'platform owner can create tenant-owner invitation',
    `/tenants/${tenantId}/owner-invitations`,
    platform.token,
    { name: `Acceptance Tenant Owner ${suffix}`, email, phone: `6${suffix.slice(-9)}` }
  );
  const firstToken = created?.invite_url
    ? new URL(created.invite_url).searchParams.get('token')
    : null;
  if (!created?.id || !firstToken) {
    record('platform owner invitation returns token', 'fail', JSON.stringify(created));
    return;
  }

  const listResult = await expectStatus(
    'platform owner can list tenant-owner invitations',
    `/tenants/${tenantId}/owner-invitations`,
    platform.token,
    [200]
  );
  record(
    'platform owner invitation appears in tenant list',
    firstArray(listResult.body).some((invitation) => Number(invitation.id) === Number(created.id)) ? 'pass' : 'fail',
    `invitation ${created.id}`
  );

  const resent = await postJson(
    'platform owner can resend tenant-owner invitation',
    `/tenants/${tenantId}/owner-invitations/${created.id}/resend`,
    platform.token,
    {},
    [200]
  );
  const resentData = dataOf(resent.body);
  const renewedToken = resentData?.invite_url
    ? new URL(resentData.invite_url).searchParams.get('token')
    : null;
  await expectStatus(
    'resend revokes previous owner invitation token',
    `/auth/invitations/${encodeURIComponent(firstToken)}`,
    undefined,
    [404]
  );
  if (!renewedToken) {
    record('renewed owner invitation returns token', 'fail', JSON.stringify(resentData));
    return;
  }

  const accepted = await expectStatus(
    'tenant owner accepts renewed platform invitation',
    `/auth/invitations/${encodeURIComponent(renewedToken)}/accept`,
    undefined,
    [200],
    { method: 'POST', body: JSON.stringify({ password }) }
  );
  const userId = Number(dataOf(accepted.body)?.userId);
  const owner = await login('invited tenant owner', { email, password });
  if (owner) {
    record(
      'platform-invited owner receives tenant admin role',
      owner.user?.role === 'admin' && Number(owner.user?.tenant_id) === tenantId ? 'pass' : 'fail',
      `${owner.user?.role || 'missing'} / tenant ${owner.user?.tenant_id || 'missing'}`
    );
    await expectStatus(
      'platform-invited owner can access tenant workspace',
      '/tenants/current',
      owner.token,
      [200]
    );
  }
  if (userId) {
    await expectStatus(
      'acceptance platform-invited owner is cleaned up',
      `/settings/team/${userId}`,
      tenantA.token,
      [200],
      { method: 'DELETE' }
    );
  }
}

async function getCurrentTenant(session, label) {
  const result = await expectStatus(`${label} can read current tenant for lifecycle checks`, '/tenants/current', session.token, [200]);
  return result.ok ? dataOf(result.body)?.tenant : null;
}

async function listPendingSubscriptionPayments(platform) {
  const result = await expectStatus(
    'platform owner can list pending subscription payments',
    '/platform/subscription-payments',
    platform.token,
    [200]
  );
  return result.ok ? firstArray(result.body) : [];
}

async function approveSubscriptionPayment(
  platform,
  paymentId,
  name = 'platform owner can approve subscription payment',
  allowedStatuses = [200]
) {
  return postJson(
    name,
    `/platform/subscription-payments/${paymentId}/approve`,
    platform.token,
    {},
    allowedStatuses
  );
}

async function clearExistingAcceptancePendingPayment(platform, tenantId) {
  const pendingPayments = await listPendingSubscriptionPayments(platform);
  const existingPayment = pendingPayments.find((payment) => Number(payment.tenant_id) === Number(tenantId));
  if (!existingPayment) return;

  await approveSubscriptionPayment(
    platform,
    existingPayment.id,
    'platform owner can clear previous acceptance subscription payment'
  );
}

async function acceptanceSubscriptionWorkflow(platform, tenantA) {
  const tenant = await getCurrentTenant(tenantA, 'tenant A');
  if (!tenant?.id) {
    record('tenant A subscription workflow has tenant ID', 'fail', 'current tenant did not return an ID');
    return;
  }

  await clearExistingAcceptancePendingPayment(platform, tenant.id);

  const qrResult = await postJson(
    'tenant A can generate manual subscription payment instructions',
    '/settings/subscription/generate-qr',
    tenantA.token,
    {},
    process.env.UPI_ID ? [200] : [503]
  );
  if (qrResult.response.status === 503 && !process.env.UPI_ID) {
    record('subscription instructions fail closed without UPI_ID', 'pass', 'HTTP 503');
    return;
  }
  const qrData = dataOf(qrResult.body);
  if (qrResult.ok && Number(qrData?.amount) > 0 && qrData?.upi_link) {
    record('subscription instructions include amount and UPI link', 'pass', `amount ${qrData.amount}`);
  } else {
    record('subscription instructions include amount and UPI link', 'fail', JSON.stringify(qrData));
    return;
  }

  const suffix = uniqueAcceptanceSuffix();
  const form = new FormData();
  form.append('transaction_id', `ACC-SUB-${suffix}`);
  form.append(
    'payment_proof',
    new Blob([`Acceptance subscription proof ${suffix}`], { type: 'text/plain' }),
    `acceptance-subscription-proof-${suffix}.txt`
  );

  const submitResult = await requestMultipart('/settings/subscription/payment', tenantA.token, form);
  if (submitResult.response.status === 200 && dataOf(submitResult.body)?.payment_id) {
    record('tenant A can submit subscription payment proof', 'pass', `payment ${dataOf(submitResult.body).payment_id}`);
  } else {
    record(
      'tenant A can submit subscription payment proof',
      'fail',
      `HTTP ${submitResult.response.status}: ${JSON.stringify(submitResult.body)}`
    );
    return;
  }

  const paymentId = dataOf(submitResult.body).payment_id;
  const pendingPayments = await listPendingSubscriptionPayments(platform);
  const pendingPayment = pendingPayments.find((payment) => Number(payment.id) === Number(paymentId));
  if (pendingPayment) {
    record('platform owner can see submitted subscription proof', 'pass', `payment ${paymentId}`);
  } else {
    record('platform owner can see submitted subscription proof', 'fail', `payment ${paymentId} not found`);
    return;
  }

  await approveSubscriptionPayment(platform, paymentId);
  await approveSubscriptionPayment(
    platform,
    paymentId,
    'duplicate subscription approval is rejected',
    [400, 409]
  );

  const subscriptionResult = await expectStatus(
    'tenant A can read approved subscription',
    '/settings/subscription',
    tenantA.token,
    [200]
  );
  const subscription = dataOf(subscriptionResult.body);
  if (subscriptionResult.ok && subscription?.status === 'active' && Number(subscription?.daysRemaining) > 0) {
    record('approved subscription is active with remaining days', 'pass', `${subscription.daysRemaining} days`);
  } else {
    record('approved subscription is active with remaining days', 'fail', JSON.stringify(subscription));
  }

  const rejectionQr = await postJson(
    'tenant A can create a second renewal order for rejection coverage',
    '/settings/subscription/generate-qr',
    tenantA.token,
    {},
    [200]
  );
  if (!rejectionQr.ok) return;

  const rejectionSuffix = uniqueAcceptanceSuffix();
  const rejectionForm = new FormData();
  rejectionForm.append('transaction_id', `ACC-SUB-REJECT-${rejectionSuffix}`);
  rejectionForm.append(
    'payment_proof',
    new Blob([`Acceptance rejected subscription proof ${rejectionSuffix}`], { type: 'text/plain' }),
    `acceptance-subscription-reject-${rejectionSuffix}.txt`
  );
  const rejectionSubmit = await requestMultipart('/settings/subscription/payment', tenantA.token, rejectionForm);
  const rejectedPaymentId = Number(dataOf(rejectionSubmit.body)?.payment_id);
  if (rejectionSubmit.response.status === 200 && rejectedPaymentId) {
    record('tenant A can submit proof for rejection coverage', 'pass', `payment ${rejectedPaymentId}`);
  } else {
    record('tenant A can submit proof for rejection coverage', 'fail', `HTTP ${rejectionSubmit.response.status}`);
    return;
  }

  await postJson(
    'platform owner can reject subscription payment with reason',
    `/platform/subscription-payments/${rejectedPaymentId}/reject`,
    platform.token,
    { reason: 'Controlled acceptance rejection' },
    [200]
  );
  await postJson(
    'duplicate subscription rejection is rejected',
    `/platform/subscription-payments/${rejectedPaymentId}/reject`,
    platform.token,
    { reason: 'Duplicate controlled rejection' },
    [400, 409]
  );
  const afterRejection = await listPendingSubscriptionPayments(platform);
  record(
    'rejected subscription payment leaves pending queue',
    afterRejection.some((payment) => Number(payment.id) === rejectedPaymentId) ? 'fail' : 'pass',
    `payment ${rejectedPaymentId}`
  );
}

async function acceptanceSuspensionWorkflow(platform, tenantB) {
  const tenant = await getCurrentTenant(tenantB, 'tenant B');
  if (!tenant?.id) {
    record('tenant B suspension workflow has tenant ID', 'fail', 'current tenant did not return an ID');
    return;
  }

  const originalStatus = tenant.status || 'active';
  try {
    await putJson(
      'platform owner can place acceptance tenant B in past-due grace',
      `/tenants/${tenant.id}`,
      platform.token,
      { status: 'past_due' },
      [200]
    );
    await expectStatus(
      'past-due tenant B retains read-only workspace access',
      '/customers?limit=1',
      tenantB.token,
      [200]
    );
    await createJson(
      'past-due tenant B cannot write during grace',
      '/customers',
      tenantB.token,
      { name: 'Blocked Past Due Acceptance Customer', phone: '7000000000' },
      [402]
    );
    await putJson(
      'platform owner can suspend acceptance tenant B',
      `/tenants/${tenant.id}`,
      platform.token,
      { status: 'suspended' },
      [200]
    );
    await expectStatus(
      'suspended tenant B is blocked from tenant workspace APIs',
      '/customers?limit=1',
      tenantB.token,
      [403]
    );
  } finally {
    await putJson(
      'platform owner restores acceptance tenant B status',
      `/tenants/${tenant.id}`,
      platform.token,
      { status: originalStatus === 'suspended' || originalStatus === 'archived' ? 'active' : originalStatus },
      [200]
    );
  }
}

function tinyPngBlob() {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  return new Blob([Buffer.from(base64, 'base64')], { type: 'image/png' });
}

async function acceptanceGalleryWorkflow(tenantA, tenantAViewer, tenantB) {
  const hallsResult = await expectStatus(
    'tenant A can list active halls for gallery workflow',
    '/halls/active',
    tenantA.token,
    [200]
  );
  const hall = firstArray(hallsResult.body)[0];
  if (!hall?.id) {
    record('tenant A gallery workflow fixture available', 'fail', 'active hall fixture missing');
    return;
  }

  const suffix = uniqueAcceptanceSuffix();
  const uploadForm = new FormData();
  uploadForm.append('category', 'acceptance');
  uploadForm.append('caption', `Acceptance gallery image ${suffix}`);
  uploadForm.append('alt_text', `Acceptance gallery image ${suffix}`);
  uploadForm.append('is_featured', 'true');
  uploadForm.append('images', tinyPngBlob(), `acceptance-gallery-${suffix}.png`);

  const uploadResult = await expectMultipartStatus(
    'tenant A admin can upload hall gallery image',
    `/halls/${hall.id}/gallery`,
    tenantA.token,
    uploadForm,
    [201]
  );
  const uploadedImage = firstArray(uploadResult.body)[0];
  if (!uploadedImage?.id) {
    record('tenant A uploaded gallery image has ID', 'fail', JSON.stringify(uploadResult.body));
    return;
  }

  if (tenantAViewer) {
    const viewerForm = new FormData();
    viewerForm.append('images', tinyPngBlob(), `blocked-viewer-gallery-${suffix}.png`);
    await expectMultipartStatus(
      'tenant A viewer cannot upload hall gallery image',
      `/halls/${hall.id}/gallery`,
      tenantAViewer.token,
      viewerForm,
      [403]
    );
  }

  const galleryResult = await expectStatus(
    'tenant A can list hall gallery images',
    `/halls/${hall.id}/gallery`,
    tenantA.token,
    [200]
  );
  const galleryImages = firstArray(galleryResult.body);
  if (galleryImages.some((image) => Number(image.id) === Number(uploadedImage.id))) {
    record('uploaded gallery image appears in tenant gallery list', 'pass', `image ${uploadedImage.id}`);
  } else {
    record('uploaded gallery image appears in tenant gallery list', 'fail', `image ${uploadedImage.id} missing`);
  }

  await expectStatus(
    'tenant A can read gallery image details',
    `/halls/gallery/${uploadedImage.id}`,
    tenantA.token,
    [200]
  );

  if (tenantB) {
    await expectStatus(
      'tenant B cannot read tenant A gallery image by guessed ID',
      `/halls/gallery/${uploadedImage.id}`,
      tenantB.token,
      [404]
    );
  }

  const updatedCaption = `Acceptance gallery updated ${suffix}`;
  const updateResult = await putJson(
    'tenant A admin can update gallery image metadata',
    `/halls/gallery/${uploadedImage.id}`,
    tenantA.token,
    {
      category: 'acceptance-updated',
      caption: updatedCaption,
      alt_text: updatedCaption,
      is_featured: true,
    },
    [200]
  );
  if (updateResult.ok && dataOf(updateResult.body)?.caption === updatedCaption) {
    record('gallery image metadata update is persisted', 'pass', updatedCaption);
  } else {
    record('gallery image metadata update is persisted', 'fail', JSON.stringify(updateResult.body));
  }

  await putJson(
    'tenant A admin can set gallery image featured',
    `/halls/gallery/${uploadedImage.id}/featured`,
    tenantA.token,
    { hall_id: hall.id },
    [200]
  );

  const featuredResult = await expectStatus(
    'tenant A can list featured gallery images',
    `/halls/${hall.id}/gallery/featured`,
    tenantA.token,
    [200]
  );
  const featuredImages = firstArray(featuredResult.body);
  if (featuredImages.some((image) => Number(image.id) === Number(uploadedImage.id))) {
    record('featured gallery image appears in featured list', 'pass', `image ${uploadedImage.id}`);
  } else {
    record('featured gallery image appears in featured list', 'fail', `image ${uploadedImage.id} missing`);
  }

  const statsResult = await expectStatus(
    'tenant A can read gallery stats',
    `/halls/${hall.id}/gallery/stats`,
    tenantA.token,
    [200]
  );
  const stats = dataOf(statsResult.body);
  if (statsResult.ok && Number(stats?.total || 0) >= 1) {
    record('gallery stats include uploaded image', 'pass', `total ${stats.total}`);
  } else {
    record('gallery stats include uploaded image', 'fail', JSON.stringify(stats));
  }

  await expectStatus(
    'tenant A admin can delete acceptance gallery image',
    `/halls/gallery/${uploadedImage.id}`,
    tenantA.token,
    [200],
    { method: 'DELETE' }
  );
  await expectStatus(
    'deleted gallery image is no longer readable',
    `/halls/gallery/${uploadedImage.id}`,
    tenantA.token,
    [404]
  );
}

async function acceptanceSessionPolicyWorkflow(tenantAViewer) {
  await expectStatus(
    'sliding refresh endpoint is disabled',
    '/auth/refresh',
    tenantAViewer.token,
    [404],
    { method: 'POST', body: JSON.stringify({}) }
  );

  await postJson(
    'tenant viewer can revoke all sessions on logout',
    '/auth/logout',
    tenantAViewer.token,
    {},
    [200]
  );

  await expectStatus(
    'revoked token is rejected after logout',
    '/auth/user',
    tenantAViewer.token,
    [401]
  );

  const reloggedViewer = await login(
    'tenant A viewer can log in after revocation',
    accounts.tenantAViewer
  );
  if (reloggedViewer) {
    await expectStatus(
      'fresh token is valid after re-login',
      '/auth/user',
      reloggedViewer.token,
      [200]
    );
  }
}

async function main() {
  await expectStatus('API health', '/health', undefined, [200]);
  await expectStatus(
    'invalid credentials are rejected',
    '/auth/login',
    undefined,
    [401],
    {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid.acceptance@hallsync.local', password: 'Wrong-Password-1' }),
    }
  );

  const platform = await login('platform owner', accounts.platform);
  if (platform) {
    await expectStatus('platform owner can access platform subscriptions', '/platform/subscription-payments', platform.token, [200]);
    await expectStatus('platform owner can access real platform overview', '/platform/overview', platform.token, [200]);
    await expectStatus('platform owner can access provider-safe operations status', '/platform/operations', platform.token, [200]);
    await expectStatus('platform owner can search platform audit logs', '/platform/audit-logs?limit=10', platform.token, [200]);
    await expectStatus('platform owner can inspect tenant audit events', '/platform/tenant-audit-logs?limit=10', platform.token, [200]);
    await expectStatus('platform owner cannot access tenant customers', '/customers', platform.token, [403]);
    await expectStatus('platform owner cannot access tenant settings', '/tenants/current', platform.token, [403]);
  }

  const tenantA = await login('tenant A admin', accounts.tenantA);
  const tenantAStaff2 = await login('tenant A staff_2', accounts.tenantAStaff2);
  const tenantAViewer = await login('tenant A viewer', accounts.tenantAViewer);
  if (tenantAViewer) {
    await expectStatus(
      'tenant viewer cannot access tenant settings APIs',
      '/settings/business',
      tenantAViewer.token,
      [403]
    );
  }
  let tenantACustomers = [];
  let tenantAResources = null;
  if (tenantA) {
    await expectStatus('tenant A can read current tenant', '/tenants/current', tenantA.token, [200]);
    await expectStatus('tenant A cannot access platform subscriptions', '/platform/subscription-payments', tenantA.token, [403]);
    await expectStatus('tenant A cannot access platform operations', '/platform/operations', tenantA.token, [403]);
    await expectStatus('tenant A cannot access platform audit logs', '/platform/audit-logs', tenantA.token, [403]);
    const customerResult = await expectStatus('tenant A can list own customers', '/customers?limit=5', tenantA.token, [200]);
    tenantACustomers = firstArray(customerResult.body);
    tenantAResources = await acceptanceWriteWorkflow(tenantA, tenantAStaff2, tenantAViewer);
  }

  const tenantB = await login('tenant B admin', accounts.tenantB);
  if (tenantA && tenantB && tenantACustomers.length > 0) {
    const customerId = tenantACustomers[0].id;
    await expectStatus(
      'tenant B cannot read tenant A customer by guessed ID',
      `/customers/${customerId}`,
      tenantB.token,
      [403, 404]
    );
  } else if (tenantA && tenantB) {
    record('tenant cross-read guessed customer ID', 'skip', 'tenant A has no customer rows to probe');
  }

  if (tenantA && tenantB && tenantAResources) {
    await acceptanceCrossTenantResourceMatrix(tenantA, tenantB, tenantAResources);
  }

  if (platform && tenantA) {
    await acceptanceAuditedStaffWorkflow(platform, tenantA);
    await acceptanceSubscriptionWorkflow(platform, tenantA);
  }

  if (tenantA) {
    await acceptanceInvitationWorkflow(tenantA);
    await acceptanceStaff1Workflow(tenantA, tenantAResources);
  }

  if (platform && tenantA) {
    await acceptancePlatformOwnerInvitationWorkflow(platform, tenantA);
  }

  if (platform && tenantB) {
    await acceptanceSuspensionWorkflow(platform, tenantB);
  }

  if (tenantA && tenantB) {
    await acceptanceGalleryWorkflow(tenantA, tenantAViewer, tenantB);
  }

  if (tenantAViewer) {
    await acceptanceSessionPolicyWorkflow(tenantAViewer);
  }

  const failed = results.filter((result) => result.status === 'fail');
  const skipped = results.filter((result) => result.status === 'skip');

  console.log('\nAcceptance probe summary');
  console.log(JSON.stringify({
    base_url: baseUrl,
    passed: results.length - failed.length - skipped.length,
    skipped: skipped.length,
    failed: failed.length,
  }, null, 2));

  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error('Acceptance probe failed:', error.message);
  process.exitCode = 1;
});
