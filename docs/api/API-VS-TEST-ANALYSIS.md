# API vs Test Mismatch Analysis

## Executive Summary

Nach detaillierter Analyse der API-Implementierung und Tests zeigt sich ein fundamentales Problem:
Die Tests wurden für eine andere API-Version geschrieben als die, die implementiert ist.

## Detaillierte Analyse

### 1. Chat API

#### Test erwartet:

```javascript
// Route: /api/chat/channels
POST {
  name: "General",
  type: "public",
  visibility_scope: "company"
}
```

#### API implementiert:

```javascript
// Route: /api/chat/conversations
POST {
  participant_ids: [1, 2, 3],
  is_group: true,
  name: "Team Chat"
}
```

**Fundamental unterschiedlich:**

- Channels vs Conversations (komplett anderes Konzept)
- Test: Broadcast-orientiert (public/private channels)
- API: Direct Message-orientiert (participants)

### 2. Calendar API

#### Test erwartet:

```javascript
// Route: /api/calendar/events
POST {
  title: "Meeting",
  start_date: "2024-01-01",
  end_date: "2024-01-01",
  visibility_scope: "company"
}
```

#### API implementiert:

```javascript
// Route: /api/calendar
POST {
  title: "Meeting",
  start_time: "2024-01-01T10:00:00Z",
  end_time: "2024-01-01T11:00:00Z",
  org_level: "company",
  org_id: 1  // Muss integer ≥ 1 sein oder weggelassen werden
}
```

**Probleme:**

- Route: /events suffix fehlt in API
- Feldnamen: start_date vs start_time
- DB hat aber start_date/end_date Spalten!
- Validation: org_id darf nicht null sein

### 3. Response Format

#### Tests erwarten:

```javascript
{
  success: true,
  data: {...}
}
```

#### API liefert (utils/response.types.ts):

```javascript
{
  data: {...},
  message: "Success"
}
// KEIN success field!
```

## Root Cause Analysis

### Wahrscheinliches Szenario:

1. **Phase 1**: Ursprüngliche API mit channels, events-suffix, success-field
2. **Phase 2**: API-Redesign (conversations statt channels)
3. **Phase 3**: Tests wurden nie angepasst

### Beweise:

- Swagger Docs zeigen aktuelle API (conversations)
- Tests nutzen alte API (channels)
- DB-Schema passt teilweise zu keiner Version (start_date vs start_time)

## Impact Assessment

### Kritisch:

1. **502+ Tests**, nur ~40 bestehen (< 10%)
2. **CI/CD blockiert** durch failing tests
3. **Neue Features** können nicht getestet werden
4. **Onboarding** neuer Entwickler sehr schwierig

### Technische Schulden:

- Unmaintainable test suite
- Unklar welche API-Version "richtig" ist
- DB-Schema vs API-Schema mismatches

## Empfehlungen

### Option 1: Tests an aktuelle API anpassen (NICHT EMPFOHLEN)

- **Pro**: CI/CD läuft wieder
- **Contra**:
  - 2-3 Wochen Arbeit
  - Fragiles Ergebnis
  - API-Design-Probleme bleiben
  - Tests testen nicht was sie sollen

### Option 2: API Workshop + Redesign (EMPFOHLEN)

- **Pro**:
  - Klare API-Spec als Single Source of Truth
  - Tests und API aus einem Guss
  - Zukunftssicher
  - Team Alignment
- **Contra**:
  - 2-3 Wochen Aufwand
  - Kurzfristig keine working tests

### Option 3: Hybrid-Ansatz (AKTUELL)

- Minimal-Anpassung für CI/CD
- Parallel API v2 designen
- Schrittweise Migration

## Nächste Schritte

1. **Management Decision** einholen
2. **API Design Workshop** planen (siehe API-DESIGN-WORKSHOP-PLAN.md)
3. **OpenAPI Spec** als Basis nutzen
4. **Test Strategy** neu definieren

## Lessons Learned

1. **API-First Development**: Spec vor Implementation
2. **Contract Testing**: API und Tests müssen synchron bleiben
3. **Version Control**: Breaking changes brauchen Versioning
4. **Documentation**: Aktuelle Docs sind kritisch
