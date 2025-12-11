import { Request, Response } from 'express';
import { UserService } from '../services/UserService';

const userService = new UserService();

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
      name,
      email,
      password,
      role: role || 'staff',
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
    const statusCode = message.includes('Invalid') ? 401 : 500;
    
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

export default { login, getCurrentUser };
