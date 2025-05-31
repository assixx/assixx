-- =====================================================
-- views.sql - Datenbank-Views
-- =====================================================
-- Vordefinierte Views für häufige Abfragen
-- Vereinfacht komplexe JOINs und Aggregationen
-- =====================================================

-- Mitarbeiter-Übersicht
CREATE OR REPLACE VIEW employee_overview AS
SELECT 
    u.id,
    u.tenant_id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.role,
    u.status,
    u.created_at,
    u.last_login,
    d.name AS department_name,
    t.name AS team_name,
    COUNT(DISTINCT doc.id) AS document_count,
    COUNT(DISTINCT msg.id) AS message_count
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_teams ut ON u.id = ut.user_id
LEFT JOIN teams t ON ut.team_id = t.id
LEFT JOIN documents doc ON u.id = doc.user_id
LEFT JOIN messages msg ON u.id = msg.sender_id
WHERE u.role = 'employee'
GROUP BY u.id;

-- Tenant-Statistiken
CREATE OR REPLACE VIEW tenant_statistics AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.subdomain,
    t.status,
    t.plan_type,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.role = 'admin' THEN u.id END) AS admin_count,
    COUNT(DISTINCT CASE WHEN u.role = 'employee' THEN u.id END) AS employee_count,
    COUNT(DISTINCT d.id) AS department_count,
    COUNT(DISTINCT tm.id) AS team_count,
    COUNT(DISTINCT tf.id) AS active_features,
    t.created_at,
    t.subscription_end_date
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id AND u.status = 'active'
LEFT JOIN departments d ON t.id = d.tenant_id
LEFT JOIN teams tm ON t.id = tm.tenant_id
LEFT JOIN tenant_features tf ON t.id = tf.tenant_id AND tf.is_active = TRUE
GROUP BY t.id;

-- Feature-Nutzung
CREATE OR REPLACE VIEW feature_usage_summary AS
SELECT 
    f.id AS feature_id,
    f.code,
    f.name,
    f.category,
    f.base_price,
    COUNT(DISTINCT tf.tenant_id) AS tenant_count,
    COUNT(DISTINCT ful.id) AS usage_count,
    SUM(CASE WHEN tf.is_active = TRUE THEN 1 ELSE 0 END) AS active_count,
    AVG(DATEDIFF(NOW(), tf.activated_at)) AS avg_days_active
FROM features f
LEFT JOIN tenant_features tf ON f.id = tf.feature_id
LEFT JOIN feature_usage_logs ful ON f.id = ful.feature_id
GROUP BY f.id;

-- Aktive Schichten heute
CREATE OR REPLACE VIEW active_shifts_today AS
SELECT 
    s.id,
    s.tenant_id,
    s.user_id,
    u.first_name,
    u.last_name,
    s.start_time,
    s.end_time,
    s.status,
    s.type,
    st.name AS template_name,
    d.name AS department_name
FROM shifts s
JOIN users u ON s.user_id = u.id
LEFT JOIN shift_templates st ON s.template_id = st.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE DATE(s.date) = CURDATE()
AND s.status NOT IN ('cancelled');

-- Offene KVP-Vorschläge
CREATE OR REPLACE VIEW open_kvp_suggestions AS
SELECT 
    k.id,
    k.tenant_id,
    k.title,
    k.category,
    k.status,
    k.priority,
    k.estimated_savings,
    k.created_at,
    u.first_name AS submitter_first_name,
    u.last_name AS submitter_last_name,
    d.name AS department_name,
    COUNT(DISTINCT kc.id) AS comment_count,
    AVG(kr.rating) AS avg_rating
FROM kvp_suggestions k
JOIN users u ON k.submitter_id = u.id
LEFT JOIN departments d ON k.department_id = d.id
LEFT JOIN kvp_comments kc ON k.id = kc.suggestion_id
LEFT JOIN kvp_ratings kr ON k.id = kr.suggestion_id
WHERE k.status IN ('submitted', 'review', 'approved')
GROUP BY k.id;

-- Aktuelle Umfragen
CREATE OR REPLACE VIEW active_surveys AS
SELECT 
    s.id,
    s.tenant_id,
    s.title,
    s.type,
    s.status,
    s.is_anonymous,
    s.start_date,
    s.end_date,
    u.first_name AS creator_first_name,
    u.last_name AS creator_last_name,
    COUNT(DISTINCT sq.id) AS question_count,
    COUNT(DISTINCT sr.id) AS response_count,
    COUNT(DISTINCT CASE WHEN sr.status = 'completed' THEN sr.id END) AS completed_count
FROM surveys s
JOIN users u ON s.created_by = u.id
LEFT JOIN survey_questions sq ON s.id = sq.survey_id
LEFT JOIN survey_responses sr ON s.id = sr.survey_id
WHERE s.status = 'active'
AND (s.start_date IS NULL OR s.start_date <= NOW())
AND (s.end_date IS NULL OR s.end_date >= NOW())
GROUP BY s.id;

-- Dokument-Übersicht
CREATE OR REPLACE VIEW document_summary AS
SELECT 
    d.id,
    d.tenant_id,
    d.user_id,
    d.category,
    d.filename,
    d.file_size,
    d.uploaded_at,
    d.is_archived,
    u.first_name AS owner_first_name,
    u.last_name AS owner_last_name,
    u.email AS owner_email,
    cu.first_name AS uploader_first_name,
    cu.last_name AS uploader_last_name
FROM documents d
JOIN users u ON d.user_id = u.id
LEFT JOIN users cu ON d.created_by = cu.id
WHERE d.is_archived = FALSE;

-- Chat-Aktivität
CREATE OR REPLACE VIEW chat_activity AS
SELECT 
    DATE(m.created_at) AS activity_date,
    m.sender_id,
    u.first_name,
    u.last_name,
    u.tenant_id,
    COUNT(DISTINCT m.id) AS message_count,
    COUNT(DISTINCT m.receiver_id) AS unique_recipients,
    COUNT(DISTINCT m.group_id) AS group_messages
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.is_deleted = FALSE
AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(m.created_at), m.sender_id;

-- Mitarbeiter ohne Dokumente
CREATE OR REPLACE VIEW employees_without_documents AS
SELECT 
    u.id,
    u.tenant_id,
    u.email,
    u.first_name,
    u.last_name,
    u.created_at,
    d.name AS department_name
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN documents doc ON u.id = doc.user_id
WHERE u.role = 'employee'
AND u.status = 'active'
AND doc.id IS NULL
GROUP BY u.id;