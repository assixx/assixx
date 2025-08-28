-- Migration: Add F/S/N shift types to shifts table
-- Date: 2025-08-28
-- Purpose: Add consistency with shift_rotation_history table for Kontischicht feature

-- Add F, S, N to the shifts.type ENUM
ALTER TABLE shifts 
MODIFY COLUMN type ENUM(
  'regular',
  'overtime', 
  'standby',
  'vacation',
  'sick',
  'holiday',
  'early',
  'late',
  'night',
  'day',
  'flexible',
  'F',  -- Frühschicht (Early shift)
  'S',  -- Spätschicht (Late shift) 
  'N'   -- Nachtschicht (Night shift)
) DEFAULT 'regular';

-- Optional: Update existing early/late/night to F/S/N if needed
-- UPDATE shifts SET type = 'F' WHERE type = 'early';
-- UPDATE shifts SET type = 'S' WHERE type = 'late';
-- UPDATE shifts SET type = 'N' WHERE type = 'night';