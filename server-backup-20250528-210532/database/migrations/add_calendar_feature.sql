-- Add calendar_system feature to the features table
-- Migration created on 2025-05-22

INSERT INTO features (
    code, 
    name, 
    description, 
    category, 
    base_price,
    is_active
) VALUES (
    'calendar_system',
    'Firmenkalender',
    'Integrierter Firmenkalender für firmeneigene, abteilungs- und teamspezifische Termine und Veranstaltungen.',
    'premium',
    15.00,
    1
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    base_price = VALUES(base_price),
    is_active = VALUES(is_active);

-- Aktivieren für Standard-Tenant (für Entwicklungszwecke)
INSERT INTO tenant_features (
    tenant_id,
    feature_code,
    is_active,
    usage_limit,
    expiry_date
) VALUES (
    1,
    'calendar_system',
    1,
    1000,
    DATE_ADD(CURRENT_DATE, INTERVAL 1 YEAR)
) ON DUPLICATE KEY UPDATE
    is_active = VALUES(is_active),
    usage_limit = VALUES(usage_limit),
    expiry_date = VALUES(expiry_date);