-- Hall gallery schema for Cloudinary-backed hall imagery.
-- This migration is additive and safe for production reruns through the
-- platform migration tracker.

CREATE TABLE IF NOT EXISTS hall_gallery (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  hall_id INT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  public_id VARCHAR(500) NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  caption VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_hall_gallery_tenant_hall_order (tenant_id, hall_id, display_order, created_at),
  INDEX idx_hall_gallery_featured (tenant_id, hall_id, is_featured),
  INDEX idx_hall_gallery_category (tenant_id, hall_id, category),
  INDEX idx_hall_gallery_uploaded_by (uploaded_by),
  CONSTRAINT fk_hall_gallery_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hall_gallery_hall
    FOREIGN KEY (hall_id) REFERENCES halls(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hall_gallery_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
