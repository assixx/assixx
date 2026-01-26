-- =====================================================
-- Migration: Fix UTF-8 encoding in seed data
-- Date: 2026-01-14
-- Author: Claude
-- Issue: Data inserted with wrong encoding (UTF-8 bytes as Latin-1)
-- =====================================================

-- Fix plans table
UPDATE plans SET description = 'Perfekt für kleine Teams und Startups' WHERE id = 1;
UPDATE plans SET description = 'Für wachsende Unternehmen' WHERE id = 2;
UPDATE plans SET description = 'Für große Organisationen' WHERE id = 3;

-- Fix machine_categories table
UPDATE machine_categories SET name = 'Schweißanlagen', description = 'Verschiedene Schweißtechnologien' WHERE id = 4;
UPDATE machine_categories SET name = 'Messgeräte', description = 'Qualitätskontrolle und Messtechnik' WHERE id = 5;
UPDATE machine_categories SET name = 'Fördertechnik', description = 'Transportbänder und Fördersysteme' WHERE id = 7;
UPDATE machine_categories SET name = 'Kühlanlagen', description = 'Klimatisierung und Kühlung' WHERE id = 9;

-- Verify changes
SELECT 'plans' as tabelle, id, name, description FROM plans ORDER BY id;
SELECT 'machine_categories' as tabelle, id, name, description FROM machine_categories ORDER BY id;
