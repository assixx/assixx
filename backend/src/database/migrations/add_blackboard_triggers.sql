-- =====================================================
-- Migration: Add Blackboard Attachment Triggers
-- Date: 2025-01-06
-- Description: Adds triggers for automatic attachment count
-- NOTE: Requires SUPER/TRIGGER privileges
-- =====================================================

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_attachment_count_on_insert;
DROP TRIGGER IF EXISTS update_attachment_count_on_delete;

DELIMITER $$

-- Trigger for INSERT
CREATE TRIGGER update_attachment_count_on_insert
AFTER INSERT ON blackboard_attachments
FOR EACH ROW
BEGIN
    UPDATE blackboard_entries 
    SET attachment_count = (
        SELECT COUNT(*) FROM blackboard_attachments 
        WHERE entry_id = NEW.entry_id
    )
    WHERE id = NEW.entry_id;
END$$

-- Trigger for DELETE
CREATE TRIGGER update_attachment_count_on_delete
AFTER DELETE ON blackboard_attachments
FOR EACH ROW
BEGIN
    UPDATE blackboard_entries 
    SET attachment_count = (
        SELECT COUNT(*) FROM blackboard_attachments 
        WHERE entry_id = OLD.entry_id
    )
    WHERE id = OLD.entry_id;
END$$

DELIMITER ;

-- Update existing counts
UPDATE blackboard_entries be
SET attachment_count = (
    SELECT COUNT(*) 
    FROM blackboard_attachments ba 
    WHERE ba.entry_id = be.id
);

SELECT 'Triggers created successfully!' AS status;