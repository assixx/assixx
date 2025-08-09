-- =====================================================
-- Migration: Split ambiguous org_id into department_id and team_id
-- Date: 2025-08-08
-- Author: System
-- CRITICAL: Fixes org_id ambiguity issue
-- =====================================================

-- WICHTIG: Vor Ausführung ein Backup machen!
-- bash scripts/quick-backup.sh "before_calendar_orgsplit_$(date +%Y%m%d_%H%M%S)"

-- =====================================================
-- SCHRITT 1: Prüfe ob Spalten bereits existieren
-- =====================================================

SET @dept_col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND COLUMN_NAME = 'department_id'
);

SET @team_col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND COLUMN_NAME = 'team_id'
);

-- Wenn beide Spalten existieren, Migration abbrechen
SET @sql = IF(@dept_col_exists > 0 AND @team_col_exists > 0,
    'SELECT "WARNUNG: department_id und team_id existieren bereits - Migration übersprungen" AS status',
    'SELECT "Migration wird ausgeführt..." AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 2: Füge neue Spalten hinzu
-- =====================================================

-- department_id hinzufügen
SET @sql = IF(@dept_col_exists = 0,
    'ALTER TABLE calendar_events ADD COLUMN department_id INT NULL AFTER org_level',
    'SELECT "department_id existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- team_id hinzufügen
SET @sql = IF(@team_col_exists = 0,
    'ALTER TABLE calendar_events ADD COLUMN team_id INT NULL AFTER department_id',
    'SELECT "team_id existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- allow_attendees hinzufügen
SET @allow_col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND COLUMN_NAME = 'allow_attendees'
);

SET @sql = IF(@allow_col_exists = 0,
    'ALTER TABLE calendar_events ADD COLUMN allow_attendees BOOLEAN DEFAULT TRUE',
    'SELECT "allow_attendees existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- created_by_role hinzufügen
SET @role_col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND COLUMN_NAME = 'created_by_role'
);

SET @sql = IF(@role_col_exists = 0,
    'ALTER TABLE calendar_events ADD COLUMN created_by_role ENUM("admin","lead","user") DEFAULT "user"',
    'SELECT "created_by_role existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 3: Migriere existierende Daten von org_id
-- =====================================================

-- Prüfe ob org_id existiert (alte Struktur)
SET @org_id_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND COLUMN_NAME = 'org_id'
);

-- Department Events migrieren
SET @sql = IF(@org_id_exists > 0 AND @dept_col_exists = 0,
    'UPDATE calendar_events 
     SET department_id = org_id 
     WHERE org_level = "department" 
     AND department_id IS NULL',
    'SELECT "Keine department Migration nötig" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Team Events migrieren (Teams gehören zu Departments!)
SET @sql = IF(@org_id_exists > 0 AND @team_col_exists = 0,
    'UPDATE calendar_events e
     INNER JOIN teams t ON e.org_id = t.id
     SET e.team_id = e.org_id,
         e.department_id = t.department_id
     WHERE e.org_level = "team" 
     AND e.team_id IS NULL',
    'SELECT "Keine team Migration nötig" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 4: Foreign Key Constraints hinzufügen
-- =====================================================

-- FK für department_id
SET @fk_dept_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'calendar_events'
    AND COLUMN_NAME = 'department_id'
    AND REFERENCED_TABLE_NAME = 'departments'
);

SET @sql = IF(@fk_dept_exists = 0 AND @dept_col_exists = 0,
    'ALTER TABLE calendar_events 
     ADD CONSTRAINT fk_calendar_events_department 
     FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
    'SELECT "FK für department_id existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK für team_id
SET @fk_team_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'calendar_events'
    AND COLUMN_NAME = 'team_id'
    AND REFERENCED_TABLE_NAME = 'teams'
);

SET @sql = IF(@fk_team_exists = 0 AND @team_col_exists = 0,
    'ALTER TABLE calendar_events 
     ADD CONSTRAINT fk_calendar_events_team 
     FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL',
    'SELECT "FK für team_id existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 5: Performance Indexes
-- =====================================================

-- Index für Filter-Queries
SET @idx_filter_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND INDEX_NAME = 'idx_calendar_filter_optimized'
);

SET @sql = IF(@idx_filter_exists = 0,
    'CREATE INDEX idx_calendar_filter_optimized 
     ON calendar_events(tenant_id, start_date, end_date, org_level)',
    'SELECT "Index idx_calendar_filter_optimized existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für Department-Filter
SET @idx_dept_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND INDEX_NAME = 'idx_calendar_department'
);

SET @sql = IF(@idx_dept_exists = 0,
    'CREATE INDEX idx_calendar_department 
     ON calendar_events(tenant_id, department_id, start_date)',
    'SELECT "Index idx_calendar_department existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für Team-Filter
SET @idx_team_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND INDEX_NAME = 'idx_calendar_team'
);

SET @sql = IF(@idx_team_exists = 0,
    'CREATE INDEX idx_calendar_team 
     ON calendar_events(tenant_id, team_id, start_date)',
    'SELECT "Index idx_calendar_team existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 6: Verifikation
-- =====================================================

-- Zeige finale Struktur
SELECT 
    'Verifikation: calendar_events Struktur' AS check_type,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'calendar_events'
AND COLUMN_NAME IN ('id', 'tenant_id', 'org_level', 'department_id', 'team_id', 'allow_attendees', 'created_by_role')
ORDER BY ORDINAL_POSITION;

-- Daten-Konsistenz prüfen
SELECT 
    'Daten-Konsistenz Check' AS check_type,
    org_level,
    COUNT(*) as count,
    SUM(CASE WHEN org_level = 'department' AND department_id IS NULL THEN 1 ELSE 0 END) as missing_dept_id,
    SUM(CASE WHEN org_level = 'team' AND team_id IS NULL THEN 1 ELSE 0 END) as missing_team_id,
    SUM(CASE WHEN org_level = 'team' AND department_id IS NULL THEN 1 ELSE 0 END) as team_missing_dept
FROM calendar_events
GROUP BY org_level;

-- =====================================================
-- SCHRITT 7: WICHTIGE WARNUNG
-- =====================================================

SELECT 
    'WARNUNG' AS message,
    'Die org_id Spalte wurde NICHT automatisch entfernt!' AS detail,
    'Führe nach Verifikation aus: ALTER TABLE calendar_events DROP COLUMN org_id' AS action;

-- =====================================================
-- ABSCHLUSS: Status Report
-- =====================================================

SELECT 
    'Migration Abgeschlossen' AS status,
    NOW() AS completed_at,
    (SELECT COUNT(*) FROM calendar_events) AS total_events,
    (SELECT COUNT(*) FROM calendar_events WHERE department_id IS NOT NULL) AS events_with_dept,
    (SELECT COUNT(*) FROM calendar_events WHERE team_id IS NOT NULL) AS events_with_team;