# API Design Workshop - Assixx

---

## 🎯 Workshop Ziel

**Eine einheitliche, dokumentierte API-Struktur für Assixx etablieren**

### Warum sind wir heute hier?

- 502+ Tests, nur ~40 bestehen (< 10%)
- API und Tests sprechen verschiedene "Sprachen"
- CI/CD blockiert, neue Features gefährdet

---

## 📊 Aktuelle Situation

### Die Zahlen

```
✅ Passing Tests:    40 (~8%)
❌ Failing Tests:   462 (~92%)
🚧 Total Tests:     502+
```

### Hauptprobleme

1. **Chat API**: Tests erwarten `channels`, API bietet `conversations`
2. **Calendar API**: Tests erwarten `/events` suffix, API hat keinen
3. **Response Format**: Tests erwarten `success` field, API liefert es nicht
4. **Field Naming**: `start_date` vs `start_time` Chaos

---

## 🔍 Beispiel: Chat API Mismatch

### Test erwartet

```javascript
POST /api/chat/channels
{
  "name": "General",
  "type": "public",
  "visibility_scope": "company"
}
```

### API bietet

```javascript
POST /api/chat/conversations
{
  "participant_ids": [1, 2, 3],
  "is_group": true,
  "name": "Team Chat"
}
```

**➡️ Komplett unterschiedliche Konzepte!**

---

## 📋 Heutige Agenda

### Phase 1: IST-Analyse (60 Min)

- Swagger UI Review
- Test vs Reality Check

### Phase 2: Standards definieren (90 Min)

- REST Best Practices
- Naming Conventions
- Response Formats

### Phase 3: Entscheidungen (90 Min)

- Decision Matrix ausfüllen
- Prioritäten setzen

### Phase 4: Implementation Plan (60 Min)

- Timeline erstellen
- Verantwortlichkeiten

---

## 🎨 API Standards Preview

### Resource Naming

```
✅ Plural:     /users, /departments, /teams
✅ Nested:     /departments/:id/teams
✅ Actions:    POST /users/:id/activate
```

### Response Format

```javascript
// Success
{
  "success": true,
  "data": {...},
  "meta": { "pagination": {...} }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Readable message",
    "details": [...]
  }
}
```

---

## 🤔 Entscheidungs-Framework

Für jeden Endpoint:

1. **KEEP** - Funktioniert gut, keine Änderung
2. **DEPRECATE** - Auslaufen lassen mit Warning
3. **CHANGE** - Breaking Change notwendig
4. **ADD** - Neuer Endpoint benötigt
5. **REMOVE** - Nicht mehr benötigt

### Bewertungskriterien

- Frontend Impact
- Backend Complexity
- User Experience
- Technical Debt

---

## 📈 Migration Strategy

### Option 1: Big Bang ❌

- Alle Änderungen auf einmal
- Hohes Risiko

### Option 2: Gradual Migration ✅

- API Versioning (v1 → v2)
- Deprecation Warnings
- Parallel-Betrieb

### Option 3: Adapter Pattern ⚡

- Facade für alte Endpoints
- Interne Umleitung auf neue API

---

## 🌟 Best Practices von anderen

### Stripe

- **Konsistenz** über alles
- **Idempotency** Keys
- Exzellente Docs

### GitHub

- **HATEOAS** Links
- Rate Limiting Headers
- Webhook Events

### Was wir übernehmen sollten

1. Konsistente Naming Conventions
2. Standardisierte Error Responses
3. Proper Pagination
4. API Versioning

---

## 🎯 Workshop Outcomes

### Was wir heute erreichen

1. ✅ Einheitliche API Standards
2. ✅ Decision Matrix ausgefüllt
3. ✅ Klare Migration Timeline
4. ✅ Verantwortlichkeiten definiert

### Nächste Schritte

1. OpenAPI Spec Update (2 Tage)
2. Postman Tests erstellen (3 Tage)
3. Frontend Migration (2 Wochen)
4. Backend Anpassungen (2 Wochen)

---

## 💡 Denkt daran

> "APIs sind wie Benutzeroberflächen für Entwickler.
> Sie sollten intuitiv, konsistent und gut dokumentiert sein."

### Unsere Prinzipien

- **Developer Experience First**
- **Consistency over Cleverness**
- **Document Everything**
- **Version Thoughtfully**

---

## 🚀 Let's Build a Better API

### Fragen vor dem Start?

**Dokumente bereit:**

- ✅ API Standards Template
- ✅ Decision Matrix
- ✅ Example APIs
- ✅ Current OpenAPI Spec

**Tools bereit:**

- ✅ Swagger UI: <http://localhost:3000/api-docs/>
- ✅ Postman Collection
- ✅ Whiteboard/Miro

---

## 📝 Notizen-Template

### Für jeden Teilnehmer

```markdown
## Endpoint: /api/...

### Current State:

- Route:
- Method:
- Issues:

### Proposed Change:

- New Route:
- Reason:
- Impact:

### Decision: [KEEP/CHANGE/DEPRECATE/ADD/REMOVE]

### Priority: [Critical/High/Medium/Low]

### Owner: [Name]

### Timeline: [Sprint X]
```
