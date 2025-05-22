-- Add KVP System Feature to Feature Management
-- Migration created on 2025-05-22

-- Insert KVP feature
INSERT IGNORE INTO features (code, name, description, category, base_price) VALUES
('kvp_system', 'KVP System', 'Kontinuierlicher Verbesserungsprozess - Mitarbeiter können Verbesserungsvorschläge einreichen', 'premium', 25.00);

-- Add KVP to Premium and Enterprise plans
INSERT IGNORE INTO plan_features (plan_id, feature_id) 
SELECT p.id, f.id 
FROM subscription_plans p, features f 
WHERE p.name IN ('Premium', 'Enterprise') 
AND f.code = 'kvp_system';

-- Enable KVP for default tenant (development)
INSERT IGNORE INTO tenant_features (tenant_id, feature_id, status, valid_from, valid_until)
SELECT 1, f.id, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
FROM features f
WHERE f.code = 'kvp_system';