mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.42, for Linux (x86_64)
--
-- Host: localhost    Database: global
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
-- Table structure for table `kvp_categories`
--

DROP TABLE IF EXISTS `kvp_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kvp_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#3498db',
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ðŸ’¡',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kvp_categories`
--

LOCK TABLES `kvp_categories` WRITE;
/*!40000 ALTER TABLE `kvp_categories` DISABLE KEYS */;
INSERT INTO `kvp_categories` VALUES (1,'Sicherheit','Verbesserungen zur Arbeitssicherheit','#e74c3c','🛡️','2025-11-13 22:07:17'),(2,'Effizienz','Prozessoptimierungen und Zeitersparnis','#2ecc71','⚡','2025-11-13 22:07:17'),(3,'Qualität','Qualitätsverbesserungen und Fehlervermeidung','#3498db','⭐','2025-11-13 22:07:17'),(4,'Umwelt','Umweltfreundliche Verbesserungen','#27ae60','🌱','2025-11-13 22:07:17'),(5,'Ergonomie','Arbeitsplatzverbesserungen','#9b59b6','💤','2025-11-13 22:07:17'),(6,'Kosteneinsparung','Maßnahmen zur Kostenreduzierung','#f39c12','💰','2025-11-13 22:07:17');
/*!40000 ALTER TABLE `kvp_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `machine_categories`
--

DROP TABLE IF EXISTS `machine_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `machine_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `machine_categories`
--

LOCK TABLES `machine_categories` WRITE;
/*!40000 ALTER TABLE `machine_categories` DISABLE KEYS */;
INSERT INTO `machine_categories` VALUES (1,'CNC-Maschinen','Computer Numerical Control Maschinen','fa-cogs',1,1),(2,'Spritzgussmaschinen','Kunststoff-Spritzgussmaschinen','fa-industry',2,1),(3,'Pressen','Hydraulische und mechanische Pressen','fa-compress',3,1),(4,'SchweiÃŸanlagen','Verschiedene SchweiÃŸtechnologien','fa-fire',4,1),(5,'MessgerÃ¤te','QualitÃ¤tskontrolle und Messtechnik','fa-ruler',5,1),(6,'Verpackungsmaschinen','Verpackung und Etikettierung','fa-box',6,1),(7,'FÃ¶rdertechnik','TransportbÃ¤nder und FÃ¶rdersysteme','fa-truck',7,1),(8,'Kompressoren','Druckluft und Vakuumsysteme','fa-wind',8,1),(9,'KÃ¼hlanlagen','Klimatisierung und KÃ¼hlung','fa-snowflake',9,1),(10,'Sonstige','Andere Maschinentypen','fa-wrench',10,1),(11,'Test Category','Test Category Description','fa-test',99,1);
/*!40000 ALTER TABLE `machine_categories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-30 16:36:39
