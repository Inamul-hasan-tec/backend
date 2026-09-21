import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';
import {
  CreateEventInventoryRequirementDTO,
  CreateInventoryItemDTO,
  CreateInventoryKitDTO,
  CreateInventoryStockAdjustmentDTO,
  CreateInventoryKitItemDTO,
  EventInventoryRequirement,
  EventInventoryStatus,
  InventoryQuantitySnapshot,
  InventoryItemImage,
  InventoryKit,
  InventoryKitAvailabilityPreview,
  InventoryAvailabilitySlot,
  InventoryKitItem,
  InventoryPhotoUsage,
  InventoryStockAdjustment,
  InventoryItem,
  InventoryItemFilters,
  InventoryReadinessSummary,
  UpdateEventInventoryRequirementDTO,
  UpdateInventoryKitDTO,
  UpdateInventoryItemDTO,
} from '../models/Inventory';

const OVERLAPPING_SLOT_SQL = `
  (
    b.time_slot = target.time_slot
    OR b.time_slot = 'full_day'
    OR target.time_slot = 'full_day'
  )
`;

export class InventoryRepository {
  async getItems(filters?: InventoryItemFilters): Promise<InventoryItem[]> {
    const tenantId = getTenantId();
    let sql = `
      SELECT ii.*, h.name AS hall_name
      , primary_image.image_url AS primary_image_url
      , COALESCE(image_counts.image_count, 0) AS image_count
      FROM inventory_items ii
      LEFT JOIN halls h ON h.id = ii.hall_id AND h.tenant_id = ii.tenant_id
      LEFT JOIN inventory_item_images primary_image
        ON primary_image.inventory_item_id = ii.id
       AND primary_image.tenant_id = ii.tenant_id
       AND primary_image.is_primary = TRUE
      LEFT JOIN (
        SELECT tenant_id, inventory_item_id, COUNT(*) AS image_count
        FROM inventory_item_images
        GROUP BY tenant_id, inventory_item_id
      ) image_counts
        ON image_counts.inventory_item_id = ii.id
       AND image_counts.tenant_id = ii.tenant_id
      WHERE ii.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (filters?.category) {
      sql += ' AND ii.category = ?';
      params.push(filters.category);
    }

    if (filters?.status) {
      sql += ' AND ii.status = ?';
      params.push(filters.status);
    }

    if (filters?.hall_id !== undefined && filters.hall_id !== null) {
      sql += filters.include_global === false
        ? ' AND ii.hall_id = ?'
        : ' AND (ii.hall_id IS NULL OR ii.hall_id = ?)';
      params.push(filters.hall_id);
    }

    if (filters?.search) {
      sql += ' AND (ii.name LIKE ? OR ii.notes LIKE ? OR ii.storage_location LIKE ? OR h.name LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY ii.status ASC, ii.hall_id IS NOT NULL ASC, ii.category ASC, ii.name ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as InventoryItem[];
  }

  async getItemById(id: number): Promise<InventoryItem | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ii.*, h.name AS hall_name
       , primary_image.image_url AS primary_image_url
       , COALESCE(image_counts.image_count, 0) AS image_count
       FROM inventory_items ii
       LEFT JOIN halls h ON h.id = ii.hall_id AND h.tenant_id = ii.tenant_id
       LEFT JOIN inventory_item_images primary_image
         ON primary_image.inventory_item_id = ii.id
        AND primary_image.tenant_id = ii.tenant_id
        AND primary_image.is_primary = TRUE
       LEFT JOIN (
         SELECT tenant_id, inventory_item_id, COUNT(*) AS image_count
         FROM inventory_item_images
         GROUP BY tenant_id, inventory_item_id
       ) image_counts
         ON image_counts.inventory_item_id = ii.id
        AND image_counts.tenant_id = ii.tenant_id
       WHERE ii.id = ? AND ii.tenant_id = ?`,
      [id, tenantId]
    );
    return rows[0] ? (rows[0] as InventoryItem) : null;
  }

  async createItem(data: CreateInventoryItemDTO): Promise<number> {
    const tenantId = getTenantId();
    if (data.hall_id) {
      await this.assertHallExists(data.hall_id);
    }
    const total = toNonNegativeInt(data.total_quantity, 0);
    const usable = data.usable_quantity === undefined ? total : toNonNegativeInt(data.usable_quantity, 0);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO inventory_items (
        tenant_id, hall_id, name, category, unit, total_quantity, usable_quantity,
        damaged_quantity, missing_quantity, maintenance_quantity, reorder_level, storage_location, rented_default, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        data.hall_id || null,
        data.name.trim(),
        data.category || 'other',
        (data.unit || 'pcs').trim(),
        total,
        usable,
        toNonNegativeInt(data.damaged_quantity, 0),
        toNonNegativeInt(data.missing_quantity, 0),
        toNonNegativeInt(data.maintenance_quantity, 0),
        toNonNegativeInt(data.reorder_level, 0),
        data.storage_location || null,
        Boolean(data.rented_default),
        data.notes || null,
        data.status || 'active',
      ]
    );

    return result.insertId;
  }

  async bulkCreateItems(itemsData: CreateInventoryItemDTO[]): Promise<{ createdCount: number }> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      let createdCount = 0;

      for (const data of itemsData) {
        if (!data.name?.trim()) continue;

        const usable = toNonNegativeInt(data.usable_quantity, toNonNegativeInt(data.total_quantity, 0));
        const total = toNonNegativeInt(data.total_quantity, usable);

        await connection.execute(
          `INSERT INTO inventory_items (
            tenant_id, hall_id, name, category, unit, total_quantity, usable_quantity,
            damaged_quantity, missing_quantity, maintenance_quantity, reorder_level, storage_location, rented_default, notes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            data.hall_id || null,
            data.name.trim(),
            data.category || 'other',
            (data.unit || 'pcs').trim(),
            total,
            usable,
            toNonNegativeInt(data.damaged_quantity, 0),
            toNonNegativeInt(data.missing_quantity, 0),
            toNonNegativeInt(data.maintenance_quantity, 0),
            toNonNegativeInt(data.reorder_level, 0),
            data.storage_location || null,
            Boolean(data.rented_default),
            data.notes || null,
            data.status || 'active',
          ]
        );
        createdCount++;
      }

      await connection.commit();
      return { createdCount };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateItem(id: number, data: UpdateInventoryItemDTO): Promise<boolean> {
    const tenantId = getTenantId();
    if (data.hall_id) {
      await this.assertHallExists(data.hall_id);
    }
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || key === 'tenant_id') {
        return;
      }
      fields.push(`${key} = ?`);
      values.push(typeof value === 'string' && key !== 'notes' ? value.trim() : value);
    });

    if (fields.length === 0) {
      return false;
    }

    values.push(id, tenantId);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE inventory_items
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  async getStockAdjustments(itemId: number): Promise<InventoryStockAdjustment[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT isa.*, u.name AS adjusted_by_name
       FROM inventory_stock_adjustments isa
       LEFT JOIN users u ON u.id = isa.adjusted_by
       WHERE isa.inventory_item_id = ? AND isa.tenant_id = ?
       ORDER BY isa.adjusted_at DESC, isa.id DESC
       LIMIT 50`,
      [itemId, tenantId]
    );

    return rows.map(row => ({
      ...(row as any),
      previous_quantities: parseSnapshot(row.previous_quantities),
      new_quantities: parseSnapshot(row.new_quantities),
    })) as InventoryStockAdjustment[];
  }

  async getItemImages(itemId: number): Promise<InventoryItemImage[]> {
    const tenantId = getTenantId();
    await this.assertItemExists(itemId);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM inventory_item_images
       WHERE inventory_item_id = ? AND tenant_id = ?
       ORDER BY is_primary DESC, display_order ASC, created_at ASC`,
      [itemId, tenantId]
    );
    return rows as InventoryItemImage[];
  }

  async getImageById(imageId: number): Promise<InventoryItemImage | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM inventory_item_images WHERE id = ? AND tenant_id = ?',
      [imageId, tenantId]
    );
    return rows[0] ? (rows[0] as InventoryItemImage) : null;
  }

  async createItemImage(data: {
    itemId: number;
    imageUrl: string;
    thumbnailUrl: string;
    publicId: string;
    caption?: string | null;
    altText?: string | null;
    uploadedBy?: number | null;
  }): Promise<InventoryItemImage> {
    const tenantId = getTenantId();
    await this.assertItemExists(data.itemId);

    const [countRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM inventory_item_images WHERE tenant_id = ? AND inventory_item_id = ?',
      [tenantId, data.itemId]
    );
    const existingCount = Number(countRows[0]?.count || 0);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO inventory_item_images (
        tenant_id, inventory_item_id, image_url, thumbnail_url, public_id,
        caption, alt_text, display_order, is_primary, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        data.itemId,
        data.imageUrl,
        data.thumbnailUrl,
        data.publicId,
        data.caption || null,
        data.altText || null,
        existingCount + 1,
        existingCount === 0,
        data.uploadedBy || null,
      ]
    );

    const image = await this.getImageById(result.insertId);
    if (!image) {
      throw new Error('Failed to create inventory image');
    }
    return image;
  }

  async deleteItemImage(imageId: number): Promise<boolean> {
    const tenantId = getTenantId();
    const image = await this.getImageById(imageId);
    if (!image) return false;

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM inventory_item_images WHERE id = ? AND tenant_id = ?',
      [imageId, tenantId]
    );

    if (image.is_primary && result.affectedRows > 0) {
      await pool.execute(
        `UPDATE inventory_item_images
         SET is_primary = TRUE
         WHERE tenant_id = ? AND inventory_item_id = ?
         ORDER BY display_order ASC, created_at ASC
         LIMIT 1`,
        [tenantId, image.inventory_item_id]
      );
    }

    return result.affectedRows > 0;
  }

  async setPrimaryImage(imageId: number): Promise<boolean> {
    const tenantId = getTenantId();
    const image = await this.getImageById(imageId);
    if (!image) return false;

    await pool.execute(
      'UPDATE inventory_item_images SET is_primary = FALSE WHERE tenant_id = ? AND inventory_item_id = ?',
      [tenantId, image.inventory_item_id]
    );
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE inventory_item_images SET is_primary = TRUE WHERE id = ? AND tenant_id = ?',
      [imageId, tenantId]
    );
    return result.affectedRows > 0;
  }

  async getPhotoUsage(): Promise<InventoryPhotoUsage> {
    const tenantId = getTenantId();
    const [usageRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS used FROM inventory_item_images WHERE tenant_id = ?',
      [tenantId]
    );
    const [subscriptionRows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.plan, p.inventory_photo_limit
       FROM subscriptions s
       LEFT JOIN subscription_plans p ON p.code = s.plan
       WHERE s.tenant_id = ?
       ORDER BY s.id DESC
       LIMIT 1`,
      [tenantId]
    );

    const plan = subscriptionRows[0]?.plan || 'starter';
    const fallbackLimit = plan === 'enterprise' ? null : plan === 'professional' ? 1500 : 300;
    const limit = subscriptionRows[0]?.inventory_photo_limit === undefined || subscriptionRows[0]?.inventory_photo_limit === null
      ? fallbackLimit
      : Number(subscriptionRows[0].inventory_photo_limit);
    const used = Number(usageRows[0]?.used || 0);

    return {
      plan,
      limit,
      used,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      can_upload: limit === null || used < limit,
    };
  }

  async getKits(filters?: { hall_id?: number; status?: 'active' | 'inactive'; search?: string }): Promise<InventoryKit[]> {
    const tenantId = getTenantId();
    let sql = `
      SELECT ik.*, h.name AS hall_name, COALESCE(item_counts.item_count, 0) AS item_count
      FROM inventory_kits ik
      LEFT JOIN halls h ON h.id = ik.hall_id AND h.tenant_id = ik.tenant_id
      LEFT JOIN (
        SELECT tenant_id, kit_id, COUNT(*) AS item_count
        FROM inventory_kit_items
        GROUP BY tenant_id, kit_id
      ) item_counts ON item_counts.tenant_id = ik.tenant_id AND item_counts.kit_id = ik.id
      WHERE ik.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (filters?.hall_id) {
      sql += ' AND (ik.hall_id IS NULL OR ik.hall_id = ?)';
      params.push(filters.hall_id);
    }
    if (filters?.status) {
      sql += ' AND ik.status = ?';
      params.push(filters.status);
    }
    if (filters?.search) {
      sql += ' AND (ik.name LIKE ? OR ik.description LIKE ? OR ik.event_type LIKE ? OR h.name LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY ik.status ASC, ik.hall_id IS NOT NULL ASC, ik.name ASC';
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as InventoryKit[];
  }

  async getKitById(id: number): Promise<(InventoryKit & { items: InventoryKitItem[] }) | null> {
    const tenantId = getTenantId();
    const [kitRows] = await pool.execute<RowDataPacket[]>(
      `SELECT ik.*, h.name AS hall_name
       FROM inventory_kits ik
       LEFT JOIN halls h ON h.id = ik.hall_id AND h.tenant_id = ik.tenant_id
       WHERE ik.id = ? AND ik.tenant_id = ?`,
      [id, tenantId]
    );
    if (!kitRows[0]) return null;

    const [itemRows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM inventory_kit_items
       WHERE kit_id = ? AND tenant_id = ?
       ORDER BY category ASC, item_name ASC`,
      [id, tenantId]
    );

    return {
      ...(kitRows[0] as InventoryKit),
      items: itemRows as InventoryKitItem[],
    };
  }

  async createKit(data: CreateInventoryKitDTO): Promise<number> {
    const tenantId = getTenantId();
    if (data.hall_id) await this.assertHallExists(data.hall_id);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_kits (tenant_id, hall_id, name, description, event_type, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          data.hall_id || null,
          data.name.trim(),
          data.description || null,
          data.event_type || null,
          data.status || 'active',
        ]
      );

      await this.replaceKitItems(connection, tenantId, result.insertId, data.items || []);
      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateKit(id: number, data: UpdateInventoryKitDTO): Promise<boolean> {
    const tenantId = getTenantId();
    if (data.hall_id) await this.assertHallExists(data.hall_id);

    const existing = await this.getKitById(id);
    if (!existing) return false;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const fields: string[] = [];
      const values: any[] = [];

      (['hall_id', 'name', 'description', 'event_type', 'status'] as const).forEach(field => {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(field === 'name' && data.name ? data.name.trim() : data[field]);
        }
      });

      if (fields.length > 0) {
        values.push(id, tenantId);
        await connection.execute(
          `UPDATE inventory_kits
           SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND tenant_id = ?`,
          values
        );
      }

      if (data.items) {
        await connection.execute(
          'DELETE FROM inventory_kit_items WHERE kit_id = ? AND tenant_id = ?',
          [id, tenantId]
        );
        await this.replaceKitItems(connection, tenantId, id, data.items);
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addKitToBooking(bookingId: number, kitId: number): Promise<number[]> {
    await this.assertBookingExists(bookingId);
    const kit = await this.getKitById(kitId);
    if (!kit || kit.status !== 'active') {
      throw new Error('Inventory kit not found');
    }
    if (!Array.isArray(kit.items) || kit.items.length === 0) {
      throw new Error('This inventory kit has no items to add');
    }

    const createdIds: number[] = [];
    for (const item of kit.items) {
      const requirementId = await this.createRequirement(bookingId, {
        inventory_item_id: item.inventory_item_id,
        item_name: item.item_name,
        category: item.category,
        required_quantity: item.quantity,
        owned_reserved_quantity: item.source === 'owned' ? item.quantity : 0,
        source: item.source,
        notes: item.notes,
      });
      createdIds.push(requirementId);
    }

    if (createdIds.length === 0) {
      throw new Error('No kit items were added to this booking');
    }

    return createdIds;
  }

  async createStockAdjustment(
    itemId: number,
    data: CreateInventoryStockAdjustmentDTO,
    actorUserId?: number
  ): Promise<number> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, total_quantity, usable_quantity, damaged_quantity, missing_quantity, maintenance_quantity
         FROM inventory_items
         WHERE id = ? AND tenant_id = ?
         FOR UPDATE`,
        [itemId, tenantId]
      );

      const item = rows[0];
      if (!item) {
        throw new Error('Inventory item not found');
      }

      const quantity = toNonNegativeInt(data.quantity, 0);
      if (quantity <= 0) {
        throw new Error('Adjustment quantity must be greater than zero');
      }
      if (!data.reason?.trim()) {
        throw new Error('Adjustment reason is required');
      }

      const previous = snapshotFromRow(item);
      const next = applyAdjustment(previous, data.adjustment_type, quantity);

      await connection.execute(
        `UPDATE inventory_items
         SET total_quantity = ?,
             usable_quantity = ?,
             damaged_quantity = ?,
             missing_quantity = ?,
             maintenance_quantity = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [
          next.total_quantity,
          next.usable_quantity,
          next.damaged_quantity,
          next.missing_quantity,
          next.maintenance_quantity,
          itemId,
          tenantId,
        ]
      );

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO inventory_stock_adjustments (
          tenant_id, inventory_item_id, adjustment_type, quantity, reason,
          notes, previous_quantities, new_quantities, adjusted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          itemId,
          data.adjustment_type,
          quantity,
          data.reason.trim(),
          data.notes || null,
          JSON.stringify(previous),
          JSON.stringify(next),
          actorUserId || null,
        ]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getBookingRequirements(bookingId: number): Promise<EventInventoryRequirement[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT eir.*
       FROM event_inventory_requirements eir
       INNER JOIN bookings b ON b.id = eir.booking_id AND b.tenant_id = eir.tenant_id
       WHERE eir.booking_id = ? AND eir.tenant_id = ?
       ORDER BY eir.category ASC, eir.item_name ASC`,
      [bookingId, tenantId]
    );

    const requirements = rows as EventInventoryRequirement[];
    return Promise.all(
      requirements.map(async requirement => ({
        ...requirement,
        available_quantity: requirement.inventory_item_id
          ? await this.getAvailableQuantity(requirement.inventory_item_id, bookingId, requirement.id)
          : undefined,
      }))
    );
  }

  async getRequirementById(id: number): Promise<EventInventoryRequirement | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT *
       FROM event_inventory_requirements
       WHERE id = ? AND tenant_id = ?`,
      [id, tenantId]
    );
    return rows[0] ? (rows[0] as EventInventoryRequirement) : null;
  }

  async createRequirement(bookingId: number, data: CreateEventInventoryRequirementDTO): Promise<number> {
    const tenantId = getTenantId();
    await this.assertBookingExists(bookingId);
    const item = data.inventory_item_id ? await this.getItemById(data.inventory_item_id) : null;
    if (data.inventory_item_id && !item) {
      throw new Error('Inventory item not found');
    }

    const required = toNonNegativeInt(data.required_quantity, 0);
    const itemNameClean = (data.item_name || item?.name || '').trim();

    // Check if a requirement already exists for this booking & item
    let existing: EventInventoryRequirement | null = null;
    if (item?.id) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM event_inventory_requirements
         WHERE booking_id = ? AND tenant_id = ? AND inventory_item_id = ?
         LIMIT 1`,
        [bookingId, tenantId, item.id]
      );
      if (rows[0]) existing = rows[0] as EventInventoryRequirement;
    }

    if (!existing && itemNameClean) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM event_inventory_requirements
         WHERE booking_id = ? AND tenant_id = ? AND LOWER(TRIM(item_name)) = LOWER(TRIM(?))
         LIMIT 1`,
        [bookingId, tenantId, itemNameClean]
      );
      if (rows[0]) existing = rows[0] as EventInventoryRequirement;
    }

    if (existing) {
      // Merge into existing requirement
      const combinedRequired = existing.required_quantity + required;
      const available = item ? Math.max(await this.getAvailableQuantity(item.id, bookingId, existing.id), 0) : 0;
      const combinedReserved = item ? Math.min(combinedRequired, available) : 0;
      const combinedRental = Math.max(combinedRequired - combinedReserved, 0);

      await this.updateRequirement(existing.id, {
        required_quantity: combinedRequired,
        owned_reserved_quantity: combinedReserved,
        rental_needed_quantity: combinedRental,
        responsible_name: data.responsible_name || existing.responsible_name,
        notes: data.notes || existing.notes,
      });

      return existing.id;
    }

    const requestedReserved = data.owned_reserved_quantity === undefined
      ? required
      : toNonNegativeInt(data.owned_reserved_quantity, 0);
    const available = item ? Math.max(await this.getAvailableQuantity(item.id, bookingId), 0) : 0;
    const reserved = item ? Math.min(requestedReserved, required, available) : 0;
    const rentalNeeded = data.rental_needed_quantity === undefined
      ? Math.max(required - reserved, 0)
      : Math.max(toNonNegativeInt(data.rental_needed_quantity, 0), Math.max(required - reserved, 0));

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO event_inventory_requirements (
        tenant_id, booking_id, inventory_item_id, item_name, category, required_quantity,
        owned_reserved_quantity, rental_needed_quantity, source, status, responsible_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        bookingId,
        item?.id || data.inventory_item_id || null,
        itemNameClean,
        data.category || item?.category || 'other',
        required,
        reserved,
        rentalNeeded,
        data.source || (item ? 'owned' : 'unknown'),
        data.status || deriveStatus(required, reserved, rentalNeeded, 0, 0, 0, 0),
        data.responsible_name || null,
        data.notes || null,
      ]
    );

    return result.insertId;
  }

  async updateRequirement(id: number, data: UpdateEventInventoryRequirementDTO): Promise<boolean> {
    const tenantId = getTenantId();
    const existing = await this.getRequirementById(id);
    if (!existing) {
      return false;
    }

    const item = data.inventory_item_id ? await this.getItemById(data.inventory_item_id) : null;
    if (data.inventory_item_id && !item) {
      throw new Error('Inventory item not found');
    }

    const nextRequired = data.required_quantity === undefined
      ? existing.required_quantity
      : toNonNegativeInt(data.required_quantity, 0);
    const requestedReserved = data.owned_reserved_quantity === undefined
      ? existing.owned_reserved_quantity
      : toNonNegativeInt(data.owned_reserved_quantity, 0);
    const available = existing.inventory_item_id
      ? Math.max(await this.getAvailableQuantity(existing.inventory_item_id, existing.booking_id, existing.id), 0)
      : 0;
    const nextReserved = existing.inventory_item_id
      ? Math.min(requestedReserved, nextRequired, available)
      : 0;
    const nextRentalNeeded = data.rental_needed_quantity === undefined
      ? Math.max(nextRequired - nextReserved, 0)
      : toNonNegativeInt(data.rental_needed_quantity, 0);

    const updates = {
      ...data,
      inventory_item_id: data.inventory_item_id === undefined ? existing.inventory_item_id : data.inventory_item_id,
      item_name: (data.item_name || item?.name || existing.item_name).trim(),
      category: data.category || item?.category || existing.category,
      required_quantity: nextRequired,
      owned_reserved_quantity: nextReserved,
      rental_needed_quantity: nextRentalNeeded,
      status: data.status || deriveStatus(
        nextRequired,
        nextReserved,
        nextRentalNeeded,
        existing.dispatched_quantity,
        existing.returned_quantity,
        existing.damaged_quantity,
        existing.missing_quantity
      ),
    };

    const fields: string[] = [];
    const values: any[] = [];
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'tenant_id' && key !== 'booking_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    values.push(id, tenantId);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE event_inventory_requirements
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  async deleteRequirement(id: number): Promise<boolean> {
    const tenantId = getTenantId();
    const existing = await this.getRequirementById(id);
    if (!existing) {
      return false;
    }

    if (
      existing.dispatched_quantity > 0 ||
      existing.returned_quantity > 0 ||
      existing.damaged_quantity > 0 ||
      existing.missing_quantity > 0
    ) {
      throw new Error('Cannot remove inventory after dispatch or return audit has started');
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM event_inventory_requirements WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    return result.affectedRows > 0;
  }

  async reserveRequirement(id: number): Promise<boolean> {
    const requirement = await this.getRequirementById(id);
    if (!requirement) {
      return false;
    }

    if (!requirement.inventory_item_id) {
      throw new Error('Only linked inventory items can be reserved');
    }

    const available = await this.getAvailableQuantity(requirement.inventory_item_id, requirement.booking_id, id);
    const reserved = Math.min(requirement.required_quantity, Math.max(available, 0));
    const rentalNeeded = Math.max(requirement.required_quantity - reserved, 0);

    return this.updateRequirement(id, {
      owned_reserved_quantity: reserved,
      rental_needed_quantity: rentalNeeded,
      status: deriveStatus(requirement.required_quantity, reserved, rentalNeeded, 0, 0, 0, 0),
    });
  }

  async dispatchRequirement(id: number, quantity?: number): Promise<boolean> {
    const requirement = await this.getRequirementById(id);
    if (!requirement) {
      return false;
    }
    const dispatched = toNonNegativeInt(quantity, requirement.owned_reserved_quantity || requirement.required_quantity);
    return this.updateRequirement(id, {
      status: 'dispatched',
      owned_reserved_quantity: Math.max(requirement.owned_reserved_quantity, dispatched),
      dispatched_quantity: dispatched,
    } as UpdateEventInventoryRequirementDTO & { dispatched_quantity: number });
  }

  async returnRequirement(
    id: number,
    data: { returned_quantity?: number; damaged_quantity?: number; missing_quantity?: number },
    actorUserId?: number
  ): Promise<boolean> {
    const requirement = await this.getRequirementById(id);
    if (!requirement) {
      return false;
    }

    const returned = toNonNegativeInt(data.returned_quantity, requirement.dispatched_quantity);
    const damaged = toNonNegativeInt(data.damaged_quantity, 0);
    const missing = toNonNegativeInt(data.missing_quantity, 0);
    const damagedDelta = damaged - Number(requirement.damaged_quantity || 0);
    const missingDelta = missing - Number(requirement.missing_quantity || 0);
    const status = deriveStatus(
      requirement.required_quantity,
      requirement.owned_reserved_quantity,
      requirement.rental_needed_quantity,
      requirement.dispatched_quantity,
      returned,
      damaged,
      missing
    );

    if (requirement.inventory_item_id) {
      const auditReason = `Booking #${requirement.booking_id} return audit for ${requirement.item_name}`;

      if (damagedDelta > 0) {
        await this.createStockAdjustment(requirement.inventory_item_id, {
          adjustment_type: 'mark_damaged',
          quantity: damagedDelta,
          reason: auditReason,
          notes: 'Auto-recorded from event return audit.',
        }, actorUserId);
      } else if (damagedDelta < 0) {
        await this.createStockAdjustment(requirement.inventory_item_id, {
          adjustment_type: 'restore_damaged',
          quantity: Math.abs(damagedDelta),
          reason: `${auditReason} correction`,
          notes: 'Auto-corrected after return audit quantity was reduced.',
        }, actorUserId);
      }

      if (missingDelta > 0) {
        await this.createStockAdjustment(requirement.inventory_item_id, {
          adjustment_type: 'mark_missing',
          quantity: missingDelta,
          reason: auditReason,
          notes: 'Auto-recorded from event return audit.',
        }, actorUserId);
      } else if (missingDelta < 0) {
        await this.createStockAdjustment(requirement.inventory_item_id, {
          adjustment_type: 'restore_missing',
          quantity: Math.abs(missingDelta),
          reason: `${auditReason} correction`,
          notes: 'Auto-corrected after return audit quantity was reduced.',
        }, actorUserId);
      }
    }

    return this.updateRequirement(id, {
      status,
      returned_quantity: returned,
      damaged_quantity: damaged,
      missing_quantity: missing,
    } as UpdateEventInventoryRequirementDTO & {
      returned_quantity: number;
      damaged_quantity: number;
      missing_quantity: number;
    });
  }

  async getReadinessSummary(bookingId: number): Promise<InventoryReadinessSummary> {
    const requirements = await this.getBookingRequirements(bookingId);
    const hasRentalNeed = (item: EventInventoryRequirement) => Number(item.rental_needed_quantity || 0) > 0;
    const hasShortage = (item: EventInventoryRequirement) =>
      Number(item.rental_needed_quantity || 0) > 0 ||
      Number(item.owned_reserved_quantity || 0) < Number(item.required_quantity || 0);
    const summary: InventoryReadinessSummary = {
      total_items: requirements.length,
      ready_items: requirements.filter(item => item.status === 'ready').length,
      short_items: requirements.filter(hasShortage).length,
      rental_needed_items: requirements.filter(hasRentalNeed).length,
      dispatched_items: requirements.filter(item => item.status === 'dispatched').length,
      returned_items: requirements.filter(item => item.status === 'returned' || item.status === 'damaged_or_missing').length,
      damaged_or_missing_items: requirements.filter(item =>
        item.status === 'damaged_or_missing' ||
        Number(item.damaged_quantity || 0) > 0 ||
        Number(item.missing_quantity || 0) > 0
      ).length,
      readiness_status: 'not_started',
    };

    if (summary.total_items === 0) {
      return summary;
    }
    if (summary.damaged_or_missing_items > 0) {
      summary.readiness_status = 'closed_with_issues';
    } else if (summary.returned_items === summary.total_items) {
      summary.readiness_status = 'closed';
    } else if (summary.short_items > 0 || summary.rental_needed_items > 0) {
      summary.readiness_status = 'short';
    } else if (summary.dispatched_items > 0) {
      summary.readiness_status = 'dispatched';
    } else if (summary.ready_items === summary.total_items) {
      summary.readiness_status = 'ready';
    } else {
      summary.readiness_status = 'needs_review';
    }

    return summary;
  }

  async getKitAvailabilityPreview(
    kitId: number,
    eventDate: string,
    slotType: InventoryAvailabilitySlot
  ): Promise<InventoryKitAvailabilityPreview | null> {
    const tenantId = getTenantId();
    const kit = await this.getKitById(kitId);
    if (!kit) return null;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         iki.id AS kit_item_id,
         iki.inventory_item_id,
         COALESCE(ii.name, iki.item_name) AS item_name,
         iki.category,
         iki.source,
         iki.quantity AS required_quantity,
         COALESCE(ii.unit, 'pcs') AS unit,
         ii.hall_id,
         h.name AS hall_name,
         COALESCE(ii.usable_quantity, 0) AS usable_quantity,
         COALESCE(reserved.overlapping_reserved_quantity, 0) AS overlapping_reserved_quantity,
         COALESCE(ii.usable_quantity, 0) - COALESCE(reserved.overlapping_reserved_quantity, 0) AS available_quantity,
         iki.notes
       FROM inventory_kit_items iki
       LEFT JOIN inventory_items ii
         ON ii.id = iki.inventory_item_id
        AND ii.tenant_id = iki.tenant_id
       LEFT JOIN halls h
         ON h.id = ii.hall_id
        AND h.tenant_id = ii.tenant_id
       LEFT JOIN (
         SELECT
           eir.inventory_item_id,
           SUM(eir.owned_reserved_quantity) AS overlapping_reserved_quantity
         FROM event_inventory_requirements eir
         INNER JOIN bookings b
           ON b.id = eir.booking_id
          AND b.tenant_id = eir.tenant_id
         WHERE eir.tenant_id = ?
           AND eir.inventory_item_id IS NOT NULL
           AND b.event_date = ?
           AND b.status <> 'cancelled'
           AND (
             b.time_slot = ?
             OR b.time_slot = 'full_day'
             OR ? = 'full_day'
           )
         GROUP BY eir.inventory_item_id
       ) reserved
         ON reserved.inventory_item_id = iki.inventory_item_id
       WHERE iki.tenant_id = ?
         AND iki.kit_id = ?
       ORDER BY iki.id ASC`,
      [tenantId, eventDate, slotType, slotType, tenantId, kitId]
    );

    const lines = rows.map((row) => {
      const requiredQuantity = Number(row.required_quantity || 0);
      const isExternal = !row.inventory_item_id || row.source !== 'owned';
      const availableQuantity = Math.max(Number(row.available_quantity || 0), 0);
      const shortageQuantity = isExternal ? 0 : Math.max(requiredQuantity - availableQuantity, 0);

      const status: 'ready' | 'short' | 'external' = isExternal
        ? 'external'
        : shortageQuantity > 0
        ? 'short'
        : 'ready';

      return {
        kit_item_id: Number(row.kit_item_id),
        inventory_item_id: row.inventory_item_id ? Number(row.inventory_item_id) : null,
        item_name: row.item_name,
        category: row.category,
        source: row.source,
        required_quantity: requiredQuantity,
        unit: row.unit || 'pcs',
        hall_id: row.hall_id ? Number(row.hall_id) : null,
        hall_name: row.hall_name || null,
        usable_quantity: Number(row.usable_quantity || 0),
        overlapping_reserved_quantity: Number(row.overlapping_reserved_quantity || 0),
        available_quantity: availableQuantity,
        shortage_quantity: shortageQuantity,
        status,
        notes: row.notes || null,
      };
    });

    return {
      kit_id: kit.id,
      kit_name: kit.name,
      event_date: eventDate,
      slot_type: slotType,
      summary: {
        total_lines: lines.length,
        ready_lines: lines.filter((line) => line.status === 'ready').length,
        short_lines: lines.filter((line) => line.status === 'short').length,
        external_lines: lines.filter((line) => line.status === 'external').length,
      },
      lines,
    };
  }

  async getAvailableQuantity(itemId: number, bookingId: number, excludeRequirementId?: number): Promise<number> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(ii.usable_quantity, 0) - COALESCE(SUM(eir.owned_reserved_quantity), 0) AS available_quantity
       FROM bookings target
       INNER JOIN inventory_items ii ON ii.id = ? AND ii.tenant_id = target.tenant_id
       LEFT JOIN bookings b
         ON b.tenant_id = target.tenant_id
        AND b.event_date = target.event_date
        AND b.status <> 'cancelled'
        AND b.id <> target.id
        AND ${OVERLAPPING_SLOT_SQL}
       LEFT JOIN event_inventory_requirements eir
         ON eir.booking_id = b.id
        AND eir.tenant_id = b.tenant_id
        AND eir.inventory_item_id = ii.id
        AND (? IS NULL OR eir.id <> ?)
       WHERE target.id = ? AND target.tenant_id = ?
       GROUP BY ii.usable_quantity`,
      [itemId, excludeRequirementId || null, excludeRequirementId || null, bookingId, tenantId]
    );

    return Number(rows[0]?.available_quantity || 0);
  }

  private async assertBookingExists(bookingId: number): Promise<void> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM bookings WHERE id = ? AND tenant_id = ? LIMIT 1',
      [bookingId, tenantId]
    );
    if (!rows[0]) {
      throw new Error('Booking not found');
    }
  }

  private async assertItemExists(itemId: number): Promise<void> {
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }
  }

  private async replaceKitItems(
    connection: any,
    tenantId: number,
    kitId: number,
    items: CreateInventoryKitItemDTO[]
  ): Promise<void> {
    for (const item of items) {
      const linkedItem = item.inventory_item_id ? await this.getItemById(item.inventory_item_id) : null;
      if (item.inventory_item_id && !linkedItem) {
        throw new Error('Inventory item not found');
      }

      const quantity = toNonNegativeInt(item.quantity, 0);
      if (quantity <= 0) {
        throw new Error('Kit item quantity must be greater than zero');
      }

      const itemName = (item.item_name || linkedItem?.name || '').trim();
      if (!itemName) {
        throw new Error('Kit item name is required');
      }

      await connection.execute(
        `INSERT INTO inventory_kit_items (
          tenant_id, kit_id, inventory_item_id, item_name, category, quantity, source, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          kitId,
          linkedItem?.id || item.inventory_item_id || null,
          itemName,
          item.category || linkedItem?.category || 'other',
          quantity,
          item.source || (linkedItem ? 'owned' : 'unknown'),
          item.notes || null,
        ]
      );
    }
  }

  private async assertHallExists(hallId: number): Promise<void> {
    const tenantId = getTenantId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM halls WHERE id = ? AND tenant_id = ? LIMIT 1',
      [hallId, tenantId]
    );
    if (!rows[0]) {
      throw new Error('Hall not found');
    }
  }
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Quantities must be non-negative numbers');
  }
  return parsed;
}

function deriveStatus(
  required: number,
  reserved: number,
  rentalNeeded: number,
  dispatched: number,
  returned: number,
  damaged: number,
  missing: number
): EventInventoryStatus {
  if (required === 0) {
    return 'not_needed';
  }
  if (damaged > 0 || missing > 0) {
    return 'damaged_or_missing';
  }
  if (returned > 0 && returned < dispatched) {
    return 'partially_returned';
  }
  if (dispatched > 0 && returned >= dispatched) {
    return 'returned';
  }
  if (dispatched > 0) {
    return 'dispatched';
  }
  if (rentalNeeded > 0 && reserved > 0) {
    return 'rental_needed';
  }
  if (rentalNeeded > 0) {
    return 'short';
  }
  if (reserved >= required) {
    return 'ready';
  }
  return 'needs_review';
}

function snapshotFromRow(row: RowDataPacket): InventoryQuantitySnapshot {
  return {
    total_quantity: Number(row.total_quantity || 0),
    usable_quantity: Number(row.usable_quantity || 0),
    damaged_quantity: Number(row.damaged_quantity || 0),
    missing_quantity: Number(row.missing_quantity || 0),
    maintenance_quantity: Number(row.maintenance_quantity || 0),
  };
}

function parseSnapshot(value: unknown): InventoryQuantitySnapshot {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value as InventoryQuantitySnapshot;
}

function applyAdjustment(
  previous: InventoryQuantitySnapshot,
  adjustmentType: CreateInventoryStockAdjustmentDTO['adjustment_type'],
  quantity: number
): InventoryQuantitySnapshot {
  const next = { ...previous };

  switch (adjustmentType) {
    case 'stock_in':
      next.total_quantity += quantity;
      next.usable_quantity += quantity;
      break;
    case 'stock_out':
      ensureEnough(previous.usable_quantity, quantity, 'usable stock');
      ensureEnough(previous.total_quantity, quantity, 'total stock');
      next.total_quantity -= quantity;
      next.usable_quantity -= quantity;
      break;
    case 'mark_damaged':
      ensureEnough(previous.usable_quantity, quantity, 'usable stock');
      next.usable_quantity -= quantity;
      next.damaged_quantity += quantity;
      break;
    case 'mark_missing':
      ensureEnough(previous.usable_quantity, quantity, 'usable stock');
      next.usable_quantity -= quantity;
      next.missing_quantity += quantity;
      break;
    case 'send_to_maintenance':
      ensureEnough(previous.usable_quantity, quantity, 'usable stock');
      next.usable_quantity -= quantity;
      next.maintenance_quantity += quantity;
      break;
    case 'restore_damaged':
      ensureEnough(previous.damaged_quantity, quantity, 'damaged stock');
      next.damaged_quantity -= quantity;
      next.usable_quantity += quantity;
      break;
    case 'restore_missing':
      ensureEnough(previous.missing_quantity, quantity, 'missing stock');
      next.missing_quantity -= quantity;
      next.usable_quantity += quantity;
      break;
    case 'restore_maintenance':
      ensureEnough(previous.maintenance_quantity, quantity, 'maintenance stock');
      next.maintenance_quantity -= quantity;
      next.usable_quantity += quantity;
      break;
    case 'retire_stock':
      ensureEnough(previous.usable_quantity, quantity, 'usable stock');
      ensureEnough(previous.total_quantity, quantity, 'total stock');
      next.usable_quantity -= quantity;
      next.total_quantity -= quantity;
      break;
    default:
      throw new Error('Invalid stock adjustment type');
  }

  return next;
}

function ensureEnough(available: number, quantity: number, label: string): void {
  if (available < quantity) {
    throw new Error(`Not enough ${label} for this adjustment`);
  }
}

export default new InventoryRepository();
