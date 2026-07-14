/**
 * User Service
 * Business logic for user management and authentication
 */

import { UserRepository } from '../repositories/UserRepository';
import { CreateUserDTO, UserResponse } from '../models/User';
import {
  hashPassword,
  comparePassword,
  generateToken,
  validatePassword,
  validateEmail,
} from '../utils/auth';

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  /**
   * Register a new user (for public signup / first tenant creation)
   */
  async register(userData: CreateUserDTO): Promise<{
    user: UserResponse;
    token: string;
  }> {
    // Validate email format
    if (!validateEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.message || 'Invalid password');
    }

    // Check if user already exists
    const existingUser = await this.userRepo.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);

    // Create user
    const userId = await this.userRepo.create({
      ...userData,
      password: hashedPassword,
    });

    // Get created user
    const user = await this.userRepo.findByIdSafe(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate JWT token with tenant info
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.is_super_admin ? 'super_admin' : user.role,
      name: user.name,
      tenant_id: user.is_super_admin ? undefined : user.tenant_id,
      is_super_admin: user.is_super_admin,
      auth_version: user.auth_version,
    });

    return {
      user: user as UserResponse,
      token,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{
    user: UserResponse;
    token: string;
  }> {
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user by email
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active globally (or in the tenant context, handled in repo)
    if (user.status !== 'active') {
      throw new Error('Account is inactive. Please contact administrator.');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token with full user context
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.is_super_admin ? 'super_admin' : user.role,
      name: user.name,
      tenant_id: user.is_super_admin ? undefined : user.tenant_id,
      is_super_admin: user.is_super_admin,
      auth_version: user.auth_version,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    if (user.is_super_admin) {
      delete userWithoutPassword.tenant_id;
      userWithoutPassword.role = 'super_admin';
    }

    return {
      user: userWithoutPassword as UserResponse,
      token,
    };
  }

  /**
   * Get user by ID (safe - without password)
   */
  async getUserById(id: number): Promise<UserResponse | null> {
    const user = await this.userRepo.findByIdSafe(id);
    return user as UserResponse | null;
  }

  /**
   * Get all active users
   */
  async getActiveUsers(): Promise<UserResponse[]> {
    const users = await this.userRepo.getActive();
    return users.map(({ password, ...user }: any) => user) as UserResponse[];
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.message || 'Invalid password');
    }

    const hashedPassword = await hashPassword(newPassword);

    const updated = await this.userRepo.updatePassword(userId, hashedPassword);
    if (!updated) {
      throw new Error('Failed to update password');
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: number): Promise<void> {
    const updated = await this.userRepo.updateStatus(userId, 'inactive');
    if (!updated) {
      throw new Error('Failed to deactivate user');
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId: number): Promise<void> {
    const updated = await this.userRepo.updateStatus(userId, 'active');
    if (!updated) {
      throw new Error('Failed to activate user');
    }
  }

  /**
   * Get all users for a tenant
   */
  async getAllUsersByTenant(): Promise<UserResponse[]> {
    return await this.userRepo.getAllByTenant();
  }

  /**
   * Get user by ID with tenant check
   */
  async getUserByIdWithTenant(userId: number): Promise<UserResponse | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      return null;
    }
    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId: number, updateData: Partial<CreateUserDTO>): Promise<UserResponse> {
    if (updateData.email && !validateEmail(updateData.email)) {
      throw new Error('Invalid email format');
    }

    if (updateData.email) {
      const existingUser = await this.userRepo.findByEmail(updateData.email);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email already exists');
      }
    }

    const updated = await this.userRepo.update(userId, updateData);
    if (!updated) {
      throw new Error('Failed to update user');
    }

    const user = await this.userRepo.findByIdSafe(userId);
    if (!user) {
      throw new Error('User not found after update');
    }

    return user;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: number): Promise<void> {
    const deleted = await this.userRepo.delete(userId);
    if (!deleted) {
      throw new Error('Failed to delete user');
    }
  }

}
