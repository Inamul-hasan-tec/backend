/**
 * User Model
 * Represents system users (admin, manager, staff)
 */

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'staff';
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'manager' | 'staff';
  status?: 'active' | 'inactive';
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'staff';
  status?: 'active' | 'inactive';
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: Date;
}
