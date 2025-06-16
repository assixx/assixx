-- Migration: Fix message_status foreign key
-- Date: 2025-06-14
-- Description: Updates message_status foreign key to reference the new messages table instead of messages_old_backup

-- Drop the existing foreign key that references messages_old_backup
ALTER TABLE message_status 
DROP FOREIGN KEY message_status_ibfk_1;

-- Add the corrected foreign key that references the new messages table
ALTER TABLE message_status 
ADD CONSTRAINT fk_message_status_message 
FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;