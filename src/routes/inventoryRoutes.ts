import { NextFunction, Response, Router } from 'express';
import multer from 'multer';
import InventoryController from '../controllers/InventoryController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { TenantRequest } from '../middleware/tenantMiddleware';
import { Permission } from '../types/permissions';
import { runWithTenantContext } from '../utils/tenantContext';

const router = Router();

const bindTenantContext = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.tenantId) {
    return res.status(403).json({
      success: false,
      error: 'Tenant context is required for inventory operations.',
    });
  }

  return runWithTenantContext(
    {
      tenantId: req.tenantId,
      userId: req.user.id,
      role: req.user.role,
    },
    next
  );
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only JPG, PNG, and WebP images are allowed'));
  },
});

router.get(
  '/photo-usage',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getPhotoUsage.bind(InventoryController)
);

router.get(
  '/kits',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getKits.bind(InventoryController)
);

router.post(
  '/kits',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.createKit.bind(InventoryController)
);

router.get(
  '/kits/:id',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getKitById.bind(InventoryController)
);

router.get(
  '/kits/:id/availability',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getKitAvailabilityPreview.bind(InventoryController)
);

router.put(
  '/kits/:id',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.updateKit.bind(InventoryController)
);

router.post(
  '/bookings/:bookingId/kits/:kitId',
  requirePermission(Permission.EVENT_INVENTORY_MANAGE),
  InventoryController.addKitToBooking.bind(InventoryController)
);

router.get(
  '/items',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getItems.bind(InventoryController)
);

router.post(
  '/items/bulk',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.bulkCreateItems.bind(InventoryController)
);

router.post(
  '/items',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.createItem.bind(InventoryController)
);

router.put(
  '/items/:id',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.updateItem.bind(InventoryController)
);

router.get(
  '/items/:id/images',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getItemImages.bind(InventoryController)
);

router.post(
  '/items/:id/images',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  upload.single('image'),
  bindTenantContext,
  InventoryController.uploadItemImage.bind(InventoryController)
);

router.delete(
  '/images/:imageId',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.deleteItemImage.bind(InventoryController)
);

router.put(
  '/images/:imageId/primary',
  requirePermission(Permission.INVENTORY_ITEM_MANAGE),
  InventoryController.setPrimaryItemImage.bind(InventoryController)
);

router.get(
  '/items/:id/adjustments',
  requirePermission(Permission.INVENTORY_ITEM_VIEW),
  InventoryController.getStockAdjustments.bind(InventoryController)
);

router.post(
  '/items/:id/adjustments',
  requirePermission(Permission.INVENTORY_STOCK_ADJUST),
  InventoryController.createStockAdjustment.bind(InventoryController)
);

router.get(
  '/bookings/:bookingId/requirements',
  requirePermission(Permission.EVENT_INVENTORY_VIEW),
  InventoryController.getBookingRequirements.bind(InventoryController)
);

router.post(
  '/bookings/:bookingId/requirements',
  requirePermission(Permission.EVENT_INVENTORY_MANAGE),
  InventoryController.createRequirement.bind(InventoryController)
);

router.put(
  '/requirements/:id',
  requirePermission(Permission.EVENT_INVENTORY_MANAGE),
  InventoryController.updateRequirement.bind(InventoryController)
);

router.delete(
  '/requirements/:id',
  requirePermission(Permission.EVENT_INVENTORY_MANAGE),
  InventoryController.deleteRequirement.bind(InventoryController)
);

router.post(
  '/requirements/:id/reserve',
  requirePermission(Permission.EVENT_INVENTORY_RESERVE),
  InventoryController.reserveRequirement.bind(InventoryController)
);

router.post(
  '/requirements/:id/dispatch',
  requirePermission(Permission.EVENT_INVENTORY_DISPATCH),
  InventoryController.dispatchRequirement.bind(InventoryController)
);

router.post(
  '/requirements/:id/return',
  requirePermission(Permission.EVENT_INVENTORY_RETURN),
  InventoryController.returnRequirement.bind(InventoryController)
);

export default router;
