-- ============================================================
-- Migration: Survey Question Options - Proper DB Structure
-- Date: 2025-11-17
-- Author: Claude Code
-- Purpose: Replace JSON options array with proper relational table
--
-- WHY THIS MIGRATION:
-- - Current structure stores options as JSON: [{"option_text": "foo"}]
-- - No stable IDs for options
-- - No foreign keys possible
-- - Frontend needs workarounds (1-based indexing)
-- - SOLUTION: Separate table with proper IDs
-- ============================================================

-- Step 1: Create survey_question_options table
CREATE TABLE IF NOT EXISTS survey_question_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  question_id INT NOT NULL,
  option_text VARCHAR(500) NOT NULL,
  order_position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys
  CONSTRAINT fk_option_question
    FOREIGN KEY (question_id)
    REFERENCES survey_questions(id)
    ON DELETE CASCADE,

  -- Indexes
  INDEX idx_question_id (question_id),
  INDEX idx_tenant_question (tenant_id, question_id),
  INDEX idx_order (question_id, order_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Migrate existing options from JSON to new table
-- This handles all existing questions with options
INSERT INTO survey_question_options (tenant_id, question_id, option_text, order_position)
SELECT
  q.tenant_id,
  q.id AS question_id,
  JSON_UNQUOTE(JSON_EXTRACT(opt.value, '$.option_text')) AS option_text,
  (opt.idx - 1) AS order_position  -- 0-based ordering
FROM survey_questions q
CROSS JOIN JSON_TABLE(
  q.options,
  '$[*]' COLUMNS(
    idx FOR ORDINALITY,
    value JSON PATH '$'
  )
) AS opt
WHERE q.options IS NOT NULL
  AND JSON_LENGTH(q.options) > 0
  AND q.question_type IN ('single_choice', 'multiple_choice');

-- Step 3: Verify migration (optional check)
-- Count should match: questions with options = sum of migrated options
SELECT
  'Before migration - questions with options' AS check_type,
  COUNT(*) AS count
FROM survey_questions
WHERE options IS NOT NULL
  AND JSON_LENGTH(options) > 0;

SELECT
  'After migration - migrated options' AS check_type,
  COUNT(*) AS count
FROM survey_question_options;

-- Step 4: Drop the options JSON column (point of no return!)
-- IMPORTANT: Backup database before running this!
ALTER TABLE survey_questions
DROP COLUMN options;

-- Step 5: Update validation_rules column comment
ALTER TABLE survey_questions
MODIFY COLUMN validation_rules JSON
COMMENT 'Validation rules for text/number inputs (not for choice options)';

-- ============================================================
-- ROLLBACK (if needed - run BEFORE Step 4!)
-- ============================================================

-- To rollback (restore options JSON from options table):
/*
UPDATE survey_questions q
SET options = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT(
      'option_text', o.option_text
    )
    ORDER BY o.order_position
  )
  FROM survey_question_options o
  WHERE o.question_id = q.id
)
WHERE q.question_type IN ('single_choice', 'multiple_choice');

DROP TABLE survey_question_options;
*/

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check migrated data
SELECT
  q.id AS question_id,
  q.question_text,
  q.question_type,
  o.id AS option_id,
  o.option_text,
  o.order_position
FROM survey_questions q
LEFT JOIN survey_question_options o ON o.question_id = q.id
WHERE q.question_type IN ('single_choice', 'multiple_choice')
ORDER BY q.id, o.order_position;

-- Count options per question
SELECT
  q.id,
  q.question_text,
  COUNT(o.id) AS option_count
FROM survey_questions q
LEFT JOIN survey_question_options o ON o.question_id = q.id
WHERE q.question_type IN ('single_choice', 'multiple_choice')
GROUP BY q.id, q.question_text;
