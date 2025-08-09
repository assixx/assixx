-- =====================================================
-- Migration: Add requires_response field to calendar_events
-- Date: 2025-01-28
-- Author: System
-- Description: Adds field to track if event requires response from attendees
-- =====================================================

-- Add requires_response column to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN requires_response BOOLEAN DEFAULT FALSE 
COMMENT 'Whether this event requires a response from attendees' 
AFTER allow_attendees;

-- Set default for existing events based on type
-- Company and department events typically require response
UPDATE calendar_events 
SET requires_response = CASE 
    WHEN org_level IN ('company', 'department') THEN TRUE
    WHEN allow_attendees = 1 THEN TRUE
    ELSE FALSE
END;

-- Add index for better query performance
CREATE INDEX idx_calendar_requires_response 
ON calendar_events(tenant_id, requires_response, status);

-- Add index for finding pending responses
CREATE INDEX idx_calendar_attendees_pending 
ON calendar_attendees(user_id, response_status, tenant_id);