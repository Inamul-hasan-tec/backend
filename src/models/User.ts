/**
 * User Model
 * Represents system users with RBAC and multi-tenancy support
 */

// RBAC Role Types
export type UserRole = 'super_admin' | 'admin' | 'staff_1' | 'staff_2' | 'viewer';

export interface User {
  id: number;
  tenant_id?: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  is_super_admin: boolean;
  status: 'active' | 'inactive';
  auth_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDTO {
  tenant_id?: number;
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  is_super_admin?: boolean;
  status?: 'active' | 'inactive';
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  is_super_admin?: boolean;
  status?: 'active' | 'inactive';
}

export interface UserResponse {
  id: number;
  tenant_id?: number;
  name: string;
  email: string;
  role: UserRole;
  is_super_admin: boolean;
  status: string;
  auth_version?: number;
  created_at: Date;
}

// User-Tenant Junction (for multi-tenant users)
export interface UserTenant {
  id: number;
  user_id: number;
  tenant_id: number;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
