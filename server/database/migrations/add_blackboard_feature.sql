-- Add blackboard_system feature to the features table
INSERT INTO features (
    code, 
    name, 
    description, 
    category, 
    base_price,
    is_active
) VALUES (
    'blackboard_system',
    'Blackboard-System',
    'Digitales schwarzes Brett für firmenweite, abteilungs- und teamspezifische Ankündigungen.',
    'premium',
    15.00,
    1
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    base_price = VALUES(base_price),
    is_active = VALUES(is_active);