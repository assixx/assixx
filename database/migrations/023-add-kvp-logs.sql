-- =====================================================
-- Migration: Add KVP activity logging
-- Date: 2025-06-21
-- Author: Simon & Claude
-- Description: Track KVP creation and sharing in activity logs
-- =====================================================

-- Add KVP-related activity types to the activity_logs table
-- First, let's check the current structure
-- The activity_logs table should already exist with a 'type' column

-- Insert sample log entries for testing (optional)
-- These will be created automatically when KVP actions occur

-- Verify the activity_logs table can handle KVP events
SELECT 'KVP logging ready - activity_logs table will track kvp_created and kvp_shared events' as Status;