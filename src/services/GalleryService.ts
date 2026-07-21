import GalleryRepository, { CreateGalleryImageData, UpdateGalleryImageData } from '../repositories/GalleryRepository';
import CloudinaryService from './CloudinaryService';
import { getTenantId } from '../utils/tenantContext';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const imageExtensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

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
    const storage = await this.storePublicHallImage(file, tenantId, hallId);

    // Get current max display order
    const existingImages = await GalleryRepository.getHallGallery(hallId);
    const maxOrder = existingImages.length > 0 
      ? Math.max(...existingImages.map(img => img.display_order)) 
      : 0;

    // Create database record
    const imageData: CreateGalleryImageData = {
      hall_id: hallId,
      image_url: storage.imageUrl,
      thumbnail_url: storage.thumbnailUrl,
      public_id: storage.publicId,
      category: metadata?.category || 'general',
      caption: metadata?.caption,
      alt_text: metadata?.alt_text,
      display_order: maxOrder + 1,
      is_featured: metadata?.is_featured || false,
      uploaded_by: userId,
    };

    return await GalleryRepository.createImage(imageData);
  }

  private async storePublicHallImage(
    file: Express.Multer.File,
    tenantId: number,
    hallId: number
  ): Promise<{ imageUrl: string; thumbnailUrl: string; publicId: string }> {
    if (CloudinaryService.isConfigured()) {
      const imageUrl = await CloudinaryService.uploadFromBuffer(
        file,
        `hallsync/tenant-${tenantId}/halls/${hallId}`
      );
      return {
        imageUrl,
        thumbnailUrl: CloudinaryService.getOptimizedUrl(imageUrl, {
          width: 400,
          height: 300,
          crop: 'fill',
          quality: 'auto',
        }),
        publicId: imageUrl,
      };
    }

    const uploadRoot = process.env.LOCAL_UPLOAD_ROOT || path.join(process.cwd(), 'uploads');
    const relativeFolder = path.join('hall-gallery', `tenant-${tenantId}`, `hall-${hallId}`);
    const absoluteFolder = path.join(uploadRoot, relativeFolder);
    await fs.mkdir(absoluteFolder, { recursive: true });

    const extension = imageExtensionByMimeType[file.mimetype] || 'bin';
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    const absolutePath = path.join(absoluteFolder, fileName);
    await fs.writeFile(absolutePath, file.buffer);

    const relativeUrl = `/uploads/${relativeFolder.split(path.sep).join('/')}/${fileName}`;
    const publicBaseUrl = (process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');
    const imageUrl = publicBaseUrl ? `${publicBaseUrl}${relativeUrl}` : relativeUrl;

    logger.warn('hall_gallery_stored_locally_cloudinary_missing', {
      tenant_id: tenantId,
      hall_id: hallId,
      mime_type: file.mimetype,
    });

    return {
      imageUrl,
      thumbnailUrl: imageUrl,
      publicId: `local:${relativeUrl}`,
    };
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

    // Delete from Cloudinary if public_id exists. Local fallback files are left
    // on disk for safety; cleanup can be handled by an operator script later.
    if (image.public_id && !String(image.public_id).startsWith('local:')) {
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
