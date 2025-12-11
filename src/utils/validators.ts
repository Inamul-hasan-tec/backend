/**
 * Validation Utilities
 * Helper functions for input validation and sanitization
 */

/**
 * Validate and sanitize limit parameter for SQL queries
 * Ensures the value is a safe integer within acceptable range
 * 
 * @param limit - The limit value to validate (can be string, number, or undefined)
 * @param defaultValue - Default value if limit is invalid (default: 10)
 * @param max - Maximum allowed value (default: 100)
 * @returns Validated integer between 1 and max
 * 
 * @example
 * validateLimit('5') // returns 5
 * validateLimit('abc') // returns 10 (default)
 * validateLimit(150, 10, 100) // returns 100 (capped at max)
 * validateLimit(-5) // returns 10 (default, negative not allowed)
 */
export function validateLimit(
  limit: any,
  defaultValue: number = 10,
  max: number = 100
): number {
  const parsed = parseInt(limit);
  
  // Return default if parsing fails or value is less than 1
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  
  // Cap at maximum value
  return Math.min(parsed, max);
}

/**
 * Validate and sanitize offset parameter for SQL queries
 * 
 * @param offset - The offset value to validate
 * @param defaultValue - Default value if offset is invalid (default: 0)
 * @param max - Maximum allowed value (default: 10000)
 * @returns Validated integer between 0 and max
 */
export function validateOffset(
  offset: any,
  defaultValue: number = 0,
  max: number = 10000
): number {
  const parsed = parseInt(offset);
  
  // Return default if parsing fails or value is less than 0
  if (isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  
  // Cap at maximum value
  return Math.min(parsed, max);
}

/**
 * Validate ID parameter
 * Ensures the value is a positive integer
 * 
 * @param id - The ID to validate
 * @returns Validated positive integer or null if invalid
 */
export function validateId(id: any): number | null {
  const parsed = parseInt(id);
  
  if (isNaN(parsed) || parsed < 1) {
    return null;
  }
  
  return parsed;
}

/**
 * Sanitize string input for SQL LIKE queries
 * Escapes special characters to prevent SQL injection
 * 
 * @param input - The string to sanitize
 * @returns Sanitized string safe for LIKE queries
 */
export function sanitizeLikeInput(input: string): string {
  if (!input) return '';
  
  // Escape special characters used in LIKE patterns
  return input
    .replace(/\\/g, '\\\\')  // Escape backslash
    .replace(/%/g, '\\%')    // Escape percent
    .replace(/_/g, '\\_');   // Escape underscore
}
