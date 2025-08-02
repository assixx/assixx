-- Create comprehensive audit trail table for compliance and security monitoring
-- This replaces the limited deletion_audit_trail with a full audit system

CREATE TABLE IF NOT EXISTS `audit_trail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `user_name` varchar(100) DEFAULT NULL,
  `user_role` varchar(50) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` int DEFAULT NULL,
  `resource_name` varchar(255) DEFAULT NULL,
  `changes` JSON DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `status` enum('success','failure') NOT NULL DEFAULT 'success',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_user` (`tenant_id`, `user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_resource` (`resource_type`, `resource_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  CONSTRAINT `audit_trail_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `audit_trail_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for common queries
CREATE INDEX `idx_audit_search` ON `audit_trail` (`tenant_id`, `created_at` DESC);
CREATE INDEX `idx_audit_compliance` ON `audit_trail` (`tenant_id`, `action`, `resource_type`, `created_at`);

-- Migrate existing deletion_audit_trail data if it exists
INSERT INTO `audit_trail` (
  `tenant_id`,
  `user_id`,
  `user_name`,
  `action`,
  `resource_type`,
  `resource_id`,
  `resource_name`,
  `changes`,
  `created_at`
)
SELECT 
  dat.`tenant_id`,
  dat.`deleted_by`,
  u.`username`,
  'delete',
  dat.`entity_type`,
  dat.`entity_id`,
  CONCAT(dat.`entity_type`, ' #', dat.`entity_id`),
  JSON_OBJECT(
    'deletion_reason', dat.`deletion_reason`,
    'entity_data', dat.`entity_data`
  ),
  dat.`deleted_at`
FROM `deletion_audit_trail` dat
LEFT JOIN `users` u ON u.`id` = dat.`deleted_by`
WHERE EXISTS (SELECT 1 FROM `deletion_audit_trail` LIMIT 1);