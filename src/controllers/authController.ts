import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { AuthRepository } from '../repositories/AuthRepository';

const userService = new UserService();
const authRepository = new AuthRepository();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Register user
    const result = await userService.register({
      tenant_id: 1, // Default tenant for now, will be set by tenant middleware
      name,
      email,
      password,
      role: role || 'staff_2',
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    const statusCode = message.includes('already exists') ? 409 : 400;
    
    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Login user
    const result = await userService.login(email, password);

    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const statusCode = message.includes('Invalid')
      ? 401
      : message.includes('inactive')
        ? 403
        : 500;
    
    res.status(statusCode).json({
      success: false,
      message,
    });
  }
};

/**
 * @route   GET /api/auth/user
 * @desc    Get current user data
 * @access  Private
 */
export const getCurrentUser = (req: Request, res: Response) => {
  try {
    // User is set by auth middleware
    res.json({
      success: true,
      user: (req as any).user || null
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke all access tokens issued to the current user
 * @access  Private
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const revoked = await authRepository.revokeAllSessions(user.id);
    if (!revoked) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
    });
  }
};

export default { login, getCurrentUser, logout };
