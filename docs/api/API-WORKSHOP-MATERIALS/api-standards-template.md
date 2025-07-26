# 🎯 Assixx API Standards v1.0

## 📋 Inhaltsverzeichnis

1. [Grundprinzipien](#grundprinzipien)
2. [URL-Struktur](#url-struktur)
3. [HTTP-Methoden](#http-methoden)
4. [Request Format](#request-format)
5. [Response Format](#response-format)
6. [Error Handling](#error-handling)
7. [Versionierung](#versionierung)
8. [Authentifizierung](#authentifizierung)
9. [Pagination](#pagination)
10. [Filtering & Sorting](#filtering--sorting)

## 🎯 Grundprinzipien

### RESTful Design

- **Ressourcen-orientiert:** URLs repräsentieren Ressourcen, nicht Aktionen
- **Stateless:** Jeder Request enthält alle notwendigen Informationen
- **Uniform Interface:** Konsistente Patterns über alle Endpoints
- **HATEOAS:** Links zu verwandten Ressourcen wo sinnvoll

### Naming Conventions

```yaml
Resources:
  - IMMER Plural: /users, /departments, /teams
  - NIEMALS Singular: /user, /department, /team

Nested Resources:
  - Max 2 Ebenen: /departments/:id/teams
  - NICHT: /departments/:id/teams/:id/members/:id

Actions (wenn unvermeidbar):
  - Verb als Sub-Resource: POST /users/:id/activate
  - NICHT als Query: POST /users/:id?action=activate
```

## 📐 URL-Struktur

### Base URL

```
Production: https://api.assixx.com/api/v1
Development: http://localhost:3000/api/v1
```

### Resource Patterns

```javascript
// Collection Operations
GET    /api/v1/resources          // List all
POST   /api/v1/resources          // Create new
GET    /api/v1/resources/:id      // Get one
PUT    /api/v1/resources/:id      // Update (full)
PATCH  /api/v1/resources/:id      // Update (partial)
DELETE /api/v1/resources/:id      // Delete

// Sub-Resources
GET    /api/v1/resources/:id/sub-resources
POST   /api/v1/resources/:id/sub-resources

// Actions (Ausnahmen)
POST   /api/v1/resources/:id/action-name
```

### URL Best Practices

- **Lowercase:** Immer kleinschreiben
- **Hyphens:** Bindestriche für Worttrennnung (kebab-case)
- **No Trailing Slash:** Kein `/` am Ende
- **Query für Filter:** `?status=active&sort=created_at`

## 🔧 HTTP-Methoden

### Standard CRUD Operations

| Method | Operation        | Idempotent | Safe | Body |
| ------ | ---------------- | ---------- | ---- | ---- |
| GET    | Read             | ✅         | ✅   | ❌   |
| POST   | Create           | ❌         | ❌   | ✅   |
| PUT    | Update (full)    | ✅         | ❌   | ✅   |
| PATCH  | Update (partial) | ❌         | ❌   | ✅   |
| DELETE | Delete           | ✅         | ❌   | ❌   |

### Status Codes

```javascript
// Success
200 OK              // GET, PUT, PATCH, DELETE erfolgreich
201 Created         // POST erfolgreich (mit Location Header)
204 No Content      // DELETE ohne Response Body

// Client Errors
400 Bad Request     // Validation Fehler
401 Unauthorized    // Nicht authentifiziert
403 Forbidden       // Keine Berechtigung
404 Not Found       // Ressource nicht gefunden
409 Conflict        // Konflikt (z.B. Duplikat)
422 Unprocessable   // Validation Fehler (alternative)

// Server Errors
500 Internal Error  // Unerwarteter Fehler
503 Service Unavail // Wartung/Überlastung
```

## 📤 Request Format

### Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>
```

### Body Format (JSON)

```javascript
// POST /api/v1/calendar/events
{
  "title": "Team Meeting",
  "description": "Wöchentliches Sync Meeting",
  "start_date": "2025-07-25T10:00:00Z",
  "end_date": "2025-07-25T11:00:00Z",
  "visibility": "team",
  "location": "Konferenzraum A"
}
```

### Naming in JSON

- **camelCase** für Frontend-Kompatibilität
- Alternative: **snake_case** für DB-Nähe
- **WICHTIG:** Konsistent bleiben!

## 📥 Response Format

### Success Response

```javascript
// Single Resource
{
  "success": true,
  "data": {
    "id": 123,
    "title": "Team Meeting",
    "createdAt": "2025-07-24T10:00:00Z",
    // ... weitere Felder
  }
}

// Collection
{
  "success": true,
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}

// Action Response
{
  "success": true,
  "message": "Email erfolgreich versendet",
  "data": {
    "emailId": "abc-123",
    "queuedAt": "2025-07-24T10:00:00Z"
  }
}
```

### Error Response

```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Die Eingabe enthält Fehler",
    "details": [
      {
        "field": "email",
        "message": "Keine gültige E-Mail-Adresse",
        "value": "invalid-email"
      },
      {
        "field": "startDate",
        "message": "Muss in der Zukunft liegen",
        "value": "2020-01-01"
      }
    ]
  },
  "requestId": "req_abc123"
}
```

### Error Codes (Beispiele)

```javascript
const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS: "Ungültige Anmeldedaten",
  AUTH_TOKEN_EXPIRED: "Token abgelaufen",
  AUTH_INSUFFICIENT_PERMISSIONS: "Keine Berechtigung",

  // Validation
  VALIDATION_ERROR: "Validierungsfehler",
  VALIDATION_REQUIRED_FIELD: "Pflichtfeld fehlt",
  VALIDATION_INVALID_FORMAT: "Ungültiges Format",

  // Business Logic
  RESOURCE_NOT_FOUND: "Ressource nicht gefunden",
  RESOURCE_ALREADY_EXISTS: "Ressource existiert bereits",
  OPERATION_NOT_ALLOWED: "Operation nicht erlaubt",

  // System
  INTERNAL_SERVER_ERROR: "Interner Serverfehler",
  SERVICE_UNAVAILABLE: "Service nicht verfügbar",
};
```

## 🔐 Authentifizierung

### JWT Bearer Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Payload Standard

```javascript
{
  "sub": 123,              // User ID
  "username": "john.doe",
  "role": "employee",
  "tenantId": 1,
  "iat": 1627849200,
  "exp": 1627852800
}
```

## 📄 Pagination

### Query Parameters

```
GET /api/v1/employees?page=2&perPage=20&sort=lastName&order=asc
```

### Pagination Response

```javascript
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "perPage": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": true
    }
  },
  "links": {
    "first": "/api/v1/employees?page=1&perPage=20",
    "prev": "/api/v1/employees?page=1&perPage=20",
    "next": "/api/v1/employees?page=3&perPage=20",
    "last": "/api/v1/employees?page=8&perPage=20"
  }
}
```

## 🔍 Filtering & Sorting

### Filter Syntax

```
// Exact match
GET /api/v1/employees?department=sales

// Multiple values
GET /api/v1/employees?role=admin,employee

// Range
GET /api/v1/events?startDate[gte]=2025-01-01&startDate[lte]=2025-12-31

// Search
GET /api/v1/employees?search=john
```

### Sort Syntax

```
// Single field
GET /api/v1/employees?sort=lastName

// Multiple fields
GET /api/v1/employees?sort=department,lastName

// With direction
GET /api/v1/employees?sort=lastName:asc,createdAt:desc
```

## 🔄 Versionierung

### URL Versioning (Empfohlen)

```
/api/v1/resources
/api/v2/resources
```

### Header Versioning (Alternative)

```http
X-API-Version: 1
Accept: application/vnd.assixx.v1+json
```

### Deprecation Notice

```http
X-API-Deprecation-Date: 2025-12-31
X-API-Deprecation-Info: https://docs.assixx.com/api/v1/deprecation
```

## 📝 Weitere Standards

### Date/Time Format

- **IMMER ISO 8601:** `2025-07-24T10:30:00Z`
- **Timezone:** Immer UTC, Client konvertiert

### Multi-Tenant Headers

```http
X-Tenant-ID: 123
X-Tenant-Context: production
```

### Rate Limiting Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1627852800
```

### CORS Headers

```http
Access-Control-Allow-Origin: https://app.assixx.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```

## ✅ Checkliste für neue Endpoints

- [ ] RESTful URL-Struktur
- [ ] Korrekte HTTP-Methode
- [ ] Konsistente Naming Convention
- [ ] Standard Response Format
- [ ] Error Handling implementiert
- [ ] Pagination (bei Collections)
- [ ] Filter/Sort Support
- [ ] OpenAPI Dokumentation
- [ ] Unit Tests
- [ ] Postman Collection Update

## 🚀 Migration Strategy

### Phase 1: Neue Standards für neue Endpoints

- Alle neuen Endpoints folgen diesen Standards
- Keine Änderung bestehender Endpoints

### Phase 2: Schrittweise Migration

- Deprecation Notices für alte Endpoints
- Neue Version parallel entwickeln
- Frontend schrittweise migrieren

### Phase 3: Cleanup

- Alte Endpoints entfernen
- Dokumentation aktualisieren
- Monitoring der API-Nutzung

---

**Version:** 1.0  
**Gültig ab:** [Datum nach Workshop]  
**Nächste Review:** [Datum + 6 Monate]
