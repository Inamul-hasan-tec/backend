import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId?: number;
  userId: number;
  role: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

/**
 * Run a function within a tenant context
 */
export const runWithTenantContext = <T>(context: TenantContext, fn: () => T): T => {
  return tenantContext.run(context, fn);
};

/**
 * Get the current tenant context
 */
export const getTenantContext = (): TenantContext | undefined => {
  return tenantContext.getStore();
};

/**
 * Get the current tenant ID, throws if not found
 */
export const getTenantId = (): number => {
  const store = tenantContext.getStore();
  if (!store || !store.tenantId) {
    throw new Error('Tenant context is missing. Cannot execute tenant-isolated query.');
  }
  return store.tenantId;
};
