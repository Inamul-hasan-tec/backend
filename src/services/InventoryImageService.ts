import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import InventoryRepository from '../repositories/InventoryRepository';
import CloudinaryService from './CloudinaryService';
import { getTenantId } from '../utils/tenantContext';
import { logger } from '../utils/logger';

const imageExtensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

class InventoryImageService {
  async getUsage() {
    return InventoryRepository.getPhotoUsage();
  }

  async getImages(itemId: number) {
    return InventoryRepository.getItemImages(itemId);
  }

  async uploadImage(
    itemId: number,
    file: Express.Multer.File,
    userId: number,
    metadata?: { caption?: string; alt_text?: string }
  ) {
    const usage = await InventoryRepository.getPhotoUsage();
    if (!usage.can_upload) {
      throw new Error(`Inventory photo limit reached for ${usage.plan} plan`);
    }

    const tenantId = getTenantId();
    const storage = await this.storeImage(file, tenantId, itemId);

    return InventoryRepository.createItemImage({
      itemId,
      imageUrl: storage.imageUrl,
      thumbnailUrl: storage.thumbnailUrl,
      publicId: storage.publicId,
      caption: metadata?.caption,
      altText: metadata?.alt_text,
      uploadedBy: userId,
    });
  }

  async deleteImage(imageId: number) {
    const image = await InventoryRepository.getImageById(imageId);
    if (!image) {
      throw new Error('Inventory image not found');
    }

    if (image.public_id && !String(image.public_id).startsWith('local:')) {
      try {
        await CloudinaryService.deleteImage(image.public_id);
      } catch (error) {
        logger.warn('inventory_image_cloudinary_delete_failed', {
          image_id: imageId,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    await InventoryRepository.deleteItemImage(imageId);
  }

  async setPrimary(imageId: number) {
    const updated = await InventoryRepository.setPrimaryImage(imageId);
    if (!updated) {
      throw new Error('Inventory image not found');
    }
  }

  private async storeImage(
    file: Express.Multer.File,
    tenantId: number,
    itemId: number
  ): Promise<{ imageUrl: string; thumbnailUrl: string; publicId: string }> {
    if (CloudinaryService.isConfigured()) {
      const imageUrl = await CloudinaryService.uploadFromBuffer(
        file,
        `hallsync/tenant-${tenantId}/inventory/items/${itemId}`
      );
      return {
        imageUrl,
        thumbnailUrl: CloudinaryService.getOptimizedUrl(imageUrl, {
          width: 360,
          height: 260,
          crop: 'fill',
          quality: 'auto',
        }),
        publicId: imageUrl,
      };
    }

    const uploadRoot = process.env.LOCAL_UPLOAD_ROOT || path.join(process.cwd(), 'uploads');
    const relativeFolder = path.join('inventory', `tenant-${tenantId}`, `item-${itemId}`);
    const absoluteFolder = path.join(uploadRoot, relativeFolder);
    await fs.mkdir(absoluteFolder, { recursive: true });

    const extension = imageExtensionByMimeType[file.mimetype] || 'bin';
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    const absolutePath = path.join(absoluteFolder, fileName);
    await fs.writeFile(absolutePath, file.buffer);

    const relativeUrl = `/uploads/${relativeFolder.split(path.sep).join('/')}/${fileName}`;
    const publicBaseUrl = (process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').replace(/\/$/, '');
    const imageUrl = publicBaseUrl ? `${publicBaseUrl}${relativeUrl}` : relativeUrl;

    logger.warn('inventory_image_stored_locally_cloudinary_missing', {
      tenant_id: tenantId,
      item_id: itemId,
      mime_type: file.mimetype,
    });

    return {
      imageUrl,
      thumbnailUrl: imageUrl,
      publicId: `local:${relativeUrl}`,
    };
  }
}

export default new InventoryImageService();
