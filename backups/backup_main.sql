mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: localhost    Database: main
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `absences`
--

DROP TABLE IF EXISTS `absences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `absences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `type` enum('vacation','sick','training','other') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` text,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_dates` (`start_date`,`end_date`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  CONSTRAINT `absences_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `absences_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `absences_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `absences`
--

LOCK TABLES `absences` WRITE;
/*!40000 ALTER TABLE `absences` DISABLE KEYS */;
/*!40000 ALTER TABLE `absences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tenant_id` (`tenant_id`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_activity_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_area_permissions`
--

DROP TABLE IF EXISTS `admin_area_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_area_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `admin_user_id` int NOT NULL,
  `area_id` int NOT NULL,
  `can_read` tinyint(1) NOT NULL DEFAULT '1',
  `can_write` tinyint(1) NOT NULL DEFAULT '0',
  `can_delete` tinyint(1) NOT NULL DEFAULT '0',
  `assigned_by` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_area_tenant` (`admin_user_id`,`area_id`,`tenant_id`),
  KEY `fk_uap_area` (`area_id`),
  KEY `fk_uap_assigned_by` (`assigned_by`),
  KEY `idx_uap_tenant_user` (`tenant_id`,`admin_user_id`),
  KEY `idx_uap_tenant_area` (`tenant_id`,`area_id`),
  KEY `idx_admin_area_permissions_admin` (`admin_user_id`),
  CONSTRAINT `fk_uap_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uap_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_uap_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uap_user` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_area_permissions`
--

LOCK TABLES `admin_area_permissions` WRITE;
/*!40000 ALTER TABLE `admin_area_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_area_permissions` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`localhost`*/ /*!50003 TRIGGER `trg_admin_area_permissions_role_check` BEFORE INSERT ON `admin_area_permissions` FOR EACH ROW BEGIN
  DECLARE user_role VARCHAR(20);
  SELECT role INTO user_role FROM users WHERE id = NEW.admin_user_id;
  IF user_role IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_area_permissions: User not found';
  ELSEIF user_role != 'admin' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_area_permissions: Only admins can have area permissions';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `admin_department_permissions`
--

DROP TABLE IF EXISTS `admin_department_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_department_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `admin_user_id` int NOT NULL,
  `department_id` int NOT NULL,
  `can_read` tinyint(1) DEFAULT '1',
  `can_write` tinyint(1) DEFAULT '0',
  `can_delete` tinyint(1) DEFAULT '0',
  `assigned_by` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_admin_dept` (`tenant_id`,`admin_user_id`,`department_id`),
  KEY `department_id` (`department_id`),
  KEY `assigned_by` (`assigned_by`),
  KEY `idx_admin_permissions` (`admin_user_id`,`tenant_id`),
  CONSTRAINT `admin_department_permissions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_department_permissions_ibfk_2` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_department_permissions_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_department_permissions_ibfk_4` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=96 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_department_permissions`
--

LOCK TABLES `admin_department_permissions` WRITE;
/*!40000 ALTER TABLE `admin_department_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_department_permissions` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`localhost`*/ /*!50003 TRIGGER `trg_admin_dept_permissions_role_check` BEFORE INSERT ON `admin_department_permissions` FOR EACH ROW BEGIN
  DECLARE user_role VARCHAR(20);
  SELECT role INTO user_role FROM users WHERE id = NEW.admin_user_id;
  IF user_role IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_department_permissions: User not found';
  ELSEIF user_role != 'admin' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'admin_department_permissions: Only admins can have department permissions';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `admin_logs`
--

DROP TABLE IF EXISTS `admin_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_action` (`user_id`,`action`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `admin_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_logs`
--

LOCK TABLES `admin_logs` WRITE;
/*!40000 ALTER TABLE `admin_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_permission_logs`
--

DROP TABLE IF EXISTS `admin_permission_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_permission_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_user_id` int NOT NULL,
  `target_id` int NOT NULL,
  `target_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` int NOT NULL,
  `old_permissions` json DEFAULT NULL,
  `new_permissions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_permission_logs` (`admin_user_id`,`created_at`),
  CONSTRAINT `admin_permission_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_permission_logs_ibfk_2` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_permission_logs_ibfk_3` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_permission_logs`
--

LOCK TABLES `admin_permission_logs` WRITE;
/*!40000 ALTER TABLE `admin_permission_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_permission_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_keys`
--

DROP TABLE IF EXISTS `api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `key_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `last_used` timestamp NULL DEFAULT NULL,
  `deactivated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_key_hash` (`key_hash`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_active` (`active`),
  CONSTRAINT `api_keys_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `api_keys_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_keys`
--

LOCK TABLES `api_keys` WRITE;
/*!40000 ALTER TABLE `api_keys` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_logs`
--

DROP TABLE IF EXISTS `api_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `method` varchar(10) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `status_code` int DEFAULT NULL,
  `request_body` text,
  `response_time_ms` int DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_endpoint` (`endpoint`),
  KEY `idx_status_code` (`status_code`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `api_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_api_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_logs`
--

LOCK TABLES `api_logs` WRITE;
/*!40000 ALTER TABLE `api_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `archived_tenant_invoices`
--

DROP TABLE IF EXISTS `archived_tenant_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `archived_tenant_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `original_tenant_id` int NOT NULL,
  `tenant_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_tax_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_data` json NOT NULL,
  `invoice_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_date` date DEFAULT NULL,
  `invoice_amount` decimal(10,2) DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `delete_after` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_original_tenant` (`original_tenant_id`),
  KEY `idx_invoice_number` (`invoice_number`),
  KEY `idx_delete_after` (`delete_after`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archived_tenant_invoices`
--

LOCK TABLES `archived_tenant_invoices` WRITE;
/*!40000 ALTER TABLE `archived_tenant_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `archived_tenant_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `areas`
--

DROP TABLE IF EXISTS `areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `area_lead_id` int DEFAULT NULL,
  `type` enum('building','warehouse','office','production','outdoor','other') NOT NULL DEFAULT 'other',
  `capacity` int DEFAULT NULL COMMENT 'Maximum number of people',
  `address` text COMMENT 'Physical address if applicable',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_areas_tenant` (`tenant_id`),
  KEY `idx_areas_type` (`type`),
  KEY `idx_areas_active` (`is_active`),
  KEY `fk_areas_created_by` (`created_by`),
  KEY `idx_areas_is_archived` (`is_archived`),
  KEY `idx_area_lead_id` (`area_lead_id`),
  CONSTRAINT `fk_areas_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_areas_lead` FOREIGN KEY (`area_lead_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_areas_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Physical locations/areas (e.g., buildings, halls, warehouses)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areas`
--

LOCK TABLES `areas` WRITE;
/*!40000 ALTER TABLE `areas` DISABLE KEYS */;
/*!40000 ALTER TABLE `areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_trail`
--

DROP TABLE IF EXISTS `audit_trail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_trail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `user_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_id` int DEFAULT NULL,
  `resource_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changes` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `status` enum('success','failure') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_resource` (`resource_type`,`resource_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  KEY `audit_trail_user_fk` (`user_id`),
  CONSTRAINT `audit_trail_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `audit_trail_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=275 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_trail`
--

LOCK TABLES `audit_trail` WRITE;
/*!40000 ALTER TABLE `audit_trail` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_trail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backup_retention_policy`
--

DROP TABLE IF EXISTS `backup_retention_policy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_retention_policy` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int DEFAULT NULL,
  `backup_type` enum('daily','weekly','monthly','deletion','final') COLLATE utf8mb4_unicode_ci DEFAULT 'deletion',
  `backup_file` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `backup_size` bigint DEFAULT NULL,
  `retention_days` int DEFAULT '90',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp GENERATED ALWAYS AS ((`created_at` + interval `retention_days` day)) STORED NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_backup_type` (`backup_type`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backup_retention_policy`
--

LOCK TABLES `backup_retention_policy` WRITE;
/*!40000 ALTER TABLE `backup_retention_policy` DISABLE KEYS */;
/*!40000 ALTER TABLE `backup_retention_policy` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blackboard_comments`
--

DROP TABLE IF EXISTS `blackboard_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blackboard_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `entry_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_internal` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_blackboard_comments_entry_id` (`entry_id`),
  KEY `idx_blackboard_comments_user_id` (`user_id`),
  KEY `idx_blackboard_comments_tenant_id` (`tenant_id`),
  KEY `idx_blackboard_comments_tenant_entry` (`tenant_id`,`entry_id`),
  KEY `idx_blackboard_comments_created_at` (`created_at`),
  CONSTRAINT `fk_blackboard_comments_entry` FOREIGN KEY (`entry_id`) REFERENCES `blackboard_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blackboard_comments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blackboard_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blackboard_comments`
--

LOCK TABLES `blackboard_comments` WRITE;
/*!40000 ALTER TABLE `blackboard_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `blackboard_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blackboard_confirmations`
--

DROP TABLE IF EXISTS `blackboard_confirmations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blackboard_confirmations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `entry_id` int NOT NULL,
  `user_id` int NOT NULL,
  `confirmed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_confirmation` (`entry_id`,`user_id`,`tenant_id`),
  KEY `idx_entry_id` (`entry_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_blackboard_confirmations_tenant_id` (`tenant_id`),
  CONSTRAINT `blackboard_confirmations_ibfk_1` FOREIGN KEY (`entry_id`) REFERENCES `blackboard_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `blackboard_confirmations_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blackboard_confirmations_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=247 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blackboard_confirmations`
--

LOCK TABLES `blackboard_confirmations` WRITE;
/*!40000 ALTER TABLE `blackboard_confirmations` DISABLE KEYS */;
/*!40000 ALTER TABLE `blackboard_confirmations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blackboard_entries`
--

DROP TABLE IF EXISTS `blackboard_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blackboard_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) DEFAULT NULL,
  `tenant_id` int NOT NULL,
  `org_level` enum('company','department','team','area') DEFAULT 'company' COMMENT 'Legacy: Use blackboard_entry_organizations for multi-org. NULL = company-wide',
  `org_id` int DEFAULT NULL COMMENT 'Legacy: Use blackboard_entry_organizations for multi-org',
  `area_id` int DEFAULT NULL,
  `author_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `color` varchar(20) DEFAULT 'blue',
  `category` varchar(50) DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT '0',
  `views` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `status` enum('active','archived') DEFAULT 'active',
  `requires_confirmation` tinyint(1) DEFAULT '0',
  `attachment_count` int DEFAULT '0',
  `attachment_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `uuid_created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uuid` (`uuid`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_author_id` (`author_id`),
  KEY `idx_priority` (`priority`),
  KEY `idx_valid_dates` (`valid_from`,`valid_until`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_is_pinned` (`is_pinned`),
  KEY `idx_org_level` (`org_level`),
  KEY `idx_org_id` (`org_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_blackboard_entries_uuid` (`uuid`),
  KEY `idx_blackboard_entries_tenant_uuid` (`tenant_id`,`uuid`),
  KEY `idx_area_id` (`area_id`),
  CONSTRAINT `blackboard_entries_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `blackboard_entries_ibfk_2` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blackboard_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6819 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blackboard_entries`
--

LOCK TABLES `blackboard_entries` WRITE;
/*!40000 ALTER TABLE `blackboard_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `blackboard_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blackboard_entry_organizations`
--

DROP TABLE IF EXISTS `blackboard_entry_organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blackboard_entry_organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_id` int NOT NULL,
  `org_type` enum('department','team','area') COLLATE utf8mb4_unicode_ci NOT NULL,
  `org_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_entry_org` (`entry_id`,`org_type`,`org_id`),
  KEY `idx_entry_id` (`entry_id`),
  KEY `idx_org_type_id` (`org_type`,`org_id`),
  KEY `idx_combined` (`entry_id`,`org_type`,`org_id`),
  CONSTRAINT `fk_blackboard_entry_org_entry` FOREIGN KEY (`entry_id`) REFERENCES `blackboard_entries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Many-to-many mapping between blackboard entries and organizations (departments/teams/areas)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blackboard_entry_organizations`
--

LOCK TABLES `blackboard_entry_organizations` WRITE;
/*!40000 ALTER TABLE `blackboard_entry_organizations` DISABLE KEYS */;
/*!40000 ALTER TABLE `blackboard_entry_organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calendar_attendees`
--

DROP TABLE IF EXISTS `calendar_attendees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `calendar_attendees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `event_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_event_user` (`event_id`,`user_id`),
  KEY `idx_event_status` (`event_id`),
  KEY `idx_tenant_attendee` (`tenant_id`,`user_id`),
  KEY `idx_tenant_event` (`tenant_id`,`event_id`),
  KEY `idx_calendar_attendees_pending` (`user_id`,`tenant_id`),
  CONSTRAINT `calendar_attendees_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_attendees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_calendar_attendees_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2391 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calendar_attendees`
--

LOCK TABLES `calendar_attendees` WRITE;
/*!40000 ALTER TABLE `calendar_attendees` DISABLE KEYS */;
/*!40000 ALTER TABLE `calendar_attendees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calendar_events`
--

DROP TABLE IF EXISTS `calendar_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `calendar_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `type` enum('meeting','training','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `status` enum('confirmed','tentative','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'confirmed',
  `is_private` tinyint(1) DEFAULT '0',
  `all_day` tinyint(1) DEFAULT '0',
  `org_level` enum('company','department','team','area','personal') COLLATE utf8mb4_unicode_ci DEFAULT 'personal' COMMENT 'Legacy: Use calendar_events_organizations for multi-org',
  `department_id` int DEFAULT NULL COMMENT 'Legacy: Use calendar_events_organizations for multi-org',
  `team_id` int DEFAULT NULL COMMENT 'Legacy: Use calendar_events_organizations for multi-org',
  `area_id` int DEFAULT NULL COMMENT 'Legacy: Use calendar_events_organizations for multi-org',
  `org_id` int DEFAULT NULL,
  `reminder_minutes` int DEFAULT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#3498db',
  `recurrence_rule` text COLLATE utf8mb4_unicode_ci,
  `parent_event_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `allow_attendees` tinyint(1) DEFAULT '1',
  `created_by_role` enum('admin','lead','user') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `uuid_created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_calendar_event_uuid` (`uuid`),
  KEY `parent_event_id` (`parent_event_id`),
  KEY `idx_org_level_id` (`org_level`,`org_id`),
  KEY `idx_user_dates` (`user_id`,`start_date`,`end_date`),
  KEY `idx_tenant_dates` (`tenant_id`,`start_date`,`end_date`),
  KEY `fk_calendar_events_department` (`department_id`),
  KEY `fk_calendar_events_team` (`team_id`),
  KEY `idx_calendar_filter_optimized` (`tenant_id`,`start_date`,`end_date`,`org_level`),
  KEY `idx_calendar_department` (`tenant_id`,`department_id`,`start_date`),
  KEY `idx_calendar_team` (`tenant_id`,`team_id`,`start_date`),
  KEY `idx_org_filter` (`tenant_id`,`org_level`,`org_id`),
  KEY `idx_calendar_requires_response` (`tenant_id`,`status`),
  KEY `idx_calendar_tenant_uuid` (`tenant_id`,`uuid`),
  KEY `idx_calendar_events_area_id` (`area_id`),
  KEY `idx_calendar_events_org_level` (`org_level`),
  CONSTRAINT `calendar_events_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `calendar_events_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `calendar_events_ibfk_3` FOREIGN KEY (`parent_event_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_calendar_events_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_calendar_events_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_calendar_events_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5606 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calendar_events`
--

LOCK TABLES `calendar_events` WRITE;
/*!40000 ALTER TABLE `calendar_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `calendar_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calendar_events_organizations`
--

DROP TABLE IF EXISTS `calendar_events_organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `calendar_events_organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `org_type` enum('department','team','area') COLLATE utf8mb4_unicode_ci NOT NULL,
  `org_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_event_org` (`event_id`,`org_type`,`org_id`),
  KEY `idx_event_id` (`event_id`),
  KEY `idx_org_type_id` (`org_type`,`org_id`),
  KEY `idx_combined` (`event_id`,`org_type`,`org_id`),
  CONSTRAINT `fk_calendar_event_org_event` FOREIGN KEY (`event_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calendar_events_organizations`
--

LOCK TABLES `calendar_events_organizations` WRITE;
/*!40000 ALTER TABLE `calendar_events_organizations` DISABLE KEYS */;
/*!40000 ALTER TABLE `calendar_events_organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calendar_recurring_patterns`
--

DROP TABLE IF EXISTS `calendar_recurring_patterns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `calendar_recurring_patterns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `frequency` enum('daily','weekly','monthly','yearly') COLLATE utf8mb4_unicode_ci NOT NULL,
  `interval_value` int DEFAULT '1',
  `days_of_week` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `tenant_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_event` (`event_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `calendar_recurring_patterns_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_recurring_patterns_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calendar_recurring_patterns`
--

LOCK TABLES `calendar_recurring_patterns` WRITE;
/*!40000 ALTER TABLE `calendar_recurring_patterns` DISABLE KEYS */;
/*!40000 ALTER TABLE `calendar_recurring_patterns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_channel_members`
--

DROP TABLE IF EXISTS `chat_channel_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_channel_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('member','moderator','admin') COLLATE utf8mb4_unicode_ci DEFAULT 'member',
  `tenant_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_channel_user` (`channel_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `chat_channel_members_ibfk_1` FOREIGN KEY (`channel_id`) REFERENCES `chat_channels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_channel_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chat_channel_members_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_channel_members`
--

LOCK TABLES `chat_channel_members` WRITE;
/*!40000 ALTER TABLE `chat_channel_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_channel_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_channels`
--

DROP TABLE IF EXISTS `chat_channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_channels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` enum('public','private','direct') COLLATE utf8mb4_unicode_ci NOT NULL,
  `visibility_scope` enum('company','department','team') COLLATE utf8mb4_unicode_ci DEFAULT 'company',
  `target_id` int DEFAULT NULL,
  `created_by` int NOT NULL,
  `tenant_id` int NOT NULL,
  `is_archived` tinyint(1) DEFAULT '0',
  `archived_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `chat_channels_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `chat_channels_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_channels`
--

LOCK TABLES `chat_channels` WRITE;
/*!40000 ALTER TABLE `chat_channels` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_channels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_message_edits`
--

DROP TABLE IF EXISTS `chat_message_edits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_message_edits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `previous_content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `edited_by` int NOT NULL,
  `edited_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `message_id` (`message_id`),
  KEY `edited_by` (`edited_by`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `chat_message_edits_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_message_edits_ibfk_2` FOREIGN KEY (`edited_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chat_message_edits_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_message_edits`
--

LOCK TABLES `chat_message_edits` WRITE;
/*!40000 ALTER TABLE `chat_message_edits` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_message_edits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_message_reactions`
--

DROP TABLE IF EXISTS `chat_message_reactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_message_reactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `user_id` int NOT NULL,
  `emoji` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_message_user_emoji` (`message_id`,`user_id`,`emoji`),
  KEY `user_id` (`user_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `chat_message_reactions_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_message_reactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chat_message_reactions_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_message_reactions`
--

LOCK TABLES `chat_message_reactions` WRITE;
/*!40000 ALTER TABLE `chat_message_reactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_message_reactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_message_read_receipts`
--

DROP TABLE IF EXISTS `chat_message_read_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_message_read_receipts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `user_id` int NOT NULL,
  `channel_id` int NOT NULL,
  `read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_message_user` (`message_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `channel_id` (`channel_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `chat_message_read_receipts_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_message_read_receipts_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chat_message_read_receipts_ibfk_3` FOREIGN KEY (`channel_id`) REFERENCES `chat_channels` (`id`),
  CONSTRAINT `chat_message_read_receipts_ibfk_4` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_message_read_receipts`
--

LOCK TABLES `chat_message_read_receipts` WRITE;
/*!40000 ALTER TABLE `chat_message_read_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_message_read_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','file','system') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `reply_to_id` int DEFAULT NULL,
  `is_edited` tinyint(1) DEFAULT '0',
  `edited_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT '0',
  `tenant_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `channel_id` (`channel_id`),
  KEY `sender_id` (`sender_id`),
  KEY `reply_to_id` (`reply_to_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`channel_id`) REFERENCES `chat_channels` (`id`),
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chat_messages_ibfk_3` FOREIGN KEY (`reply_to_id`) REFERENCES `chat_messages` (`id`),
  CONSTRAINT `chat_messages_ibfk_4` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversation_participants`
--

DROP TABLE IF EXISTS `conversation_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversation_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `user_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_admin` tinyint(1) DEFAULT '0',
  `last_read_message_id` int DEFAULT NULL,
  `last_read_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_participant` (`conversation_id`,`user_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_tenant` (`tenant_id`),
  CONSTRAINT `conversation_participants_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversation_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1367 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversation_participants`
--

LOCK TABLES `conversation_participants` WRITE;
/*!40000 ALTER TABLE `conversation_participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversation_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_group` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=583 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `current_employee_availability`
--

DROP TABLE IF EXISTS `current_employee_availability`;
/*!50001 DROP VIEW IF EXISTS `current_employee_availability`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `current_employee_availability` AS SELECT 
 1 AS `employee_id`,
 1 AS `tenant_id`,
 1 AS `username`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `current_status`,
 1 AS `current_reason`,
 1 AS `available_from`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `deletion_alerts`
--

DROP TABLE IF EXISTS `deletion_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deletion_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `alert_type` enum('slack','teams','pagerduty','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('info','warning','critical') COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `sent_at` timestamp NULL DEFAULT NULL,
  `response_code` int DEFAULT NULL,
  `response_body` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `queue_id` (`queue_id`),
  KEY `idx_severity` (`severity`),
  KEY `idx_sent_status` (`sent_at`),
  CONSTRAINT `deletion_alerts_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `tenant_deletion_queue` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deletion_alerts`
--

LOCK TABLES `deletion_alerts` WRITE;
/*!40000 ALTER TABLE `deletion_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `deletion_alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deletion_audit_trail`
--

DROP TABLE IF EXISTS `deletion_audit_trail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deletion_audit_trail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `tenant_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_count` int DEFAULT '0',
  `deleted_by` int NOT NULL,
  `deleted_by_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deletion_reason` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_deleted_by` (`deleted_by`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deletion_audit_trail`
--

LOCK TABLES `deletion_audit_trail` WRITE;
/*!40000 ALTER TABLE `deletion_audit_trail` DISABLE KEYS */;
/*!40000 ALTER TABLE `deletion_audit_trail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deletion_dry_run_reports`
--

DROP TABLE IF EXISTS `deletion_dry_run_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deletion_dry_run_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `estimated_duration_seconds` int DEFAULT NULL,
  `total_affected_records` int DEFAULT NULL,
  `report_data` json DEFAULT NULL,
  `warnings` json DEFAULT NULL,
  `blockers` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `requested_by` (`requested_by`),
  KEY `idx_tenant_date` (`tenant_id`,`created_at`),
  CONSTRAINT `deletion_dry_run_reports_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `deletion_dry_run_reports_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deletion_dry_run_reports`
--

LOCK TABLES `deletion_dry_run_reports` WRITE;
/*!40000 ALTER TABLE `deletion_dry_run_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `deletion_dry_run_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deletion_partial_options`
--

DROP TABLE IF EXISTS `deletion_partial_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deletion_partial_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `option_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `included` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_queue_option` (`queue_id`,`option_name`),
  CONSTRAINT `deletion_partial_options_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `tenant_deletion_queue` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deletion_partial_options`
--

LOCK TABLES `deletion_partial_options` WRITE;
/*!40000 ALTER TABLE `deletion_partial_options` DISABLE KEYS */;
/*!40000 ALTER TABLE `deletion_partial_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `department_lead_id` int DEFAULT NULL,
  `area_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_dept_name_per_tenant` (`tenant_id`,`name`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_area_id` (`area_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_departments_is_archived` (`is_archived`),
  KEY `idx_department_lead_id` (`department_lead_id`),
  CONSTRAINT `departments_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_departments_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_departments_lead` FOREIGN KEY (`department_lead_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_departments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2823 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Organizational departments within areas';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_permissions`
--

DROP TABLE IF EXISTS `document_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `team_id` int DEFAULT NULL,
  `permission_type` enum('view','download','edit','delete') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `user_id` (`user_id`),
  KEY `department_id` (`department_id`),
  KEY `team_id` (`team_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `document_permissions_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_permissions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `document_permissions_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
  CONSTRAINT `document_permissions_ibfk_4` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`),
  CONSTRAINT `document_permissions_ibfk_5` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_permissions`
--

LOCK TABLES `document_permissions` WRITE;
/*!40000 ALTER TABLE `document_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `document_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_read_status`
--

DROP TABLE IF EXISTS `document_read_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_read_status` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `user_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_document_user_read` (`document_id`,`user_id`,`tenant_id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_user_read_status` (`user_id`,`tenant_id`),
  KEY `idx_document_read_status` (`document_id`,`tenant_id`),
  CONSTRAINT `document_read_status_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_read_status_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_read_status_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2211 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_read_status`
--

LOCK TABLES `document_read_status` WRITE;
/*!40000 ALTER TABLE `document_read_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `document_read_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_shares`
--

DROP TABLE IF EXISTS `document_shares`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_shares` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int NOT NULL,
  `owner_tenant_id` int NOT NULL,
  `shared_with_tenant_id` int NOT NULL,
  `permissions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `document_id` (`document_id`),
  KEY `idx_owner_tenant` (`owner_tenant_id`),
  KEY `idx_shared_tenant` (`shared_with_tenant_id`),
  CONSTRAINT `document_shares_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`),
  CONSTRAINT `document_shares_ibfk_2` FOREIGN KEY (`owner_tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `document_shares_ibfk_3` FOREIGN KEY (`shared_with_tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_shares`
--

LOCK TABLES `document_shares` WRITE;
/*!40000 ALTER TABLE `document_shares` DISABLE KEYS */;
/*!40000 ALTER TABLE `document_shares` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `file_uuid` varchar(36) DEFAULT NULL COMMENT 'UUID v4 for unique filename',
  `version` int DEFAULT '1' COMMENT 'Version number for file versioning',
  `parent_version_id` int DEFAULT NULL COMMENT 'Previous version ID for versioning',
  `tenant_id` int NOT NULL,
  `access_scope` enum('personal','team','department','company','payroll','blackboard') NOT NULL,
  `owner_user_id` int DEFAULT NULL COMMENT 'User who owns this document (for personal/payroll scopes)',
  `target_team_id` int DEFAULT NULL COMMENT 'Team that can access this document (for team scope)',
  `target_department_id` int DEFAULT NULL COMMENT 'Department that can access this document (for department scope)',
  `salary_year` int DEFAULT NULL COMMENT 'Year for payroll documents (e.g., 2025)',
  `salary_month` int DEFAULT NULL COMMENT 'Month for payroll documents (1-12)',
  `blackboard_entry_id` int DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL COMMENT 'Document type classification (flexible metadata)',
  `filename` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int NOT NULL,
  `file_checksum` varchar(64) DEFAULT NULL COMMENT 'SHA-256 hash for integrity verification',
  `file_content` longblob,
  `storage_type` enum('database','filesystem','s3') DEFAULT 'filesystem' COMMENT 'Where the file is stored',
  `mime_type` varchar(100) DEFAULT NULL,
  `description` text,
  `tags` json DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT '0',
  `is_archived` tinyint(1) DEFAULT '0',
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `uuid_created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_document_uuid` (`uuid`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_category` (`category`),
  KEY `idx_uploaded_at` (`uploaded_at`),
  KEY `idx_is_archived` (`is_archived`),
  KEY `idx_file_uuid` (`file_uuid`),
  KEY `idx_file_checksum` (`file_checksum`),
  KEY `idx_storage_type` (`storage_type`),
  KEY `idx_version` (`version`),
  KEY `idx_tenant_category_date` (`tenant_id`,`category`,`uploaded_at`),
  KEY `fk_documents_owner_user` (`owner_user_id`),
  KEY `fk_documents_target_team` (`target_team_id`),
  KEY `fk_documents_target_dept` (`target_department_id`),
  KEY `idx_document_tenant_uuid` (`tenant_id`,`uuid`),
  KEY `idx_documents_blackboard_entry` (`blackboard_entry_id`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documents_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_blackboard_entry` FOREIGN KEY (`blackboard_entry_id`) REFERENCES `blackboard_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_owner_user` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_documents_target_dept` FOREIGN KEY (`target_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_documents_target_team` FOREIGN KEY (`target_team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_salary_month_range` CHECK (((`salary_month` is null) or ((`salary_month` >= 1) and (`salary_month` <= 12)))),
  CONSTRAINT `chk_salary_year_range` CHECK (((`salary_year` is null) or ((`salary_year` >= 2000) and (`salary_year` <= 2100))))
) ENGINE=InnoDB AUTO_INCREMENT=1786 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_queue`
--

DROP TABLE IF EXISTS `email_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int DEFAULT NULL,
  `to_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','sending','sent','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `attempts` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_queue`
--

LOCK TABLES `email_queue` WRITE;
/*!40000 ALTER TABLE `email_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_templates`
--

DROP TABLE IF EXISTS `email_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `template_key` varchar(100) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body_html` text NOT NULL,
  `body_text` text,
  `variables` json DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_template` (`tenant_id`,`template_key`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_template_key` (`template_key`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_email_templates_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_templates`
--

LOCK TABLES `email_templates` WRITE;
/*!40000 ALTER TABLE `email_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_availability`
--

DROP TABLE IF EXISTS `employee_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `status` enum('available','unavailable','vacation','sick','training','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_availability_created_by` (`created_by`),
  KEY `idx_availability_employee` (`employee_id`),
  KEY `idx_availability_tenant` (`tenant_id`),
  KEY `idx_availability_dates` (`start_date`,`end_date`),
  KEY `idx_availability_status` (`status`),
  CONSTRAINT `fk_availability_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_availability_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_availability_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_availability_dates` CHECK ((`end_date` >= `start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_availability`
--

LOCK TABLES `employee_availability` WRITE;
/*!40000 ALTER TABLE `employee_availability` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_file_deletions`
--

DROP TABLE IF EXISTS `failed_file_deletions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_file_deletions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `file_data` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved` tinyint(1) DEFAULT '0',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `resolved_by` (`resolved_by`),
  KEY `idx_queue_id` (`queue_id`),
  KEY `idx_resolved` (`resolved`),
  CONSTRAINT `failed_file_deletions_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `tenant_deletion_queue` (`id`),
  CONSTRAINT `failed_file_deletions_ibfk_2` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_file_deletions`
--

LOCK TABLES `failed_file_deletions` WRITE;
/*!40000 ALTER TABLE `failed_file_deletions` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_file_deletions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feature_usage_logs`
--

DROP TABLE IF EXISTS `feature_usage_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feature_usage_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `feature_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_feature_id` (`feature_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `feature_usage_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feature_usage_logs_ibfk_2` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feature_usage_logs_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feature_usage_logs`
--

LOCK TABLES `feature_usage_logs` WRITE;
/*!40000 ALTER TABLE `feature_usage_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `feature_usage_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `features`
--

DROP TABLE IF EXISTS `features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `category` enum('basic','core','premium','enterprise') DEFAULT 'basic',
  `base_price` decimal(10,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `requires_setup` tinyint(1) DEFAULT '0',
  `setup_instructions` text,
  `icon` varchar(100) DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_category` (`category`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `features`
--

LOCK TABLES `features` WRITE;
/*!40000 ALTER TABLE `features` DISABLE KEYS */;
INSERT INTO `features` VALUES (1,'dashboard','Dashboard','Dashboard mit Ãœbersicht','basic',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(2,'employees','Mitarbeiterverwaltung','Mitarbeiter verwalten','core',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(3,'departments','Abteilungen','Abteilungen verwalten','core',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(4,'teams','Teams','Teams verwalten','core',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(5,'shift_planning','Schichtplanung','SchichtplÃ¤ne erstellen und verwalten','premium',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(6,'calendar','Kalender','Gemeinsamer Kalender','basic',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(7,'blackboard','Schwarzes Brett','Digitales schwarzes Brett','basic',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(8,'chat','Chat','Team-Chat Funktion','premium',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(9,'documents','Dokumente','Dokumentenverwaltung','core',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(10,'surveys','Umfragen','Umfragen erstellen und auswerten','premium',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(11,'kvp','KVP','Kontinuierlicher Verbesserungsprozess','enterprise',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05'),(12,'settings','Einstellungen','Systemeinstellungen','basic',0.00,1,0,NULL,NULL,0,'2025-07-23 09:56:05','2025-07-23 09:56:05');
/*!40000 ALTER TABLE `features` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `prevent_features_delete` BEFORE DELETE ON `features` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'PROTECTED TABLE: DELETE not allowed on features - system critical data';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `kvp_attachments`
--

DROP TABLE IF EXISTS `kvp_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_uuid` varchar(36) NOT NULL,
  `suggestion_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `file_size` int NOT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_file_uuid` (`file_uuid`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `suggestion_id` (`suggestion_id`),
  KEY `idx_suggestion_uploaded` (`suggestion_id`,`uploaded_at`),
  CONSTRAINT `kvp_attachments_ibfk_1` FOREIGN KEY (`suggestion_id`) REFERENCES `kvp_suggestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_attachments`
--

LOCK TABLES `kvp_attachments` WRITE;
/*!40000 ALTER TABLE `kvp_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kvp_comments`
--

DROP TABLE IF EXISTS `kvp_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `suggestion_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment` text NOT NULL,
  `is_internal` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `suggestion_id` (`suggestion_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_kvp_comments_tenant_id` (`tenant_id`),
  KEY `idx_kvp_comments_tenant_suggestion` (`tenant_id`,`suggestion_id`),
  CONSTRAINT `fk_kvp_comments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `kvp_comments_ibfk_1` FOREIGN KEY (`suggestion_id`) REFERENCES `kvp_suggestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=619 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_comments`
--

LOCK TABLES `kvp_comments` WRITE;
/*!40000 ALTER TABLE `kvp_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kvp_points`
--

DROP TABLE IF EXISTS `kvp_points`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_points` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `suggestion_id` int NOT NULL,
  `points` int NOT NULL,
  `reason` enum('submission','implementation','rating','bonus') NOT NULL,
  `awarded_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `awarded_by` (`awarded_by`),
  KEY `tenant_id` (`tenant_id`),
  KEY `user_id` (`user_id`),
  KEY `suggestion_id` (`suggestion_id`),
  CONSTRAINT `kvp_points_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_points_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_points_ibfk_3` FOREIGN KEY (`suggestion_id`) REFERENCES `kvp_suggestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_points_ibfk_4` FOREIGN KEY (`awarded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=231 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_points`
--

LOCK TABLES `kvp_points` WRITE;
/*!40000 ALTER TABLE `kvp_points` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_points` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kvp_ratings`
--

DROP TABLE IF EXISTS `kvp_ratings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `suggestion_id` (`suggestion_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `suggestion_id_2` (`suggestion_id`),
  CONSTRAINT `kvp_ratings_ibfk_1` FOREIGN KEY (`suggestion_id`) REFERENCES `kvp_suggestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_ratings_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_ratings_chk_1` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_ratings`
--

LOCK TABLES `kvp_ratings` WRITE;
/*!40000 ALTER TABLE `kvp_ratings` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_ratings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kvp_status_history`
--

DROP TABLE IF EXISTS `kvp_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_status_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_id` int NOT NULL,
  `old_status` enum('new','pending','in_review','approved','implemented','rejected','archived') DEFAULT NULL,
  `new_status` enum('new','pending','in_review','approved','implemented','rejected','archived') NOT NULL,
  `changed_by` int NOT NULL,
  `change_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `changed_by` (`changed_by`),
  KEY `suggestion_id` (`suggestion_id`),
  CONSTRAINT `kvp_status_history_ibfk_1` FOREIGN KEY (`suggestion_id`) REFERENCES `kvp_suggestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_status_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=161 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_status_history`
--

LOCK TABLES `kvp_status_history` WRITE;
/*!40000 ALTER TABLE `kvp_status_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kvp_suggestions`
--

DROP TABLE IF EXISTS `kvp_suggestions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_suggestions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `tenant_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `category_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `org_level` enum('company','department','area','team') NOT NULL DEFAULT 'team' COMMENT 'Organization level for visibility: company (entire tenant), department, area (physical location), or team',
  `org_id` int NOT NULL,
  `is_shared` tinyint(1) DEFAULT '0' COMMENT 'FALSE = private (only creator + team_leader), TRUE = shared to org_level/org_id',
  `submitted_by` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `status` enum('new','in_review','approved','implemented','rejected','archived') DEFAULT 'new',
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `expected_benefit` text,
  `estimated_cost` text COMMENT 'Estimated cost as free text (can include currency symbols and descriptions)',
  `actual_savings` decimal(10,2) DEFAULT NULL,
  `implementation_date` date DEFAULT NULL,
  `rejection_reason` text,
  `shared_by` int DEFAULT NULL,
  `shared_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `uuid_created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Track when UUID was generated',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_kvp_uuid` (`uuid`),
  KEY `category_id` (`category_id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `org_level` (`org_level`,`org_id`),
  KEY `status` (`status`),
  KEY `submitted_by` (`submitted_by`),
  KEY `assigned_to` (`assigned_to`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_shared_by` (`shared_by`),
  KEY `idx_visibility_query` (`tenant_id`,`org_level`,`org_id`,`status`),
  KEY `idx_kvp_team_id` (`team_id`),
  KEY `idx_kvp_tenant_uuid` (`tenant_id`,`uuid`),
  KEY `idx_is_shared` (`is_shared`),
  KEY `idx_org_level_area` (`org_level`,`org_id`,`is_shared`),
  CONSTRAINT `fk_kvp_category` FOREIGN KEY (`category_id`) REFERENCES `global`.`kvp_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_kvp_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_kvp_shared_by` FOREIGN KEY (`shared_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_kvp_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `kvp_suggestions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_suggestions_ibfk_3` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_suggestions_ibfk_4` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6994 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_suggestions`
--

LOCK TABLES `kvp_suggestions` WRITE;
/*!40000 ALTER TABLE `kvp_suggestions` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_suggestions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kvp_votes`
--

DROP TABLE IF EXISTS `kvp_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_votes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `suggestion_id` int NOT NULL,
  `user_id` int NOT NULL,
  `vote_type` enum('up','down') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_suggestion` (`user_id`,`suggestion_id`),
  KEY `suggestion_id` (`suggestion_id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `kvp_votes_ibfk_1` FOREIGN KEY (`suggestion_id`) REFERENCES `kvp_suggestions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `kvp_votes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `kvp_votes_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_votes`
--

LOCK TABLES `kvp_votes` WRITE;
/*!40000 ALTER TABLE `kvp_votes` DISABLE KEYS */;
/*!40000 ALTER TABLE `kvp_votes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `legal_holds`
--

DROP TABLE IF EXISTS `legal_holds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `legal_holds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `reason` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `case_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `released_at` timestamp NULL DEFAULT NULL,
  `released_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `released_by` (`released_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_active` (`active`),
  CONSTRAINT `legal_holds_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `legal_holds_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `legal_holds_ibfk_3` FOREIGN KEY (`released_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `legal_holds`
--

LOCK TABLES `legal_holds` WRITE;
/*!40000 ALTER TABLE `legal_holds` DISABLE KEYS */;
/*!40000 ALTER TABLE `legal_holds` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `success` tinyint(1) DEFAULT '0',
  `attempted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_username_attempts` (`username`,`attempted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=1420 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_attempts`
--

LOCK TABLES `login_attempts` WRITE;
/*!40000 ALTER TABLE `login_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_documents`
--

DROP TABLE IF EXISTS `machine_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `machine_id` int NOT NULL,
  `document_type` enum('manual','certificate','warranty','inspection_report','maintenance_report','invoice','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_machine_docs` (`machine_id`),
  KEY `idx_doc_type` (`document_type`),
  CONSTRAINT `machine_documents_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `machine_documents_ibfk_2` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `machine_documents_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_documents`
--

LOCK TABLES `machine_documents` WRITE;
/*!40000 ALTER TABLE `machine_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `machine_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_maintenance_history`
--

DROP TABLE IF EXISTS `machine_maintenance_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_maintenance_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `machine_id` int NOT NULL,
  `maintenance_type` enum('preventive','corrective','inspection','calibration','cleaning','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `performed_date` datetime NOT NULL,
  `performed_by` int DEFAULT NULL,
  `external_company` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `parts_replaced` text COLLATE utf8mb4_unicode_ci,
  `cost` decimal(10,2) DEFAULT NULL,
  `duration_hours` decimal(5,2) DEFAULT NULL,
  `status_after` enum('operational','needs_repair','decommissioned') COLLATE utf8mb4_unicode_ci DEFAULT 'operational',
  `next_maintenance_date` date DEFAULT NULL,
  `report_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `performed_by` (`performed_by`),
  KEY `created_by` (`created_by`),
  KEY `idx_machine_history` (`machine_id`),
  KEY `idx_maintenance_date` (`performed_date`),
  KEY `idx_maintenance_type` (`maintenance_type`),
  CONSTRAINT `machine_maintenance_history_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `machine_maintenance_history_ibfk_2` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `machine_maintenance_history_ibfk_3` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `machine_maintenance_history_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_maintenance_history`
--

LOCK TABLES `machine_maintenance_history` WRITE;
/*!40000 ALTER TABLE `machine_maintenance_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `machine_maintenance_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_metrics`
--

DROP TABLE IF EXISTS `machine_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_metrics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `machine_id` int NOT NULL,
  `metric_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_value` decimal(15,4) NOT NULL,
  `unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recorded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_anomaly` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_machine_metrics` (`machine_id`,`recorded_at`),
  KEY `idx_metric_type` (`metric_type`,`recorded_at`),
  KEY `idx_anomalies` (`is_anomaly`,`recorded_at`),
  CONSTRAINT `machine_metrics_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `machine_metrics_ibfk_2` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_metrics`
--

LOCK TABLES `machine_metrics` WRITE;
/*!40000 ALTER TABLE `machine_metrics` DISABLE KEYS */;
/*!40000 ALTER TABLE `machine_metrics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_teams`
--

DROP TABLE IF EXISTS `machine_teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `machine_id` int NOT NULL,
  `team_id` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `assigned_by` int DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0' COMMENT 'Main team responsible for this machine',
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_machine_team_per_tenant` (`tenant_id`,`machine_id`,`team_id`),
  KEY `idx_tenant_machine_teams` (`tenant_id`),
  KEY `idx_machine_id` (`machine_id`),
  KEY `idx_team_id` (`team_id`),
  KEY `idx_assigned_at` (`assigned_at`),
  KEY `fk_machine_teams_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_machine_teams_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_machine_teams_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_machine_teams_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_machine_teams_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Junction table: which teams work on which machines';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_teams`
--

LOCK TABLES `machine_teams` WRITE;
/*!40000 ALTER TABLE `machine_teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `machine_teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machines`
--

DROP TABLE IF EXISTS `machines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manufacturer` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `serial_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `area_id` int DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `machine_type` enum('production','packaging','quality_control','logistics','utility','other') COLLATE utf8mb4_unicode_ci DEFAULT 'production',
  `status` enum('operational','maintenance','repair','standby','decommissioned') COLLATE utf8mb4_unicode_ci DEFAULT 'operational',
  `purchase_date` date DEFAULT NULL,
  `installation_date` date DEFAULT NULL,
  `warranty_until` date DEFAULT NULL,
  `last_maintenance` date DEFAULT NULL,
  `next_maintenance` date DEFAULT NULL,
  `operating_hours` decimal(10,2) DEFAULT '0.00',
  `production_capacity` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `energy_consumption` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manual_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `serial_number` (`serial_number`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_tenant_machines` (`tenant_id`),
  KEY `idx_department_machines` (`department_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`machine_type`),
  KEY `idx_serial` (`serial_number`),
  KEY `idx_asset` (`asset_number`),
  KEY `fk_machines_area` (`area_id`),
  CONSTRAINT `fk_machines_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `machines_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `machines_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `machines_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `machines_ibfk_4` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=178 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Machines located in departments/areas';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machines`
--

LOCK TABLES `machines` WRITE;
/*!40000 ALTER TABLE `machines` DISABLE KEYS */;
/*!40000 ALTER TABLE `machines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attachment_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_size` bigint DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conversation` (`conversation_id`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_created` (`created_at`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_messages_attachment_size` (`tenant_id`,`attachment_size`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=848 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migration_log`
--

DROP TABLE IF EXISTS `migration_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migration_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `migration_name` (`migration_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migration_log`
--

LOCK TABLES `migration_log` WRITE;
/*!40000 ALTER TABLE `migration_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `migration_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_preferences`
--

DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `notification_type` varchar(50) NOT NULL,
  `email_notifications` tinyint(1) DEFAULT '1',
  `push_notifications` tinyint(1) DEFAULT '1',
  `sms_notifications` tinyint(1) DEFAULT '0',
  `preferences` json DEFAULT NULL,
  `email_enabled` tinyint(1) DEFAULT '1',
  `push_enabled` tinyint(1) DEFAULT '1',
  `in_app_enabled` tinyint(1) DEFAULT '1',
  `frequency` enum('immediate','hourly','daily','weekly') DEFAULT 'immediate',
  `quiet_hours_start` time DEFAULT NULL,
  `quiet_hours_end` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_notification_pref` (`user_id`,`notification_type`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_notification_type` (`notification_type`),
  KEY `notification_preferences_tenant_fk` (`tenant_id`),
  CONSTRAINT `notification_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notification_preferences_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_preferences`
--

LOCK TABLES `notification_preferences` WRITE;
/*!40000 ALTER TABLE `notification_preferences` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_read_status`
--

DROP TABLE IF EXISTS `notification_read_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_read_status` (
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
) ENGINE=InnoDB AUTO_INCREMENT=375 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_read_status`
--

LOCK TABLES `notification_read_status` WRITE;
/*!40000 ALTER TABLE `notification_read_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_read_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
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
  KEY `notifications_ibfk_2` (`created_by`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3590 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `oauth_tokens`
--

DROP TABLE IF EXISTS `oauth_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `token` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `revoked` tinyint(1) DEFAULT '0',
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_token` (`token`(100)),
  KEY `idx_revoked` (`revoked`),
  CONSTRAINT `oauth_tokens_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `oauth_tokens_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=890 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `oauth_tokens`
--

LOCK TABLES `oauth_tokens` WRITE;
/*!40000 ALTER TABLE `oauth_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `oauth_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token`),
  KEY `idx_user_expires` (`user_id`,`expires_at`),
  CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_history`
--

DROP TABLE IF EXISTS `payment_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `subscription_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'EUR',
  `status` enum('pending','completed','failed','refunded') DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `invoice_number` varchar(50) DEFAULT NULL,
  `invoice_url` varchar(500) DEFAULT NULL,
  `failure_reason` text,
  `paid_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_subscription_id` (`subscription_id`),
  KEY `idx_status` (`status`),
  KEY `idx_invoice_number` (`invoice_number`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `payment_history_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_history_ibfk_2` FOREIGN KEY (`subscription_id`) REFERENCES `tenant_subscriptions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_history`
--

LOCK TABLES `payment_history` WRITE;
/*!40000 ALTER TABLE `payment_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `plan_features`
--

DROP TABLE IF EXISTS `plan_features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `feature_id` int NOT NULL,
  `is_included` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_plan_feature` (`plan_id`,`feature_id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_feature_id` (`feature_id`),
  CONSTRAINT `plan_features_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plan_features_ibfk_2` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plan_features`
--

LOCK TABLES `plan_features` WRITE;
/*!40000 ALTER TABLE `plan_features` DISABLE KEYS */;
INSERT INTO `plan_features` VALUES (1,1,1,1,'2025-07-23 09:56:05'),(2,1,2,1,'2025-07-23 09:56:05'),(3,1,3,1,'2025-07-23 09:56:05'),(4,1,4,0,'2025-07-23 09:56:05'),(5,1,5,0,'2025-07-23 09:56:05'),(6,1,6,1,'2025-07-23 09:56:05'),(7,1,7,1,'2025-07-23 09:56:05'),(8,1,8,0,'2025-07-23 09:56:05'),(9,1,9,1,'2025-07-23 09:56:05'),(10,1,10,0,'2025-07-23 09:56:05'),(11,1,11,0,'2025-07-23 09:56:05'),(12,1,12,1,'2025-07-23 09:56:05'),(13,2,1,1,'2025-07-23 09:56:05'),(14,2,2,1,'2025-07-23 09:56:05'),(15,2,3,1,'2025-07-23 09:56:05'),(16,2,4,1,'2025-07-23 09:56:05'),(17,2,5,1,'2025-07-23 09:56:05'),(18,2,6,1,'2025-07-23 09:56:05'),(19,2,7,1,'2025-07-23 09:56:05'),(20,2,8,1,'2025-07-23 09:56:05'),(21,2,9,1,'2025-07-23 09:56:05'),(22,2,10,1,'2025-07-23 09:56:05'),(23,2,11,0,'2025-07-23 09:56:05'),(24,2,12,1,'2025-07-23 09:56:05'),(25,3,1,1,'2025-07-23 09:56:05'),(26,3,2,1,'2025-07-23 09:56:05'),(27,3,3,1,'2025-07-23 09:56:05'),(28,3,4,1,'2025-07-23 09:56:05'),(29,3,5,1,'2025-07-23 09:56:05'),(30,3,6,1,'2025-07-23 09:56:05'),(31,3,7,1,'2025-07-23 09:56:05'),(32,3,8,1,'2025-07-23 09:56:05'),(33,3,9,1,'2025-07-23 09:56:05'),(34,3,10,1,'2025-07-23 09:56:05'),(35,3,11,1,'2025-07-23 09:56:05'),(36,3,12,1,'2025-07-23 09:56:05');
/*!40000 ALTER TABLE `plan_features` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `prevent_plan_features_delete` BEFORE DELETE ON `plan_features` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'PROTECTED TABLE: DELETE not allowed on plan_features - system critical data';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `base_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `max_employees` int DEFAULT NULL,
  `max_admins` int DEFAULT NULL,
  `max_storage_gb` int DEFAULT '100',
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `plans`
--

LOCK TABLES `plans` WRITE;
/*!40000 ALTER TABLE `plans` DISABLE KEYS */;
INSERT INTO `plans` VALUES (1,'basic','Basic','Perfekt fÃ¼r kleine Teams und Startups',49.00,10,1,100,1,1,'2025-06-02 19:21:07','2025-06-02 19:21:07'),(2,'professional','Professional','FÃ¼r wachsende Unternehmen',149.00,50,3,500,1,2,'2025-06-02 19:21:07','2025-06-02 19:21:07'),(3,'enterprise','Enterprise','FÃ¼r groÃŸe Organisationen',299.00,NULL,NULL,1000,1,3,'2025-06-02 19:21:07','2025-06-02 19:21:07');
/*!40000 ALTER TABLE `plans` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `prevent_plans_delete` BEFORE DELETE ON `plans` FOR EACH ROW BEGIN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'PROTECTED TABLE: DELETE not allowed on plans - system critical data';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `recurring_jobs`
--

DROP TABLE IF EXISTS `recurring_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recurring_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `job_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cron_expression` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `last_run` timestamp NULL DEFAULT NULL,
  `next_run` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_active` (`active`),
  KEY `idx_next_run` (`next_run`),
  CONSTRAINT `recurring_jobs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recurring_jobs`
--

LOCK TABLES `recurring_jobs` WRITE;
/*!40000 ALTER TABLE `recurring_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `recurring_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `token_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'SHA-256 hash of the refresh token',
  `token_family` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID to track token chain for reuse detection',
  `expires_at` datetime NOT NULL,
  `is_revoked` tinyint(1) DEFAULT '0' COMMENT 'TRUE when token is invalidated',
  `used_at` datetime DEFAULT NULL COMMENT 'When token was used for refresh (for reuse detection)',
  `replaced_by_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hash of the replacement token',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'IPv4 or IPv6 address',
  `user_agent` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_refresh_tokens_hash` (`token_hash`),
  KEY `idx_refresh_tokens_user_tenant` (`user_id`,`tenant_id`),
  KEY `idx_refresh_tokens_family` (`token_family`),
  KEY `idx_refresh_tokens_expires` (`expires_at`),
  KEY `idx_refresh_tokens_revoked` (`is_revoked`),
  KEY `fk_refresh_tokens_tenant` (`tenant_id`),
  CONSTRAINT `fk_refresh_tokens_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=175 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores refresh token hashes for rotation and reuse detection';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `released_subdomains`
--

DROP TABLE IF EXISTS `released_subdomains`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `released_subdomains` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subdomain` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_tenant_id` int DEFAULT NULL,
  `original_company_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `released_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reused` tinyint(1) DEFAULT '0',
  `reused_at` timestamp NULL DEFAULT NULL,
  `new_tenant_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_subdomain` (`subdomain`),
  KEY `idx_reused` (`reused`),
  KEY `idx_released_at` (`released_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `released_subdomains`
--

LOCK TABLES `released_subdomains` WRITE;
/*!40000 ALTER TABLE `released_subdomains` DISABLE KEYS */;
/*!40000 ALTER TABLE `released_subdomains` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `root_logs`
--

DROP TABLE IF EXISTS `root_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `root_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `details` text,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `was_role_switched` tinyint(1) DEFAULT '0' COMMENT 'Indicates if the action was performed while user had switched roles',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_action` (`action`),
  KEY `idx_entity_type` (`entity_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_was_role_switched` (`was_role_switched`),
  CONSTRAINT `admin_logs_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `root_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1756 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Logs all administrative actions performed by users';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `root_logs`
--

LOCK TABLES `root_logs` WRITE;
/*!40000 ALTER TABLE `root_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `root_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scheduled_tasks`
--

DROP TABLE IF EXISTS `scheduled_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `task_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_data` json DEFAULT NULL,
  `scheduled_at` timestamp NOT NULL,
  `executed` tinyint(1) DEFAULT '0',
  `executed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_scheduled_at` (`scheduled_at`),
  KEY `idx_executed` (`executed`),
  CONSTRAINT `scheduled_tasks_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scheduled_tasks`
--

LOCK TABLES `scheduled_tasks` WRITE;
/*!40000 ALTER TABLE `scheduled_tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `scheduled_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `security_logs`
--

DROP TABLE IF EXISTS `security_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `security_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action` enum('login_success','login_failed','logout','password_reset','account_locked','suspicious_activity') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_ip_address` (`ip_address`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_security_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `security_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `security_logs`
--

LOCK TABLES `security_logs` WRITE;
/*!40000 ALTER TABLE `security_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `security_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_assignments`
--

DROP TABLE IF EXISTS `shift_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `shift_id` int NOT NULL,
  `user_id` int NOT NULL,
  `assignment_type` enum('assigned','requested','available','unavailable') DEFAULT 'assigned',
  `status` enum('pending','accepted','declined','cancelled') DEFAULT 'pending',
  `assigned_by` int DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `response_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `overtime_hours` decimal(4,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_shift_user` (`shift_id`,`user_id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_shift_type` (`shift_id`,`assignment_type`),
  KEY `idx_assigned_by` (`assigned_by`),
  CONSTRAINT `shift_assignments_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shift_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shift_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=466 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_assignments`
--

LOCK TABLES `shift_assignments` WRITE;
/*!40000 ALTER TABLE `shift_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_favorites`
--

DROP TABLE IF EXISTS `shift_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `area_id` int NOT NULL,
  `area_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department_id` int NOT NULL,
  `department_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `machine_id` int NOT NULL,
  `machine_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `team_id` int NOT NULL,
  `team_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_favorite` (`tenant_id`,`user_id`,`name`),
  KEY `fk_shift_fav_user` (`user_id`),
  KEY `fk_shift_fav_area` (`area_id`),
  KEY `fk_shift_fav_dept` (`department_id`),
  KEY `fk_shift_fav_machine` (`machine_id`),
  KEY `fk_shift_fav_team` (`team_id`),
  KEY `idx_user_favorites` (`tenant_id`,`user_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `fk_shift_fav_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shift_fav_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shift_fav_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shift_fav_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shift_fav_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shift_fav_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores user-specific favorite filter combinations for shift planning';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_favorites`
--

LOCK TABLES `shift_favorites` WRITE;
/*!40000 ALTER TABLE `shift_favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_plans`
--

DROP TABLE IF EXISTS `shift_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `tenant_id` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `shift_notes` text,
  `department_id` int DEFAULT NULL,
  `team_id` int DEFAULT NULL,
  `machine_id` int DEFAULT NULL,
  `area_id` int DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('draft','published','locked','archived') DEFAULT 'draft',
  `created_by` int NOT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `uuid_created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_shift_plan_uuid` (`uuid`),
  UNIQUE KEY `unique_shift_plan_period` (`tenant_id`,`team_id`,`start_date`,`end_date`),
  KEY `idx_tenant_dates` (`tenant_id`,`start_date`,`end_date`),
  KEY `idx_department` (`department_id`),
  KEY `idx_team` (`team_id`),
  KEY `idx_status` (`status`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_shift_plans_machine` (`machine_id`),
  KEY `idx_shift_plans_area` (`area_id`),
  KEY `idx_shift_plan_tenant_uuid` (`tenant_id`,`uuid`),
  CONSTRAINT `fk_shift_plans_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_shift_plans_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shift_plans_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shift_plans_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shift_plans_ibfk_3` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shift_plans_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shift_plans_ibfk_5` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_plans`
--

LOCK TABLES `shift_plans` WRITE;
/*!40000 ALTER TABLE `shift_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_rotation_assignments`
--

DROP TABLE IF EXISTS `shift_rotation_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_rotation_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `pattern_id` int NOT NULL,
  `user_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `shift_group` enum('F','S','N') COLLATE utf8mb4_unicode_ci NOT NULL,
  `rotation_order` int DEFAULT '0',
  `can_override` tinyint(1) DEFAULT '1',
  `override_dates` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `starts_at` date NOT NULL,
  `ends_at` date DEFAULT NULL,
  `assigned_by` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rotation_assignment` (`tenant_id`,`pattern_id`,`user_id`,`starts_at`),
  KEY `fk_rotation_assignment_assigned_by` (`assigned_by`),
  KEY `idx_rotation_assignment_tenant` (`tenant_id`),
  KEY `idx_rotation_assignment_pattern` (`pattern_id`),
  KEY `idx_rotation_assignment_user` (`user_id`),
  KEY `idx_rotation_assignment_active` (`tenant_id`,`is_active`),
  KEY `idx_rotation_assignment_dates` (`starts_at`,`ends_at`),
  KEY `idx_shift_rotation_assignments_team_id` (`team_id`),
  CONSTRAINT `fk_rotation_assignment_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rotation_assignment_pattern` FOREIGN KEY (`pattern_id`) REFERENCES `shift_rotation_patterns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_assignment_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_assignment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_assignments_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_rotation_assignments`
--

LOCK TABLES `shift_rotation_assignments` WRITE;
/*!40000 ALTER TABLE `shift_rotation_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_rotation_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_rotation_history`
--

DROP TABLE IF EXISTS `shift_rotation_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_rotation_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `pattern_id` int NOT NULL,
  `assignment_id` int NOT NULL,
  `user_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `shift_date` date NOT NULL,
  `shift_type` enum('F','S','N') COLLATE utf8mb4_unicode_ci NOT NULL,
  `week_number` int NOT NULL,
  `status` enum('generated','confirmed','modified','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'generated',
  `modified_reason` text COLLATE utf8mb4_unicode_ci,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `confirmed_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rotation_history` (`tenant_id`,`user_id`,`shift_date`),
  KEY `fk_rotation_history_assignment` (`assignment_id`),
  KEY `fk_rotation_history_confirmed_by` (`confirmed_by`),
  KEY `idx_rotation_history_tenant` (`tenant_id`),
  KEY `idx_rotation_history_date` (`shift_date`),
  KEY `idx_rotation_history_user_date` (`user_id`,`shift_date`),
  KEY `idx_rotation_history_pattern` (`pattern_id`),
  KEY `idx_shift_rotation_history_team_id` (`team_id`),
  CONSTRAINT `fk_rotation_history_assignment` FOREIGN KEY (`assignment_id`) REFERENCES `shift_rotation_assignments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_history_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rotation_history_pattern` FOREIGN KEY (`pattern_id`) REFERENCES `shift_rotation_patterns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_history_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rotation_history_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_history_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_rotation_history`
--

LOCK TABLES `shift_rotation_history` WRITE;
/*!40000 ALTER TABLE `shift_rotation_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_rotation_history` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`%`*/ /*!50003 TRIGGER `before_rotation_history_insert` BEFORE INSERT ON `shift_rotation_history` FOR EACH ROW BEGIN
      DECLARE overlap_count INT;

      SELECT COUNT(*) INTO overlap_count
      FROM shifts
      WHERE team_id = NEW.team_id
      AND date = NEW.shift_date;

      IF overlap_count > 0 THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'FEHLER: Überlappung vorhanden! Ein Eintrag für dieses Team und Datum existiert bereits in shifts.';
      END IF;
  END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`%`*/ /*!50003 TRIGGER `before_rotation_history_update` BEFORE UPDATE ON `shift_rotation_history` FOR EACH ROW BEGIN
      DECLARE overlap_count INT;

      IF NEW.team_id != OLD.team_id OR NEW.shift_date != OLD.shift_date THEN
          SELECT COUNT(*) INTO overlap_count
          FROM shifts
          WHERE team_id = NEW.team_id
          AND date = NEW.shift_date;

          IF overlap_count > 0 THEN
              SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'FEHLER: Überlappung vorhanden! Ein Eintrag für dieses Team und Datum existiert bereits in shifts.';
          END IF;
      END IF;
  END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `shift_rotation_patterns`
--

DROP TABLE IF EXISTS `shift_rotation_patterns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_rotation_patterns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `pattern_type` enum('alternate_fs','fixed_n','custom') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'alternate_fs',
  `pattern_config` json NOT NULL,
  `cycle_length_weeks` int NOT NULL DEFAULT '2',
  `starts_at` date NOT NULL,
  `ends_at` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rotation_pattern_name` (`tenant_id`,`name`),
  KEY `fk_rotation_pattern_creator` (`created_by`),
  KEY `idx_rotation_pattern_tenant` (`tenant_id`),
  KEY `idx_rotation_pattern_active` (`tenant_id`,`is_active`),
  KEY `idx_rotation_pattern_dates` (`starts_at`,`ends_at`),
  KEY `idx_shift_rotation_patterns_team_id` (`team_id`),
  CONSTRAINT `fk_rotation_pattern_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rotation_pattern_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rotation_patterns_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_rotation_patterns`
--

LOCK TABLES `shift_rotation_patterns` WRITE;
/*!40000 ALTER TABLE `shift_rotation_patterns` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_rotation_patterns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_swap_requests`
--

DROP TABLE IF EXISTS `shift_swap_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_swap_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assignment_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `requested_with` int DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approved_by` int DEFAULT NULL,
  `tenant_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `assignment_id` (`assignment_id`),
  KEY `requested_by` (`requested_by`),
  KEY `requested_with` (`requested_with`),
  KEY `approved_by` (`approved_by`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `shift_swap_requests_ibfk_1` FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments` (`id`),
  CONSTRAINT `shift_swap_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
  CONSTRAINT `shift_swap_requests_ibfk_3` FOREIGN KEY (`requested_with`) REFERENCES `users` (`id`),
  CONSTRAINT `shift_swap_requests_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `shift_swap_requests_ibfk_5` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=353 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_swap_requests`
--

LOCK TABLES `shift_swap_requests` WRITE;
/*!40000 ALTER TABLE `shift_swap_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_swap_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_templates`
--

DROP TABLE IF EXISTS `shift_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `break_minutes` int DEFAULT '0',
  `color` varchar(7) DEFAULT '#3498db',
  `is_night_shift` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `shift_templates_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=552 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_templates`
--

LOCK TABLES `shift_templates` WRITE;
/*!40000 ALTER TABLE `shift_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `area_id` int DEFAULT NULL,
  `plan_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `template_id` int DEFAULT NULL,
  `date` date NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `title` varchar(200) DEFAULT NULL,
  `required_employees` int DEFAULT '1',
  `actual_start` datetime DEFAULT NULL,
  `actual_end` datetime DEFAULT NULL,
  `break_minutes` int DEFAULT '0',
  `status` enum('planned','confirmed','in_progress','completed','cancelled') DEFAULT 'planned',
  `type` enum('regular','overtime','standby','vacation','sick','holiday','early','late','night','day','flexible','F','S','N') DEFAULT 'regular',
  `notes` text,
  `department_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `machine_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `metadata` json DEFAULT NULL COMMENT 'Flexible metadata for notes, tags, etc.',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_shift` (`user_id`,`date`,`start_time`),
  KEY `template_id` (`template_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_date` (`date`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  KEY `plan_id` (`plan_id`),
  KEY `team_id` (`team_id`),
  KEY `shifts_ibfk_6` (`department_id`),
  KEY `fk_shifts_machine` (`machine_id`),
  KEY `idx_shifts_area` (`area_id`),
  CONSTRAINT `fk_shifts_machine` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shifts_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shifts_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shifts_ibfk_3` FOREIGN KEY (`template_id`) REFERENCES `shift_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shifts_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shifts_ibfk_5` FOREIGN KEY (`plan_id`) REFERENCES `shift_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shifts_ibfk_6` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `shifts_ibfk_7` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shifts_ibfk_8` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11802 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`%`*/ /*!50003 TRIGGER `before_shifts_insert` BEFORE INSERT ON `shifts` FOR EACH ROW BEGIN
      DECLARE overlap_count INT;

      SELECT COUNT(*) INTO overlap_count
      FROM shift_rotation_history
      WHERE team_id = NEW.team_id
      AND shift_date = NEW.date;

      IF overlap_count > 0 THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'FEHLER: Überlappung vorhanden! Ein Eintrag für dieses Team und Datum existiert bereits in 
  shift_rotation_history.';
      END IF;
  END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`%`*/ /*!50003 TRIGGER `before_shifts_update` BEFORE UPDATE ON `shifts` FOR EACH ROW BEGIN
      DECLARE overlap_count INT;

      IF NEW.team_id != OLD.team_id OR NEW.date != OLD.date THEN
          SELECT COUNT(*) INTO overlap_count
          FROM shift_rotation_history
          WHERE team_id = NEW.team_id
          AND shift_date = NEW.date;

          IF overlap_count > 0 THEN
              SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'FEHLER: Überlappung vorhanden! Ein Eintrag für dieses Team und Datum existiert bereits in 
  shift_rotation_history.';
          END IF;
      END IF;
  END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `subscription_plans`
--

DROP TABLE IF EXISTS `subscription_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscription_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) NOT NULL,
  `description` text,
  `price_monthly` decimal(10,2) NOT NULL,
  `price_yearly` decimal(10,2) DEFAULT NULL,
  `max_users` int DEFAULT NULL,
  `max_storage_gb` int DEFAULT NULL,
  `features` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subscription_plans`
--

LOCK TABLES `subscription_plans` WRITE;
/*!40000 ALTER TABLE `subscription_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `subscription_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_answers`
--

DROP TABLE IF EXISTS `survey_answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `response_id` int NOT NULL,
  `question_id` int NOT NULL,
  `answer_text` text,
  `answer_options` json DEFAULT NULL,
  `answer_number` decimal(10,2) DEFAULT NULL,
  `answer_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_response_id` (`response_id`),
  KEY `idx_question_id` (`question_id`),
  KEY `idx_sa_tenant_id` (`tenant_id`),
  KEY `idx_sa_tenant_response` (`tenant_id`,`response_id`),
  CONSTRAINT `fk_survey_answers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_answers_ibfk_1` FOREIGN KEY (`response_id`) REFERENCES `survey_responses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `survey_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_answers`
--

LOCK TABLES `survey_answers` WRITE;
/*!40000 ALTER TABLE `survey_answers` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_assignments`
--

DROP TABLE IF EXISTS `survey_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `survey_id` int NOT NULL,
  `assignment_type` enum('all_users','area','department','team','user') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `department_id` int DEFAULT NULL,
  `team_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `area_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`tenant_id`,`survey_id`,`assignment_type`,`department_id`,`team_id`,`user_id`,`area_id`),
  KEY `idx_survey_id` (`survey_id`),
  KEY `idx_assignment_type` (`assignment_type`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_team_id` (`team_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_area_id` (`area_id`),
  CONSTRAINT `fk_survey_assignments_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_survey_assignments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_assignments_ibfk_1` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_assignments_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_assignments_ibfk_3` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_assignments_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=278 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_assignments`
--

LOCK TABLES `survey_assignments` WRITE;
/*!40000 ALTER TABLE `survey_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_comments`
--

DROP TABLE IF EXISTS `survey_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `survey_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment` text NOT NULL,
  `is_public` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_survey_id` (`survey_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_sc_tenant_id` (`tenant_id`),
  KEY `idx_sc_tenant_survey` (`tenant_id`,`survey_id`),
  CONSTRAINT `fk_survey_comments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_comments_ibfk_1` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_comments`
--

LOCK TABLES `survey_comments` WRITE;
/*!40000 ALTER TABLE `survey_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_participants`
--

DROP TABLE IF EXISTS `survey_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `survey_id` int NOT NULL,
  `user_id` int NOT NULL,
  `invited_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reminder_sent_at` timestamp NULL DEFAULT NULL,
  `completed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_participant` (`survey_id`,`user_id`),
  KEY `idx_survey_id` (`survey_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_completed` (`completed`),
  KEY `idx_sp_tenant_id` (`tenant_id`),
  KEY `idx_sp_tenant_survey` (`tenant_id`,`survey_id`),
  CONSTRAINT `fk_survey_participants_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_participants_ibfk_1` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_participants`
--

LOCK TABLES `survey_participants` WRITE;
/*!40000 ALTER TABLE `survey_participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_question_options`
--

DROP TABLE IF EXISTS `survey_question_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_question_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `question_id` int NOT NULL,
  `option_text` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_position` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_question_id` (`question_id`),
  KEY `idx_tenant_question` (`tenant_id`,`question_id`),
  KEY `idx_order` (`question_id`,`order_position`),
  CONSTRAINT `fk_option_question` FOREIGN KEY (`question_id`) REFERENCES `survey_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_question_options`
--

LOCK TABLES `survey_question_options` WRITE;
/*!40000 ALTER TABLE `survey_question_options` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_question_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_questions`
--

DROP TABLE IF EXISTS `survey_questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `survey_id` int NOT NULL,
  `question_text` text NOT NULL,
  `question_type` enum('single_choice','multiple_choice','text','rating','scale','yes_no','date','number') NOT NULL,
  `is_required` tinyint(1) DEFAULT '1',
  `validation_rules` json DEFAULT NULL COMMENT 'Validation rules for text/number inputs (not for choice options)',
  `order_index` int DEFAULT '0',
  `help_text` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_survey_id` (`survey_id`),
  KEY `idx_order_index` (`order_index`),
  KEY `idx_sq_tenant_id` (`tenant_id`),
  KEY `idx_sq_tenant_survey` (`tenant_id`,`survey_id`),
  CONSTRAINT `fk_survey_questions_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_questions_ibfk_1` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_questions`
--

LOCK TABLES `survey_questions` WRITE;
/*!40000 ALTER TABLE `survey_questions` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_reminders`
--

DROP TABLE IF EXISTS `survey_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `survey_id` int NOT NULL,
  `reminder_date` datetime NOT NULL,
  `message` text,
  `is_sent` tinyint(1) DEFAULT '0',
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_survey_id` (`survey_id`),
  KEY `idx_reminder_date` (`reminder_date`),
  KEY `idx_is_sent` (`is_sent`),
  KEY `idx_srem_tenant_id` (`tenant_id`),
  KEY `idx_srem_tenant_survey` (`tenant_id`,`survey_id`),
  CONSTRAINT `fk_survey_reminders_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_reminders_ibfk_1` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_reminders`
--

LOCK TABLES `survey_reminders` WRITE;
/*!40000 ALTER TABLE `survey_reminders` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_responses`
--

DROP TABLE IF EXISTS `survey_responses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_responses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `survey_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `session_id` varchar(100) DEFAULT NULL,
  `status` enum('in_progress','completed','abandoned') DEFAULT 'in_progress',
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  PRIMARY KEY (`id`),
  KEY `idx_survey_id` (`survey_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_status` (`status`),
  KEY `idx_completed_at` (`completed_at`),
  KEY `idx_sr_tenant_id` (`tenant_id`),
  KEY `idx_sr_tenant_survey` (`tenant_id`,`survey_id`),
  CONSTRAINT `fk_survey_responses_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_responses_ibfk_1` FOREIGN KEY (`survey_id`) REFERENCES `surveys` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_responses_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_responses`
--

LOCK TABLES `survey_responses` WRITE;
/*!40000 ALTER TABLE `survey_responses` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_responses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `survey_templates`
--

DROP TABLE IF EXISTS `survey_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `survey_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(50) DEFAULT NULL,
  `template_data` json NOT NULL,
  `is_public` tinyint(1) DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_category` (`category`),
  KEY `idx_is_public` (`is_public`),
  CONSTRAINT `survey_templates_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `survey_templates_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `survey_templates`
--

LOCK TABLES `survey_templates` WRITE;
/*!40000 ALTER TABLE `survey_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `survey_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `surveys`
--

DROP TABLE IF EXISTS `surveys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `surveys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `tenant_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `type` enum('feedback','satisfaction','poll','assessment','other') DEFAULT 'feedback',
  `status` enum('draft','active','paused','completed','archived') DEFAULT 'draft',
  `is_anonymous` tinyint(1) DEFAULT '0',
  `is_mandatory` tinyint(1) DEFAULT '0' COMMENT 'Whether survey completion is mandatory',
  `allow_multiple_responses` tinyint(1) DEFAULT '0',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_by` int NOT NULL,
  `notification_sent` tinyint(1) DEFAULT '0',
  `reminder_sent` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `uuid_created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_survey_uuid` (`uuid`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  KEY `idx_dates` (`start_date`,`end_date`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_survey_tenant_uuid` (`tenant_id`,`uuid`),
  CONSTRAINT `surveys_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `surveys_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2303 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Survey definitions - assignment targets now managed via survey_assignments table';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `surveys`
--

LOCK TABLES `surveys` WRITE;
/*!40000 ALTER TABLE `surveys` DISABLE KEYS */;
/*!40000 ALTER TABLE `surveys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_logs`
--

DROP TABLE IF EXISTS `system_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `level` enum('debug','info','warning','error','critical') NOT NULL,
  `category` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `context` json DEFAULT NULL,
  `stack_trace` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_level` (`level`),
  KEY `idx_category` (`category`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_logs`
--

LOCK TABLES `system_logs` WRITE;
/*!40000 ALTER TABLE `system_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `value_type` enum('string','number','boolean','json') DEFAULT 'string',
  `category` varchar(50) DEFAULT NULL,
  `description` text,
  `is_public` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `idx_category` (`category`),
  KEY `idx_is_public` (`is_public`)
) ENGINE=InnoDB AUTO_INCREMENT=93 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `department_id` int DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `team_lead_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_team_name_per_dept` (`department_id`,`name`),
  KEY `created_by` (`created_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_department_id` (`department_id`),
  KEY `idx_team_lead_id` (`team_lead_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_teams_is_archived` (`is_archived`),
  CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teams_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teams_ibfk_3` FOREIGN KEY (`team_lead_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `teams_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Teams that work in departments and operate machines';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`localhost`*/ /*!50003 TRIGGER `trg_teams_lead_role_check` BEFORE INSERT ON `teams` FOR EACH ROW BEGIN
  DECLARE user_role VARCHAR(20);
  IF NEW.team_lead_id IS NOT NULL THEN
    SELECT role INTO user_role FROM users WHERE id = NEW.team_lead_id;
    IF user_role IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: User not found';
    ELSEIF user_role NOT IN ('root', 'admin') THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: Only root or admin can be team lead';
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`localhost`*/ /*!50003 TRIGGER `trg_teams_lead_role_check_update` BEFORE UPDATE ON `teams` FOR EACH ROW BEGIN
  DECLARE user_role VARCHAR(20);
  IF NEW.team_lead_id IS NOT NULL AND (OLD.team_lead_id IS NULL OR NEW.team_lead_id != OLD.team_lead_id) THEN
    SELECT role INTO user_role FROM users WHERE id = NEW.team_lead_id;
    IF user_role IS NULL THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: User not found';
    ELSEIF user_role NOT IN ('root', 'admin') THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'teams.team_lead_id: Only root or admin can be team lead';
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `tenant_addons`
--

DROP TABLE IF EXISTS `tenant_addons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_addons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `addon_type` enum('employees','admins','storage_gb') NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) GENERATED ALWAYS AS ((`quantity` * `unit_price`)) STORED,
  `status` enum('active','cancelled') DEFAULT 'active',
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_addon` (`tenant_id`,`addon_type`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_addon_type` (`addon_type`),
  KEY `idx_status` (`status`),
  CONSTRAINT `tenant_addons_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=163 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_addons`
--

LOCK TABLES `tenant_addons` WRITE;
/*!40000 ALTER TABLE `tenant_addons` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_addons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_data_exports`
--

DROP TABLE IF EXISTS `tenant_data_exports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_data_exports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint DEFAULT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `downloaded` tinyint(1) DEFAULT '0',
  `downloaded_at` timestamp NULL DEFAULT NULL,
  `downloaded_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_downloaded` (`downloaded`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_data_exports`
--

LOCK TABLES `tenant_data_exports` WRITE;
/*!40000 ALTER TABLE `tenant_data_exports` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_data_exports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_deletion_approvals`
--

DROP TABLE IF EXISTS `tenant_deletion_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_deletion_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `approver_id` int NOT NULL,
  `action` enum('requested','approved','rejected','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_queue_action` (`queue_id`,`action`),
  KEY `idx_approver` (`approver_id`),
  CONSTRAINT `tenant_deletion_approvals_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `tenant_deletion_queue` (`id`),
  CONSTRAINT `tenant_deletion_approvals_ibfk_2` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_deletion_approvals`
--

LOCK TABLES `tenant_deletion_approvals` WRITE;
/*!40000 ALTER TABLE `tenant_deletion_approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_deletion_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_deletion_backups`
--

DROP TABLE IF EXISTS `tenant_deletion_backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_deletion_backups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `backup_file` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `backup_size` bigint DEFAULT NULL,
  `backup_type` enum('pre_deletion','final','partial') COLLATE utf8mb4_unicode_ci DEFAULT 'final',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_deletion_backups`
--

LOCK TABLES `tenant_deletion_backups` WRITE;
/*!40000 ALTER TABLE `tenant_deletion_backups` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_deletion_backups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_deletion_log`
--

DROP TABLE IF EXISTS `tenant_deletion_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_deletion_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `step_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `records_deleted` int DEFAULT '0',
  `duration_ms` int DEFAULT NULL,
  `status` enum('success','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_queue_id` (`queue_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `tenant_deletion_log_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `tenant_deletion_queue` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_deletion_log`
--

LOCK TABLES `tenant_deletion_log` WRITE;
/*!40000 ALTER TABLE `tenant_deletion_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_deletion_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_deletion_queue`
--

DROP TABLE IF EXISTS `tenant_deletion_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_deletion_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int DEFAULT NULL,
  `status` enum('queued','processing','completed','failed','pending_approval','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'queued',
  `progress` int DEFAULT '0',
  `current_step` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_steps` int DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `retry_count` int DEFAULT '0',
  `grace_period_days` int DEFAULT '30',
  `scheduled_deletion_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `approval_required` tinyint(1) DEFAULT '1',
  `second_approver_id` int DEFAULT NULL,
  `approval_requested_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `deletion_reason` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_stop` tinyint(1) DEFAULT '0',
  `emergency_stopped_at` timestamp NULL DEFAULT NULL,
  `emergency_stopped_by` int DEFAULT NULL,
  `cooling_off_hours` int DEFAULT '24',
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`),
  KEY `idx_scheduled_deletion` (`scheduled_deletion_date`),
  KEY `fk_second_approver` (`second_approver_id`),
  KEY `fk_emergency_stopped_by` (`emergency_stopped_by`),
  CONSTRAINT `fk_emergency_stopped_by` FOREIGN KEY (`emergency_stopped_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_second_approver` FOREIGN KEY (`second_approver_id`) REFERENCES `users` (`id`),
  CONSTRAINT `tenant_deletion_queue_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  CONSTRAINT `tenant_deletion_queue_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_deletion_queue`
--

LOCK TABLES `tenant_deletion_queue` WRITE;
/*!40000 ALTER TABLE `tenant_deletion_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_deletion_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_deletion_rollback`
--

DROP TABLE IF EXISTS `tenant_deletion_rollback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_deletion_rollback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `rollback_data` longtext COLLATE utf8mb4_unicode_ci,
  `can_rollback` tinyint(1) DEFAULT '1',
  `rollback_expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `rolled_back` tinyint(1) DEFAULT '0',
  `rolled_back_at` timestamp NULL DEFAULT NULL,
  `rolled_back_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rolled_back_by` (`rolled_back_by`),
  KEY `idx_queue_id` (`queue_id`),
  KEY `idx_can_rollback` (`can_rollback`),
  KEY `idx_rollback_expires_at` (`rollback_expires_at`),
  CONSTRAINT `tenant_deletion_rollback_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `tenant_deletion_queue` (`id`),
  CONSTRAINT `tenant_deletion_rollback_ibfk_2` FOREIGN KEY (`rolled_back_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_deletion_rollback`
--

LOCK TABLES `tenant_deletion_rollback` WRITE;
/*!40000 ALTER TABLE `tenant_deletion_rollback` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_deletion_rollback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_features`
--

DROP TABLE IF EXISTS `tenant_features`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_features` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `feature_id` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `activated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `activated_by` int DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `custom_config` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_feature` (`tenant_id`,`feature_id`),
  KEY `activated_by` (`activated_by`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_feature_id` (`feature_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `tenant_features_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tenant_features_ibfk_2` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tenant_features_ibfk_3` FOREIGN KEY (`activated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1702 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_features`
--

LOCK TABLES `tenant_features` WRITE;
/*!40000 ALTER TABLE `tenant_features` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_features` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_plans`
--

DROP TABLE IF EXISTS `tenant_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `status` enum('active','trial','cancelled','expired') DEFAULT 'active',
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `custom_price` decimal(10,2) DEFAULT NULL,
  `billing_cycle` enum('monthly','yearly') DEFAULT 'monthly',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `plan_id` (`plan_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `tenant_plans_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tenant_plans_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=215 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_plans`
--

LOCK TABLES `tenant_plans` WRITE;
/*!40000 ALTER TABLE `tenant_plans` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_settings`
--

DROP TABLE IF EXISTS `tenant_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `value_type` enum('string','number','boolean','json') DEFAULT 'string',
  `category` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_setting` (`tenant_id`,`setting_key`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_category` (`category`),
  CONSTRAINT `tenant_settings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_settings`
--

LOCK TABLES `tenant_settings` WRITE;
/*!40000 ALTER TABLE `tenant_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_subscriptions`
--

DROP TABLE IF EXISTS `tenant_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `plan_id` int DEFAULT NULL,
  `status` enum('active','cancelled','expired','suspended') DEFAULT 'active',
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `tenant_subscriptions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_subscriptions`
--

LOCK TABLES `tenant_subscriptions` WRITE;
/*!40000 ALTER TABLE `tenant_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_webhooks`
--

DROP TABLE IF EXISTS `tenant_webhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_webhooks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `events` json DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `secret` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_active` (`active`),
  CONSTRAINT `tenant_webhooks_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_webhooks`
--

LOCK TABLES `tenant_webhooks` WRITE;
/*!40000 ALTER TABLE `tenant_webhooks` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_webhooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) NOT NULL,
  `subdomain` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` text,
  `status` enum('trial','active','suspended','cancelled') DEFAULT 'trial',
  `trial_ends_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `settings` json DEFAULT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `current_plan` enum('basic','premium','enterprise') DEFAULT 'basic',
  `billing_email` varchar(255) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `primary_color` varchar(7) DEFAULT '#0066cc',
  `created_by` int DEFAULT NULL,
  `current_plan_id` int DEFAULT NULL,
  `deletion_status` enum('active','marked_for_deletion','suspended','deleting') DEFAULT 'active',
  `deletion_requested_at` timestamp NULL DEFAULT NULL,
  `deletion_requested_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subdomain` (`subdomain`),
  KEY `idx_subdomain` (`subdomain`),
  KEY `idx_status` (`status`),
  KEY `idx_trial_ends` (`trial_ends_at`),
  KEY `fk_tenants_created_by` (`created_by`),
  KEY `idx_current_plan` (`current_plan_id`),
  KEY `idx_deletion_status` (`deletion_status`),
  KEY `fk_deletion_requested_by` (`deletion_requested_by`),
  CONSTRAINT `fk_deletion_requested_by` FOREIGN KEY (`deletion_requested_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_tenants_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tenants_ibfk_1` FOREIGN KEY (`current_plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5641 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenants`
--

LOCK TABLES `tenants` WRITE;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usage_quotas`
--

DROP TABLE IF EXISTS `usage_quotas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usage_quotas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `resource_type` enum('users','storage','api_calls','documents','messages') NOT NULL,
  `used_amount` int DEFAULT '0',
  `limit_amount` int DEFAULT NULL,
  `reset_period` enum('daily','weekly','monthly','yearly') DEFAULT 'monthly',
  `last_reset` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_quota` (`tenant_id`,`resource_type`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_resource_type` (`resource_type`),
  CONSTRAINT `usage_quotas_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usage_quotas`
--

LOCK TABLES `usage_quotas` WRITE;
/*!40000 ALTER TABLE `usage_quotas` DISABLE KEYS */;
/*!40000 ALTER TABLE `usage_quotas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_2fa_backup_codes`
--

DROP TABLE IF EXISTS `user_2fa_backup_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_2fa_backup_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `code_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_used` (`used`),
  CONSTRAINT `user_2fa_backup_codes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_2fa_backup_codes`
--

LOCK TABLES `user_2fa_backup_codes` WRITE;
/*!40000 ALTER TABLE `user_2fa_backup_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_2fa_backup_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_2fa_secrets`
--

DROP TABLE IF EXISTS `user_2fa_secrets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_2fa_secrets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `secret` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_id` (`user_id`),
  CONSTRAINT `user_2fa_secrets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_2fa_secrets`
--

LOCK TABLES `user_2fa_secrets` WRITE;
/*!40000 ALTER TABLE `user_2fa_secrets` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_2fa_secrets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_departments`
--

DROP TABLE IF EXISTS `user_departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `department_id` int NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '1',
  `assigned_by` int DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_department_tenant` (`user_id`,`department_id`,`tenant_id`),
  KEY `fk_ud_department` (`department_id`),
  KEY `fk_ud_assigned_by` (`assigned_by`),
  KEY `idx_ud_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_ud_tenant_department` (`tenant_id`,`department_id`),
  KEY `idx_ud_primary` (`tenant_id`,`is_primary`),
  CONSTRAINT `fk_ud_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ud_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ud_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ud_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_departments`
--

LOCK TABLES `user_departments` WRITE;
/*!40000 ALTER TABLE `user_departments` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `session_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fingerprint` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `last_activity` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  KEY `idx_user_sessions_user_id` (`user_id`),
  KEY `idx_user_sessions_session_id` (`session_id`),
  KEY `idx_user_sessions_expires_at` (`expires_at`),
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=888 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `tenant_id` int NOT NULL,
  `team_id` int DEFAULT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `value_type` enum('string','number','boolean','json') DEFAULT 'string',
  `category` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_team_setting` (`user_id`,`tenant_id`,`team_id`,`setting_key`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_category` (`category`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_team_id` (`team_id`),
  KEY `idx_user_tenant_team` (`user_id`,`tenant_id`,`team_id`),
  CONSTRAINT `user_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_settings_team_fk` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_settings_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=296 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User settings with team-specific support and multi-tenant isolation';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_settings`
--

LOCK TABLES `user_settings` WRITE;
/*!40000 ALTER TABLE `user_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_teams`
--

DROP TABLE IF EXISTS `user_teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `user_id` int NOT NULL,
  `team_id` int NOT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` enum('member','lead') DEFAULT 'member',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_team` (`user_id`,`team_id`),
  KEY `idx_tenant_id` (`tenant_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_team_id` (`team_id`),
  CONSTRAINT `user_teams_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_teams_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_teams_ibfk_3` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_teams`
--

LOCK TABLES `user_teams` WRITE;
/*!40000 ALTER TABLE `user_teams` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_teams` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = latin1 */ ;
/*!50003 SET character_set_results = latin1 */ ;
/*!50003 SET collation_connection  = latin1_swedish_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`assixx_user`@`localhost`*/ /*!50003 TRIGGER `trg_user_teams_role_check` BEFORE INSERT ON `user_teams` FOR EACH ROW BEGIN
  DECLARE user_role VARCHAR(20);
  SELECT role INTO user_role FROM users WHERE id = NEW.user_id;
  IF user_role IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'user_teams: User not found';
  ELSEIF user_role != 'employee' THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'user_teams: Only employees can be assigned to teams via user_teams';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('root','admin','employee') NOT NULL DEFAULT 'employee',
  `has_full_access` tinyint(1) NOT NULL DEFAULT '0',
  `first_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `age` int DEFAULT NULL,
  `employee_id` varchar(50) DEFAULT NULL,
  `employee_number` varchar(10) NOT NULL COMMENT 'Personalnummer: Max 10 Zeichen, Buchstaben, Zahlen und Bindestrich erlaubt',
  `notes` text,
  `position` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL COMMENT 'Handynummer/Mobile (optional, can have duplicates)',
  `landline` varchar(30) DEFAULT NULL COMMENT 'Festnetznummer (optional)',
  `profile_picture` varchar(255) DEFAULT NULL,
  `address` text,
  `date_of_birth` date DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `emergency_contact` text,
  `editable_fields` json DEFAULT NULL,
  `notification_preferences` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `is_archived` tinyint(1) DEFAULT '0',
  `last_login` timestamp NULL DEFAULT NULL,
  `password_reset_token` varchar(255) DEFAULT NULL,
  `password_reset_expires` timestamp NULL DEFAULT NULL,
  `two_factor_secret` varchar(255) DEFAULT NULL,
  `two_factor_enabled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` timestamp NULL DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `availability_status` enum('available','unavailable','vacation','sick') DEFAULT 'available',
  `availability_start` date DEFAULT NULL,
  `availability_end` date DEFAULT NULL,
  `availability_notes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `idx_tenant_employee_number` (`tenant_id`,`employee_number`),
  KEY `idx_tenant_users` (`tenant_id`),
  KEY `idx_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_archived` (`is_archived`),
  KEY `idx_users_availability_status` (`availability_status`),
  KEY `idx_employee_number_search` (`employee_number`),
  KEY `idx_users_full_access` (`tenant_id`,`has_full_access`),
  CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35870 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
mysqldump: Couldn't execute 'SHOW FIELDS FROM `v_documents_with_recipients`': View 'main.v_documents_with_recipients' references invalid table(s) or column(s) or function(s) or definer/invoker of view lack rights to use them (1356)
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_active_deletions`
--

DROP TABLE IF EXISTS `v_active_deletions`;
/*!50001 DROP VIEW IF EXISTS `v_active_deletions`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_active_deletions` AS SELECT 
 1 AS `queue_id`,
 1 AS `tenant_id`,
 1 AS `company_name`,
 1 AS `status`,
 1 AS `progress`,
 1 AS `current_step`,
 1 AS `total_steps`,
 1 AS `started_at`,
 1 AS `minutes_running`,
 1 AS `created_by`,
 1 AS `created_by_name`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_documents_with_recipients`
--

DROP TABLE IF EXISTS `v_documents_with_recipients`;
