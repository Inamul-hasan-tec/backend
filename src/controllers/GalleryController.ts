import { Request, Response } from 'express';
import GalleryService from '../services/GalleryService';

class GalleryController {
  // Get all images for a hall
  async getHallGallery(req: Request, res: Response) {
    try {
      const hallId = parseInt(req.params.hallId);
      const category = req.query.category as string | undefined;

      const images = await GalleryService.getHallGallery(hallId, category);

      res.json({
        success: true,
        data: images,
      });
    } catch (error: any) {
      console.error('Get hall gallery error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch gallery',
      });
    }
  }

  // Get featured images
  async getFeaturedImages(req: Request, res: Response) {
    try {
      const hallId = parseInt(req.params.hallId);

      const images = await GalleryService.getFeaturedImages(hallId);

      res.json({
        success: true,
        data: images,
      });
    } catch (error: any) {
      console.error('Get featured images error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch featured images',
      });
    }
  }

  // Upload images
  async uploadImages(req: Request, res: Response) {
    try {
      const hallId = parseInt(req.params.hallId);
      const userId = req.user!.id;

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'No images provided',
        });
      }

      // Handle multer file array properly
      let files: Express.Multer.File[] = [];
      
      if (req.files) {
        if (Array.isArray(req.files)) {
          files = req.files;
        } else if ('images' in req.files && Array.isArray(req.files.images)) {
          files = req.files.images;
        }
      }

      const { category, caption, alt_text, is_featured } = req.body;

      let uploadedImages;

      if (files.length === 1) {
        // Single image upload with metadata
        uploadedImages = [await GalleryService.uploadImage(
          files[0],
          hallId,
          userId,
          {
            category,
            caption,
            alt_text,
            is_featured: is_featured === 'true' || is_featured === true,
          }
        )];
      } else {
        // Multiple images upload
        uploadedImages = await GalleryService.uploadMultipleImages(
          files,
          hallId,
          userId,
          category
        );
      }

      res.status(201).json({
        success: true,
        message: `${uploadedImages.length} image(s) uploaded successfully`,
        data: uploadedImages,
      });
    } catch (error: any) {
      console.error('Upload images error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload images',
      });
    }
  }

  // Update image metadata
  async updateImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.id);
      const { category, caption, alt_text, display_order, is_featured } = req.body;

      const updatedImage = await GalleryService.updateImage(imageId, {
        category,
        caption,
        alt_text,
        display_order,
        is_featured,
      });

      res.json({
        success: true,
        message: 'Image updated successfully',
        data: updatedImage,
      });
    } catch (error: any) {
      console.error('Update image error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update image',
      });
    }
  }

  // Delete image
  async deleteImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.id);

      await GalleryService.deleteImage(imageId);

      res.json({
        success: true,
        message: 'Image deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete image error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete image',
      });
    }
  }

  // Reorder images
  async reorderImages(req: Request, res: Response) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid updates array',
        });
      }

      await GalleryService.reorderImages(updates);

      res.json({
        success: true,
        message: 'Images reordered successfully',
      });
    } catch (error: any) {
      console.error('Reorder images error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reorder images',
      });
    }
  }

  // Set featured image
  async setFeaturedImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.id);
      const { hall_id } = req.body;

      if (!hall_id) {
        return res.status(400).json({
          success: false,
          error: 'hall_id is required',
        });
      }

      await GalleryService.setFeaturedImage(imageId, hall_id);

      res.json({
        success: true,
        message: 'Featured image set successfully',
      });
    } catch (error: any) {
      console.error('Set featured image error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to set featured image',
      });
    }
  }

  // Get gallery statistics
  async getGalleryStats(req: Request, res: Response) {
    try {
      const hallId = parseInt(req.params.hallId);

      const stats = await GalleryService.getGalleryStats(hallId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Get gallery stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch gallery statistics',
      });
    }
  }

  // Bulk delete images
  async bulkDeleteImages(req: Request, res: Response) {
    try {
      const { image_ids } = req.body;

      if (!Array.isArray(image_ids) || image_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image_ids array',
        });
      }

      await GalleryService.bulkDeleteImages(image_ids);

      res.json({
        success: true,
        message: `${image_ids.length} image(s) deleted successfully`,
      });
    } catch (error: any) {
      console.error('Bulk delete images error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete images',
      });
    }
  }

  // Get single image by ID
  async getImageById(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.id);

      const image = await GalleryService.getImageById(imageId);

      if (!image) {
        return res.status(404).json({
          success: false,
          error: 'Image not found',
        });
      }

      res.json({
        success: true,
        data: image,
      });
    } catch (error: any) {
      console.error('Get image by ID error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get image',
      });
    }
  }
}

export default new GalleryController();
