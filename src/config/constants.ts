// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const JWT_EXPIRE = '30d';

// User roles
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer'
};

// Default pagination
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

export { DEFAULT_PAGE, DEFAULT_LIMIT };
