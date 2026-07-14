/**
 * Permission Middleware
 * Checks if user has required permissions to access routes
 */

import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantMiddleware';
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions, UserRole } from '../types/permissions';

/**
 * Middleware to check if user has a specific permission
 * Usage: requirePermission(Permission.CUSTOMER_CREATE)
 */
export function requirePermission(permission: Permission) {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userRole = req.user.role as UserRole;

      // Check if user has the required permission
      if (!hasPermission(userRole, permission)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: permission,
          userRole: userRole,
        });
        return;
      }

      // User has permission, proceed
      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Middleware to check if user has ANY of the specified permissions
 * Usage: requireAnyPermission([Permission.CUSTOMER_VIEW, Permission.CUSTOMER_LIST])
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userRole = req.user.role as UserRole;

      if (!hasAnyPermission(userRole, permissions)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: 'Any of: ' + permissions.join(', '),
          userRole: userRole,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Middleware to check if user has ALL of the specified permissions
 * Usage: requireAllPermissions([Permission.CUSTOMER_UPDATE, Permission.CUSTOMER_VIEW])
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userRole = req.user.role as UserRole;

      if (!hasAllPermissions(userRole, permissions)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: 'All of: ' + permissions.join(', '),
          userRole: userRole,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Middleware to check if user is super admin
 * Usage: requireSuperAdmin()
 */
export function requireSuperAdmin() {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!req.user.is_super_admin && req.user.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Super admin access required.',
          userRole: req.user.role,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Require a tenant-scoped account. Platform accounts do not belong to a
 * customer workspace and must use platform routes.
 */
export function requireTenantAccount() {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.is_super_admin || req.user.role === 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Platform accounts cannot access tenant workspace settings.',
      });
      return;
    }

    if (!req.user.tenant_id) {
      res.status(403).json({
        success: false,
        message: 'Tenant account is not associated with a tenant.',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user is admin or higher
 * Usage: requireAdmin()
 */
export function requireAdmin() {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userRole = req.user.role as UserRole;
      if (userRole !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin access required.',
          userRole: userRole,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Middleware to check if user is staff or higher
 * Usage: requireStaff()
 */
export function requireStaff() {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userRole = req.user.role as UserRole;
      const allowedRoles: UserRole[] = ['admin', 'staff_1', 'staff_2'];
      
      if (!allowedRoles.includes(userRole)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Staff access required.',
          userRole: userRole,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Middleware to check if user can access a specific resource
 * Combines tenant isolation with permission check
 * Usage: requireResourceAccess(Permission.CUSTOMER_UPDATE)
 */
export function requireResourceAccess(permission: Permission) {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!req.tenantId) {
        res.status(400).json({
          success: false,
          message: 'Tenant context required',
        });
        return;
      }

      const userRole = req.user.role as UserRole;

      // Check if user belongs to the tenant
      if (req.user.tenant_id !== req.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You do not have access to this tenant.',
          userTenantId: req.user.tenant_id,
          requestedTenantId: req.tenantId,
        });
        return;
      }

      // Check if user has the required permission
      if (!hasPermission(userRole, permission)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          required: permission,
          userRole: userRole,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
}
