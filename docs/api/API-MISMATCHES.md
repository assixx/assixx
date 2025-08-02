# 🔴 API Mismatches - Tests vs Reality

## Übersicht

Stand: 24.07.2025

Die Unit Tests erwarten andere API-Endpunkte als tatsächlich implementiert sind. Dies zeigt ein fundamentales Kommunikationsproblem zwischen Test-Entwicklung und API-Implementation.

## Calendar API

### Was Tests erwarten:

- `POST /api/calendar/events`
- `GET /api/calendar/events`
- `GET /api/calendar/events/:id`
- `PUT /api/calendar/events/:id`
- `DELETE /api/calendar/events/:id`
- `GET /api/calendar/availability`
- `GET /api/calendar/availability/free-slots`

### Was tatsächlich existiert:

- `GET /api/calendar`
- `POST /api/calendar`
- `GET /api/calendar/:id`
- `PUT /api/calendar/:id`
- `DELETE /api/calendar/:id`
- ❌ Keine `/availability` Endpoints

### Weitere Probleme:

- Tests erwarten `response.body.data.eventId`, API gibt komplettes Event-Objekt
- Tests erwarten Validation-Fehler mit `path`, API gibt `field`
- Tests nutzen `visibility_scope`, API erwartet `org_level`

## Chat API

### Was Tests erwarten:

- `POST /api/chat/channels`
- `GET /api/chat/channels`
- `POST /api/chat/messages`
- `GET /api/chat/messages`
- `PUT /api/chat/messages/:id`
- `DELETE /api/chat/messages/:id`

### Was tatsächlich existiert:

- `POST /api/chat/conversations`
- `GET /api/chat/conversations`
- `GET /api/chat/conversations/:id`
- `POST /api/chat/conversations/:id/messages`
- `PUT /api/chat/conversations/:id}/read`
- `GET /api/chat/attachments/:filename`
- `GET /api/chat/users`
- `GET /api/chat/unread-count`

### Konzeptuelle Unterschiede:

- Tests denken in "channels", API nutzt "conversations"
- Messages sind unter conversations geschachtelt, nicht top-level
- Komplett andere Architektur!

## Shifts API

### Status:

- Auth funktioniert ✅
- Nur 6/66 Tests bestehen (9%)
- Weitere Analyse erforderlich

## Empfehlungen

### Option A: Tests an API anpassen (Quick Fix - 2-3 Tage)

**Vorteile:**

- Schnell umsetzbar
- Keine Breaking Changes
- Frontend bleibt unberührt

**Nachteile:**

- Tests dokumentieren nicht mehr das "gewünschte" Verhalten
- Versteckt das eigentliche Problem

### Option B: API an Tests anpassen (Breaking Change - 1-2 Wochen)

**Vorteile:**

- Tests waren vermutlich das ursprüngliche Design
- Konsistentere API-Struktur

**Nachteile:**

- Breaking Changes für Frontend
- Migration erforderlich
- Risiko für Production

### Option C: Neu designen (Best Practice - 2-3 Wochen)

**Vorteile:**

- Chance für Clean Slate
- Moderne API-Standards
- Konsistenz über alle Endpoints

**Nachteile:**

- Größter Aufwand
- Komplette Frontend-Anpassung
- Längste Downtime

## Nächste Schritte

1. **Management-Entscheidung erforderlich!**
2. API-Design Workshop mit allen Stakeholdern
3. OpenAPI Spec als Single Source of Truth
4. Postman/Newman für Contract Testing
5. CI/CD Integration

## Wichtige Fragen

- Wer hat die Tests geschrieben?
- Wer hat die APIs implementiert?
- Gab es eine API-Spec vorab?
- Welche Version ist in Production?
- Was erwartet das Frontend?

---

**WARNUNG:** Ohne klare Entscheidung wird das Problem nur größer!
