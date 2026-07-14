import assert from 'assert';
import { NextFunction, Request, Response } from 'express';
import { createAuthMiddleware } from '../src/middleware/auth';
import { SessionState } from '../src/repositories/AuthRepository';
import { generateToken } from '../src/utils/auth';

function responseMock() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

export async function testAuthSessionPolicy(): Promise<void> {
  const previousSecret = process.env.JWT_SECRET;
  const previousExpiry = process.env.JWT_EXPIRES_IN;
  process.env.JWT_SECRET = 'auth-session-policy-test-secret-32-chars';
  process.env.JWT_EXPIRES_IN = '8h';

  const token = generateToken({
    id: 42,
    email: 'tenant@example.com',
    name: 'Tenant User',
    role: 'admin',
    tenant_id: 7,
    is_super_admin: false,
    auth_version: 3,
  });

  const baseSession: SessionState = {
    id: 42,
    email: 'tenant@example.com',
    name: 'Tenant User',
    status: 'active',
    role: 'admin',
    tenant_id: 7,
    is_super_admin: false,
    auth_version: 3,
  };

  async function run(session: SessionState | null) {
    const request = {
      header: (name: string) =>
        name === 'Authorization' ? `Bearer ${token}` : undefined,
    } as Request;
    const response = responseMock();
    let nextCalled = false;
    const middleware = createAuthMiddleware({
      getSessionState: async () => session,
    });

    await middleware(
      request,
      response as unknown as Response,
      (() => {
        nextCalled = true;
      }) as NextFunction
    );
    return { request, response, nextCalled };
  }

  const valid = await run(baseSession);
  assert.equal(valid.nextCalled, true);
  assert.equal(valid.request.user?.auth_version, 3);

  const revoked = await run({ ...baseSession, auth_version: 4 });
  assert.equal(revoked.nextCalled, false);
  assert.equal(revoked.response.statusCode, 401);

  const roleChanged = await run({ ...baseSession, role: 'viewer' });
  assert.equal(roleChanged.nextCalled, false);
  assert.equal(roleChanged.response.statusCode, 401);

  const inactive = await run({ ...baseSession, status: 'inactive' });
  assert.equal(inactive.nextCalled, false);
  assert.equal(inactive.response.statusCode, 401);

  process.env.JWT_SECRET = previousSecret;
  process.env.JWT_EXPIRES_IN = previousExpiry;
}

