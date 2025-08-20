# API v2 Implementation Roadmap

**Stand: 27.07.2025 - 21:05 Uhr**

## 🎯 Übersicht

Dieses Dokument ist deine zentrale Anlaufstelle für die API v2 Implementation.

## 📊 AKTUELLER STATUS

✅ **FERTIG (6/11 APIs - 55%)**

- Auth v2 - 11/11 Tests ✅
- Users v2 - 13/13 Tests ✅
- Calendar v2 - 33/33 Tests ✅
- Chat v2 - 22 Tests geschrieben ✅
- Departments v2 - 27/27 Tests ✅
- Teams v2 - 48/48 Tests ✅ (27.07. fertiggestellt)

🔧 **FAST FERTIG (1/11 APIs - 9%)**

- Documents v2 - 23/28 Tests ✅ (82% grün)

⏳ **AUSSTEHEND (4/11 APIs - 36%)**

- Blackboard v2
- KVP v2
- Shifts v2
- Surveys v2

---

## 🚀 SOFORT STARTEN (Diese Woche)

### 1️⃣ Deprecation Middleware erstellen

**Datei:** `backend/src/middleware/deprecation.ts`

```typescript
export function deprecationMiddleware(version: string, sunset: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/v1")) {
      res.setHeader("Deprecation", "true");
      res.setHeader("Sunset", sunset);
      res.setHeader("Link", '</api/v2>; rel="successor-version"');
    }
    next();
  };
}
```

**Einbinden in:** `backend/src/app.ts`

```typescript
app.use(deprecationMiddleware("v1", "2025-12-31"));
```

### 2️⃣ Response Wrapper erstellen

**Datei:** `backend/src/utils/apiResponse.ts`

```typescript
import { v4 as uuidv4 } from "uuid";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export function successResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0",
    },
  };
}

export function errorResponse(code: string, message: string, details?: any[]): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
  };
}
```

### 3️⃣ Field Mapping Utilities erstellen

**Datei:** `backend/src/utils/fieldMapping.ts`

```typescript
import { camelCase, snakeCase, mapKeys } from "lodash";

export const dbToApi = <T>(dbObject: any): T => {
  return mapKeys(dbObject, (_, key) => camelCase(key)) as T;
};

export const apiToDb = <T>(apiObject: any): T => {
  return mapKeys(apiObject, (_, key) => snakeCase(key)) as T;
};

// Beispiel Usage:
// const userFromDb = { first_name: 'Max', created_at: '2024-01-01' };
// const userForApi = dbToApi(userFromDb); // { firstName: 'Max', createdAt: '2024-01-01' }
```

---

## 📅 ERWEITETER ZEITPLAN - ALLE 11 APIs

### Phase 1: Core APIs (Wochen 1-12) ✅

#### Wochen 1-3: Auth API v2 🔐 ✅

**Status:** FERTIG (24.07.2025)

- ✅ JWT mit Access & Refresh Tokens
- ✅ 6 Endpoints implementiert
- ✅ Rate Limiting & Security
- ✅ Integration Tests

#### Wochen 4-6: Users API v2 👥 ✅

**Status:** FERTIG (24.07.2025)

- ✅ 13 Endpoints komplett
- ✅ Service Layer Pattern
- ✅ Profile Pictures & Availability
- ✅ Multi-Tenant Isolation

#### Wochen 7-9: Calendar API v2 📅 ✅

**Status:** FERTIG (25.07.2025)

- ✅ Event CRUD mit Attendees
- ✅ ICS/CSV Export
- ✅ Recurrence Rules
- ✅ 55 Tests geschrieben

#### Wochen 10-12: Chat API v2 💬 ✅

**Status:** FERTIG (25.07.2025)

- ✅ 18 Endpoints (13 implementiert, 5 Phase 2)
- ✅ File Attachments mit Multer
- ✅ Read Receipts & Unread Count
- ✅ 22 Integration Tests

### Phase 2: Organization APIs (Wochen 13-18)

#### Wochen 13-14: Departments API v2 🏢 ✅

**Status:** FERTIG (25.07.2025)

- ✅ CRUD Operations
- ✅ Hierarchie-Management
- ✅ User Assignments
- ✅ Department Stats
- ✅ 27 Integration Tests

#### Wochen 15-16: Teams API v2 👨‍👩‍👧‍👦 ✅

**Status:** FERTIG (27.07.2025)

- ✅ Team CRUD Operations
- ✅ Member Management (add/remove)
- ✅ Service Layer Pattern
- ✅ 48 Integration Tests (96% passing)
- ✅ Multi-Tenant Isolation

#### Wochen 17-18: Shifts API v2 ⏰

**Start:** KW 47 (18.11. - 01.12.2025)

- [ ] Shift Templates
- [ ] Recurring Shifts
- [ ] Swap Requests
- [ ] Availability Integration

### Phase 3: Content & Collaboration (Wochen 19-24)

#### Wochen 19-20: Documents API v2 📄

**Status:** FAST FERTIG (27.07.2025) - 90% implementiert

- ✅ File Upload/Download (Multer für PDFs)
- ✅ Access Control (recipient-based)
- ✅ Archive/Unarchive
- ✅ Read Status Tracking
- ✅ Tags & Metadata
- ⚠️ 5 Test-Fehler zu beheben

#### Wochen 21-22: Blackboard API v2 📢

**Start:** KW 51 (16.12. - 29.12.2025)

- [ ] Announcements CRUD
- [ ] Confirmations
- [ ] Categories
- [ ] Attachments

#### Wochen 23-24: KVP API v2 💡

**Start:** KW 1 (30.12.2025 - 12.01.2026)

- [ ] Suggestions CRUD
- [ ] Workflow States
- [ ] Comments & Voting
- [ ] Reports & Analytics

### Phase 4: Advanced Features (Wochen 25-26)

#### Wochen 25-26: Surveys API v2 📊

**Start:** KW 3 (13.01. - 26.01.2026)

- [ ] Survey Builder
- [ ] Response Collection
- [ ] Analytics
- [ ] Export Functions

---

## 📊 PROGRESS TRACKING

### Gesamt-Fortschritt (11 APIs)

```
Phase 1: Core APIs (4/4) ✅
[██████████] 100% - Auth API v2 ✅
[██████████] 100% - Users API v2 ✅
[██████████] 100% - Calendar API v2 ✅
[██████████] 100% - Chat API v2 ✅

Phase 2: Organization APIs (2/3)
[██████████] 100% - Departments API v2 ✅
[██████████] 100% - Teams API v2 ✅
[░░░░░░░░░░] 0% - Shifts API v2

Phase 3: Content & Collaboration (1/3)
[████████░░] 90% - Documents API v2 🔧
[░░░░░░░░░░] 0% - Blackboard API v2
[░░░░░░░░░░] 0% - KVP API v2

Phase 4: Advanced (0/1)
[░░░░░░░░░░] 0% - Surveys API v2

GESAMT: 6.9/11 APIs (63%) ✅
```

### Timeline Overview

```
2025:
JUL: ✅ Auth, Users, Calendar, Chat, Departments, Teams
AUG: Documents, Blackboard
SEP: KVP, Shifts
OKT: Surveys, Final Testing
NOV: Migration & Documentation
DEZ: v1 Deprecation Complete
```

### Test Coverage Progress

```
Vorher: ~40 von 502 Tests (8%)
Aktuell: ~194 von 502 Tests (39%)
Ziel: 400+ von 502 Tests (80%)
```

### Detaillierte Test-Statistik

| API            | Tests       | Status     | Coverage                  |
| -------------- | ----------- | ---------- | ------------------------- |
| Auth v2        | 11/11       | ✅ 100%    | Login, Register, JWT      |
| Users v2       | 13/13       | ✅ 100%    | CRUD, Archive, Profile    |
| Calendar v2    | 33/33       | ✅ 100%    | Events, Attendees, Export |
| Chat v2        | 22          | ✅ Written | Messages, Conversations   |
| Departments v2 | 27/27       | ✅ 100%    | CRUD, Stats, Hierarchy    |
| Teams v2       | 48/48       | ✅ 100%    | CRUD, Members, Leaders    |
| Documents v2   | 23/28       | 🔧 82%     | Upload, Archive, Access   |
| **TOTAL**      | **177/182** | **97%**    | **Fast alle Tests grün!** |

---

## 📝 CHECKLISTE FÜR JEDE API

- [ ] OpenAPI Spec updaten
- [ ] Response Format: success flag + meta
- [ ] Field Names: camelCase
- [ ] Error Handling: Strukturierte Errors
- [ ] Deprecation Headers für v1
- [ ] Migration Guide schreiben
- [ ] Tests anpassen/schreiben
- [ ] Performance testen
- [ ] Security Review
- [ ] Documentation updaten

---

## 🔗 WICHTIGE LINKS

- **Workshop Decisions:** `/docs/api/API-WORKSHOP-MATERIALS/workshop-decisions.md`
- **API Standards:** `/docs/TYPESCRIPT-STANDARDS.md` (Abschnitt 12)
- **Original Plan:** `/docs/api/API-WORKSHOP-MATERIALS/workshop-final-summary.md`
- **Swagger UI:** <http://localhost:3000/api-docs/>

---

## 🎆 MEILENSTEINE

1. **Ende Juli:** 5 APIs fertig ✅ (Auth, Users, Calendar, Chat, Departments)
2. **Ende August:** 7 APIs fertig (+ Teams, Documents)
3. **Ende September:** 9 APIs fertig (+ Blackboard, KVP)
4. **Ende Oktober:** Alle 11 APIs fertig (+ Shifts, Surveys)
5. **Ende November:** Migration abgeschlossen
6. **Ende Dezember:** v1 Shutdown

---

**Letzte Aktualisierung:** 27.07.2025
**Nächster Check:** 03.08.2025 (Documents API Status)
