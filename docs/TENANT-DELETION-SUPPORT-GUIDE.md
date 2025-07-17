# 📋 Tenant Deletion - Support Team Guide

Version: 1.0  
Last Updated: 13.06.2025

## 📑 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Wie funktioniert die Tenant-Löschung?](#wie-funktioniert-die-tenant-löschung)
3. [Support-Anfragen bearbeiten](#support-anfragen-bearbeiten)
4. [Monitoring & Status-Prüfung](#monitoring--status-prüfung)
5. [Häufige Probleme & Lösungen](#häufige-probleme--lösungen)
6. [Notfall-Prozeduren](#notfall-prozeduren)
7. [SQL Queries für Support](#sql-queries-für-support)
8. [Kontakte & Eskalation](#kontakte--eskalation)

---

## 🎯 Übersicht

Das Tenant Deletion System ermöglicht die sichere und vollständige Löschung von Firmen-Accounts (Tenants) aus dem Assixx System. Als Support-Mitarbeiter müssen Sie:

- ✅ Löschanfragen verifizieren und bestätigen
- 📊 Den Löschprozess überwachen
- 🔧 Probleme diagnostizieren und beheben
- 📞 Kunden bei Fragen unterstützen
- ⚠️ Notfälle eskalieren

### Wichtige Fakten:

- **Grace Period**: 30 Tage (Kunde kann Löschung widerrufen)
- **Automatische Löschung**: Nach 30 Tagen läuft der Background Worker
- **Dauer**: Je nach Datenmenge 5-60 Minuten
- **DSGVO**: Daten werden vor Löschung exportiert

---

## 🔄 Wie funktioniert die Tenant-Löschung?

### 1. Löschung anfordern (Tag 0)

```
Kunde/Root-User → Klickt "Tenant löschen" → Status: marked_for_deletion
```

### 2. Grace Period (Tag 0-30)

```
30 Tage Wartezeit → Kunde kann widerrufen → Emails werden versendet
```

### 3. Automatische Löschung (Tag 31)

```
Background Worker → Löscht Schritt für Schritt → Status: completed
```

### Lösch-Phasen im Detail:

| Phase            | Status                | Beschreibung                           | Dauer    |
| ---------------- | --------------------- | -------------------------------------- | -------- |
| 1. Anfrage       | `marked_for_deletion` | Löschung eingeplant, 30 Tage Wartezeit | Sofort   |
| 2. Verarbeitung  | `suspended`           | Tenant gesperrt, Worker startet        | 1-5 Min  |
| 3. Löschvorgang  | `deleting`            | Daten werden gelöscht                  | 5-60 Min |
| 4. Abgeschlossen | `completed`           | Alle Daten gelöscht                    | -        |

---

## 📞 Support-Anfragen bearbeiten

### Anfrage: "Ich möchte meinen Tenant löschen"

**1. Verifizierung:**

```sql
-- Prüfen ob Kunde Root-User ist
SELECT u.username, u.email, u.role, t.company_name
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'kunde@email.de' AND u.role = 'root';
```

**2. Anleitung für Kunden:**

- Einloggen als Root-User
- Zu "Mein Profil" navigieren
- Ganz unten "Gefahrenzone"
- "Tenant komplett löschen" klicken
- "LÖSCHEN" eingeben und bestätigen

### Anfrage: "Ich möchte die Löschung abbrechen"

**1. Grace Period prüfen:**

```sql
-- Wie viele Tage noch übrig?
SELECT
    company_name,
    deletion_status,
    deletion_requested_at,
    DATEDIFF(DATE_ADD(deletion_requested_at, INTERVAL 30 DAY), NOW()) as days_remaining
FROM tenants
WHERE id = {TENANT_ID};
```

**2. Wenn noch Zeit (days_remaining > 0):**

- Kunde kann selbst abbrechen im Portal
- Oder Support kann manuell abbrechen (siehe unten)

**3. Wenn Grace Period abgelaufen:**

- Löschung kann NICHT mehr abgebrochen werden
- Kunde über Backup-Möglichkeiten informieren

### Anfrage: "Wie ist der Status meiner Löschung?"

```sql
-- Aktuellen Status abrufen
SELECT
    t.company_name,
    t.deletion_status,
    q.status as queue_status,
    q.progress,
    q.current_step,
    q.error_message
FROM tenants t
LEFT JOIN tenant_deletion_queue q ON t.id = q.tenant_id
WHERE t.id = {TENANT_ID}
ORDER BY q.id DESC
LIMIT 1;
```

---

## 📊 Monitoring & Status-Prüfung

### Worker Health Check

```bash
# Ist der Worker online?
curl http://localhost:3001/health

# Docker Status prüfen
docker-compose ps deletion-worker

# Worker Logs anzeigen
docker-compose logs --tail=100 deletion-worker
```

### Dashboard Queries

**Alle geplanten Löschungen:**

```sql
SELECT
    t.id,
    t.company_name,
    t.deletion_requested_at,
    DATEDIFF(DATE_ADD(t.deletion_requested_at, INTERVAL 30 DAY), NOW()) as days_remaining,
    q.status
FROM tenants t
JOIN tenant_deletion_queue q ON t.id = q.tenant_id
WHERE t.deletion_status = 'marked_for_deletion'
ORDER BY t.deletion_requested_at ASC;
```

**Aktive Löschvorgänge:**

```sql
SELECT
    t.company_name,
    q.progress,
    q.current_step,
    q.started_at,
    TIMESTAMPDIFF(MINUTE, q.started_at, NOW()) as minutes_running
FROM tenant_deletion_queue q
JOIN tenants t ON q.tenant_id = t.id
WHERE q.status = 'processing';
```

**Fehlgeschlagene Löschungen:**

```sql
SELECT
    t.company_name,
    q.error_message,
    q.retry_count,
    q.created_at
FROM tenant_deletion_queue q
JOIN tenants t ON q.tenant_id = t.id
WHERE q.status = 'failed'
ORDER BY q.created_at DESC;
```

---

## 🔧 Häufige Probleme & Lösungen

### Problem 1: "Löschung hängt bei X%"

**Diagnose:**

```sql
-- Check aktuellen Step und Logs
SELECT * FROM tenant_deletion_log
WHERE queue_id = {QUEUE_ID}
ORDER BY created_at DESC
LIMIT 10;
```

**Lösung:**

1. Worker neustarten: `docker-compose restart deletion-worker`
2. Falls immer noch hängt: Manuell auf 'failed' setzen und retry

### Problem 2: "Cannot delete - shared resources exist"

**Diagnose:**

```sql
-- Welche geteilten Ressourcen?
SELECT * FROM shared_resources WHERE tenant_id = {TENANT_ID};
```

**Lösung:**

1. Shared Resources identifizieren
2. Mit anderen Tenants klären
3. Resources manuell entfernen oder übertragen

### Problem 3: "Worker verarbeitet keine Jobs"

**Diagnose:**

```bash
# Worker Logs prüfen
docker-compose logs deletion-worker | grep ERROR

# Datenbankverbindung testen
docker-compose exec deletion-worker node -e "console.log('DB Test')"
```

**Lösung:**

1. Worker neustarten
2. MySQL/Redis Verbindung prüfen
3. Disk Space prüfen

### Problem 4: "Datenexport fehlt"

**Diagnose:**

```sql
-- Export Status prüfen
SELECT * FROM tenant_data_exports WHERE tenant_id = {TENANT_ID};
```

**Lösung:**

1. Export manuell triggern (siehe Notfall-Prozeduren)
2. Backup von gestern wiederherstellen
3. Kunde informieren

---

## 🚨 Notfall-Prozeduren

### Löschung sofort abbrechen (Emergency Stop)

```sql
-- 1. Queue Entry auf cancelled setzen
UPDATE tenant_deletion_queue
SET status = 'cancelled', error_message = 'Emergency stop by support'
WHERE tenant_id = {TENANT_ID} AND status IN ('queued', 'processing');

-- 2. Tenant Status zurücksetzen
UPDATE tenants
SET deletion_status = 'active', deletion_requested_at = NULL
WHERE id = {TENANT_ID};

-- 3. Audit Log
INSERT INTO deletion_audit_trail (tenant_id, action, details, performed_by)
VALUES ({TENANT_ID}, 'emergency_stop', 'Stopped by support', 'support_user');
```

### Manueller Datenexport

```sql
-- Trigger manual export
INSERT INTO tenant_data_exports (tenant_id, export_path, status)
VALUES ({TENANT_ID}, CONCAT('/exports/manual/', {TENANT_ID}, '_', NOW()), 'pending');
```

Dann im Terminal:

```bash
cd /home/scs/projects/Assixx
node backend/src/utils/scripts/manual-export.js {TENANT_ID}
```

### Worker hängt - Force Restart

```bash
# 1. Worker stoppen
docker-compose stop deletion-worker

# 2. Hängende Jobs resetten
mysql -u root -p main -e "
UPDATE tenant_deletion_queue
SET status = 'queued', started_at = NULL
WHERE status = 'processing'
AND TIMESTAMPDIFF(HOUR, started_at, NOW()) > 2;"

# 3. Worker neu starten
docker-compose up -d deletion-worker
```

### Rollback nach Teil-Löschung

**⚠️ NUR im absoluten Notfall!**

```sql
-- 1. Rollback Info abrufen
SELECT * FROM tenant_deletion_rollback WHERE tenant_id = {TENANT_ID};

-- 2. Tenant wiederherstellen
UPDATE tenants SET deletion_status = 'active' WHERE id = {TENANT_ID};

-- 3. Support-Ticket erstellen für manuelles Recovery
```

---

## 💾 SQL Queries für Support

### Basis-Informationen

```sql
-- Tenant Details
SELECT
    id,
    company_name,
    subdomain,
    deletion_status,
    deletion_requested_at,
    created_at
FROM tenants
WHERE company_name LIKE '%SUCHBEGRIFF%'
   OR subdomain LIKE '%SUCHBEGRIFF%';

-- User eines Tenants
SELECT
    username,
    email,
    role,
    last_login
FROM users
WHERE tenant_id = {TENANT_ID};

-- Datenvolumen prüfen
SELECT
    (SELECT COUNT(*) FROM users WHERE tenant_id = {TENANT_ID}) as users,
    (SELECT COUNT(*) FROM documents WHERE tenant_id = {TENANT_ID}) as documents,
    (SELECT COUNT(*) FROM messages WHERE sender_tenant_id = {TENANT_ID}) as messages;
```

### Lösch-Historie

```sql
-- Alle Lösch-Aktionen eines Tenants
SELECT
    q.id as queue_id,
    q.status,
    q.reason,
    q.created_at,
    q.completed_at,
    u.username as requested_by
FROM tenant_deletion_queue q
JOIN users u ON q.created_by = u.id
WHERE q.tenant_id = {TENANT_ID}
ORDER BY q.created_at DESC;

-- Detaillierte Lösch-Logs
SELECT
    step_name,
    table_name,
    records_deleted,
    status,
    error_message,
    created_at
FROM tenant_deletion_log
WHERE queue_id = {QUEUE_ID}
ORDER BY created_at;
```

### Performance Monitoring

```sql
-- Durchschnittliche Löschzeit
SELECT
    AVG(TIMESTAMPDIFF(MINUTE, started_at, completed_at)) as avg_minutes,
    MAX(TIMESTAMPDIFF(MINUTE, started_at, completed_at)) as max_minutes,
    COUNT(*) as total_deletions
FROM tenant_deletion_queue
WHERE status = 'completed'
  AND completed_at > DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Fehlerrate
SELECT
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    ROUND(COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0 / COUNT(*), 2) as error_rate
FROM tenant_deletion_queue
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

## 📞 Kontakte & Eskalation

### Level 1: Support Team

- **Zuständig für**: Basis-Anfragen, Status-Checks, Anleitungen
- **Tools**: Diese Dokumentation, SQL Queries
- **Eskalation wenn**: Technische Fehler, Datenverlust, Legal Issues

### Level 2: DevOps Team

- **Kontakt**: devops@assixx.de / Slack: #devops-emergency
- **Zuständig für**: Worker-Probleme, Performance, Infrastructure
- **Eskalation wenn**: System down, Worker crashed, DB Issues

### Level 3: Development Team

- **Kontakt**: Simon (CTO) / Slack: #dev-emergency
- **Zuständig für**: Bugs, Feature Requests, Complex Recovery
- **Eskalation wenn**: Unerwartetes Verhalten, Datenverlust

### Legal & Compliance

- **Kontakt**: legal@assixx.de
- **Zuständig für**: DSGVO-Anfragen, Legal Holds, Compliance
- **Eskalation wenn**: Behörden-Anfragen, Rechtsstreitigkeiten

---

## 📋 Checkliste für Support

### Bei jeder Lösch-Anfrage:

- [ ] Kunde-Identität verifizieren
- [ ] Root-User Status bestätigen
- [ ] Grund dokumentieren
- [ ] Grace Period erklären
- [ ] Export-Option erwähnen
- [ ] Ticket-Nummer vergeben

### Bei Problemen:

- [ ] Error Logs sammeln
- [ ] Screenshots/Fehlermeldungen
- [ ] Tenant ID & Queue ID notieren
- [ ] Zeitpunkt des Problems
- [ ] Bereits versuchte Lösungen
- [ ] Bei Bedarf eskalieren

### Nach Abschluss:

- [ ] Kunde informieren
- [ ] Ticket schließen
- [ ] Knowledge Base updaten (bei neuen Issues)

---

## 🔐 Sicherheitshinweise

⚠️ **WICHTIG**:

- NIE Passwörter oder Tokens in Tickets speichern
- Keine Screenshots mit sensiblen Daten
- Lösch-Bestätigungen immer schriftlich
- Bei Unsicherheit: Eskalieren!

**Audit Trail**: Alle Aktionen werden geloggt. Bei manuellen Eingriffen IMMER dokumentieren:

```sql
INSERT INTO deletion_audit_trail (tenant_id, action, details, performed_by)
VALUES ({TENANT_ID}, 'manual_intervention', 'BESCHREIBUNG', 'DEIN_NAME');
```

---

## 📚 Weitere Ressourcen

- [DELETE-TENANT-FIX.md](./DELETE-TENANT-FIX.md) - Technische Dokumentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System-Architektur
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - DB Schema

Bei Fragen oder Verbesserungsvorschlägen: Slack #support-team oder Issue in GitHub erstellen.

---

**Stand**: 13.06.2025 | **Version**: 1.0 | **Autor**: Assixx Development Team
