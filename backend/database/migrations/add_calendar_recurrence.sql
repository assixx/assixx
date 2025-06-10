-- Add recurrence support to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN recurrence_rule VARCHAR(500) DEFAULT NULL AFTER color,
ADD COLUMN parent_event_id INT DEFAULT NULL AFTER recurrence_rule,
ADD INDEX idx_parent_event (parent_event_id),
ADD FOREIGN KEY (parent_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;

-- Add comment for clarity
ALTER TABLE calendar_events 
MODIFY COLUMN recurrence_rule VARCHAR(500) DEFAULT NULL COMMENT 'Recurrence pattern: daily, weekly, biweekly, monthly, yearly, weekdays with optional ;COUNT=n or ;UNTIL=date';