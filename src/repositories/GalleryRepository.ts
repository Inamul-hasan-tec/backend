/**
 * Gallery Repository
 * Handles database operations for gallery with Strict Multi-Tenancy via ALS
 */

import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';

export interface GalleryImage {
  id: number;
  hall_id: number;
  tenant_id: number;
  image_url: string;
  thumbnail_url: string | null;
  public_id: string | null;
  category: string;
  caption: string | null;
  alt_text: string | null;
  display_order: number;
  is_featured: boolean;
  uploaded_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGalleryImageData {
  hall_id: number;
  image_url: string;
  thumbnail_url?: string;
  public_id?: string;
  category?: string;
  caption?: string;
  alt_text?: string;
  display_order?: number;
  is_featured?: boolean;
  uploaded_by?: number;
}

export interface UpdateGalleryImageData {
  category?: string;
  caption?: string;
  alt_text?: string;
  display_order?: number;
  is_featured?: boolean;
}

class GalleryRepository {
  // Get all images for a hall
  async getHallGallery(hallId: number): Promise<GalleryImage[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM hall_gallery 
       WHERE hall_id = ? AND tenant_id = ? 
       ORDER BY display_order ASC, created_at DESC`,
      [hallId, tenantId]
    );
    return rows as GalleryImage[];
  }

  // Get images by category
  async getImagesByCategory(hallId: number, category: string): Promise<GalleryImage[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM hall_gallery 
       WHERE hall_id = ? AND tenant_id = ? AND category = ? 
       ORDER BY display_order ASC, created_at DESC`,
      [hallId, tenantId, category]
    );
    return rows as GalleryImage[];
  }

  // Get featured images
  async getFeaturedImages(hallId: number): Promise<GalleryImage[]> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM hall_gallery 
       WHERE hall_id = ? AND tenant_id = ? AND is_featured = TRUE 
       ORDER BY display_order ASC`,
      [hallId, tenantId]
    );
    return rows as GalleryImage[];
  }

  // Get single image by ID
  async getImageById(id: number): Promise<GalleryImage | null> {
    const tenantId = getTenantId();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM hall_gallery WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    return rows.length > 0 ? (rows[0] as GalleryImage) : null;
  }

  // Create new gallery image
  async createImage(data: CreateGalleryImageData): Promise<GalleryImage> {
    const tenantId = getTenantId();
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO hall_gallery 
       (hall_id, tenant_id, image_url, thumbnail_url, public_id, category, caption, alt_text, display_order, is_featured, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.hall_id,
        tenantId,
        data.image_url,
        data.thumbnail_url || null,
        data.public_id || null,
        data.category || 'general',
        data.caption || null,
        data.alt_text || null,
        data.display_order || 0,
        data.is_featured || false,
        data.uploaded_by || null,
      ]
    );

    const image = await this.getImageById(result.insertId);
    if (!image) {
      throw new Error('Failed to retrieve created image');
    }
    return image;
  }

  // Update gallery image
  async updateImage(id: number, data: UpdateGalleryImageData): Promise<GalleryImage> {
    const tenantId = getTenantId();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.category !== undefined) {
      updates.push('category = ?');
      values.push(data.category);
    }
    if (data.caption !== undefined) {
      updates.push('caption = ?');
      values.push(data.caption);
    }
    if (data.alt_text !== undefined) {
      updates.push('alt_text = ?');
      values.push(data.alt_text);
    }
    if (data.display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(data.display_order);
    }
    if (data.is_featured !== undefined) {
      updates.push('is_featured = ?');
      values.push(data.is_featured);
    }

    if (updates.length === 0) {
      const image = await this.getImageById(id);
      if (!image) {
        throw new Error('Image not found');
      }
      return image;
    }

    values.push(id, tenantId);

    await pool.query(
      `UPDATE hall_gallery SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values
    );

    const image = await this.getImageById(id);
    if (!image) {
      throw new Error('Image not found after update');
    }
    return image;
  }

  // Delete gallery image
  async deleteImage(id: number): Promise<void> {
    const tenantId = getTenantId();
    await pool.query('DELETE FROM hall_gallery WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  }

  // Bulk update display order
  async updateDisplayOrder(updates: Array<{ id: number; display_order: number }>): Promise<void> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const update of updates) {
        await connection.query(
          'UPDATE hall_gallery SET display_order = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
          [update.display_order, update.id, tenantId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Set featured image (unset others for the same hall)
  async setFeaturedImage(id: number, hallId: number): Promise<void> {
    const tenantId = getTenantId();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Unset all featured images for this hall
      await connection.query(
        'UPDATE hall_gallery SET is_featured = FALSE WHERE hall_id = ? AND tenant_id = ?',
        [hallId, tenantId]
      );

      // Set the new featured image
      await connection.query(
        'UPDATE hall_gallery SET is_featured = TRUE, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        [id, tenantId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get gallery statistics for a hall
  async getGalleryStats(hallId: number): Promise<{
    total: number;
    by_category: Record<string, number>;
    featured_count: number;
  }> {
    const tenantId = getTenantId();
    const [totalRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM hall_gallery WHERE hall_id = ? AND tenant_id = ?',
      [hallId, tenantId]
    );

    const [categoryRows] = await pool.query<RowDataPacket[]>(
      'SELECT category, COUNT(*) as count FROM hall_gallery WHERE hall_id = ? AND tenant_id = ? GROUP BY category',
      [hallId, tenantId]
    );

    const [featuredRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM hall_gallery WHERE hall_id = ? AND tenant_id = ? AND is_featured = TRUE',
      [hallId, tenantId]
    );

    const by_category: Record<string, number> = {};
    categoryRows.forEach((row: any) => {
      by_category[row.category] = row.count;
    });

    return {
      total: totalRows[0].total,
      by_category,
      featured_count: featuredRows[0].count,
    };
  }
}

export default new GalleryRepository();
