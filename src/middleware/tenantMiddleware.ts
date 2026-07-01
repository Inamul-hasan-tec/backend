/**
 * Tenant Middleware
 * Extracts tenant information from request and adds to req object
 */

import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { UserRole } from '../types/permissions';

export interface TenantRequest extends Request {
  tenantId?: number;
  tenant?: {
    id: number;
    name: string;
    slug: string;
    domain?: string | null;
    subdomain: string | null;
    logo_url: string | null;
    status: string;
  };
  user?: {
    id: number;
    tenant_id?: number;
    name: string;
    email: string;
    role: UserRole;
    is_super_admin: boolean;
    auth_version: number;
  };
}

/**
 * Tenant middleware - extracts tenant from subdomain or header
 * Platform users are intentionally rejected from tenant operational routes.
 */
export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Platform owners operate through /platform and /tenants routes only.
    if (req.user?.is_super_admin || req.user?.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Platform accounts cannot access tenant business operations.',
      });
    }

    // REGULAR USERS - Must have tenant_id
    if (!req.user?.tenant_id) {
      return res.status(403).json({ 
        error: 'User not associated with any tenant. Please contact administrator.' 
      });
    }

    // Use user's tenant_id
    const tenantId = req.user.tenant_id;

    // Fetch tenant details
    const [rows]: any = await pool.query(
      'SELECT * FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found or inactive' });
    }

    const tenant = rows[0];
    if (!['trial', 'active', 'past_due'].includes(tenant.status)) {
      return res.status(403).json({
        error: 'Tenant workspace is not active. Please contact Hall Sync support.',
      });
    }

    if (
      tenant.status === 'past_due' &&
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())
    ) {
      return res.status(402).json({
        error: 'Subscription payment is past due. Workspace is read-only during the grace period.',
      });
    }

    req.tenantId = tenantId;
    req.tenant = {
      ...tenant,
      subdomain: tenant.subdomain || tenant.domain || null,
    };
    next();
  } catch (error: any) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ error: 'Failed to identify tenant' });
  }
};

/**
 * Optional middleware - requires tenant to be explicitly set
 * Use this for routes that should NOT default to tenant 1
 */
export const requireTenant = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Tenant context is required.'
    });
  }
  next();
};

export default tenantMiddleware;
