/**
 * Standard API Response Utilities
 * Provides consistent response format across all endpoints
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Success response
 */
export function successResponse<T>(
  message: string,
  data?: T
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Error response
 */
export function errorResponse(
  message: string,
  error?: string
): ApiResponse {
  return {
    success: false,
    message,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: string;
}

export function paginatedResponse<T>(
  message: string,
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    timestamp: new Date().toISOString(),
  };
}
