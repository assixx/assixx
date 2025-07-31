-- Update notification_preferences table structure
ALTER TABLE `notification_preferences` 
  ADD COLUMN `tenant_id` int NOT NULL AFTER `user_id`,
  ADD COLUMN `email_notifications` tinyint(1) DEFAULT '1' AFTER `notification_type`,
  ADD COLUMN `push_notifications` tinyint(1) DEFAULT '1' AFTER `email_notifications`,
  ADD COLUMN `sms_notifications` tinyint(1) DEFAULT '0' AFTER `push_notifications`,
  ADD COLUMN `preferences` json DEFAULT NULL AFTER `sms_notifications`;

-- Add foreign key for tenant_id
ALTER TABLE `notification_preferences` 
  ADD CONSTRAINT `notification_preferences_tenant_fk` 
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

-- Create notifications table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `priority` enum('low','normal','medium','high','urgent') DEFAULT 'normal',
  `recipient_id` int DEFAULT NULL,
  `recipient_type` enum('user','department','team','all') NOT NULL,
  `action_url` varchar(500) DEFAULT NULL,
  `action_label` varchar(100) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `scheduled_for` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_type` (`tenant_id`,`type`),
  KEY `idx_recipient` (`recipient_type`,`recipient_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_scheduled` (`scheduled_for`),
  KEY `fk_notifications_tenant` (`tenant_id`),
  KEY `fk_notifications_created_by` (`created_by`),
  CONSTRAINT `fk_notifications_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create notification read status table
CREATE TABLE IF NOT EXISTS `notification_read_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `notification_id` int NOT NULL,
  `user_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_notification_user` (`notification_id`,`user_id`),
  KEY `idx_user_notifications` (`user_id`,`read_at`),
  KEY `fk_read_status_tenant` (`tenant_id`),
  CONSTRAINT `fk_read_status_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_read_status_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_read_status_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;