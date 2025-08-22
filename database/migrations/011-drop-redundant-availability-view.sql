-- =====================================================
-- Migration: Drop Redundant Employee Availability View
-- Date: 2025-08-22
-- Author: System
-- Description: Removes current_employee_availability VIEW as it's now replaced by direct queries
-- =====================================================

-- The VIEW current_employee_availability is no longer needed because:
-- 1. The same data is now queried directly in availability.service.ts
-- 2. Direct queries provide better performance and flexibility
-- 3. Reduces database complexity and maintenance overhead

-- Drop the redundant view
DROP VIEW IF EXISTS current_employee_availability;

-- Also drop the stored procedure that updates availability status
-- (This was updating a non-existent column availability_status in users table)
DROP PROCEDURE IF EXISTS UpdateUserAvailabilityStatus;

-- Drop the daily event that calls the procedure
DROP EVENT IF EXISTS update_availability_status_daily;

-- Note: This migration was successfully tested on 2025-08-22
-- The API /api/availability/current continues to work without the VIEW