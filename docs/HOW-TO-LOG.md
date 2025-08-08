# 📝 HOW TO LOG - Assixx Logging System

## 🎯 Ziel: Eine einzige Log-Tabelle für ALLES

**Wir verwenden NUR `root_logs` für alle Logs!**

## 📊 Aktuelle Situation

### Zwei redundante Tabellen:

- **activity_logs** - Alte Tabelle, wird im Frontend angezeigt
- **root_logs** - Neue Tabelle mit mehr Details

### Problem:

- v1 APIs loggen in `activity_logs`
- v2 APIs loggen in `root_logs`
- Frontend zeigt nur `activity_logs`
- Das ist redundant und verwirrend!

## ✅ Migration Plan

### Phase 1: Tabellen-Struktur angleichen ✅

```sql
-- root_logs braucht die 'details' Spalte von activity_logs
ALTER TABLE root_logs ADD COLUMN details TEXT AFTER entity_id;
```

### Phase 2: Daten bereinigen

```sql
-- Alte Daten löschen (nicht relevant für aktuelle Entwicklung)
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE root_logs;
```

### Phase 3: RootLog Model aktualisieren

```typescript
// backend/src/models/rootLog.ts
interface RootLogData {
  tenant_id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  details?: string; // NEU: Für Frontend-Anzeige
  old_values?: any; // Für Audit-Details
  new_values?: any; // Für Audit-Details
  ip_address?: string;
  user_agent?: string;
  was_role_switched?: boolean;
}
```

### Phase 4: Logging Pattern für v2 APIs

```typescript
// IMMER beide Informationen loggen:
await RootLog.create({
  tenant_id: req.user.tenant_id,
  user_id: req.user.id,
  action: "login", // z.B. login, logout, create, update, delete
  entity_type: "user", // z.B. user, document, department, etc.
  entity_id: userId,

  // FÜR FRONTEND (einfache Anzeige):
  details: "Angemeldet als Admin", // Deutscher Text für User

  // FÜR AUDIT (detailliert):
  old_values: {
    /* alte Werte */
  },
  new_values: {
    /* neue Werte */
  },

  // META-DATEN:
  ip_address: req.ip,
  user_agent: req.get("user-agent"),
  was_role_switched: false,
});
```

### Phase 5: Frontend anpassen

```typescript
// backend/src/routes/logs.ts
// ÄNDERN VON:
FROM activity_logs al
// ZU:
FROM root_logs al
```

## 📋 Was muss geloggt werden?

### Auth (v2/auth)

- ✅ login - "Angemeldet als {role}"
- ✅ logout - "Abgemeldet"
- ✅ register - "Neuer Benutzer erstellt: {email}"
- ⬜ password_reset - "Passwort zurückgesetzt"
- ⬜ token_refresh - "Token erneuert"

### Users (v2/users)

- ✅ create - "Benutzer erstellt: {email}"
- ✅ update - "Benutzer aktualisiert: {email}"
- ✅ delete - "Benutzer gelöscht: {email}"
- ⬜ password_change - "Passwort geändert"
- ⬜ avatar_upload - "Avatar hochgeladen"

### Documents (v2/documents)

- ✅ upload - "Dokument hochgeladen: {filename}"
- ✅ delete - "Dokument gelöscht: {filename}"
- ⬜ download - "Dokument heruntergeladen: {filename}"

### Departments (v2/departments)

- ✅ create - "Abteilung erstellt: {name}"
- ✅ update - "Abteilung aktualisiert: {name}"
- ✅ delete - "Abteilung gelöscht: {name}"

### Teams (v2/teams)

- ✅ create - "Team erstellt: {name}"
- ✅ update - "Team aktualisiert: {name}"
- ✅ delete - "Team gelöscht: {name}"
- ✅ add_member - "Mitglied hinzugefügt"
- ⬜ remove_member - "Mitglied entfernt"

### KVP (v2/kvp)

- ✅ create_suggestion - "KVP-Vorschlag erstellt: {title}"
- ✅ update_suggestion - "KVP-Vorschlag aktualisiert"
- ✅ delete_suggestion - "KVP-Vorschlag gelöscht"
- ✅ add_comment - "Kommentar hinzugefügt"
- ✅ upload_attachment - "Anhang hochgeladen"
- ✅ award_points - "Punkte vergeben: {points}"

### Blackboard (v2/blackboard)

- ✅ create_entry - "Eintrag erstellt: {title}"
- ✅ update_entry - "Eintrag aktualisiert"
- ✅ delete_entry - "Eintrag gelöscht"
- ✅ archive_entry - "Eintrag archiviert"
- ⬜ unarchive_entry - "Eintrag wiederhergestellt"

### Calendar (v2/calendar)

- ✅ create_event - "Termin erstellt: {title}"
- ✅ update_event - "Termin aktualisiert"
- ✅ delete_event - "Termin gelöscht"
- ✅ update_attendee_response - "Teilnahme aktualisiert"

### Chat (v2/chat)

- ✅ create_conversation - "Unterhaltung erstellt"
- ✅ send_message - "Nachricht gesendet"
- ✅ delete_conversation - "Unterhaltung gelöscht"

### Areas (v2/areas)

- ✅ create - "Bereich erstellt: {name}"
- ✅ update - "Bereich aktualisiert: {name}"
- ✅ delete - "Bereich gelöscht: {name}"

### Signup (v2/signup)

- ✅ register_tenant - "Neuer Mandant registriert: {company}"

## 🔍 Prüfung

### SQL Query zum Testen:

```sql
-- Zeige alle Logs der letzten Stunde
SELECT
  id,
  action,
  entity_type,
  details,
  created_at
FROM root_logs
WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC;
```

### Frontend-Test:

1. Öffne http://localhost:3000/logs
2. Sollte alle Aktionen aus `root_logs` anzeigen
3. Filter sollten funktionieren
4. Details sollten auf Deutsch sein

## ⚠️ WICHTIG

1. **KEINE activity_logs mehr verwenden!**
2. **IMMER details Feld ausfüllen** (für Frontend)
3. **IMMER new_values/old_values bei CRUD** (für Audit)
4. **Deutsche Texte in details** (User-freundlich)
5. **Multi-Tenant beachten** (tenant_id ist PFLICHT)

## 🚀 Nächste Schritte

1. ✅ Tabellen-Migration durchführen
2. ⬜ RootLog Model erweitern
3. ⬜ Alle v2 APIs prüfen und anpassen
4. ⬜ Frontend /logs Route umstellen
5. ⬜ Testen mit echten Daten
6. ⬜ activity_logs Tabelle später löschen
