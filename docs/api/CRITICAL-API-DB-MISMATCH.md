# 🚨 KRITISCH: API vs Database Schema Mismatch

## Problem

Die Calendar API und die Datenbank sprechen verschiedene Sprachen!

### API erwartet (calendar.ts):

```javascript
const eventData = {
  start_time: req.body.start_time, // ❌
  end_time: req.body.end_time, // ❌
  org_level: req.body.org_level, // ❌
  org_id: req.body.org_id, // ❌
  reminder_time: req.body.reminder_time, // ❌
  created_by: req.user.id, // ❌
};
```

### Datenbank hat (calendar_events table):

```sql
start_date DATETIME      -- ✅ (nicht start_time)
end_date DATETIME        -- ✅ (nicht end_time)
reminder_minutes INT     -- ✅ (nicht reminder_time)
user_id INT              -- ✅ (nicht created_by)
-- org_level existiert NICHT
-- org_id existiert NICHT
```

## Impact

- **Alle POST /api/calendar Requests schlagen mit 400/500 fehl**
- Tests können nicht bestehen
- API ist nicht funktionsfähig!

## Optionen

### Option A: API Model anpassen (Quick Fix)

```javascript
// In calendar model: Field mapping
const dbEventData = {
  start_date: eventData.start_time,
  end_date: eventData.end_time,
  reminder_minutes: eventData.reminder_time,
  user_id: eventData.created_by,
  // org_level und org_id ignorieren oder in description speichern
};
```

### Option B: DB Schema ändern (Breaking Change)

```sql
ALTER TABLE calendar_events
  CHANGE start_date start_time DATETIME,
  CHANGE end_date end_time DATETIME,
  CHANGE reminder_minutes reminder_time INT,
  CHANGE user_id created_by INT,
  ADD COLUMN org_level ENUM('company','department','team','personal'),
  ADD COLUMN org_id INT;
```

### Option C: API an DB anpassen (Recommended)

API sollte die DB-Feldnamen verwenden:

- start_time → start_date
- end_time → end_date
- reminder_time → reminder_minutes
- created_by → user_id
- org_level/org_id Features entfernen oder anders implementieren

## Sofort-Maßnahme erforderlich!

**Das ist kein Test-Problem - das ist ein Production Bug!**

Die Calendar API funktioniert aktuell NICHT, weil sie versucht in nicht-existierende DB-Spalten zu schreiben.
