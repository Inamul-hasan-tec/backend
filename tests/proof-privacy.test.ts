import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import 'multer';

// Set mock Cloudinary env vars BEFORE importing CloudinaryService
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'test_cloud';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'test_key';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'test_secret';

import cloudinaryService from '../src/services/CloudinaryService';
import { requireSuperAdmin, requirePermission } from '../src/middleware/permissionMiddleware';
import { Permission } from '../src/types/permissions';

export function testProofPrivacy(): void {
  // 1. extractPublicId tests
  assert.equal(
    cloudinaryService.extractPublicId('my-public-id'),
    'my-public-id',
    'extractPublicId should leave raw public ID unchanged'
  );

  assert.equal(
    cloudinaryService.extractPublicId('https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    'sample',
    'extractPublicId should extract public ID from standard URL'
  );

  assert.equal(
    cloudinaryService.extractPublicId('https://res.cloudinary.com/demo/image/upload/v1571234567/sample.jpg'),
    'sample',
    'extractPublicId should extract public ID from versioned URL'
  );

  assert.equal(
    cloudinaryService.extractPublicId('https://res.cloudinary.com/demo/image/upload/v1571234567/folder/nested-sample.png'),
    'folder/nested-sample',
    'extractPublicId should extract nested public ID'
  );

  assert.equal(
    cloudinaryService.extractPublicId('https://res.cloudinary.com/demo/image/upload/v1571234567/folder/nested-sample.png?token=secret#preview'),
    'folder/nested-sample',
    'extractPublicId should ignore legacy URL query strings and fragments'
  );

  assert.equal(
    cloudinaryService.extractPublicId('http://res.cloudinary.com/demo/image/upload/sample.jpg'),
    'http://res.cloudinary.com/demo/image/upload/sample.jpg',
    'extractPublicId should reject non-https legacy URLs'
  );

  // 2. getSignedProofUrl tests
  const { signedUrl, expiresAt } = cloudinaryService.getSignedProofUrl('sample-proof', 900);
  assert.ok(signedUrl.startsWith('https://'), 'Signed URL should start with https://');
  assert.ok(signedUrl.includes('/s--'), 'Signed URL should contain signature block');
  
  // Verify expiresAt
  const parsedExpiresAt = new Date(expiresAt).getTime();
  const expectedExpiresAt = Date.now() + 900 * 1000;
  assert.ok(
    Math.abs(parsedExpiresAt - expectedExpiresAt) < 5000,
    'expiresAt should be approximately now + TTL (900 seconds)'
  );

  // Verify that CLOUDINARY_API_SECRET is NOT in the signed URL
  assert.equal(
    signedUrl.includes(process.env.CLOUDINARY_API_SECRET!),
    false,
    'Signed URL must never expose CLOUDINARY_API_SECRET'
  );

  // 3. Static checks on SubscriptionRepository.ts source code
  const repoPath = path.resolve(__dirname, '../src/repositories/SubscriptionRepository.ts');
  const source = fs.readFileSync(repoPath, 'utf8');

  // Verify listPendingPayments select query does not contain sp.proof_url
  const listPendingPaymentsMatch = source.match(/async\s+listPendingPayments\(\)[\s\S]+?return\s+rows;/);
  assert.ok(listPendingPaymentsMatch, 'Should find listPendingPayments method in SubscriptionRepository.ts');
  const methodBody = listPendingPaymentsMatch[0];
  assert.equal(
    methodBody.includes('sp.proof_url'),
    false,
    'listPendingPayments SQL query SELECT must not fetch sp.proof_url'
  );

  // Verify audit logs in approvePayment and rejectPayment do not contain proof_url or proofPublicId
  const auditLogsMatches = source.match(/'subscription\.payment_(approved|rejected)'[\s\S]+?JSON\.stringify\(\{([\s\S]+?)\}\)/g);
  assert.ok(auditLogsMatches && auditLogsMatches.length >= 2, 'Should find audit log insertions in SubscriptionRepository.ts');
  for (const match of auditLogsMatches) {
    assert.equal(
      match.includes('proof_url'),
      false,
      'Audit log metadata must not contain proof_url'
    );
    assert.equal(
      match.includes('proofPublicId'),
      false,
      'Audit log metadata must not contain proofPublicId'
    );
  }
}

export async function testProofAuthorizationMiddleware(): Promise<void> {
  const superAdminReq = {
    user: {
      id: 101,
      name: 'Super Admin',
      email: 'super@hallsync.test',
      role: 'super_admin',
      is_super_admin: true,
    },
  } as any;

  const tenantAdminReq = {
    user: {
      id: 202,
      name: 'Tenant Admin',
      email: 'tenant@hallsync.test',
      role: 'admin',
      is_super_admin: false,
      tenant_id: 1,
    },
  } as any;

  const viewerReq = {
    user: {
      id: 303,
      name: 'Viewer',
      email: 'viewer@hallsync.test',
      role: 'viewer',
      is_super_admin: false,
      tenant_id: 1,
    },
  } as any;

  const unauthenticatedReq = {} as any;

  const createMockRes = () => {
    let statusCode = 200;
    let jsonBody: any = null;
    return {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        jsonBody = body;
        return this;
      },
      getStatusCode() { return statusCode; },
      getJsonBody() { return jsonBody; }
    } as any;
  };

  // Test requireSuperAdmin middleware
  const superAdminMiddleware = requireSuperAdmin();

  // Case 1: Unauthenticated request -> 401
  const res1 = createMockRes();
  let nextCalled1 = false;
  superAdminMiddleware(unauthenticatedReq, res1, () => { nextCalled1 = true; });
  assert.equal(res1.getStatusCode(), 401, 'Unauthenticated request should return 401');
  assert.equal(nextCalled1, false, 'next() should not be called for unauthenticated request');

  // Case 2: Tenant admin (not super admin) -> 403
  const res2 = createMockRes();
  let nextCalled2 = false;
  superAdminMiddleware(tenantAdminReq, res2, () => { nextCalled2 = true; });
  assert.equal(res2.getStatusCode(), 403, 'Tenant admin should be blocked from super admin routes with 403');
  assert.equal(nextCalled2, false, 'next() should not be called for tenant admin on super admin route');

  // Case 3: Super admin -> next()
  const res3 = createMockRes();
  let nextCalled3 = false;
  superAdminMiddleware(superAdminReq, res3, () => { nextCalled3 = true; });
  assert.equal(nextCalled3, true, 'next() should be called for super admin');

  // Test requirePermission(Permission.SUBSCRIPTION_MANAGE) middleware
  const subscriptionManageMiddleware = requirePermission(Permission.SUBSCRIPTION_MANAGE);

  // Case 4: Unauthenticated request -> 401
  const res4 = createMockRes();
  let nextCalled4 = false;
  subscriptionManageMiddleware(unauthenticatedReq, res4, () => { nextCalled4 = true; });
  assert.equal(res4.getStatusCode(), 401, 'Unauthenticated request should return 401');
  assert.equal(nextCalled4, false, 'next() should not be called');

  // Case 5: Role without permission -> 403
  const res5 = createMockRes();
  let nextCalled5 = false;
  subscriptionManageMiddleware(viewerReq, res5, () => { nextCalled5 = true; });
  assert.equal(res5.getStatusCode(), 403, 'Role without permission should be blocked with 403');
  assert.equal(nextCalled5, false, 'next() should not be called');

  // Case 6: Role with permission -> next()
  const res6 = createMockRes();
  let nextCalled6 = false;
  subscriptionManageMiddleware(superAdminReq, res6, () => { nextCalled6 = true; });
  assert.equal(nextCalled6, true, 'Role with permission should call next()');
}
