import { Request, Response } from 'express';
import InventoryRepository from '../repositories/InventoryRepository';
import InventoryImageService from '../services/InventoryImageService';
import {
  CreateEventInventoryRequirementDTO,
  CreateInventoryItemDTO,
  InventoryAvailabilitySlot,
  InventoryCategory,
  InventoryItemStatus,
  UpdateEventInventoryRequirementDTO,
  UpdateInventoryItemDTO,
} from '../models/Inventory';

const inventoryCategories: InventoryCategory[] = [
  'furniture',
  'linen',
  'dining',
  'kitchen_service',
  'decor',
  'sound_lighting',
  'utility',
  'other',
];

const itemStatuses: InventoryItemStatus[] = ['active', 'inactive'];
const availabilitySlots: InventoryAvailabilitySlot[] = ['morning', 'afternoon', 'night', 'full_day'];

export class InventoryController {
  async getItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await InventoryRepository.getItems({
        category: req.query.category as InventoryCategory,
        status: req.query.status as InventoryItemStatus,
        hall_id: req.query.hall_id ? Number(req.query.hall_id) : undefined,
        include_global: req.query.include_global === 'false' ? false : true,
        search: req.query.search as string,
      });

      res.json({ success: true, data: items, count: items.length });
    } catch (error) {
      sendError(res, error, 'Failed to fetch inventory items');
    }
  }

  async getPhotoUsage(_req: Request, res: Response): Promise<void> {
    try {
      const usage = await InventoryImageService.getUsage();
      res.json({ success: true, data: usage });
    } catch (error) {
      sendError(res, error, 'Failed to fetch inventory photo usage');
    }
  }

  async getKits(req: Request, res: Response): Promise<void> {
    try {
      const kits = await InventoryRepository.getKits({
        hall_id: req.query.hall_id ? Number(req.query.hall_id) : undefined,
        status: req.query.status as 'active' | 'inactive' | undefined,
        search: req.query.search as string,
      });
      res.json({ success: true, data: kits, count: kits.length });
    } catch (error) {
      sendError(res, error, 'Failed to fetch inventory kits');
    }
  }

  async getKitById(req: Request, res: Response): Promise<void> {
    try {
      const kit = await InventoryRepository.getKitById(Number(req.params.id));
      if (!kit) {
        res.status(404).json({ success: false, message: 'Inventory kit not found' });
        return;
      }
      res.json({ success: true, data: kit });
    } catch (error) {
      sendError(res, error, 'Failed to fetch inventory kit');
    }
  }

  async getKitAvailabilityPreview(req: Request, res: Response): Promise<void> {
    try {
      const kitId = Number(req.params.id);
      const eventDate = String(req.query.event_date || '');
      const slotType = String(req.query.slot_type || 'full_day') as InventoryAvailabilitySlot;

      if (!eventDate || Number.isNaN(Date.parse(`${eventDate}T00:00:00`))) {
        res.status(400).json({ success: false, message: 'Valid event_date is required' });
        return;
      }
      if (!availabilitySlots.includes(slotType)) {
        res.status(400).json({ success: false, message: 'Invalid slot_type' });
        return;
      }

      const preview = await InventoryRepository.getKitAvailabilityPreview(kitId, eventDate, slotType);
      if (!preview) {
        res.status(404).json({ success: false, message: 'Inventory kit not found' });
        return;
      }

      res.json({ success: true, data: preview });
    } catch (error) {
      sendError(res, error, 'Failed to preview kit availability');
    }
  }

  async createKit(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body.name?.trim()) {
        res.status(400).json({ success: false, message: 'Kit name is required' });
        return;
      }
      const id = await InventoryRepository.createKit(req.body);
      const kit = await InventoryRepository.getKitById(id);
      res.status(201).json({ success: true, message: 'Inventory kit created', data: kit });
    } catch (error) {
      sendError(res, error, 'Failed to create inventory kit');
    }
  }

  async updateKit(req: Request, res: Response): Promise<void> {
    try {
      const updated = await InventoryRepository.updateKit(Number(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Inventory kit not found' });
        return;
      }
      const kit = await InventoryRepository.getKitById(Number(req.params.id));
      res.json({ success: true, message: 'Inventory kit updated', data: kit });
    } catch (error) {
      sendError(res, error, 'Failed to update inventory kit');
    }
  }

  async addKitToBooking(req: Request, res: Response): Promise<void> {
    try {
      const createdIds = await InventoryRepository.addKitToBooking(
        Number(req.params.bookingId),
        Number(req.params.kitId)
      );
      const requirements = await InventoryRepository.getBookingRequirements(Number(req.params.bookingId));
      const summary = await InventoryRepository.getReadinessSummary(Number(req.params.bookingId));
      res.status(201).json({
        success: true,
        message: `${createdIds.length} kit item(s) added to booking`,
        data: { created_requirement_ids: createdIds, summary, requirements },
      });
    } catch (error) {
      sendError(res, error, 'Failed to add kit to booking');
    }
  }

  async createItem(req: Request, res: Response): Promise<void> {
    try {
      const data = sanitizeItemPayload(req.body) as CreateInventoryItemDTO;
      const id = await InventoryRepository.createItem(data);
      const item = await InventoryRepository.getItemById(id);

      res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: item,
      });
    } catch (error) {
      sendError(res, error, 'Failed to create inventory item');
    }
  }

  async bulkCreateItems(req: Request, res: Response): Promise<void> {
    try {
      const rawItems = Array.isArray(req.body.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
      if (rawItems.length === 0) {
        res.status(400).json({ success: false, message: 'No inventory items provided for bulk import' });
        return;
      }

      const sanitizedItems = rawItems.map((item: any) => sanitizeItemPayload(item)) as CreateInventoryItemDTO[];
      const result = await InventoryRepository.bulkCreateItems(sanitizedItems);

      res.status(201).json({
        success: true,
        message: `Successfully imported ${result.createdCount} inventory items in bulk`,
        data: result,
      });
    } catch (error) {
      sendError(res, error, 'Failed to bulk import inventory items');
    }
  }

  async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const data = sanitizeItemPayload(req.body, true);
      const updated = await InventoryRepository.updateItem(id, data);

      if (!updated) {
        res.status(404).json({ success: false, message: 'Inventory item not found' });
        return;
      }

      const item = await InventoryRepository.getItemById(id);
      res.json({
        success: true,
        message: 'Inventory item updated successfully',
        data: item,
      });
    } catch (error) {
      sendError(res, error, 'Failed to update inventory item');
    }
  }

  async getItemImages(req: Request, res: Response): Promise<void> {
    try {
      const itemId = Number(req.params.id);
      const images = await InventoryImageService.getImages(itemId);
      const usage = await InventoryImageService.getUsage();
      res.json({ success: true, data: { images, usage } });
    } catch (error) {
      sendError(res, error, 'Failed to fetch inventory images');
    }
  }

  async uploadItemImage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No image provided' });
        return;
      }

      const itemId = Number(req.params.id);
      const image = await InventoryImageService.uploadImage(itemId, req.file, req.user!.id, {
        caption: req.body.caption,
        alt_text: req.body.alt_text,
      });
      const usage = await InventoryImageService.getUsage();

      res.status(201).json({
        success: true,
        message: 'Inventory image uploaded successfully',
        data: { image, usage },
      });
    } catch (error) {
      sendError(res, error, 'Failed to upload inventory image');
    }
  }

  async deleteItemImage(req: Request, res: Response): Promise<void> {
    try {
      await InventoryImageService.deleteImage(Number(req.params.imageId));
      const usage = await InventoryImageService.getUsage();
      res.json({ success: true, message: 'Inventory image deleted', data: { usage } });
    } catch (error) {
      sendError(res, error, 'Failed to delete inventory image');
    }
  }

  async setPrimaryItemImage(req: Request, res: Response): Promise<void> {
    try {
      await InventoryImageService.setPrimary(Number(req.params.imageId));
      res.json({ success: true, message: 'Primary inventory image updated' });
    } catch (error) {
      sendError(res, error, 'Failed to set primary inventory image');
    }
  }

  async getStockAdjustments(req: Request, res: Response): Promise<void> {
    try {
      const itemId = Number(req.params.id);
      const adjustments = await InventoryRepository.getStockAdjustments(itemId);
      res.json({ success: true, data: adjustments, count: adjustments.length });
    } catch (error) {
      sendError(res, error, 'Failed to fetch stock adjustments');
    }
  }

  async createStockAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const itemId = Number(req.params.id);
      const adjustmentId = await InventoryRepository.createStockAdjustment(
        itemId,
        {
          adjustment_type: req.body.adjustment_type,
          quantity: req.body.quantity,
          reason: req.body.reason,
          notes: req.body.notes,
        },
        req.user?.id
      );
      const item = await InventoryRepository.getItemById(itemId);
      const adjustments = await InventoryRepository.getStockAdjustments(itemId);

      res.status(201).json({
        success: true,
        message: 'Stock adjustment recorded',
        data: {
          adjustment_id: adjustmentId,
          item,
          adjustments,
        },
      });
    } catch (error) {
      sendError(res, error, 'Failed to record stock adjustment');
    }
  }

  async getBookingRequirements(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.bookingId);
      const requirements = await InventoryRepository.getBookingRequirements(bookingId);
      const summary = await InventoryRepository.getReadinessSummary(bookingId);

      res.json({
        success: true,
        data: {
          summary,
          requirements,
        },
      });
    } catch (error) {
      sendError(res, error, 'Failed to fetch event inventory requirements');
    }
  }

  async createRequirement(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.bookingId);
      const data = sanitizeRequirementPayload(req.body) as CreateEventInventoryRequirementDTO;
      const id = await InventoryRepository.createRequirement(bookingId, data);
      const requirement = await InventoryRepository.getRequirementById(id);

      res.status(201).json({
        success: true,
        message: 'Event inventory requirement created successfully',
        data: requirement,
      });
    } catch (error) {
      sendError(res, error, 'Failed to create event inventory requirement');
    }
  }

  async updateRequirement(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const data = sanitizeRequirementPayload(req.body, true);
      const updated = await InventoryRepository.updateRequirement(id, data);

      if (!updated) {
        res.status(404).json({ success: false, message: 'Event inventory requirement not found' });
        return;
      }

      const requirement = await InventoryRepository.getRequirementById(id);
      res.json({
        success: true,
        message: 'Event inventory requirement updated successfully',
        data: requirement,
      });
    } catch (error) {
      sendError(res, error, 'Failed to update event inventory requirement');
    }
  }

  async deleteRequirement(req: Request, res: Response): Promise<void> {
    try {
      const deleted = await InventoryRepository.deleteRequirement(Number(req.params.id));

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Event inventory requirement not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Event inventory requirement removed successfully',
      });
    } catch (error) {
      sendError(res, error, 'Failed to remove event inventory requirement');
    }
  }

  async reserveRequirement(req: Request, res: Response): Promise<void> {
    try {
      const updated = await InventoryRepository.reserveRequirement(Number(req.params.id));
      if (!updated) {
        res.status(404).json({ success: false, message: 'Event inventory requirement not found' });
        return;
      }
      const requirement = await InventoryRepository.getRequirementById(Number(req.params.id));
      res.json({ success: true, message: 'Inventory reserved for event', data: requirement });
    } catch (error) {
      sendError(res, error, 'Failed to reserve inventory');
    }
  }

  async dispatchRequirement(req: Request, res: Response): Promise<void> {
    try {
      const updated = await InventoryRepository.dispatchRequirement(
        Number(req.params.id),
        req.body.quantity
      );
      if (!updated) {
        res.status(404).json({ success: false, message: 'Event inventory requirement not found' });
        return;
      }
      const requirement = await InventoryRepository.getRequirementById(Number(req.params.id));
      res.json({ success: true, message: 'Inventory dispatched for event', data: requirement });
    } catch (error) {
      sendError(res, error, 'Failed to dispatch inventory');
    }
  }

  async returnRequirement(req: Request, res: Response): Promise<void> {
    try {
      const updated = await InventoryRepository.returnRequirement(Number(req.params.id), {
        returned_quantity: req.body.returned_quantity,
        damaged_quantity: req.body.damaged_quantity,
        missing_quantity: req.body.missing_quantity,
      }, req.user?.id);
      if (!updated) {
        res.status(404).json({ success: false, message: 'Event inventory requirement not found' });
        return;
      }
      const requirement = await InventoryRepository.getRequirementById(Number(req.params.id));
      res.json({ success: true, message: 'Inventory return recorded', data: requirement });
    } catch (error) {
      sendError(res, error, 'Failed to record inventory return');
    }
  }
}

function sanitizeItemPayload(body: any, partial = false): CreateInventoryItemDTO | UpdateInventoryItemDTO {
  if (!partial && !body.name?.trim()) {
    throw new Error('Item name is required');
  }

  if (body.category && !inventoryCategories.includes(body.category)) {
    throw new Error('Invalid inventory category');
  }
  if (body.status && !itemStatuses.includes(body.status)) {
    throw new Error('Invalid inventory status');
  }

  return {
    hall_id: body.hall_id === '' ? null : body.hall_id,
    name: body.name,
    category: body.category,
    unit: body.unit,
    total_quantity: body.total_quantity,
    usable_quantity: body.usable_quantity,
    damaged_quantity: body.damaged_quantity,
    missing_quantity: body.missing_quantity,
    maintenance_quantity: body.maintenance_quantity,
    reorder_level: body.reorder_level,
    storage_location: body.storage_location,
    rented_default: body.rented_default,
    notes: body.notes,
    status: body.status,
  };
}

function sanitizeRequirementPayload(
  body: any,
  partial = false
): CreateEventInventoryRequirementDTO | UpdateEventInventoryRequirementDTO {
  if (!partial && !body.inventory_item_id && !body.item_name?.trim()) {
    throw new Error('Inventory item or item name is required');
  }
  if (!partial && body.required_quantity === undefined) {
    throw new Error('Required quantity is required');
  }
  if (body.category && !inventoryCategories.includes(body.category)) {
    throw new Error('Invalid inventory category');
  }

  return {
    inventory_item_id: body.inventory_item_id,
    item_name: body.item_name,
    category: body.category,
    required_quantity: body.required_quantity,
    owned_reserved_quantity: body.owned_reserved_quantity,
    rental_needed_quantity: body.rental_needed_quantity,
    source: body.source,
    status: body.status,
    responsible_name: body.responsible_name,
    notes: body.notes,
  };
}

function sendError(res: Response, error: unknown, fallbackMessage: string): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = message.includes('not found')
    ? 404
    : message.includes('Invalid') ||
      message.includes('required') ||
      message.includes('Quantities') ||
      message.includes('greater than zero') ||
      message.includes('Not enough') ||
      message.includes('Cannot') ||
      message.includes('photo limit reached')
      ? 400
      : 500;

  res.status(status).json({
    success: false,
    message,
  });
}

export default new InventoryController();
