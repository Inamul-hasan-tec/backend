export type InventoryCategory =
  | 'furniture'
  | 'linen'
  | 'dining'
  | 'kitchen_service'
  | 'decor'
  | 'sound_lighting'
  | 'utility'
  | 'other';

export type InventoryItemStatus = 'active' | 'inactive';

export type EventInventorySource = 'owned' | 'rental' | 'vendor' | 'unknown';

export type EventInventoryStatus =
  | 'needs_review'
  | 'ready'
  | 'short'
  | 'rental_needed'
  | 'dispatched'
  | 'partially_returned'
  | 'returned'
  | 'damaged_or_missing'
  | 'not_needed';

export interface InventoryItem {
  id: number;
  tenant_id?: number;
  hall_id: number | null;
  hall_name?: string | null;
  name: string;
  category: InventoryCategory;
  unit: string;
  total_quantity: number;
  usable_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  maintenance_quantity: number;
  reorder_level: number;
  storage_location: string | null;
  rented_default: boolean;
  notes: string | null;
  status: InventoryItemStatus;
  primary_image_url?: string | null;
  image_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemDTO {
  hall_id?: number | null;
  name: string;
  category?: InventoryCategory;
  unit?: string;
  total_quantity?: number;
  usable_quantity?: number;
  damaged_quantity?: number;
  missing_quantity?: number;
  maintenance_quantity?: number;
  reorder_level?: number;
  storage_location?: string | null;
  rented_default?: boolean;
  notes?: string | null;
  status?: InventoryItemStatus;
}

export interface UpdateInventoryItemDTO {
  hall_id?: number | null;
  name?: string;
  category?: InventoryCategory;
  unit?: string;
  total_quantity?: number;
  usable_quantity?: number;
  damaged_quantity?: number;
  missing_quantity?: number;
  maintenance_quantity?: number;
  reorder_level?: number;
  storage_location?: string | null;
  rented_default?: boolean;
  notes?: string | null;
  status?: InventoryItemStatus;
}

export interface InventoryItemFilters {
  category?: InventoryCategory;
  status?: InventoryItemStatus;
  hall_id?: number | null;
  include_global?: boolean;
  search?: string;
}

export interface EventInventoryRequirement {
  id: number;
  tenant_id?: number;
  booking_id: number;
  inventory_item_id: number | null;
  item_name: string;
  category: InventoryCategory;
  required_quantity: number;
  owned_reserved_quantity: number;
  rental_needed_quantity: number;
  dispatched_quantity: number;
  returned_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  source: EventInventorySource;
  status: EventInventoryStatus;
  responsible_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  available_quantity?: number;
}

export interface CreateEventInventoryRequirementDTO {
  inventory_item_id?: number | null;
  item_name?: string;
  category?: InventoryCategory;
  required_quantity: number;
  owned_reserved_quantity?: number;
  rental_needed_quantity?: number;
  source?: EventInventorySource;
  status?: EventInventoryStatus;
  responsible_name?: string | null;
  notes?: string | null;
}

export interface UpdateEventInventoryRequirementDTO {
  inventory_item_id?: number | null;
  item_name?: string;
  category?: InventoryCategory;
  required_quantity?: number;
  owned_reserved_quantity?: number;
  rental_needed_quantity?: number;
  source?: EventInventorySource;
  status?: EventInventoryStatus;
  responsible_name?: string | null;
  notes?: string | null;
}

export interface InventoryReadinessSummary {
  total_items: number;
  ready_items: number;
  short_items: number;
  rental_needed_items: number;
  dispatched_items: number;
  returned_items: number;
  damaged_or_missing_items: number;
  readiness_status: 'not_started' | 'needs_review' | 'short' | 'ready' | 'dispatched' | 'closed_with_issues' | 'closed';
}

export type InventoryAdjustmentType =
  | 'stock_in'
  | 'stock_out'
  | 'mark_damaged'
  | 'mark_missing'
  | 'send_to_maintenance'
  | 'restore_damaged'
  | 'restore_missing'
  | 'restore_maintenance'
  | 'retire_stock';

export interface InventoryQuantitySnapshot {
  total_quantity: number;
  usable_quantity: number;
  damaged_quantity: number;
  missing_quantity: number;
  maintenance_quantity: number;
}

export interface InventoryStockAdjustment {
  id: number;
  tenant_id?: number;
  inventory_item_id: number;
  adjustment_type: InventoryAdjustmentType;
  quantity: number;
  reason: string;
  notes: string | null;
  previous_quantities: InventoryQuantitySnapshot;
  new_quantities: InventoryQuantitySnapshot;
  adjusted_by: number | null;
  adjusted_by_name?: string | null;
  adjusted_at: string;
}

export interface CreateInventoryStockAdjustmentDTO {
  adjustment_type: InventoryAdjustmentType;
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface InventoryItemImage {
  id: number;
  tenant_id?: number;
  inventory_item_id: number;
  image_url: string;
  thumbnail_url: string | null;
  public_id: string | null;
  caption: string | null;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryPhotoUsage {
  plan: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  can_upload: boolean;
}

export interface InventoryKit {
  id: number;
  tenant_id?: number;
  hall_id: number | null;
  hall_name?: string | null;
  name: string;
  description: string | null;
  event_type: string | null;
  status: 'active' | 'inactive';
  item_count?: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryKitItem {
  id: number;
  tenant_id?: number;
  kit_id: number;
  inventory_item_id: number | null;
  item_name: string;
  category: InventoryCategory;
  quantity: number;
  source: EventInventorySource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryKitDTO {
  hall_id?: number | null;
  name: string;
  description?: string | null;
  event_type?: string | null;
  status?: 'active' | 'inactive';
  items?: CreateInventoryKitItemDTO[];
}

export interface UpdateInventoryKitDTO {
  hall_id?: number | null;
  name?: string;
  description?: string | null;
  event_type?: string | null;
  status?: 'active' | 'inactive';
  items?: CreateInventoryKitItemDTO[];
}

export interface CreateInventoryKitItemDTO {
  inventory_item_id?: number | null;
  item_name?: string;
  category?: InventoryCategory;
  quantity: number;
  source?: EventInventorySource;
  notes?: string | null;
}

export type InventoryAvailabilitySlot = 'morning' | 'afternoon' | 'night' | 'full_day';

export interface InventoryKitAvailabilityLine {
  kit_item_id: number;
  inventory_item_id: number | null;
  item_name: string;
  category: InventoryCategory;
  source: EventInventorySource;
  required_quantity: number;
  unit: string;
  hall_id: number | null;
  hall_name: string | null;
  usable_quantity: number;
  overlapping_reserved_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  status: 'ready' | 'short' | 'external';
  notes: string | null;
}

export interface InventoryKitAvailabilityPreview {
  kit_id: number;
  kit_name: string;
  event_date: string;
  slot_type: InventoryAvailabilitySlot;
  summary: {
    total_lines: number;
    ready_lines: number;
    short_lines: number;
    external_lines: number;
  };
  lines: InventoryKitAvailabilityLine[];
}
