-- =====================================================
-- Migration: Drop deprecated message_attachments table
-- Date: 2026-01-13
-- Author: Claude Code
-- =====================================================
--
-- REASON: message_attachments junction table is DEPRECATED
-- Chat attachments are now stored directly in the documents table
-- with the conversation_id and message_id columns.
--
-- Evidence:
-- - Table has 0 rows (SELECT COUNT(*) FROM message_attachments = 0)
-- - NO backend code uses this table (grep found only schema files)
-- - documents table has conversation_id for chat attachment flow
-- - ChatController now uses DocumentsService directly
--
-- This is safe to drop because:
-- 1. No application code references this table
-- 2. No data exists in the table
-- 3. Only outgoing FK constraints (to tenants, messages, documents)
-- 4. No other tables reference message_attachments
-- =====================================================

-- 1. Drop RLS policy first
DROP POLICY IF EXISTS tenant_isolation ON message_attachments;

-- 2. Drop the table (CASCADE will remove FKs automatically)
DROP TABLE IF EXISTS message_attachments CASCADE;

-- 3. Verify table is gone
-- Run manually: \dt message_attachments
-- Should return: Did not find any relation named "message_attachments"

-- =====================================================
-- DOCUMENTATION UPDATE REQUIRED:
-- - Update docs/UUIDV7-MIGRATION-PLAN.md to mark as removed
-- - Remove from database/database-setup.sql (legacy MySQL reference)
-- - The baseline migration (001) keeps the historical record
-- =====================================================
