# KVP UI Implementation Plan

## 🎯 Übersicht

KVP-System mit 3-Ebenen-Sichtbarkeit und rollenbasierter Einreichung

## 📊 Datenbank-Struktur

### Relevante Tabellen

1. **kvp_suggestions** - Haupttabelle für Vorschläge
   - tenant_id (vorhanden)
   - user_id (fehlt noch - muss submitted_by ersetzen/ergänzen) ( haben wir auch schon submitted_by)
   - team_id (muss hinzugefügt werden)

2. **user_teams** - Verknüpfung User ↔ Team
   - user_id
   - team_id
   - tenant_id

3. **teams** - Team-Definitionen
   - id
   - department_id
   - team_lead_id
   - tenant_id

## 🔍 3-Ebenen-System

### Sichtbarkeitsebenen

1. **Team-Ebene** (team_id)
   - Nur Teammitglieder sehen den Vorschlag

2. **Abteilungs-Ebene** (department_id)
   - Alle in der Abteilung sehen den Vorschlag
   - Wird über teams.department_id ermittelt

3. **Firmen-Ebene** (tenant_id)
   - Alle im Unternehmen sehen den Vorschlag

## 👤 Rollenbasierte Rechte

### Employee (Mitarbeiter)

- ✅ Kann Vorschläge NUR auf Team-Ebene erstellen
- ❌ Kann NICHT auf höhere Ebenen teilen
- ⚠️ MUSS einem Team zugeordnet sein

### Admin

- ✅ Kann Vorschläge auf allen 3 Ebenen teilen
- ✅ Kann Sichtbarkeit ändern (Team → Abteilung → Firma)

## 🚨 Validierung beim Erstellen (Employee)

### Prüfung beim Klick auf Floating Add Button

1. Prüfe ob User role = 'employee'
2. Query: `SELECT team_id FROM user_teams WHERE user_id = ? AND tenant_id = ?`
3. **Wenn kein Eintrag oder team_id = NULL:**
   - Zeige Fehler: "Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator."
   - Modal öffnet NICHT
4. **Wenn team_id vorhanden:**
   - Modal öffnet
   - team_id wird automatisch gesetzt
   - orgLevel = 'team'
   - orgId = team_id

## 📝 Implementierungs-Schritte

### Phase 1: Frontend-Validierung

1. **kvp.ts** - Modifiziere `showCreateModal()`:

   ```typescript
   // Vor Modal-Öffnung
   if (effectiveRole === 'employee') {
     const userTeam = await checkUserTeamMembership();
     if (!userTeam || !userTeam.team_id) {
       showError('Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.');
       return;
     }
     // Setze team_id für Formular
     this.currentTeamId = userTeam.team_id;
   }
   ```

### Phase 2: Backend-Anpassung

1. **kvp.validation.ts** - Lockere Validierung:
   - categoryId: optional machen
   - orgLevel: Default 'team' für Employees
   - orgId: Automatisch team_id für Employees

2. **kvp.service.ts** - Erweitere createSuggestion:
   - Füge user_id (aus req.user.id) hinzu
   - Füge team_id aus user_teams hinzu
   - Setze orgLevel basierend auf Rolle

### Phase 3: Datenbank-Migration

```sql
-- Füge team_id zu kvp_suggestions hinzu (falls nicht vorhanden)
ALTER TABLE kvp_suggestions
ADD COLUMN team_id INT DEFAULT NULL,
ADD FOREIGN KEY (team_id) REFERENCES teams(id);

-- Optional: user_id als klares Feld
ALTER TABLE kvp_suggestions
ADD COLUMN user_id INT DEFAULT NULL,
ADD FOREIGN KEY (user_id) REFERENCES users(id);
```

## 🎨 UI-Anpassungen

### Modal für Employee

- Kategorie-Dropdown: Optional (kann leer bleiben)
- Keine Auswahl für Sichtbarkeitsebene (automatisch Team)
- Zeige Info: "Vorschlag wird in Ihrem Team eingereicht"

### Modal für Admin

- Zusätzliches Dropdown: "Sichtbarkeit"
  - Team (Standard)
  - Abteilung
  - Gesamtes Unternehmen

## ⚠️ Fehlerbehandlung

### Mögliche Fehler

1. **Kein Team zugeordnet**
   - Message: "Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator."

2. **Team inaktiv**
   - Message: "Ihr Team ist derzeit inaktiv. Bitte kontaktieren Sie Ihren Teamleiter."

3. **Keine Berechtigung**
   - Message: "Sie haben keine Berechtigung, Vorschläge einzureichen."

## 🔄 Migration bestehender Daten

Für bestehende KVP-Einträge ohne team_id:

1. Ermittle team_id über submitted_by → user_teams
2. Setze orgLevel = 'team' wenn nicht gesetzt
3. Setze orgId = team_id wenn nicht gesetzt
