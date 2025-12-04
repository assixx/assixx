-- Migration: Add message_id column to documents table
-- Purpose: Link chat attachments to specific messages for proper reload
-- Date: 2025-12-04

-- Add message_id column to documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS message_id INTEGER;

-- Add foreign key constraint (optional, documents can exist without message)
-- Note: Using SET NULL on delete to preserve documents even if message is deleted
ALTER TABLE documents
ADD CONSTRAINT fk_documents_message
FOREIGN KEY (message_id)
REFERENCES messages(id)
ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_documents_message_id
ON documents(message_id)
WHERE message_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN documents.message_id IS 'Links document to a chat message for attachment retrieval';
