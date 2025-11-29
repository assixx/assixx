-- Migration: Add area_lead_id to areas table
-- Date: 2025-11-29
-- Description: Add area lead (Bereichsleiter) reference to areas table

-- Add area_lead_id column
ALTER TABLE areas
ADD COLUMN area_lead_id INT NULL AFTER description;

-- Add foreign key constraint
ALTER TABLE areas
ADD CONSTRAINT fk_areas_lead
FOREIGN KEY (area_lead_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_area_lead_id ON areas(area_lead_id);
