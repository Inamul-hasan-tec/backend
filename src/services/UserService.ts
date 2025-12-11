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
   * Register a new user
   * Validates input, checks for duplicates, hashes password, creates user
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

    // Get created user (without password)
    const user = await this.userRepo.findByIdSafe(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      user: user as UserResponse,
      token,
    };
  }

  /**
   * Login user
   * Validates credentials and returns token
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

    // Check if user is active
    if (user.status !== 'active') {
      throw new Error('Account is inactive. Please contact administrator.');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

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
    // Remove passwords from response
    return users.map(({ password, ...user }) => user) as UserResponse[];
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user with password
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.message || 'Invalid password');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
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
}
