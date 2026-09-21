/**
 * Customer Service
 * Business logic for customer operations
 */

import { CustomerRepository } from '../repositories/CustomerRepository';
import { Customer, CreateCustomerDTO, UpdateCustomerDTO, CustomerSearchParams } from '../models/Customer';
import { isValidEmail, isValidPhone, validateRequired } from '../utils/validation';
import { getTenantId } from '../utils/tenantContext';

export class CustomerService {
  private customerRepo: CustomerRepository;

  constructor() {
    this.customerRepo = new CustomerRepository();
  }

  /**
   * Get all customers
   */
  async getAllCustomers(limit?: number, offset?: number): Promise<Customer[]> {
    return await this.customerRepo.findAll(limit, offset);
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(id: number): Promise<Customer | null> {
    return await this.customerRepo.findById(id);
  }

  /**
   * Create new customer
   */
  async createCustomer(data: Omit<CreateCustomerDTO, 'tenant_id'>): Promise<number> {
    // Validate required fields
    const validation = validateRequired(data, ['name', 'phone']);
    if (!validation.valid) {
      throw new Error(`Missing required fields: ${validation.missing.join(', ')}`);
    }

    // Validate phone format
    if (!isValidPhone(data.phone)) {
      throw new Error('Invalid phone number format. Must be 10 digits starting with 6-9');
    }

    // Validate email if provided
    if (data.email && !isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Check if phone already exists in this tenant
    const existing = await this.customerRepo.findByPhone(data.phone);
    if (existing) {
      throw new Error('Customer with this phone number already exists');
    }

    // Create customer (tenant_id is handled by TenantBaseRepository, but we must pass it if CreateCustomerDTO requires it type-wise)
    const tenant_id = getTenantId();
    return await this.customerRepo.create({ ...data, tenant_id } as CreateCustomerDTO);
  }

  /**
   * Update customer
   */
  async updateCustomer(id: number, data: UpdateCustomerDTO): Promise<boolean> {
    // Check if customer exists
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }

    // Validate phone if provided
    if (data.phone && !isValidPhone(data.phone)) {
      throw new Error('Invalid phone number format');
    }

    // Validate email if provided
    if (data.email && !isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Check if new phone already exists (for different customer)
    if (data.phone && data.phone !== existing.phone) {
      const phoneExists = await this.customerRepo.findByPhone(data.phone);
      if (phoneExists) {
        throw new Error('Phone number already in use by another customer');
      }
    }

    return await this.customerRepo.update(id, data);
  }

  /**
   * Get customer dependencies (bookings, payments, invoices, balances)
   */
  async getCustomerDependencies(id: number) {
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }
    return await this.customerRepo.getCustomerDependencies(id);
  }

  /**
   * Archive customer
   */
  async archiveCustomer(id: number, reason: string, actorId: number): Promise<boolean> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }
    return await this.customerRepo.archiveCustomer(id, reason, actorId);
  }

  /**
   * Delete customer permanently (Owner only, 0 dependencies)
   */
  async deleteCustomer(id: number, isOwner: boolean = false): Promise<boolean> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }

    if (!isOwner) {
      throw new Error('Only venue owners can permanently delete customer records.');
    }

    const dependencies = await this.customerRepo.getCustomerDependencies(id);
    const totalDependencies =
      dependencies.active_bookings +
      dependencies.cancelled_bookings +
      dependencies.payments_count +
      dependencies.invoices_count;

    if (totalDependencies > 0) {
      throw new Error(
        'Cannot permanently delete customer with operational or financial history (bookings, payments, or invoices). Please archive the customer instead to preserve historical records.'
      );
    }

    return await this.customerRepo.delete(id);
  }

  /**
   * Search customers
   */
  async searchCustomers(params: CustomerSearchParams): Promise<Customer[]> {
    return await this.customerRepo.search(params);
  }

  /**
   * Get recent customers
   */
  async getRecentCustomers(limit: number = 10): Promise<Customer[]> {
    return await this.customerRepo.getRecent(limit);
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats() {
    return await this.customerRepo.getStats();
  }
}
