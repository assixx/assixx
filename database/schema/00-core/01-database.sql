-- =====================================================
-- 01-database.sql - Datenbank-Erstellung
-- =====================================================
-- Erstellt die Assixx Datenbank mit korrekten Einstellungen
-- Muss als erstes ausgeführt werden
-- =====================================================

-- Datenbank erstellen wenn nicht vorhanden
CREATE DATABASE IF NOT EXISTS assixx 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Datenbank verwenden
USE assixx;

-- Charset sicherstellen
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;