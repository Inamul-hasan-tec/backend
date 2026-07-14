/**
 * RBAC Permissions System
 * Defines all permissions and role mappings
 */

// ============================================================
// PERMISSION CONSTANTS
// ============================================================

/**
 * All available permissions in the system
 * Format: RESOURCE_ACTION
 */
export enum Permission {
  // Platform Management (super_admin only)
  PLATFORM_DASHBOARD = 'platform:dashboard',
  PLATFORM_SETTINGS_VIEW = 'platform_settings:view',
  PLATFORM_SETTINGS_UPDATE = 'platform_settings:update',
  SUBSCRIPTION_MANAGE = 'subscription:manage',
  SYSTEM_HEALTH_VIEW = 'system_health:view',
  AUDIT_LOG_VIEW = 'audit_log:view',

  // Tenant Management (super_admin only)
  TENANT_CREATE = 'tenant:create',
  TENANT_UPDATE = 'tenant:update',
  TENANT_DELETE = 'tenant:delete',
  TENANT_VIEW = 'tenant:view',
  TENANT_LIST = 'tenant:list',

  // User Management
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_VIEW = 'user:view',
  USER_LIST = 'user:list',
  USER_CHANGE_ROLE = 'user:change_role',

  // Customer Management
  CUSTOMER_CREATE = 'customer:create',
  CUSTOMER_UPDATE = 'customer:update',
  CUSTOMER_DELETE = 'customer:delete',
  CUSTOMER_VIEW = 'customer:view',
  CUSTOMER_LIST = 'customer:list',

  // Hall Management
  HALL_CREATE = 'hall:create',
  HALL_UPDATE = 'hall:update',
  HALL_DELETE = 'hall:delete',
  HALL_VIEW = 'hall:view',
  HALL_LIST = 'hall:list',
  HALL_IMAGE_UPLOAD = 'hall:image_upload',
  HALL_IMAGE_DELETE = 'hall:image_delete',

  // Package Management
  PACKAGE_CREATE = 'package:create',
  PACKAGE_UPDATE = 'package:update',
  PACKAGE_DELETE = 'package:delete',
  PACKAGE_VIEW = 'package:view',
  PACKAGE_LIST = 'package:list',

  // Booking Management
  BOOKING_CREATE = 'booking:create',
  BOOKING_UPDATE = 'booking:update',
  BOOKING_DELETE = 'booking:delete',
  BOOKING_VIEW = 'booking:view',
  BOOKING_LIST = 'booking:list',
  BOOKING_CONFIRM = 'booking:confirm',
  BOOKING_CANCEL = 'booking:cancel',

  // Payment Management
  PAYMENT_CREATE = 'payment:create',
  PAYMENT_UPDATE = 'payment:update',
  PAYMENT_DELETE = 'payment:delete',
  PAYMENT_VIEW = 'payment:view',
  PAYMENT_LIST = 'payment:list',

  // Invoice Management
  INVOICE_CREATE = 'invoice:create',
  INVOICE_UPDATE = 'invoice:update',
  INVOICE_DELETE = 'invoice:delete',
  INVOICE_VIEW = 'invoice:view',
  INVOICE_LIST = 'invoice:list',
  INVOICE_GENERATE = 'invoice:generate',

  // Reports & Analytics
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',
  DASHBOARD_VIEW = 'dashboard:view',
  ANALYTICS_VIEW = 'analytics:view',

  // Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',
  BUSINESS_CONFIG_UPDATE = 'business_config:update',
}

// ============================================================
// ROLE DEFINITIONS
// ============================================================

export type UserRole = 'super_admin' | 'admin' | 'staff_1' | 'staff_2' | 'viewer';

/**
 * Role descriptions for documentation
 */
export const RoleDescriptions: Record<UserRole, string> = {
  super_admin: 'Hall Sync platform owner with no tenant operational access',
  admin: 'Tenant owner with full access to their tenant',
  staff_1: 'Senior staff with full operational access',
  staff_2: 'Junior staff with limited editing capabilities',
  viewer: 'Read-only access to view data',
};

// ============================================================
// ROLE-PERMISSION MAPPING
// ============================================================

/**
 * Maps each role to their allowed permissions
 * Lower roles inherit NO permissions from higher roles
 * Each role is explicitly defined
 */
export const RolePermissions: Record<UserRole, Permission[]> = {
  /**
   * SUPER ADMIN - Platform Owner
   * Manages the SaaS platform, not tenant business operations.
   */
  super_admin: [
    Permission.PLATFORM_DASHBOARD,
    Permission.PLATFORM_SETTINGS_VIEW,
    Permission.PLATFORM_SETTINGS_UPDATE,
    Permission.SUBSCRIPTION_MANAGE,
    Permission.SYSTEM_HEALTH_VIEW,
    Permission.AUDIT_LOG_VIEW,

    // Tenant Management (exclusive to super_admin)
    Permission.TENANT_CREATE,
    Permission.TENANT_UPDATE,
    Permission.TENANT_VIEW,
    Permission.TENANT_LIST,
  ],

  /**
   * ADMIN - Tenant Owner
   * Full access to their tenant (no tenant management)
   */
  admin: [
    // User Management
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_VIEW,
    Permission.USER_LIST,
    Permission.USER_CHANGE_ROLE,

    // Customer Management
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_DELETE,
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_LIST,

    // Hall Management
    Permission.HALL_CREATE,
    Permission.HALL_UPDATE,
    Permission.HALL_DELETE,
    Permission.HALL_VIEW,
    Permission.HALL_LIST,
    Permission.HALL_IMAGE_UPLOAD,
    Permission.HALL_IMAGE_DELETE,

    // Package Management
    Permission.PACKAGE_CREATE,
    Permission.PACKAGE_UPDATE,
    Permission.PACKAGE_DELETE,
    Permission.PACKAGE_VIEW,
    Permission.PACKAGE_LIST,

    // Booking Management
    Permission.BOOKING_CREATE,
    Permission.BOOKING_UPDATE,
    Permission.BOOKING_DELETE,
    Permission.BOOKING_VIEW,
    Permission.BOOKING_LIST,
    Permission.BOOKING_CONFIRM,
    Permission.BOOKING_CANCEL,

    // Payment Management
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_UPDATE,
    Permission.PAYMENT_DELETE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_LIST,

    // Invoice Management
    Permission.INVOICE_CREATE,
    Permission.INVOICE_UPDATE,
    Permission.INVOICE_DELETE,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_LIST,
    Permission.INVOICE_GENERATE,

    // Reports & Analytics
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DASHBOARD_VIEW,
    Permission.ANALYTICS_VIEW,

    // Settings
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,
    Permission.BUSINESS_CONFIG_UPDATE,
  ],

  /**
   * STAFF_1 - Senior Staff
   * Full operational access (no user management, no deletions)
   */
  staff_1: [
    // User Management - NO ACCESS for security

    // Customer Management
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_LIST,

    // Hall Management (no delete)
    Permission.HALL_UPDATE,
    Permission.HALL_VIEW,
    Permission.HALL_LIST,
    Permission.HALL_IMAGE_UPLOAD,

    // Package Management (no delete)
    Permission.PACKAGE_UPDATE,
    Permission.PACKAGE_VIEW,
    Permission.PACKAGE_LIST,

    // Booking Management
    Permission.BOOKING_CREATE,
    Permission.BOOKING_UPDATE,
    Permission.BOOKING_VIEW,
    Permission.BOOKING_LIST,
    Permission.BOOKING_CONFIRM,
    Permission.BOOKING_CANCEL,

    // Payment Management
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_UPDATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_LIST,

    // Invoice Management
    Permission.INVOICE_CREATE,
    Permission.INVOICE_UPDATE,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_LIST,
    Permission.INVOICE_GENERATE,

    // Reports & Analytics
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DASHBOARD_VIEW,
    Permission.ANALYTICS_VIEW,

    // Settings (view only)
    Permission.SETTINGS_VIEW,
  ],

  /**
   * STAFF_2 - Junior Staff
   * Limited operational access (create only, no editing)
   */
  staff_2: [
    // User Management - NO ACCESS for security

    // Customer Management (create and view only)
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_LIST,

    // Hall Management (view only)
    Permission.HALL_VIEW,
    Permission.HALL_LIST,

    // Package Management (view only)
    Permission.PACKAGE_VIEW,
    Permission.PACKAGE_LIST,

    // Booking Management (create and view)
    Permission.BOOKING_CREATE,
    Permission.BOOKING_VIEW,
    Permission.BOOKING_LIST,

    // Payment Management (create and view)
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_LIST,

    // Invoice Management (view only)
    Permission.INVOICE_VIEW,
    Permission.INVOICE_LIST,

    // Reports & Analytics (view only)
    Permission.REPORT_VIEW,
    Permission.DASHBOARD_VIEW,

    // Settings (view only)
    Permission.SETTINGS_VIEW,
  ],

  /**
   * VIEWER - Read-Only Access
   * Can only view data, no modifications
   * No access to user management for security
   */
  viewer: [
    // Customer Management (view only)
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_LIST,

    // Hall Management (view only)
    Permission.HALL_VIEW,
    Permission.HALL_LIST,

    // Package Management (view only)
    Permission.PACKAGE_VIEW,
    Permission.PACKAGE_LIST,

    // Booking Management (view only)
    Permission.BOOKING_VIEW,
    Permission.BOOKING_LIST,

    // Payment Management (view only)
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_LIST,

    // Invoice Management (view only)
    Permission.INVOICE_VIEW,
    Permission.INVOICE_LIST,

    // Reports & Analytics (view only)
    Permission.REPORT_VIEW,
    Permission.DASHBOARD_VIEW,

    // No settings or report-export access for the read-only viewer role.
  ],
};

// ============================================================
// PERMISSION HELPER FUNCTIONS
// ============================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return RolePermissions[role].includes(permission);
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return RolePermissions[role];
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin';
}

/**
 * Check if user is admin or higher
 */
export function isAdminOrHigher(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if user is staff or higher
 */
export function isStaffOrHigher(role: UserRole): boolean {
  return role === 'admin' || role === 'staff_1' || role === 'staff_2';
}
