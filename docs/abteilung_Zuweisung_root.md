# 📋 Abteilungszuweisungen und Berechtigungskonzept

**Erstellt:** 12.06.2025  
**Status:** Konzept & Planung  
**Priorität:** HOCH

## 🎯 Übersicht

Dieses Dokument beschreibt das Konzept für Abteilungszuweisungen und die damit verbundenen Berechtigungen im Assixx-System. Es definiert, wie die Schichtplanung mit Abteilungen verknüpft wird und wie zukünftig granulare Berechtigungen implementiert werden.

## 📊 Aktuelle Situation (IST-Zustand)

### Probleme:
1. **Schichtplanung ohne Abteilung möglich** ❌
   - Man kann aktuell Schichtpläne erstellen ohne eine Abteilung auszuwählen
   - Dies führt zu "freischwebenden" Schichtplänen ohne Kontext
   - Keine klare Zuordnung wer für welche Schichten verantwortlich ist

2. **Fehlende Validierung** ❌
   - Frontend erlaubt Speichern ohne Abteilung
   - Backend akzeptiert NULL-Werte für department_id
   - Datenbank hat department_id als nullable Feld

3. **Keine granularen Berechtigungen** ❌
   - Admins sehen ALLE Abteilungen
   - Keine Möglichkeit, Admins auf bestimmte Abteilungen zu beschränken

## 🎯 SOLL-Zustand

### Phase 1: Abteilung als Pflichtfeld (SOFORT)

1. **Frontend-Validierung:**
   - Schichtplan-Grid wird erst nach Abteilungsauswahl angezeigt
   - Platzhalter/Info-Box: "Bitte wählen Sie zuerst eine Abteilung aus"
   - Save-Button deaktiviert ohne Abteilung

2. **Backend-Validierung:**
   - department_id als Pflichtfeld in allen Shift-bezogenen APIs
   - Fehlermeldung: "Abteilung muss ausgewählt werden"

3. **Datenbank-Anpassung:**
   - Prüfen ob bestehende Shifts ohne department_id existieren
   - Migration um diese zu bereinigen
   - department_id NOT NULL setzen (optional, nach Bereinigung)

### Phase 2: Rollen-basierte Sichtbarkeit (AKTUELL)

| Rolle | Abteilungs-Sichtbarkeit | Schichtplan-Zugriff |
|-------|-------------------------|---------------------|
| Employee | Nur eigene Abteilung (aus user.department_id) | Nur Lesen |
| Admin | ALLE Abteilungen | Lesen/Schreiben für ALLE |
| Root | ALLE Abteilungen | Lesen/Schreiben für ALLE |

### Phase 3: Granulare Admin-Berechtigungen (ZUKUNFT)

## 🏗️ Datenbank-Schema für Berechtigungen

### Neue Tabelle: `admin_department_permissions`

```sql
CREATE TABLE admin_department_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    admin_user_id INT NOT NULL,
    department_id INT NOT NULL,
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    assigned_by INT NOT NULL, -- Root user who assigned this permission
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_admin_dept (tenant_id, admin_user_id, department_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (admin_user_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);
```

### Erweiterte Logik:

1. **Root User kann:**
   - Admin-Berechtigungen für spezifische Abteilungen vergeben
   - Berechtigungen wieder entziehen
   - Übersicht über alle Berechtigungen

2. **Admin User kann:**
   - Nur Abteilungen sehen/bearbeiten, für die Berechtigung existiert
   - Wenn keine spezifischen Berechtigungen → ALLE sehen (Rückwärtskompatibilität)

## 🔄 Implementierungs-Roadmap

### Schritt 1: Abteilung als Pflichtfeld (JETZT)
1. Frontend anpassen:
   - Schichtplan ausblenden bis Abteilung gewählt
   - Validierung beim Speichern
   
2. Backend anpassen:
   - department_id Validierung in `/api/shifts`
   - Fehlermeldungen verbessern

### Schritt 2: Employee-Filterung (JETZT)
1. Employees sehen nur Mitarbeiter ihrer Abteilung
2. Shift-Anzeige gefiltert nach Abteilung

### Schritt 3: Admin-Berechtigungs-UI (SPÄTER)
1. Neue Seite unter Root-Bereich
2. Matrix-Ansicht: Admin × Abteilungen
3. Checkboxen für Read/Write/Delete

## 🔒 Sicherheitsüberlegungen

1. **Tenant-Isolation bleibt bestehen**
   - Alle Queries müssen weiterhin tenant_id berücksichtigen
   
2. **Berechtigungs-Hierarchie:**
   ```
   Root → kann alles
   Admin (mit Berechtigung) → nur zugewiesene Abteilungen
   Admin (ohne Berechtigung) → alle Abteilungen (legacy)
   Employee → nur eigene Abteilung (read-only)
   ```

3. **Audit-Trail:**
   - Wer hat wann welche Berechtigung vergeben
   - Logging aller Berechtigungsänderungen

## 🚀 Migration-Strategie

1. **Bestehende Daten prüfen:**
   ```sql
   -- Shifts ohne Abteilung finden
   SELECT COUNT(*) FROM shifts WHERE department_id IS NULL;
   
   -- Diese einer Standard-Abteilung zuweisen
   UPDATE shifts 
   SET department_id = (SELECT id FROM departments WHERE tenant_id = shifts.tenant_id LIMIT 1)
   WHERE department_id IS NULL;
   ```

2. **Schrittweise Einführung:**
   - Phase 1: Soft-Requirement (Warnung)
   - Phase 2: Hard-Requirement (Pflicht)
   - Phase 3: Granulare Berechtigungen

## ⚠️ Wichtige Hinweise

1. **Rückwärtskompatibilität:**
   - Bestehende Admins behalten volle Rechte
   - Erst wenn spezifische Berechtigungen vergeben werden, greifen diese

2. **Performance:**
   - Zusätzliche JOINs für Berechtigungsprüfung
   - Caching-Strategie für Berechtigungen entwickeln

3. **UI/UX:**
   - Klare Kommunikation warum Abteilung nötig ist
   - Intuitive Berechtigungsverwaltung für Root

## 📝 Offene Fragen

1. Sollen Team-Leader auch eingeschränkte Admin-Rechte für ihre Abteilung bekommen?
2. Wie werden abteilungsübergreifende Schichten gehandhabt?
3. Brauchen wir eine "Alle Abteilungen"-Option für spezielle Fälle?