-- =====================================================
-- Migration: Add UUIDv7 columns to P0 tables
-- Date: 2026-01-13
-- Author: Claude Code
-- Tables: messages, users, document_shares
--
-- WICHTIG: Backup erstellen vor Ausführung!
-- docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backups/backup_$(date +%Y%m%d_%H%M%S).sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. MESSAGES - Chat-Nachrichten
-- =====================================================

-- 1.1 Add UUID columns (nullable first for existing rows)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- 1.2 Populate existing rows with UUIDv4 (gen_random_uuid)
-- Note: New rows will get UUIDv7 from backend
-- uuid_created_at = created_at to preserve chronological order
UPDATE messages
SET
    uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

-- 1.3 Set NOT NULL constraints
ALTER TABLE messages
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- 1.4 Add default for uuid_created_at (new rows)
ALTER TABLE messages
ALTER COLUMN uuid_created_at SET DEFAULT NOW();

-- 1.5 Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_uuid
ON messages(uuid);

-- 1.6 Create index on uuid_created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_messages_uuid_created_at
ON messages(uuid_created_at);

-- =====================================================
-- 2. USERS - Benutzerprofile
-- =====================================================

-- 2.1 Add UUID columns (nullable first)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- 2.2 Populate existing rows
UPDATE users
SET
    uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

-- 2.3 Set NOT NULL constraints
ALTER TABLE users
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- 2.4 Add default for uuid_created_at
ALTER TABLE users
ALTER COLUMN uuid_created_at SET DEFAULT NOW();

-- 2.5 Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid
ON users(uuid);

-- 2.6 Create index on uuid_created_at
CREATE INDEX IF NOT EXISTS idx_users_uuid_created_at
ON users(uuid_created_at);

-- =====================================================
-- 3. DOCUMENT_SHARES - Geteilte Dokument-Links
-- =====================================================

-- 3.1 Add UUID columns (share_uuid for public links)
ALTER TABLE document_shares
ADD COLUMN IF NOT EXISTS share_uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- 3.2 Populate existing rows
UPDATE document_shares
SET
    share_uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE share_uuid IS NULL;

-- 3.3 Set NOT NULL constraints
ALTER TABLE document_shares
ALTER COLUMN share_uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- 3.4 Add default for uuid_created_at
ALTER TABLE document_shares
ALTER COLUMN uuid_created_at SET DEFAULT NOW();

-- 3.5 Create unique index on share_uuid (used for public share links)
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_shares_share_uuid
ON document_shares(share_uuid);

-- 3.6 Create index on uuid_created_at
CREATE INDEX IF NOT EXISTS idx_document_shares_uuid_created_at
ON document_shares(uuid_created_at);

-- =====================================================
-- 4. VERIFICATION
-- =====================================================

-- Verify messages columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'uuid'
    ) THEN
        RAISE EXCEPTION 'Migration failed: messages.uuid column not created';
    END IF;
END $$;

-- Verify users columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'uuid'
    ) THEN
        RAISE EXCEPTION 'Migration failed: users.uuid column not created';
    END IF;
END $$;

-- Verify document_shares columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_shares' AND column_name = 'share_uuid'
    ) THEN
        RAISE EXCEPTION 'Migration failed: document_shares.share_uuid column not created';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- Post-migration info (run manually to verify)
-- =====================================================
-- SELECT 'messages' as table_name, COUNT(*) as rows, COUNT(uuid) as with_uuid FROM messages
-- UNION ALL
-- SELECT 'users', COUNT(*), COUNT(uuid) FROM users
-- UNION ALL
-- SELECT 'document_shares', COUNT(*), COUNT(share_uuid) FROM document_shares;
