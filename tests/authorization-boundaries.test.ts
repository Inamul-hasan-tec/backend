import assert from 'node:assert/strict';
import { Permission, hasPermission } from '../src/types/permissions';
import { tenantMiddleware } from '../src/middleware/tenantMiddleware';

export function testRolePermissions() {
  assert.equal(
    hasPermission('super_admin', Permission.PLATFORM_DASHBOARD),
    true
  );
  assert.equal(hasPermission('super_admin', Permission.TENANT_LIST), true);
  assert.equal(hasPermission('super_admin', Permission.BOOKING_LIST), false);
  assert.equal(hasPermission('super_admin', Permission.CUSTOMER_LIST), false);
  assert.equal(hasPermission('super_admin', Permission.PAYMENT_LIST), false);
  assert.equal(hasPermission('super_admin', Permission.USER_LIST), false);

  assert.equal(hasPermission('admin', Permission.USER_LIST), true);
  assert.equal(hasPermission('admin', Permission.BOOKING_LIST), true);
  assert.equal(hasPermission('admin', Permission.SETTINGS_UPDATE), true);
  assert.equal(hasPermission('admin', Permission.TENANT_LIST), false);
  assert.equal(hasPermission('admin', Permission.PLATFORM_DASHBOARD), false);

  assert.equal(hasPermission('staff_1', Permission.CUSTOMER_UPDATE), true);
  assert.equal(hasPermission('staff_1', Permission.CUSTOMER_DELETE), false);
  assert.equal(hasPermission('staff_1', Permission.USER_LIST), false);
  assert.equal(hasPermission('staff_2', Permission.BOOKING_CREATE), true);
  assert.equal(hasPermission('staff_2', Permission.INVOICE_CREATE), false);
  assert.equal(hasPermission('viewer', Permission.CUSTOMER_LIST), true);
  assert.equal(hasPermission('viewer', Permission.CUSTOMER_CREATE), false);
  assert.equal(hasPermission('viewer', Permission.REPORT_EXPORT), false);
  assert.equal(hasPermission('viewer', Permission.SETTINGS_VIEW), false);
}

export async function testPlatformAccountRejectedFromTenantMiddleware() {
  const request = {
    user: {
      id: 1,
      name: 'Platform Owner',
      email: 'owner@hallsync.test',
      role: 'super_admin',
      is_super_admin: true,
    },
    headers: {},
    query: {},
  } as any;

  let statusCode = 200;
  let responseBody: any;
  let nextCalled = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseBody = body;
      return this;
    },
  } as any;

  await tenantMiddleware(request, response, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
  assert.match(responseBody.error, /cannot access tenant/i);
}
