import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/auth';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export const auth = (req: Request, res: Response, next: NextFunction) => {
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

    // Attach user info to request
    (req as any).user = decoded;

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    return res.status(401).json({
      success: false,
      message,
    });
  }
};

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
