# API Design Workshop - Entscheidungen

## Workshop Datum: 24.07.2025

## Teilnehmer: SCS + Claude (AI Assistant)

---

## Phase 1: IST-Analyse ✅

### Identifizierte Hauptprobleme

1. **Wartbarkeit** - API ist schwer zu warten
2. **Inkonsistenz** - Verschiedene Patterns überall
3. **Mangelnde Tests** - Nicht ausgiebig getestet
4. **Naming Chaos** - channels vs conversations
5. **Fehlende Endpoints** - z.B. DELETE für Calendar

### Priorität festgelegt

**Sicherheit > Saubere Standards > Schnelle Hacks**

---

## Phase 2: API Standards ✅

### Entschiedene Standards

#### 1. Resource Naming

**Entscheidung:** IMMER PLURAL

```
✅ /users
✅ /departments
✅ /calendar/events
✅ /chat/conversations
```

**Begründung:** Best Practice, konsistent auch bei einzelnen Items

#### 2. Response Format

**Entscheidung:** MIT SUCCESS FLAG

```json
{
  "success": true,
  "data": {...},
  "meta": {
    "timestamp": "2025-07-24T14:00:00Z",
    "version": "1.0"
  }
}
```

**Begründung:** Explizit ist besser, Frontend kann einfacher prüfen

#### 3. Error Format

**Entscheidung:** STRUKTURIERTE ERRORS

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Benutzerfreundliche Nachricht",
    "details": [
      {
        "field": "email",
        "message": "Email bereits vergeben"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-07-24T14:00:00Z",
    "request_id": "uuid-hier"
  }
}
```

**Begründung:** Debugging-freundlich, Best Practice

---

## Phase 3: Endpoint-Entscheidungen 🔄 (In Progress)

### ✅ Entschieden

#### 4. API Versionierung

**Entscheidung:** URL-BASIERT

```
/api/v1/users
/api/v2/users
```

**Begründung:**

- Explizit und transparent
- CDN/Cache-freundlich
- Bessere Developer Experience
- Einfaches Routing

#### 5. Calendar API

**Entscheidung:** CHANGE zu `/api/calendar/events`

- **Alt:** `/api/calendar`
- **Neu:** `/api/calendar/events`
- **Aktion:** Migration mit Deprecation Warning
- **Neue Endpoints hinzufügen:**
  - `DELETE /api/calendar/events/:id`
  - `PATCH /api/calendar/events/:id`

#### 6. Chat API

**Entscheidung:** KEEP `conversations`

- **Bleibt:** `/api/chat/conversations`
- **Grund:** Moderner, flexibler als channels
- **Tests:** Müssen angepasst werden

#### 7. Users & Auth API

**Entscheidung:** NEUE STRUKTUR FÜR V2

```
/api/v2/auth/login
/api/v2/auth/register
/api/v2/auth/logout
/api/v2/users/me
/api/v2/users (admin: alle users)
/api/v2/users/:id
```

**Begründung:**

- Klare Trennung: /auth für Authentication, /users für Management
- Admin-Features über Permissions, nicht URLs
- REST-konform

#### 8. Departments & Teams

**Entscheidung:** FLACHE STRUKTUR

```
GET /api/v2/departments
GET /api/v2/teams
GET /api/v2/teams?department_id=123
```

**Begründung:**

- Wartbarer (weniger Verschachtelung)
- Flexibler (Teams können später erweitert werden)
- Performance (direkter Zugriff)
- Industry Standard (GitHub, Slack)

#### 9. Migrations-Prioritäten

**Entscheidung:** SECURITY FIRST

1. **Auth** (Security ist Fundament)
2. **Users** (Basis für alles)
3. **Calendar** (Tests kaputt = Risiko)
4. **Chat** (Tests kaputt, weniger kritisch)

#### 10. Field Naming Standards

**Entscheidung:** CAMELCASE FÜR TYPESCRIPT

```typescript
// API/JSON: camelCase
{
  "userId": 123,
  "firstName": "Max",
  "createdAt": "2024-07-24T10:30:00Z",
  "isActive": true,
  "hasPermission": true
}

// DB bleibt: snake_case (SQL Standard)
// Automatische Transformation dazwischen!
```

**Begründung:**

- TypeScript/JavaScript Standard
- Frontend-Konsistenz
- JSON = JavaScript Object Notation
- Automatische snake_case ↔ camelCase Konvertierung

#### 11. Pagination Standard

**Entscheidung:** OFFSET-BASED ALS DEFAULT

```typescript
interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

**Begründung:**

- Einfacher für Entwickler
- Gut für UI mit Seitenzahlen
- Cursor-based später für spezielle Use-Cases

#### 12. Batch Operations

**Entscheidung:** NOCH NICHT (YAGNI)

- Erst implementieren wenn wirklich gebraucht
- Komplexität nicht ohne konkreten Use-Case
- Performance-Optimierung für später

---

## Phase 3 ABGESCHLOSSEN ✅

### Zusammenfassung der Kern-Entscheidungen

1. **URL-basierte Versionierung:** `/api/v2/...`
2. **Immer Plural:** `/users`, `/events`, `/conversations`
3. **camelCase für API:** TypeScript-konform
4. **Success Flag:** Explizite Success/Error Responses
5. **Security First:** Auth → Users → Calendar → Chat
6. **Flache Strukturen:** Teams nicht unter Departments nesten
7. **Conversations > Channels:** Moderner und flexibler

---

## Phase 4: Migration Planning ✅ ABGESCHLOSSEN

### 13. Migration Timeline

**Entscheidung:** REALISTISCHER ZEITPLAN MIT BUFFER

```
Woche 1-3:   Auth API v2 (Security = mehr Testing)
Woche 4-6:   Users API v2 (gekoppelt mit Auth)
Woche 7-9:   Calendar API v2 (komplexe Business Logic)
Woche 10-12: Chat API v2 (Real-time Features)
```

**Begründung:**

- 50% Buffer eingeplant
- Security braucht Zeit
- APIs sind immer komplexer als gedacht

### 14. Deprecation Strategy

**Entscheidung:** 6 MONATE PARALLEL-BETRIEB

```typescript
interface DeprecationPlan {
  announcement: Date; // Tag 0
  deprecationStart: Date; // Tag 30
  supportEnd: Date; // Tag 180 (6 Monate)
  shutdownDate: Date; // Tag 210
}
```

**Begründung:**

- Industry Standard (GitHub, Stripe)
- Genug Zeit für Migration
- Überschaubarer Maintenance-Overhead

### 15. Breaking Change Communication

**Entscheidung:** TECHNISCHE KOMMUNIKATION (Solo-Dev)

```typescript
// 1. Deprecation Headers (automatisch)
res.setHeader('Deprecation', 'true');
res.setHeader('Sunset', '2025-12-31');
res.setHeader('Link', '</api/v2>; rel="successor-version"');

// 2. API Response Warnings
{
  "warnings": [
    "This endpoint is deprecated. Migrate to /api/v2 by Dec 31, 2025"
  ]
}
```

**Kanäle für Solo-Entwicklung:**

1. Deprecation Headers (automatisch)
2. Migration Guide (in Docs)
3. API Response Warnings
4. Changelog (Git)
5. README Updates

---

## Dokumentation Updates ✅

### TYPESCRIPT-STANDARDS.md aktualisiert mit

1. **camelCase für API Fields** (nicht snake_case!)
2. **API Response Standards** (success flag + meta)
3. **Field Naming Standards** (createdAt, userId, isActive)
4. **REST URL Patterns** (immer Plural)
5. **API Versioning** (/api/v2/...)
6. **Type-Safe API Client** Beispiel

### Automatische Konvertierung

- API (camelCase) ↔ DB (snake_case)
- Utility Functions in TYPESCRIPT-STANDARDS.md dokumentiert

---

## Nächste Schritte

1. Endpoint-Entscheidungen abschließen
2. Migration Timeline planen
3. OpenAPI Spec updaten
4. Tests anpassen
