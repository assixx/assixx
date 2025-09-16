-- =====================================================
-- Migration: Add Multi-Tenant Isolation to Calendar
-- Date: 2025-08-08
-- Author: System
-- CRITICAL: Adds tenant_id to calendar_attendees
-- =====================================================

-- WICHTIG: Vor Ausführung ein Backup machen!
-- bash scripts/quick-backup.sh "before_calendar_migration_$(date +%Y%m%d_%H%M%S)"

-- =====================================================
-- SCHRITT 1: Foreign Key Checks (Safety First!)
-- =====================================================

-- Prüfe ob calendar_attendees bereits tenant_id hat
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_attendees' 
    AND COLUMN_NAME = 'tenant_id'
);

-- Wenn Spalte bereits existiert, Migration abbrechen
SET @sql = IF(@col_exists > 0,
    'SELECT "WARNUNG: tenant_id existiert bereits in calendar_attendees - Migration übersprungen" AS status',
    'SELECT "Migration wird ausgeführt..." AS status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 2: Füge tenant_id Spalte hinzu (wenn nicht existiert)
-- =====================================================

-- Nur ausführen wenn Spalte nicht existiert
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE calendar_attendees ADD COLUMN tenant_id INT AFTER id',
    'SELECT "Spalte existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 3: Fülle tenant_id mit Daten aus calendar_events
-- =====================================================

-- Update nur wenn Spalte neu hinzugefügt wurde
SET @sql = IF(@col_exists = 0,
    'UPDATE calendar_attendees ca
     INNER JOIN calendar_events ce ON ca.event_id = ce.id
     SET ca.tenant_id = ce.tenant_id
     WHERE ca.tenant_id IS NULL',
    'SELECT "Update übersprungen" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 4: Setze tenant_id als NOT NULL
-- =====================================================

-- Prüfe ob noch NULL-Werte existieren
SET @null_count = (
    SELECT COUNT(*) 
    FROM calendar_attendees 
    WHERE tenant_id IS NULL
);

-- Fehlerbehandlung für NULL-Werte
SET @sql = IF(@null_count > 0,
    'SELECT CONCAT("FEHLER: ", @null_count, " Einträge haben noch NULL tenant_id!") AS error',
    IF(@col_exists = 0,
        'ALTER TABLE calendar_attendees MODIFY COLUMN tenant_id INT NOT NULL',
        'SELECT "NOT NULL bereits gesetzt" AS info'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 5: Erstelle Indexes für Performance
-- =====================================================

-- Index für tenant_id + user_id (für Attendee-Abfragen)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_attendees' 
    AND INDEX_NAME = 'idx_tenant_attendee'
);

SET @sql = IF(@idx_exists = 0 AND @col_exists = 0,
    'CREATE INDEX idx_tenant_attendee ON calendar_attendees(tenant_id, user_id)',
    'SELECT "Index idx_tenant_attendee existiert bereits oder wird nicht benötigt" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index für tenant_id + event_id (für Event-Abfragen)
SET @idx_exists2 = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_attendees' 
    AND INDEX_NAME = 'idx_tenant_event'
);

SET @sql = IF(@idx_exists2 = 0 AND @col_exists = 0,
    'CREATE INDEX idx_tenant_event ON calendar_attendees(tenant_id, event_id)',
    'SELECT "Index idx_tenant_event existiert bereits oder wird nicht benötigt" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 6: Foreign Key Constraint hinzufügen
-- =====================================================

-- Prüfe ob Foreign Key bereits existiert
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'calendar_attendees'
    AND COLUMN_NAME = 'tenant_id'
    AND REFERENCED_TABLE_NAME = 'tenants'
);

-- Füge Foreign Key hinzu wenn nicht existiert
SET @sql = IF(@fk_exists = 0 AND @col_exists = 0,
    'ALTER TABLE calendar_attendees 
     ADD CONSTRAINT fk_calendar_attendees_tenant 
     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
    'SELECT "Foreign Key existiert bereits oder wird nicht benötigt" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- SCHRITT 7: Verifikation
-- =====================================================

-- Zeige finale Struktur
SELECT 
    'Verifikation: calendar_attendees Struktur' AS check_type,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'calendar_attendees'
AND COLUMN_NAME IN ('id', 'tenant_id', 'event_id', 'user_id')
ORDER BY ORDINAL_POSITION;

-- Zeige Indexes
SELECT 
    'Verifikation: Indexes' AS check_type,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'calendar_attendees'
GROUP BY INDEX_NAME;

-- Zeige Foreign Keys
SELECT 
    'Verifikation: Foreign Keys' AS check_type,
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'calendar_attendees'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- =====================================================
-- SCHRITT 8: Optimierung calendar_events Indexes
-- =====================================================

-- Index für org_level Filter (wenn nicht existiert)
SET @idx_exists3 = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'calendar_events' 
    AND INDEX_NAME = 'idx_org_filter'
);

SET @sql = IF(@idx_exists3 = 0,
    'CREATE INDEX idx_org_filter ON calendar_events(tenant_id, org_level, org_id)',
    'SELECT "Index idx_org_filter existiert bereits" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- ABSCHLUSS: Status Report
-- =====================================================

SELECT 
    'Migration Abgeschlossen' AS status,
    NOW() AS completed_at,
    (SELECT COUNT(*) FROM calendar_attendees) AS total_attendees,
    (SELECT COUNT(DISTINCT tenant_id) FROM calendar_attendees) AS total_tenants,
    (SELECT COUNT(*) FROM calendar_events) AS total_events;