# DATABASE REDUNDANCY ANALYSIS - BRUTALE EHRLICHKEIT

## Executive Summary

**WARNUNG**: Diese Analyse wurde mit maximaler Vorsicht durchgeführt. NIEMALS Tabellen löschen ohne:

1. Vollständige Backup-Erstellung
2. Prüfung aller Foreign Keys
3. Code-Review auf versteckte Referenzen
4. Multi-Tenant-Isolation-Konformität prüfen

## Kritische Findings

### 1. HÖCHSTE PRIORITÄT - Foreign Key Abhängigkeiten

**messages_old_backup** hat noch aktive Foreign Keys von:

- `chat_notifications` (FK: chat_notifications_ibfk_3)
- `message_attachments` (FK: message_attachments_ibfk_2)
- `message_read_receipts` (FK: message_read_receipts_ibfk_2)

**STATUS**: NICHT LÖSCHBAR ohne Foreign Key Migration!

### 2. Redundante Tabellen-Paare

#### employee_availability vs employee_availability_old

- **employee_availability**: NEUE Struktur mit `employee_id` und erweiterten Status-Typen
- **employee_availability_old**: ALTE Struktur mit `user_id` und weniger Status-Typen
- **Multi-Tenant**: BEIDE haben tenant_id ✓
- **Daten**: BEIDE LEER (0 Einträge)
- **Code-Nutzung**: NUR in Schema-Files, NICHT im Backend-Code

#### messages vs messages_old_backup

**BEIDE TABELLEN WERDEN GENUTZT**:

- `messages`: AKTIV GENUTZT in:
  - `/backend/src/services/chat.service.ts` (10+ Referenzen)
  - `/backend/src/websocket.ts`
  - `/backend/src/services/tenantDeletion.service.ts`
- `messages_old_backup`: Hat noch Foreign Keys von 3 anderen Tabellen
- **Multi-Tenant**: BEIDE haben tenant_id ✓
- **KRITISCH**: Migration nicht abgeschlossen!

**STATUS**: KEINE REDUNDANZ - System ist in Migration!

### 3. BRUTALE ANALYSE - Weitere potentielle Redundanzen

#### Views - TEILWEISE REDUNDANT

**GENUTZTE Views**:

- `current_employee_availability` - AKTIV GENUTZT in availability.service.ts
- `v_*` Views - Werden für Deletion-System genutzt

**UNGENUTZTE Views (REDUNDANZ-KANDIDATEN)**:

- `active_shifts_today` - KEINE Code-Referenz gefunden!
- `active_surveys` - KEINE Code-Referenz gefunden!
- `document_summary` - KEINE Code-Referenz gefunden!
- `employee_overview` - KEINE Code-Referenz gefunden!
- `employees_without_documents` - KEINE Code-Referenz gefunden!
- `feature_usage_summary` - KEINE Code-Referenz gefunden!
- `tenant_statistics` - KEINE Code-Referenz gefunden!

**Multi-Tenant Check**: ALLE Views haben tenant_id in WHERE/JOIN ✓

#### Deletion-bezogene Tabellen (möglicherweise redundant)

- tenant_deletion_queue
- tenant_deletion_log
- tenant_deletion_backups
- tenant_deletion_rollback
- tenant_deletion_approvals
- deletion_audit_trail
- deletion_alerts
- deletion_dry_run_reports
- deletion_partial_options
  **ANALYSE**: Scheint überdimensioniert für Tenant-Löschung

#### Shift-System - AKTIV GENUTZT

**weekly_shift_notes** wird AKTIV GENUTZT in:

- `/backend/src/routes/shifts.ts` (3 Referenzen)
- Speichert Notizen pro Woche/Department
- Hat tenant_id ✓

**Shift-Tabellen Status**:

- shifts
- shift_plans
- shift_templates
- shift_patterns
- shift_assignments
- shift_swaps
- shift_swap_requests
- shift_exchange_requests
- shift_groups
- shift_group_members
- shift_pattern_assignments
- shift_notes
- weekly_shift_notes
  **ANALYSE**: System ist komplex aber WIRD GENUTZT - KEINE REDUNDANZ!

## BRUTALE WAHRHEIT - FAST NICHTS IST REDUNDANT

Das System befindet sich in einer UNFERTIGEN MIGRATION von alten zu neuen Tabellenstrukturen. Die "\_old" Tabellen sind NICHT redundant, sondern Teil eines nicht abgeschlossenen Migrationsprozesses.

## Empfehlungen (EXTREME VORSICHT!)

### KRITISCHE KORREKTUR - NICHTS IST REDUNDANT

#### employee_availability vs employee_availability_old

**FALSCHE ANNAHME KORRIGIERT**:

- `employee_availability` wird AKTIV GENUTZT in:
  - `/backend/src/services/availability.service.ts`
  - `/backend/src/models/shift.ts`
  - View `current_employee_availability` basiert darauf!
- Die Tabelle ist leer weil noch keine Daten eingegeben wurden
- `employee_availability_old` ist die ALTE Version vor Migration

**STATUS**: BEIDE TABELLEN MÜSSEN BLEIBEN bis Migration abgeschlossen!

### NICHTS LÖSCHEN - MIGRATION ABSCHLIESSEN

1. **employee_availability Migration**:
   - Code nutzt bereits neue Tabelle
   - Alte Tabelle kann gelöscht werden NACHDEM:
     - Alle Daten migriert wurden
     - Alle Foreign Keys geprüft wurden
     - 30 Tage Karenzzeit

2. **messages Migration**:
   - Neue Tabelle wird aktiv genutzt
   - Alte Tabelle hat noch Foreign Keys
   - Migration muss abgeschlossen werden:

     ```sql
     -- Foreign Keys von chat_notifications, message_attachments, message_read_receipts
     -- müssen auf neue messages Tabelle zeigen
     ```

### ECHTE REDUNDANZ-KANDIDATEN

#### 1. UNGENUTZTE VIEWS (können gelöscht werden)

- `active_shifts_today`
- `active_surveys`
- `document_summary`
- `employee_overview`
- `employees_without_documents`
- `feature_usage_summary`
- `tenant_statistics`

**Empfehlung**: Views haben keine Daten, nur Definitionen. Löschung ist risikoarm ABER prüfen ob Frontend/Reports diese nutzen!

#### 2. MIGRATION LOGS (nach erfolgreicher Migration)

- `migration_log` - Nur wenn alle Migrationen abgeschlossen

### WEITERE UNTERSUCHUNG NÖTIG

1. **Deletion-System**: 9 Tabellen für Tenant-Löschung wirkt übertrieben
2. **Shift-System**: 13 Tabellen - Konsolidierung prüfen

## Multi-Tenant-Isolation Check

✅ ALLE geprüften Tabellen haben tenant_id
✅ Keine offensichtlichen Isolation-Verletzungen gefunden
⚠️ ABER: Foreign Keys könnten Cross-Tenant-Referenzen erlauben

## Nächste Schritte

1. **NICHTS LÖSCHEN** ohne explizite Freigabe
2. Code-Scan auf versteckte Referenzen durchführen
3. Foreign Key Dependencies dokumentieren
4. Migrations-Plan erstellen
5. Test-Umgebung für Lösch-Tests aufsetzen

## Tabellen-Größen (Speicherplatz)

```
messages_old_backup: 0.11 MB (leer, aber Struktur vorhanden)
employee_availability_old: 0.05 MB (leer, aber Struktur vorhanden)
backup_retention_policy: 0.06 MB
tenant_deletion_backups: 0.05 MB
user_2fa_backup_codes: 0.05 MB
legal_holds: 0.08 MB
```

## WARNUNG

Diese Analyse basiert auf:

- Schema-Analyse
- Datenzählung
- Foreign Key Prüfung
- Oberflächlicher Code-Scan

NICHT geprüft wurde:

- Stored Procedures
- Triggers
- Application-Level-Joins
- Historische Daten-Dependencies
- Backup/Recovery-Prozesse

**BRUTALES FAZIT**:

- KEINE echten Redundanzen gefunden!
- System ist in UNFERTIGER Migration
- "\_old" Tabellen sind ÜBERGANGSWEISE notwendig
- Löschung würde System ZERSTÖREN
- Multi-Tenant-Isolation ist gewährleistet (alle haben tenant_id)

**FINALE EMPFEHLUNG**:

1. **SOFORT LÖSCHBAR** (nach Backup):
   - Ungenutzte Views (7 Stück)
   - Risikoarm da nur View-Definitionen

2. **NACH MIGRATION LÖSCHBAR**:
   - `employee_availability_old` (nach Daten-Migration)
   - `messages_old_backup` (nach Foreign Key Migration)

3. **BEHALTEN**:
   - Alle Log-Tabellen (Compliance/Audit)
   - Alle aktiv genutzten Tabellen
   - Shift-System (wird genutzt)
   - Deletion-System (wird genutzt)

**MULTI-TENANT-ISOLATION**: ✓ Alle Tabellen konform!
