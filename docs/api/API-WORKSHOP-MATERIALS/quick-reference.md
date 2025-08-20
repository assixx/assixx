# API Workshop - Quick Reference Guide

## 🚀 Workshop Start Checklist

- [ ] Swagger UI geöffnet: <http://localhost:3000/api-docs/>
- [ ] Decision Matrix ausgedruckt/geteilt
- [ ] Whiteboard/Miro bereit
- [ ] Screen Sharing funktioniert
- [ ] Alle Teilnehmer da

## ⏱ Zeitplan

| Zeit        | Phase          | Aktivität                          |
| ----------- | -------------- | ---------------------------------- |
| 09:00-10:00 | IST-Analyse    | Swagger Review + Test Analysis     |
| 10:00-10:15 | Pause          | ☕                                 |
| 10:15-11:45 | Standards      | API Conventions definieren         |
| 11:45-12:00 | Pause          | 🍎                                 |
| 12:00-13:30 | Entscheidungen | Decision Matrix ausfüllen          |
| 13:30-14:30 | Planning       | Timeline + Verantwortlichkeiten    |
| 14:30-15:00 | Wrap-Up        | Zusammenfassung + Nächste Schritte |

## 🎯 Entscheidungs-Kategorien

### KEEP ✅

- Endpoint funktioniert gut
- Keine Änderungen nötig
- Tests anpassen

### CHANGE ⚠️

- Breaking Change nötig
- Migration erforderlich
- Deprecation Warning

### DEPRECATE 🕰

- Auslaufen lassen
- 3-6 Monate Warning
- Dann entfernen

### ADD ➕

- Neuer Endpoint
- Fehlende Funktionalität
- Priorität festlegen

### REMOVE ❌

- Nicht mehr benötigt
- Keine Nutzung
- Sofort oder nach Deprecation

## 📝 Decision Template

```yaml
Endpoint: /api/xxx/yyy
Current: GET /api/calendar
Proposed: GET /api/calendar/events
Decision: CHANGE
Priority: High
Reason: Consistency with REST standards
Frontend Impact: 15 Komponenten
Backend Effort: 2 Tage
Migration: v1 parallel, 3 Monate deprecation
Owner: [Name]
Deadline: Sprint 42
```

## 🌐 REST Best Practices

### URLs

```
✅ /users                    ❌ /getUsers
✅ /users/123                ❌ /users?id=123
✅ /users/123/orders         ❌ /getUserOrders?userId=123
✅ POST /users/123/activate  ❌ GET /activateUser/123
```

### HTTP Methods

- **GET**: Daten abrufen (idempotent)
- **POST**: Neue Resource erstellen
- **PUT**: Komplette Resource ersetzen
- **PATCH**: Teilweise updaten
- **DELETE**: Resource löschen

### Status Codes

- **200**: OK (GET, PUT, PATCH)
- **201**: Created (POST)
- **204**: No Content (DELETE)
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **422**: Validation Error

## 📦 Standard Response Formats

### Success Response

```json
{
  "success": true,
  "data": {...} oder [...],
  "meta": {
    "timestamp": "2025-07-24T10:00:00Z",
    "version": "1.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email ist bereits vergeben",
    "details": [
      {
        "field": "email",
        "message": "Muss unique sein"
      }
    ]
  }
}
```

### Pagination

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "pages": 8
    }
  }
}
```

## 🎯 Priority Matrix

| Priority     | Criteria                     | Timeline   |
| ------------ | ---------------------------- | ---------- |
| **Critical** | Blockt Features, Security    | Sofort     |
| **High**     | User Experience, Performance | Sprint 1-2 |
| **Medium**   | Developer Experience         | Sprint 3-4 |
| **Low**      | Nice to have                 | Backlog    |

## 🔄 Migration Patterns

### 1. Parallel Operation

```javascript
// v1 (deprecated)
GET /api/calendar → 301 Redirect to v2

// v2 (new)
GET /api/calendar/events
```

### 2. Response Header Warning

```http
HTTP/1.1 200 OK
X-Deprecated: This endpoint will be removed in v2.0
X-Sunset-Date: 2025-10-01
```

### 3. Adapter Pattern

```javascript
// Old endpoint internally calls new logic
router.get("/calendar", (req, res) => {
  console.warn("Deprecated endpoint used");
  return calendarEventsController.list(req, res);
});
```

## 📊 Metriken für Erfolg

- [ ] 80%+ Tests grün nach Migration
- [ ] Alle Endpoints dokumentiert
- [ ] Frontend Migration Plan
- [ ] Keine Breaking Changes ohne Warning
- [ ] Performance gleich oder besser

## 📢 Kommunikations-Template

````markdown
### API Änderung: [Endpoint Name]

**Was ändert sich:**

- Alt: GET /api/xxx
- Neu: GET /api/xxx/yyy

**Warum:**

- REST Standards
- Bessere Erweiterbarkeit

**Migration:**

- Ab sofort: Deprecation Warning
- 01.10.2025: Alte API wird entfernt

**Code-Beispiel:**

```javascript
// Alt
const response = await fetch("/api/xxx");

// Neu
const response = await fetch("/api/xxx/yyy");
```
````

**Fragen?** → #api-migration Slack Channel

```

## 🎆 Nach dem Workshop

1. **Sofort (heute):**
   - [ ] Workshop-Protokoll verschicken
   - [ ] Decision Matrix finalisieren
   - [ ] Slack Announcement

2. **Diese Woche:**
   - [ ] OpenAPI Spec updaten
   - [ ] JIRA Tickets erstellen
   - [ ] Migration Guide beginnen

3. **Nächste Woche:**
   - [ ] Erste Endpoints migrieren
   - [ ] Postman Tests schreiben
   - [ ] Frontend Team briefen
```
