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
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_type` (`type`),
  KEY `idx_recipient_id` (`recipient_id`),
  KEY `idx_recipient_type` (`recipient_type`),
  KEY `idx_priority` (`priority`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_scheduled_for` (`scheduled_for`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
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
  KEY `idx_notification_id` (`notification_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  CONSTRAINT `notification_read_status_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_read_status_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_read_status_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add missing columns to notification_preferences if needed
ALTER TABLE `notification_preferences` 
  ADD COLUMN IF NOT EXISTS `tenant_id` int NOT NULL AFTER `user_id`,
  ADD COLUMN IF NOT EXISTS `email_notifications` tinyint(1) DEFAULT '1' AFTER `tenant_id`,
  ADD COLUMN IF NOT EXISTS `push_notifications` tinyint(1) DEFAULT '1' AFTER `email_notifications`,
  ADD COLUMN IF NOT EXISTS `sms_notifications` tinyint(1) DEFAULT '0' AFTER `push_notifications`,
  ADD COLUMN IF NOT EXISTS `preferences` json DEFAULT NULL AFTER `sms_notifications`;

-- Add foreign key for tenant_id if not exists
ALTER TABLE `notification_preferences`
  ADD CONSTRAINT `notification_preferences_ibfk_2` FOREIGN KEY IF NOT EXISTS (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;