import express from 'express';
import multer from 'multer';
import GalleryController from '../controllers/GalleryController';
import { requirePermission } from '../middleware/permissionMiddleware';
import { Permission } from '../types/permissions';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Gallery routes (mounted at /halls, so final URLs are /api/halls/:hallId/gallery)
// GET /:hallId/gallery - Get all images for a hall
router.get(
  '/:hallId/gallery',
  requirePermission(Permission.HALL_VIEW),
  GalleryController.getHallGallery
);

// GET /:hallId/gallery/featured - Get featured images
router.get(
  '/:hallId/gallery/featured',
  requirePermission(Permission.HALL_VIEW),
  GalleryController.getFeaturedImages
);

// GET /:hallId/gallery/stats - Get gallery statistics
router.get(
  '/:hallId/gallery/stats',
  requirePermission(Permission.HALL_VIEW),
  GalleryController.getGalleryStats
);

// POST /:hallId/gallery - Upload images
router.post(
  '/:hallId/gallery',
  requirePermission(Permission.HALL_UPDATE),
  upload.array('images', 10), // Allow up to 10 images at once
  GalleryController.uploadImages
);

// GET /gallery/:id - Get single image details
router.get(
  '/gallery/:id',
  requirePermission(Permission.HALL_VIEW),
  GalleryController.getImageById
);

// PUT /gallery/:id - Update image metadata
router.put(
  '/gallery/:id',
  requirePermission(Permission.HALL_UPDATE),
  GalleryController.updateImage
);

// DELETE /gallery/:id - Delete image
router.delete(
  '/gallery/:id',
  requirePermission(Permission.HALL_DELETE),
  GalleryController.deleteImage
);

// PUT /gallery/reorder - Reorder images
router.put(
  '/gallery/reorder',
  requirePermission(Permission.HALL_UPDATE),
  GalleryController.reorderImages
);

// PUT /gallery/:id/featured - Set featured image
router.put(
  '/gallery/:id/featured',
  requirePermission(Permission.HALL_UPDATE),
  GalleryController.setFeaturedImage
);

// POST /gallery/bulk-delete - Bulk delete images
router.post(
  '/gallery/bulk-delete',
  requirePermission(Permission.HALL_DELETE),
  GalleryController.bulkDeleteImages
);

export default router;
