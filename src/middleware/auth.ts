import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/auth';
import { runWithTenantContext } from '../utils/tenantContext';
import { AuthRepository } from '../repositories/AuthRepository';

const authRepository = new AuthRepository();

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export function createAuthMiddleware(
  repository: Pick<AuthRepository, 'getSessionState'>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header
      const authHeader = req.header('Authorization');
      const token = extractTokenFromHeader(authHeader);

      // Check if no token
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No authentication token, access denied',
        });
      }

      // Verify token
      const decoded = verifyToken(token);

      const session = await repository.getSessionState(decoded.id, decoded.tenant_id);
      if (!session || session.status !== 'active') {
        throw new Error('Session is no longer active');
      }
      if (Number(session.auth_version) !== Number(decoded.auth_version)) {
        throw new Error('Session has been revoked');
      }

      const isSuperAdmin = Boolean(session.is_super_admin);
      if (isSuperAdmin !== Boolean(decoded.is_super_admin)) {
        throw new Error('Session permissions have changed');
      }
      if (!isSuperAdmin) {
        if (
          !decoded.tenant_id ||
          Number(session.tenant_id) !== Number(decoded.tenant_id) ||
          session.role !== decoded.role
        ) {
          throw new Error('Session permissions have changed');
        }
      }

      // Attach current database-backed user info to request.
      req.user = {
        id: session.id,
        email: session.email,
        name: session.name,
        role: (isSuperAdmin ? 'super_admin' : session.role) as any,
        tenant_id: isSuperAdmin ? undefined : session.tenant_id,
        is_super_admin: isSuperAdmin,
        auth_version: Number(session.auth_version),
      } as any;

      // Run the rest of the request within the tenant context
      runWithTenantContext({
        tenantId: decoded.tenant_id,
        userId: decoded.id,
        role: isSuperAdmin ? 'super_admin' : session.role || decoded.role,
      }, () => {
        next();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token verification failed';
      return res.status(401).json({
        success: false,
        message,
      });
    }
  };
}

export const auth = createAuthMiddleware(authRepository);

/**
 * Admin Middleware
 * Checks if authenticated user has admin role
 */
export const admin = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).user && (req as any).user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
};

export default { auth, admin };
