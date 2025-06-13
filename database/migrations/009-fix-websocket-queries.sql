-- Migration: Fix WebSocket Queries
-- Date: 2025-06-13
-- Description: Removes tenant_id references from conversation_participants queries

-- The conversation_participants table doesn't have a tenant_id column
-- The tenant_id is already in the conversations table
-- This migration doesn't change the schema, but documents the correct queries