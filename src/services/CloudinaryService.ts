/**
 * Cloudinary Image Upload Service
 * Handles image uploads, transformations, and deletions
 */

import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';
import { sanitizeLogValue } from '../utils/logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  resourceType: string;
}

export class CloudinaryService {
  /**
   * Upload image to Cloudinary
   * @param filePath - Local file path or base64 string
   * @param folder - Cloudinary folder (e.g., 'hallsync/halls/tenant-1')
   * @param options - Additional upload options
   */
  async uploadImage(
    filePath: string,
    folder: string = 'hallsync/halls',
    options: any = {}
  ): Promise<UploadResult> {
    try {
      const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1920, height: 1080, crop: 'limit' }, // Max size
          { quality: 'auto' }, // Auto quality
          { fetch_format: 'auto' }, // Auto format (WebP when supported)
        ],
        ...options,
      });

      return {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        resourceType: result.resource_type,
      };
    } catch (error: any) {
      console.error('Cloudinary upload error:', sanitizeLogValue(error));
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    filePaths: string[],
    folder: string = 'hallsync/halls'
  ): Promise<UploadResult[]> {
    const uploadPromises = filePaths.map((filePath) =>
      this.uploadImage(filePath, folder)
    );
    return Promise.all(uploadPromises);
  }

  /**
   * Delete image from Cloudinary
   * @param publicId - Cloudinary public ID
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      console.error('Cloudinary delete error:', sanitizeLogValue(error));
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Delete multiple images
   */
  async deleteMultipleImages(publicIds: string[]): Promise<void> {
    const deletePromises = publicIds.map((publicId) =>
      this.deleteImage(publicId)
    );
    await Promise.all(deletePromises);
  }

  /**
   * Generate thumbnail URL
   * @param publicId - Cloudinary public ID
   * @param width - Thumbnail width
   * @param height - Thumbnail height
   */
  getThumbnailUrl(publicId: string, width: number = 300, height: number = 200): string {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
    });
  }

  /**
   * Generate optimized image URL with transformations
   */
  getOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
    } = {}
  ): string {
    return cloudinary.url(publicId, {
      quality: 'auto',
      fetch_format: 'auto',
      ...options,
    });
  }

  /**
   * Upload image from buffer (for multer file uploads)
   * @param file - Multer file object
   * @param folder - Cloudinary folder
   */
  async uploadFromBuffer(
    file: Express.Multer.File,
    folder: string = 'hallsync/uploads'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          transformation: [
            { width: 1920, height: 1080, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', sanitizeLogValue(error));
            reject(new Error(`Failed to upload image: ${error.message}`));
          } else {
            resolve(result!.secure_url);
          }
        }
      );
      
      uploadStream.end(file.buffer);
    });
  }

  /**
   * Upload a subscription payment proof from buffer.
   * Returns ONLY the Cloudinary public_id — never the raw URL.
   * Use getSignedProofUrl() to produce a short-lived signed URL on demand.
   * @param file  - Multer file object
   * @param folder - Cloudinary folder (e.g. hallsync/tenant-1/payment-proofs)
   */
  async uploadProof(
    file: Express.Multer.File,
    folder: string
  ): Promise<{ publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // No transformation — preserve the original proof for legibility
        },
        (error, result) => {
          if (error) {
            // Sanitize: Cloudinary error objects may contain the public_id / URL
            console.error('Cloudinary proof upload error:', sanitizeLogValue(error));
            reject(new Error(`Failed to upload payment proof: ${error.message}`));
          } else {
            // Return only the public_id — the caller must never log or expose this
            resolve({ publicId: result!.public_id });
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Generate a short-lived signed URL for a proof image.
   * The URL is valid for `ttlSeconds` (default 900 = 15 min) and includes
   * an HMAC signature derived from CLOUDINARY_API_SECRET.
   *
   * SECURITY NOTES:
   *  - The returned URL must never be stored in a database or logged.
   *  - The URL is time-limited but not access-controlled at the CDN level
   *    on free/standard Cloudinary plans. Enable "Strict Transformations" in
   *    the Cloudinary dashboard for CDN-level enforcement.
   *
   * @param publicIdOrLegacyUrl - Cloudinary public_id OR a legacy full URL stored before this change
   * @param ttlSeconds          - Validity window in seconds (default 900 = 15 min)
   */
  getSignedProofUrl(
    publicIdOrLegacyUrl: string,
    ttlSeconds = 900
  ): { signedUrl: string; expiresAt: string } {
    // Backwards-compat: if a legacy full URL is stored, extract the public_id.
    // Cloudinary URLs look like: https://res.cloudinary.com/<cloud>/image/upload/[v12345/]<public_id>.<ext>
    const publicId = this.extractPublicId(publicIdOrLegacyUrl);

    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    const signedUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      expires_at: expiresAt,
      resource_type: 'image',
    });

    return {
      signedUrl,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  /**
   * Extract the Cloudinary public_id from either a raw public_id string or
   * a legacy full https://res.cloudinary.com URL.
   * If the input doesn't look like a full URL, it is returned unchanged.
   */
  extractPublicId(publicIdOrUrl: string): string {
    if (!publicIdOrUrl.startsWith('http')) {
      return publicIdOrUrl;
    }

    try {
      const parsedUrl = new URL(publicIdOrUrl);
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const uploadIndex = pathSegments.findIndex((segment) => segment === 'upload');

      if (
        parsedUrl.protocol !== 'https:' ||
        !parsedUrl.hostname.endsWith('res.cloudinary.com') ||
        uploadIndex < 0 ||
        uploadIndex >= pathSegments.length - 1
      ) {
        return publicIdOrUrl;
      }

      const publicIdSegments = pathSegments.slice(uploadIndex + 1);
      if (/^v\d+$/.test(publicIdSegments[0])) {
        publicIdSegments.shift();
      }

      const publicId = publicIdSegments.join('/');
      return publicId.replace(/\.[a-z0-9]+$/i, '');
    } catch {
      return publicIdOrUrl;
    }
  }

  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  /**
   * Get folder path for tenant
   */
  getTenantFolder(subfolder: string = 'halls'): string {
    const { getTenantId } = require('../utils/tenantContext');
    const tenantId = getTenantId();
    return `hallsync/tenant-${tenantId}/${subfolder}`;
  }
}

export default new CloudinaryService();
