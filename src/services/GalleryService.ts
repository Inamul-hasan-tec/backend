import GalleryRepository, { CreateGalleryImageData, UpdateGalleryImageData } from '../repositories/GalleryRepository';
import CloudinaryService from './CloudinaryService';
import { getTenantId } from '../utils/tenantContext';

class GalleryService {
  // Get all images for a hall
  async getHallGallery(hallId: number, category?: string) {
    if (category) {
      return await GalleryRepository.getImagesByCategory(hallId, category);
    }
    return await GalleryRepository.getHallGallery(hallId);
  }

  // Get featured images
  async getFeaturedImages(hallId: number) {
    return await GalleryRepository.getFeaturedImages(hallId);
  }

  // Upload single image
  async uploadImage(
    file: Express.Multer.File,
    hallId: number,
    userId: number,
    metadata?: {
      category?: string;
      caption?: string;
      alt_text?: string;
      is_featured?: boolean;
    }
  ) {
    const tenantId = getTenantId();
    // Upload to Cloudinary
    const imageUrl = await CloudinaryService.uploadFromBuffer(
      file,
      `halls/${tenantId}/${hallId}`
    );

    // Generate thumbnail URL (using the same URL with transformation)
    const thumbnailUrl = CloudinaryService.getOptimizedUrl(imageUrl, {
      width: 400,
      height: 300,
      crop: 'fill',
      quality: 'auto',
    });

    // Get current max display order
    const existingImages = await GalleryRepository.getHallGallery(hallId);
    const maxOrder = existingImages.length > 0 
      ? Math.max(...existingImages.map(img => img.display_order)) 
      : 0;

    // Create database record
    const imageData: CreateGalleryImageData = {
      hall_id: hallId,
      image_url: imageUrl,
      thumbnail_url: thumbnailUrl,
      public_id: imageUrl, // Using URL as public_id for now
      category: metadata?.category || 'general',
      caption: metadata?.caption,
      alt_text: metadata?.alt_text,
      display_order: maxOrder + 1,
      is_featured: metadata?.is_featured || false,
      uploaded_by: userId,
    };

    return await GalleryRepository.createImage(imageData);
  }

  // Upload multiple images
  async uploadMultipleImages(
    files: Express.Multer.File[],
    hallId: number,
    userId: number,
    category?: string
  ) {
    const uploadPromises = files.map(file =>
      this.uploadImage(file, hallId, userId, { category })
    );

    return await Promise.all(uploadPromises);
  }

  // Update image metadata
  async updateImage(id: number, data: UpdateGalleryImageData) {
    return await GalleryRepository.updateImage(id, data);
  }

  // Delete image
  async deleteImage(id: number) {
    // Get image details first
    const image = await GalleryRepository.getImageById(id);
    if (!image) {
      throw new Error('Image not found');
    }

    // Delete from Cloudinary if public_id exists
    if (image.public_id) {
      try {
        await CloudinaryService.deleteImage(image.public_id);
      } catch (error) {
        console.error('Failed to delete from Cloudinary:', error);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await GalleryRepository.deleteImage(id);
  }

  // Reorder images
  async reorderImages(
    updates: Array<{ id: number; display_order: number }>
  ) {
    return await GalleryRepository.updateDisplayOrder(updates);
  }

  // Set featured image
  async setFeaturedImage(id: number, hallId: number) {
    return await GalleryRepository.setFeaturedImage(id, hallId);
  }

  // Get gallery statistics
  async getGalleryStats(hallId: number) {
    return await GalleryRepository.getGalleryStats(hallId);
  }

  // Bulk delete images
  async bulkDeleteImages(imageIds: number[]) {
    const deletePromises = imageIds.map(id => this.deleteImage(id));
    await Promise.all(deletePromises);
  }

  // Get single image by ID
  async getImageById(imageId: number) {
    return await GalleryRepository.getImageById(imageId);
  }
}

export default new GalleryService();
