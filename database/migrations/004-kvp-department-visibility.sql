-- =====================================================
-- Migration: KVP Department-basierte Sichtbarkeit
-- Date: 2025-06-21
-- Author: Simon Öztürk & Claude AI
-- Description: Erweitert KVP-System um department-basierte Sichtbarkeit
-- =====================================================

-- WARNUNG: Diese Migration macht strukturelle Änderungen am KVP-System
-- Erstellen Sie ein Backup bevor Sie fortfahren!

-- =====================================================
-- 1. Department ID hinzufügen (falls nicht vorhanden)
-- =====================================================

-- Prüfen ob department_id bereits existiert
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'department_id'
);

-- Nur hinzufügen wenn nicht vorhanden
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE kvp_suggestions ADD COLUMN department_id INT DEFAULT NULL AFTER category_id',
    'SELECT "Column department_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Key für department_id hinzufügen (falls nicht vorhanden)
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'department_id'
    AND REFERENCED_TABLE_NAME = 'departments'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE kvp_suggestions ADD CONSTRAINT fk_kvp_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
    'SELECT "Foreign key for department_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für department_id
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND INDEX_NAME = 'idx_department_id'
);

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE kvp_suggestions ADD INDEX idx_department_id (department_id)',
    'SELECT "Index idx_department_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 2. Department ID aus Benutzer-Daten befüllen
-- =====================================================

-- Alle kvp_suggestions ohne department_id mit der Abteilung des Einreichers befüllen
UPDATE kvp_suggestions s
INNER JOIN users u ON s.submitted_by = u.id
SET s.department_id = u.department_id
WHERE s.department_id IS NULL AND u.department_id IS NOT NULL;

-- =====================================================
-- 3. Status bereinigen: 'pending' zu 'in_review' migrieren
-- =====================================================

UPDATE kvp_suggestions 
SET status = 'in_review' 
WHERE status = 'pending';

-- ENUM anpassen - 'pending' entfernen, 'new' als Default
ALTER TABLE kvp_suggestions 
MODIFY COLUMN status ENUM('new','in_review','approved','implemented','rejected','archived') DEFAULT 'new';

-- =====================================================
-- 4. Neue Spalten für Teilen-Funktion
-- =====================================================

-- shared_by Spalte hinzufügen
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'shared_by'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE kvp_suggestions ADD COLUMN shared_by INT DEFAULT NULL AFTER rejection_reason',
    'SELECT "Column shared_by already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shared_at Spalte hinzufügen
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'shared_at'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE kvp_suggestions ADD COLUMN shared_at TIMESTAMP NULL DEFAULT NULL AFTER shared_by',
    'SELECT "Column shared_at already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign Key für shared_by
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND COLUMN_NAME = 'shared_by'
    AND REFERENCED_TABLE_NAME = 'users'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE kvp_suggestions ADD CONSTRAINT fk_kvp_shared_by FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "Foreign key for shared_by already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für shared_by
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND INDEX_NAME = 'idx_shared_by'
);

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE kvp_suggestions ADD INDEX idx_shared_by (shared_by)',
    'SELECT "Index idx_shared_by already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 5. Initiale Sichtbarkeit setzen
-- =====================================================

-- Alle bestehenden KVPs auf department-level setzen (falls noch nicht gesetzt)
UPDATE kvp_suggestions 
SET org_level = 'department',
    org_id = department_id
WHERE org_level IS NULL 
   OR org_id IS NULL 
   OR org_id = 0;

-- =====================================================
-- 6. Composite Index für Performance
-- =====================================================

-- Index für Sichtbarkeits-Queries
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'kvp_suggestions'
    AND INDEX_NAME = 'idx_visibility_query'
);

SET @sql = IF(@idx_exists = 0,
    'ALTER TABLE kvp_suggestions ADD INDEX idx_visibility_query (tenant_id, org_level, org_id, status)',
    'SELECT "Index idx_visibility_query already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 7. Admin Logging für Audit Trail
-- =====================================================

-- Erstelle admin_logs Tabelle falls nicht vorhanden
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    admin_user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT DEFAULT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_admin_user_id (admin_user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 8. Verifizierung der Migration
-- =====================================================

-- Zeige finale Struktur
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_KEY,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'kvp_suggestions'
ORDER BY ORDINAL_POSITION;

-- Zeige Anzahl der migrierten Datensätze
SELECT 
    'Total KVP Suggestions' as Description,
    COUNT(*) as Count
FROM kvp_suggestions
UNION ALL
SELECT 
    'With Department ID' as Description,
    COUNT(*) as Count
FROM kvp_suggestions
WHERE department_id IS NOT NULL
UNION ALL
SELECT 
    'Status: new' as Description,
    COUNT(*) as Count
FROM kvp_suggestions
WHERE status = 'new'
UNION ALL
SELECT 
    'Status: in_review' as Description,
    COUNT(*) as Count
FROM kvp_suggestions
WHERE status = 'in_review';

-- =====================================================
-- Migration abgeschlossen
-- =====================================================