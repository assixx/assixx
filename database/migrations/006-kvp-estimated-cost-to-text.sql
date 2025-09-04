-- Migration: Convert estimated_cost from DECIMAL to TEXT to allow currency symbols and text
-- Date: 2025-09-04
-- Description: Allow users to enter estimated costs with currency symbols like "1000€" or "ca. 500 EUR"

-- Change estimated_cost column from DECIMAL to TEXT
ALTER TABLE kvp_suggestions 
MODIFY COLUMN estimated_cost TEXT;

-- Add comment to document the change
ALTER TABLE kvp_suggestions 
MODIFY COLUMN estimated_cost TEXT COMMENT 'Estimated cost as free text (can include currency symbols and descriptions)';