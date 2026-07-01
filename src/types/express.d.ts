import { UserRole } from './permissions';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: UserRole;
        tenant_id?: number;
        is_super_admin: boolean;
        auth_version: number;
      };
      tenantId?: number;
      requestId?: string;
    }
  }
}

export {};
