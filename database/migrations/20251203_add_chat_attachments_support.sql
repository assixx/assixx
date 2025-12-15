-- Migration: Add Chat Attachments Support
-- Date: 2025-12-03
-- Description: Extends documents table to support chat attachments
--              following the blackboard attachment pattern
--
-- Changes:
-- 1. Add 'chat' to documents_access_scope ENUM
-- 2. Add conversation_id FK to documents table
-- 3. Add performance index for conversation lookups
-- 4. Create message_attachments junction table for M:N relationship

-- ============================================================
-- STEP 1: Add 'chat' to access_scope ENUM
-- ============================================================
-- Check if value already exists before adding
DO $$
BEGIN
    -- Check if 'chat' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'chat'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'documents_access_scope')
    ) THEN
        ALTER TYPE documents_access_scope ADD VALUE 'chat';
        RAISE NOTICE 'Added ''chat'' to documents_access_scope enum';
    ELSE
        RAISE NOTICE '''chat'' already exists in documents_access_scope enum';
    END IF;
END
$$;

-- ============================================================
-- STEP 2: Add conversation_id column to documents
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'conversation_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN conversation_id INTEGER;
        RAISE NOTICE 'Added conversation_id column to documents';
    ELSE
        RAISE NOTICE 'conversation_id column already exists in documents';
    END IF;
END
$$;

-- ============================================================
-- STEP 3: Add FK constraint for conversation_id
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_documents_conversation'
    ) THEN
        ALTER TABLE documents
        ADD CONSTRAINT fk_documents_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE SET NULL;
        RAISE NOTICE 'Added FK constraint fk_documents_conversation';
    ELSE
        RAISE NOTICE 'FK constraint fk_documents_conversation already exists';
    END IF;
END
$$;

-- ============================================================
-- STEP 4: Add performance index for conversation lookups
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_documents_conversation_id'
    ) THEN
        CREATE INDEX idx_documents_conversation_id
        ON documents(conversation_id)
        WHERE conversation_id IS NOT NULL;
        RAISE NOTICE 'Created index idx_documents_conversation_id';
    ELSE
        RAISE NOTICE 'Index idx_documents_conversation_id already exists';
    END IF;
END
$$;

-- ============================================================
-- STEP 5: Create message_attachments junction table
-- ============================================================
-- This allows M:N relationship between messages and documents
-- A message can have multiple attachments
-- An attachment (document) can theoretically be referenced by multiple messages

CREATE TABLE IF NOT EXISTS message_attachments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_message_attachments_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_message_attachments_message
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_message_attachments_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    -- Unique constraint: a document can only be attached once per message
    CONSTRAINT unique_message_document UNIQUE (message_id, document_id)
);

-- Indexes for message_attachments
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
    ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_document_id
    ON message_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_tenant_id
    ON message_attachments(tenant_id);

-- ============================================================
-- STEP 6: Enable RLS on message_attachments
-- ============================================================
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments FORCE ROW LEVEL SECURITY;

-- Create tenant isolation policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'message_attachments' AND policyname = 'tenant_isolation'
    ) THEN
        CREATE POLICY tenant_isolation ON message_attachments
        USING (
            (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
            OR (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
        );
        RAISE NOTICE 'Created RLS policy for message_attachments';
    ELSE
        RAISE NOTICE 'RLS policy for message_attachments already exists';
    END IF;
END
$$;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
    chat_exists BOOLEAN;
    conv_col_exists BOOLEAN;
    fk_exists BOOLEAN;
    idx_exists BOOLEAN;
    tbl_exists BOOLEAN;
BEGIN
    -- Check enum value
    SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'chat'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'documents_access_scope')
    ) INTO chat_exists;

    -- Check column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'conversation_id'
    ) INTO conv_col_exists;

    -- Check FK
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_documents_conversation'
    ) INTO fk_exists;

    -- Check index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_documents_conversation_id'
    ) INTO idx_exists;

    -- Check table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'message_attachments'
    ) INTO tbl_exists;

    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION VERIFICATION ===';
    RAISE NOTICE 'chat in access_scope: %', chat_exists;
    RAISE NOTICE 'conversation_id column: %', conv_col_exists;
    RAISE NOTICE 'FK constraint: %', fk_exists;
    RAISE NOTICE 'Performance index: %', idx_exists;
    RAISE NOTICE 'message_attachments table: %', tbl_exists;
    RAISE NOTICE '==============================';
END
$$;
