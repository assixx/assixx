-- CRITICAL SECURITY FIX: Add tenant_id to all survey tables for proper multi-tenant isolation

-- 1. survey_questions - Add tenant_id
ALTER TABLE survey_questions 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Populate tenant_id from parent survey
UPDATE survey_questions sq
INNER JOIN surveys s ON sq.survey_id = s.id
SET sq.tenant_id = s.tenant_id;

ALTER TABLE survey_questions
ADD CONSTRAINT fk_survey_questions_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE survey_questions
ADD INDEX idx_sq_tenant_id (tenant_id);

-- 2. survey_responses - Add tenant_id
ALTER TABLE survey_responses 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Populate tenant_id from parent survey
UPDATE survey_responses sr
INNER JOIN surveys s ON sr.survey_id = s.id
SET sr.tenant_id = s.tenant_id;

ALTER TABLE survey_responses
ADD CONSTRAINT fk_survey_responses_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE survey_responses
ADD INDEX idx_sr_tenant_id (tenant_id);

-- 3. survey_answers - Add tenant_id
ALTER TABLE survey_answers 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Populate tenant_id from parent response/survey
UPDATE survey_answers sa
INNER JOIN survey_responses sr ON sa.response_id = sr.id
INNER JOIN surveys s ON sr.survey_id = s.id
SET sa.tenant_id = s.tenant_id;

ALTER TABLE survey_answers
ADD CONSTRAINT fk_survey_answers_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE survey_answers
ADD INDEX idx_sa_tenant_id (tenant_id);

-- 4. survey_participants - Add tenant_id
ALTER TABLE survey_participants 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Populate tenant_id from parent survey
UPDATE survey_participants sp
INNER JOIN surveys s ON sp.survey_id = s.id
SET sp.tenant_id = s.tenant_id;

ALTER TABLE survey_participants
ADD CONSTRAINT fk_survey_participants_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE survey_participants
ADD INDEX idx_sp_tenant_id (tenant_id);

-- 5. survey_comments - Add tenant_id
ALTER TABLE survey_comments 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Populate tenant_id from parent survey
UPDATE survey_comments sc
INNER JOIN surveys s ON sc.survey_id = s.id
SET sc.tenant_id = s.tenant_id;

ALTER TABLE survey_comments
ADD CONSTRAINT fk_survey_comments_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE survey_comments
ADD INDEX idx_sc_tenant_id (tenant_id);

-- 6. survey_reminders - Add tenant_id
ALTER TABLE survey_reminders 
ADD COLUMN tenant_id INT NOT NULL AFTER id;

-- Populate tenant_id from parent survey
UPDATE survey_reminders sr
INNER JOIN surveys s ON sr.survey_id = s.id
SET sr.tenant_id = s.tenant_id;

ALTER TABLE survey_reminders
ADD CONSTRAINT fk_survey_reminders_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE survey_reminders
ADD INDEX idx_srem_tenant_id (tenant_id);

-- Add composite indexes for better query performance
ALTER TABLE survey_questions ADD INDEX idx_sq_tenant_survey (tenant_id, survey_id);
ALTER TABLE survey_responses ADD INDEX idx_sr_tenant_survey (tenant_id, survey_id);
ALTER TABLE survey_answers ADD INDEX idx_sa_tenant_response (tenant_id, response_id);
ALTER TABLE survey_participants ADD INDEX idx_sp_tenant_survey (tenant_id, survey_id);
ALTER TABLE survey_comments ADD INDEX idx_sc_tenant_survey (tenant_id, survey_id);
ALTER TABLE survey_reminders ADD INDEX idx_srem_tenant_survey (tenant_id, survey_id);