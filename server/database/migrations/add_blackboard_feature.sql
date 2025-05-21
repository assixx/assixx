-- Add blackboard_system feature to the features table
INSERT INTO features (
    code, 
    name, 
    description, 
    category, 
    tier, 
    default_active
) VALUES (
    'blackboard_system',
    'Blackboard-System',
    'Digitales schwarzes Brett für firmenweite, abteilungs- und teamspezifische Ankündigungen.',
    'communication',
    'premium',
    1
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    category = VALUES(category),
    tier = VALUES(tier),
    default_active = VALUES(default_active);