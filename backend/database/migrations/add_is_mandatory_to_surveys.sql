-- Add is_mandatory field to surveys table
ALTER TABLE surveys 
ADD COLUMN is_mandatory TINYINT(1) DEFAULT 0 AFTER is_anonymous;

-- Add comment for clarity
ALTER TABLE surveys 
MODIFY COLUMN is_mandatory TINYINT(1) DEFAULT 0 COMMENT 'Whether survey completion is mandatory';