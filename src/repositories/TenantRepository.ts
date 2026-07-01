/**
 * Tenant Repository
 * Database operations for tenants and tenant settings
 */

import pool from '../config/db';

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  subdomain?: string | null;
  logo_url: string | null;
  status: 'trial' | 'active' | 'past_due' | 'inactive' | 'suspended' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface TenantSetting {
  id: number;
  tenant_id: number;
  setting_key: string;
  setting_value: string;
  created_at: Date;
  updated_at: Date;
}

export class TenantRepository {
  /**
   * Get tenant by ID
   */
  async findById(tenantId: number): Promise<Tenant | null> {
    const [rows]: any = await pool.query(
      'SELECT *, domain AS subdomain FROM tenants WHERE id = ?',
      [tenantId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get tenant by subdomain
   */
  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    const [rows]: any = await pool.query(
      'SELECT *, domain AS subdomain FROM tenants WHERE domain = ?',
      [subdomain]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    const [rows]: any = await pool.query(
      'SELECT *, domain AS subdomain FROM tenants WHERE slug = ?',
      [slug]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all active tenants
   */
  async findAll(): Promise<Tenant[]> {
    const [rows] = await pool.query(
      'SELECT *, domain AS subdomain FROM tenants ORDER BY name'
    );
    return rows as Tenant[];
  }

  /**
   * Get tenant settings
   */
  async getSettings(tenantId: number): Promise<Record<string, string>> {
    const [rows]: any = await pool.query(
      'SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?',
      [tenantId]
    );

    const settings: Record<string, string> = {};
    rows.forEach((row: any) => {
      settings[row.setting_key] = row.setting_value;
    });

    return settings;
  }

  /**
   * Get single tenant setting
   */
  async getSetting(tenantId: number, key: string): Promise<string | null> {
    const [rows]: any = await pool.query(
      'SELECT setting_value FROM tenant_settings WHERE tenant_id = ? AND setting_key = ?',
      [tenantId, key]
    );
    return rows.length > 0 ? rows[0].setting_value : null;
  }

  /**
   * Set tenant setting
   */
  async setSetting(tenantId: number, key: string, value: string): Promise<void> {
    await pool.query(
      `INSERT INTO tenant_settings (tenant_id, setting_key, setting_value) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [tenantId, key, value]
    );
  }

  /**
   * Update tenant
   */
  async update(
    tenantId: number,
    data: Partial<Pick<Tenant, 'name' | 'logo_url' | 'status'>>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.logo_url !== undefined) {
      fields.push('logo_url = ?');
      values.push(data.logo_url);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (fields.length === 0) return;

    values.push(tenantId);

    await pool.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Create new tenant
   */
  async create(data: {
    name: string;
    slug: string;
    subdomain?: string;
    domain?: string;
    logo_url?: string;
  }): Promise<number> {
    const [result]: any = await pool.query(
      `INSERT INTO tenants (name, slug, domain, logo_url, status) 
       VALUES (?, ?, ?, ?, 'trial')`,
      [data.name, data.slug, data.domain || data.subdomain || null, data.logo_url || null]
    );
    return result.insertId;
  }

  /**
   * Get tenant with settings (combined)
   */
  async getTenantWithSettings(tenantId: number): Promise<{
    tenant: Tenant | null;
    settings: Record<string, string>;
  }> {
    const tenant = await this.findById(tenantId);
    const settings = tenant ? await this.getSettings(tenantId) : {};

    return { tenant, settings };
  }

  /**
   * Update tenant by ID (Super Admin only)
   */
  async updateById(
    tenantId: number,
    data: Partial<Pick<Tenant, 'name' | 'slug' | 'subdomain' | 'logo_url' | 'status'>>
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      fields.push('slug = ?');
      values.push(data.slug);
    }
    if (data.subdomain !== undefined) {
      fields.push('domain = ?');
      values.push(data.subdomain);
    }
    if (data.logo_url !== undefined) {
      fields.push('logo_url = ?');
      values.push(data.logo_url);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = NOW()');
    values.push(tenantId);

    await pool.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Get tenant statistics (Super Admin only)
   */
  async getStats(tenantId: number): Promise<{
    total_users: number;
    total_halls: number;
    total_bookings: number;
    total_customers: number;
    total_revenue: number;
  }> {
    const [stats]: any = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM user_tenants ut INNER JOIN users u ON u.id = ut.user_id WHERE ut.tenant_id = ? AND ut.is_active = true AND u.status = 'active') as total_users,
        (SELECT COUNT(*) FROM halls WHERE tenant_id = ?) as total_halls,
        (SELECT COUNT(*) FROM bookings WHERE tenant_id = ?) as total_bookings,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = ?) as total_customers,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE tenant_id = ?) as total_revenue`,
      [tenantId, tenantId, tenantId, tenantId, tenantId]
    );

    return stats[0];
  }

  /**
   * Get all tenants with stats (Super Admin only)
   */
  async getAllWithStats(): Promise<any[]> {
    const [rows]: any = await pool.query(
      `SELECT 
        t.*,
        t.domain AS subdomain,
        (SELECT COUNT(*) FROM user_tenants ut INNER JOIN users u ON u.id = ut.user_id WHERE ut.tenant_id = t.id AND ut.is_active = true AND u.status = 'active') as user_count,
        (SELECT COUNT(*) FROM halls WHERE tenant_id = t.id) as hall_count,
        (SELECT COUNT(*) FROM bookings WHERE tenant_id = t.id) as booking_count,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count
      FROM tenants t
      ORDER BY t.name`
    );

    return rows;
  }
}

export default new TenantRepository();
