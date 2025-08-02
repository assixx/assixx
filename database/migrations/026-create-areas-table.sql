-- Create areas table for location/zone management
-- Author: Claude
-- Date: 2025-08-02
-- Description: Areas represent physical locations within a company (buildings, warehouses, offices, etc.)

CREATE TABLE IF NOT EXISTS `areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `type` enum('building','warehouse','office','production','outdoor','other') NOT NULL DEFAULT 'other',
  `capacity` int DEFAULT NULL COMMENT 'Maximum number of people',
  `parent_id` int DEFAULT NULL COMMENT 'For hierarchical areas',
  `address` text COMMENT 'Physical address if applicable',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_areas_tenant` (`tenant_id`),
  KEY `idx_areas_parent` (`parent_id`),
  KEY `idx_areas_type` (`type`),
  KEY `idx_areas_active` (`is_active`),
  CONSTRAINT `fk_areas_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_areas_parent` FOREIGN KEY (`parent_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_areas_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add some example data for testing (using existing tenant_id 468 and user_id 621)
INSERT INTO `areas` (`tenant_id`, `name`, `description`, `type`, `capacity`, `created_by`) VALUES
(468, 'Hauptgebäude', 'Verwaltungsgebäude mit Büros und Empfang', 'building', 200, 621),
(468, 'Lager Nord', 'Hauptlagerbereich für Rohstoffe', 'warehouse', 50, 621),
(468, 'Lager Süd', 'Fertigwarenlager', 'warehouse', 40, 621),
(468, 'Produktionshalle A', 'Hauptproduktionsbereich', 'production', 100, 621),
(468, 'Produktionshalle B', 'Sekundäre Produktion und Verpackung', 'production', 80, 621),
(468, 'Büro Erdgeschoss', 'Verwaltungsbüros', 'office', 30, 621),
(468, 'Büro 1. Stock', 'Management und IT', 'office', 25, 621),
(468, 'Außenbereich', 'Parkplätze und Lieferzone', 'outdoor', NULL, 621);

-- Set parent relationships (Büros are part of Hauptgebäude)
UPDATE `areas` SET `parent_id` = (SELECT id FROM (SELECT id FROM areas WHERE name = 'Hauptgebäude' AND tenant_id = 468) AS tmp) 
WHERE name IN ('Büro Erdgeschoss', 'Büro 1. Stock') AND tenant_id = 468;