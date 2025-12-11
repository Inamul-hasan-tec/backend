/**
 * Package Service
 * Business logic for package operations
 */

import { PackageRepository } from '../repositories/PackageRepository';
import { Package, CreatePackageDTO, UpdatePackageDTO, PackageSearchParams } from '../models/Package';
import { validateRequired, isPositiveNumber } from '../utils/validation';

export class PackageService {
  private packageRepo: PackageRepository;

  constructor() {
    this.packageRepo = new PackageRepository();
  }

  /**
   * Get all packages
   */
  async getAllPackages(limit?: number, offset?: number): Promise<Package[]> {
    return await this.packageRepo.findAll(limit, offset);
  }

  /**
   * Get package by ID
   */
  async getPackageById(id: number): Promise<Package | null> {
    return await this.packageRepo.findById(id);
  }

  /**
   * Create new package
   */
  async createPackage(data: CreatePackageDTO): Promise<number> {
    // Validate required fields
    const validation = validateRequired(data, ['name', 'base_price']);
    if (!validation.valid) {
      throw new Error(`Missing required fields: ${validation.missing.join(', ')}`);
    }

    // Validate base price
    if (!isPositiveNumber(data.base_price)) {
      throw new Error('Base price must be a positive number');
    }

    return await this.packageRepo.create(data);
  }

  /**
   * Update package
   */
  async updatePackage(id: number, data: UpdatePackageDTO): Promise<boolean> {
    // Check if package exists
    const existing = await this.packageRepo.findById(id);
    if (!existing) {
      throw new Error('Package not found');
    }

    // Validate base price if provided
    if (data.base_price !== undefined && !isPositiveNumber(data.base_price)) {
      throw new Error('Base price must be a positive number');
    }

    return await this.packageRepo.update(id, data);
  }

  /**
   * Delete package
   */
  async deletePackage(id: number): Promise<boolean> {
    const existing = await this.packageRepo.findById(id);
    if (!existing) {
      throw new Error('Package not found');
    }

    return await this.packageRepo.delete(id);
  }

  /**
   * Search packages
   */
  async searchPackages(params: PackageSearchParams): Promise<Package[]> {
    return await this.packageRepo.search(params);
  }

  /**
   * Get active packages
   */
  async getActivePackages(): Promise<Package[]> {
    return await this.packageRepo.getActive();
  }

  /**
   * Get popular packages
   */
  async getPopularPackages(limit: number = 5): Promise<Package[]> {
    return await this.packageRepo.getPopular(limit);
  }
}
