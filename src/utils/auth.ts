/**
 * Authentication Utilities
 * Helper functions for password hashing, JWT generation, and validation
 */

import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

/**
 * JWT Payload Interface
 * Defines the structure of data stored in JWT tokens
 */
export interface JWTPayload {
  id: number;
  email: string;
  role: string;
  name: string;
  tenant_id?: number;
  is_super_admin?: boolean;
  auth_version: number;
}

/**
 * Hash a plain text password using bcrypt
 * 
 * @param password - Plain text password to hash
 * @returns Hashed password string
 * 
 * @example
 * const hashed = await hashPassword('myPassword123');
 * // Returns: $2a$10$... (60 character hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain text password with a hashed password
 * 
 * @param password - Plain text password to check
 * @param hashedPassword - Hashed password from database
 * @returns True if passwords match, false otherwise
 * 
 * @example
 * const isValid = await comparePassword('myPassword123', hashedFromDB);
 * if (isValid) {
 *   // Password is correct
 * }
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a JWT token for a user
 * 
 * @param payload - User data to encode in token
 * @returns Signed JWT token string
 * 
 * @example
 * const token = generateToken({
 *   id: 1,
 *   email: 'user@example.com',
 *   role: 'admin',
 *   name: 'John Doe'
 * });
 */
export function generateToken(payload: JWTPayload): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  // @ts-ignore - jwt types issue with expiresIn
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

/**
 * Verify and decode a JWT token
 * 
 * @param token - JWT token string to verify
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 * 
 * @example
 * try {
 *   const user = verifyToken(token);
 *   console.log(user.email); // user@example.com
 * } catch (error) {
 *   console.error('Invalid token');
 * }
 */
export function verifyToken(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Validate password strength
 * 
 * Requirements:
 * - At least 6 characters
 * - Contains at least one letter
 * - Contains at least one number
 * 
 * @param password - Password to validate
 * @returns Object with isValid boolean and error message if invalid
 * 
 * @example
 * const result = validatePassword('weak');
 * if (!result.isValid) {
 *   console.log(result.message); // "Password must be at least 6 characters"
 * }
 */
export function validatePassword(password: string): {
  isValid: boolean;
  message?: string;
} {
  if (!password || password.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters long',
    };
  }
  
  if (!/[a-zA-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one letter',
    };
  }
  
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number',
    };
  }
  
  return { isValid: true };
}

/**
 * Validate email format
 * 
 * @param email - Email address to validate
 * @returns True if email format is valid
 * 
 * @example
 * validateEmail('user@example.com'); // true
 * validateEmail('invalid-email'); // false
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extract token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns Token string or null if not found
 * 
 * @example
 * const token = extractTokenFromHeader('Bearer abc123xyz');
 * // Returns: 'abc123xyz'
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}
