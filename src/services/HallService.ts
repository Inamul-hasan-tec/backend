/**
 * Hall Service
 * Business logic for hall operations
 */

import { HallRepository } from '../repositories/HallRepository';
import { Hall, CreateHallDTO, UpdateHallDTO, HallSearchParams } from '../models/Hall';
import { validateRequired, isPositiveNumber } from '../utils/validation';
import { getTenantId } from '../utils/tenantContext';
import { SlotService } from './SlotService';

export class HallService {
  private hallRepo: HallRepository;
  private slotService: SlotService;

  constructor() {
    this.hallRepo = new HallRepository();
    this.slotService = new SlotService();
  }

  /**
   * Get all halls
   */
  async getAllHalls(limit?: number, offset?: number): Promise<Hall[]> {
    return await this.hallRepo.findAll(limit, offset);
  }

  /**
   * Get hall by ID
   */
  async getHallById(id: number): Promise<Hall | null> {
    return await this.hallRepo.findById(id);
  }

  /**
   * Create new hall
   */
  async createHall(data: CreateHallDTO): Promise<number> {
    // Validate required fields
    const validation = validateRequired(data, ['name', 'capacity', 'base_price']);
    if (!validation.valid) {
      throw new Error(`Missing required fields: ${validation.missing.join(', ')}`);
    }

    // Validate capacity
    if (!isPositiveNumber(data.capacity)) {
      throw new Error('Capacity must be a positive number');
    }

    // Validate base price
    if (!isPositiveNumber(data.base_price)) {
      throw new Error('Base price must be a positive number');
    }

    const hallId = await this.hallRepo.create(data);
    const tenantId = getTenantId();

    // New halls should immediately receive their subscription-backed inventory.
    // This is idempotent and never overwrites booked/blocked slots.
    await this.slotService.generateSlotsForHallUntilSubscriptionEnd(tenantId, hallId);

    return hallId;
  }

  /**
   * Update hall
   */
  async updateHall(id: number, data: UpdateHallDTO): Promise<boolean> {
    // Check if hall exists
    const existing = await this.hallRepo.findById(id);
    if (!existing) {
      throw new Error('Hall not found');
    }

    // Validate capacity if provided
    if (data.capacity !== undefined && !isPositiveNumber(data.capacity)) {
      throw new Error('Capacity must be a positive number');
    }

    // Validate base price if provided
    if (data.base_price !== undefined && !isPositiveNumber(data.base_price)) {
      throw new Error('Base price must be a positive number');
    }

    return await this.hallRepo.update(id, data);
  }

  /**
   * Delete hall
   */
  async deleteHall(id: number): Promise<boolean> {
    const existing = await this.hallRepo.findById(id);
    if (!existing) {
      throw new Error('Hall not found');
    }

    return await this.hallRepo.delete(id);
  }

  /**
   * Search halls
   */
  async searchHalls(params: HallSearchParams): Promise<Hall[]> {
    return await this.hallRepo.search(params);
  }

  /**
   * Get active halls
   */
  async getActiveHalls(): Promise<Hall[]> {
    return await this.hallRepo.getActive();
  }

  /**
   * Check hall availability
   */
  async checkAvailability(hallId: number, date: string): Promise<boolean> {
    const hall = await this.hallRepo.findById(hallId);
    if (!hall) {
      throw new Error('Hall not found');
    }

    if (hall.status !== 'active') {
      return false;
    }

    return await this.hallRepo.isAvailable(hallId, date);
  }

  /**
   * Get hall with availability
   */
  async getHallWithAvailability(hallId: number, dateFrom: string, dateTo: string) {
    return await this.hallRepo.getWithAvailability(hallId, dateFrom, dateTo);
  }
}
