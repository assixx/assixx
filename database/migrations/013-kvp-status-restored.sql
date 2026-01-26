-- Migration: Add 'restored' status to kvp_suggestions_status ENUM
-- Date: 2026-01-23
-- Description: Add 'restored' (Wiederhergestellt) status for unarchived KVP suggestions

-- Add 'restored' value to the ENUM type
ALTER TYPE kvp_suggestions_status ADD VALUE IF NOT EXISTS 'restored';

-- Verify the change
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'kvp_suggestions_status'::regtype ORDER BY enumsortorder;
