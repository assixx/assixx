-- Fix shifts table to allow NULL plan_id instead of default 1
ALTER TABLE shifts 
MODIFY COLUMN plan_id INT DEFAULT NULL;