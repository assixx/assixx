# 📋 API v2 TODO & Status

**Letzte Aktualisierung:** 26.07.2025 (Samstag)
**Zweck:** Zentrale Übersicht für API v2 Entwicklung - Was ist fertig, was kommt als nächstes
**Wichtig:** Diese Datei ist die SINGLE SOURCE OF TRUTH für API v2 Progress!

## 🎯 WARUM API v2? - Der Ursprung

### Das Problem (Juli 2025)
- Wir wollten Unit Tests für API v1 schreiben
- **Ergebnis:** Nur 8% der Tests bestanden! 
- **Grund:** API v1 war inkonsistent, keine Standards, keine Dokumentation
- Tests erwarteten andere Strukturen als API lieferte (z.B. Channels vs Conversations)
- OpenAPI Spec war veraltet und falsch

### Die Lösung: API v2
- **Konsistente Standards** (camelCase, success flag, meta)
- **Vollständige OpenAPI Dokumentation** von Anfang an
- **Test-Driven Development** - Tests definieren das Verhalten
- **Migration statt Chaos** - 6 Monate Übergangszeit

### Der Workshop (24.07.2025)
- 15 konkrete Entscheidungen getroffen
- Klare Standards definiert
- 12-Wochen Implementierungsplan erstellt
- **Ziel:** Eine API die TESTBAR und WARTBAR ist!

## 📌 Komplette API v2 Übersicht (11 APIs)

### ✅ Fertig (5 von 11 = 45%)
1. **Auth v2** - Authentication API v2 with improved standards
2. **Users v2** - User management API v2
3. **Calendar v2** - Calendar and events API v2
4. **Chat v2** - Real-time messaging API v2
5. **Departments v2** - Department management API v2

### ⏳ Noch zu implementieren (6 von 11 = 55%)
6. **Teams v2** - Team management API v2
7. **Documents v2** - Document management API v2
8. **Blackboard v2** - Company announcements API v2
9. **KVP v2** - Continuous improvement process API v2
10. **Shifts v2** - Shift planning API v2
11. **Surveys v2** - Survey management API v2

## ✅ Was wurde bereits gemacht?

### 🏆 Fertige APIs im Detail

1. **Auth API v2** ✅ 
   - **Status:** 100% fertig + Tests laufen
   - **Endpoints:** 6 (login, register, logout, refresh, verify, me)
   - **Tests:** 11/11 grün (26.07. alle Fehler behoben)
   - **Dateien:** `/backend/src/routes/v2/auth/`
   - **Besonderheit:** JWT mit Access (15min) & Refresh (7d) Tokens

2. **Users API v2** ✅
   - **Status:** 100% implementiert, Tests haben noch Fehler
   - **Endpoints:** 13 (CRUD, Archive, Profile Picture, Password, Availability)
   - **Tests:** Geschrieben aber Email-Format Problem
   - **Dateien:** `/backend/src/routes/v2/users/`
   - **Besonderheit:** Service Layer Pattern implementiert

3. **Calendar API v2** ✅
   - **Status:** 100% implementiert
   - **Endpoints:** 10 (Events CRUD, Attendees, Export)
   - **Tests:** 55 geschrieben (Logic + Simple + Integration)
   - **Dateien:** `/backend/src/routes/v2/calendar/`
   - **Besonderheit:** ICS/CSV Export, Recurrence Support

4. **Chat API v2** ✅
   - **Status:** 100% für Phase 1 (5 Features für Phase 2)
   - **Endpoints:** 13 aktiv + 5 NOT_IMPLEMENTED
   - **Tests:** 22 Test Cases geschrieben
   - **Dateien:** `/backend/src/routes/v2/chat/`
   - **Besonderheit:** File Upload, WebSocket vorbereitet

5. **Departments API v2** ✅
   - **Status:** 100% implementiert
   - **Endpoints:** 7 (CRUD, Stats, Members)
   - **Tests:** 27 geschrieben (Auth Token Problem)
   - **Dateien:** `/backend/src/routes/v2/departments/`
   - **Besonderheit:** Parent-Child Hierarchie

### 🔧 Basis-Infrastructure ✅

- **Deprecation Middleware** - `/backend/src/middleware/deprecation.ts`
- **Response Wrapper** - `/backend/src/utils/apiResponse.ts`
- **Field Mapping** - `/backend/src/utils/fieldMapping.ts`
- **Auth v2 Middleware** - `/backend/src/middleware/v2/auth.middleware.ts`
- **OpenAPI/Swagger v2** - `/backend/src/config/swagger-v2.ts`

### 📚 Dokumentation ✅

- API-V2-STATUS.md - Überblick
- API-V2-QUICK-REFERENCE.md - Technische Referenz
- API-V2-DEVELOPER-GUIDE.md - Entwickler-Anleitung
- MIGRATION-GUIDE-V1-TO-V2.md - Migration von v1
- API-V2-KNOWN-ISSUES.md - Bekannte Probleme

## 🎯 Nächste konkrete Tasks

### 1. Existierende v2 Tests fixen (NEXT!) 🚨

**Warum:** Bevor wir neue APIs bauen, sollten die existierenden funktionieren!
**Geschätzte Zeit:** 2-3 Stunden
**Priorität:** KRITISCH - CI/CD muss grün werden

**Reihenfolge:**
1. **users-v2.test.ts** - Email Format Problem (wie bei Auth v2 gelöst)
2. **calendar-v2.test.ts** - Permission vs NotFound prüfen
3. **departments-v2.test.ts** - Auth Token Problem

**Haupt-Problem:** Tests nutzen hardcoded emails statt `testUser.email`
**Lösung:** Siehe Auth v2 Fix als Referenz (26.07. gelöst)

### 2. Teams API v2 implementieren 🎯

**Warum:** Nach Test-Fixes können wir sicher neue APIs bauen
**Geschätzte Zeit:** 3-4 Stunden
**Priorität:** HOCH - Nächste API nach Test-Fixes

**Dateien erstellen:**
```
/backend/src/routes/v2/teams/
├── index.ts           # Routes definition
├── teams.controller.ts # HTTP handlers
├── teams.service.ts   # Business logic
└── teams.validation.ts # Input validation
```

**Schritt-für-Schritt mit Code-Beispielen:**

1. **Service Layer** (`teams.service.ts`):
```typescript
import Team from "../../../models/team";
import { ServiceError } from "../../../utils/ServiceError";
import { dbToApi } from "../../../utils/fieldMapping";

export class TeamsService {
  async listTeams(tenantId: number, filters?: any) {
    const teams = await Team.findAll({
      tenant_id: tenantId,
      ...filters
    });
    return teams.map(team => dbToApi(team));
  }

  async getTeamById(id: number, tenantId: number) {
    const team = await Team.findById(id, tenantId);
    if (!team) {
      throw new ServiceError("NOT_FOUND", "Team not found");
    }
    return dbToApi(team);
  }

  async createTeam(data: any, tenantId: number) {
    const teamData = {
      ...data,
      tenant_id: tenantId,
      created_at: new Date(),
      updated_at: new Date()
    };
    const teamId = await Team.create(teamData);
    return this.getTeamById(teamId, tenantId);
  }

  async updateTeam(id: number, data: any, tenantId: number) {
    const team = await this.getTeamById(id, tenantId); // Check exists + tenant
    await Team.update(id, {
      ...data,
      updated_at: new Date()
    });
    return this.getTeamById(id, tenantId);
  }

  async deleteTeam(id: number, tenantId: number) {
    const team = await this.getTeamById(id, tenantId); // Check exists + tenant
    await Team.delete(id);
    return { message: "Team deleted successfully" };
  }
}

export const teamsService = new TeamsService();
```

2. **Controller** (`teams.controller.ts`):
```typescript
import { Response } from "express";
import { AuthenticatedRequest } from "../../../types/request.types";
import { successResponse, errorResponse } from "../../../utils/apiResponse";
import { teamsService } from "./teams.service";

export async function listTeams(req: AuthenticatedRequest, res: Response) {
  try {
    const teams = await teamsService.listTeams(req.user.tenant_id);
    res.json(successResponse(teams));
  } catch (error) {
    res.status(500).json(errorResponse("SERVER_ERROR", "Failed to list teams"));
  }
}

export async function createTeam(req: AuthenticatedRequest, res: Response) {
  try {
    const team = await teamsService.createTeam(req.body, req.user.tenant_id);
    res.status(201).json(successResponse(team));
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.statusCode).json(errorResponse(error.code, error.message));
    } else {
      res.status(500).json(errorResponse("SERVER_ERROR", "Failed to create team"));
    }
  }
}
```

3. **Routes** (`index.ts`):
```typescript
import { Router } from "express";
import { authenticateV2 } from "../../../middleware/v2/auth.middleware";
import { typed } from "../../../utils/routeHandlers";
import { teamsValidation } from "./teams.validation";
import * as teamsController from "./teams.controller";

const router = Router();

router.get("/", authenticateV2, typed.auth(teamsController.listTeams));
router.get("/:id", authenticateV2, teamsValidation.getById, typed.auth(teamsController.getTeamById));
router.post("/", authenticateV2, teamsValidation.create, typed.auth(teamsController.createTeam));
router.put("/:id", authenticateV2, teamsValidation.update, typed.auth(teamsController.updateTeam));
router.delete("/:id", authenticateV2, teamsValidation.delete, typed.auth(teamsController.deleteTeam));

export default router;
```

4. **Validation** (`teams.validation.ts`):
```typescript
import { body, param } from "express-validator";
import { handleValidation } from "../../../middleware/validation";

export const teamsValidation = {
  getById: [
    param("id").isInt().withMessage("Team ID must be an integer"),
    handleValidation
  ],
  
  create: [
    body("name")
      .trim()
      .notEmpty().withMessage("Team name is required")
      .isLength({ min: 2, max: 100 }).withMessage("Team name must be 2-100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
    body("departmentId")
      .optional()
      .isInt().withMessage("Department ID must be an integer"),
    handleValidation
  ],
  
  update: [
    param("id").isInt().withMessage("Team ID must be an integer"),
    body("name")
      .optional()
      .trim()
      .notEmpty().withMessage("Team name cannot be empty")
      .isLength({ min: 2, max: 100 }).withMessage("Team name must be 2-100 characters"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage("Description cannot exceed 500 characters"),
    handleValidation
  ],
  
  delete: [
    param("id").isInt().withMessage("Team ID must be an integer"),
    handleValidation
  ]
};
```

**Endpoints zu implementieren:**
- `GET /api/v2/teams` - List teams
- `GET /api/v2/teams/:id` - Get team
- `POST /api/v2/teams` - Create team
- `PUT /api/v2/teams/:id` - Update team
- `DELETE /api/v2/teams/:id` - Delete team
- `GET /api/v2/teams/:id/members` - Get members
- `POST /api/v2/teams/:id/members` - Add member
- `DELETE /api/v2/teams/:id/members/:userId` - Remove member

**Referenz-Code:**
- Kopiere Pattern von `/backend/src/routes/v2/departments/`
- Model bereits vorhanden: `/backend/src/models/team.ts`
- v1 Routes: `/backend/src/routes/teams.ts`

**Wichtige Hinweise für Teams API:**
- Multi-Tenant Isolation beachten (tenant_id)
- Team Members über separate Tabelle `team_members`
- Permissions: Admin kann alle Teams, User nur eigene
- Department-Zuordnung optional

### 3. Documents API v2 (Document management API v2)

**Nach Teams API implementieren**

**Besonderheiten:**
- File Upload/Download  
- Verschlüsselung für sensible Daten
- Versionierung
- Access Control
- PDF Preview
- Ordner-Struktur

### 4. Blackboard API v2 (Company announcements API v2)

**Wichtige Features:**
- Unternehmens-weite Ankündigungen
- Prioritäten (Normal, Wichtig, Kritisch)
- Anhänge und Bilder
- Bestätigungs-Tracking (wer hat gelesen)
- Archivierung nach Zeit

### 5. KVP API v2 (Continuous improvement process API v2)

**Industrie-spezifisch:**
- Verbesserungsvorschläge einreichen
- Status-Tracking (Eingereicht, In Prüfung, Umgesetzt)
- Prämien-System
- Kategorie-Verwaltung
- ROI Berechnung

### 6. Shifts API v2 (Shift planning API v2)

**Komplex - Höchste Priorität für Industrie:**
- Schichtplan-Templates
- Schichtwechsel-Anfragen
- Überstunden-Tracking
- Pausenzeiten-Verwaltung
- Export für Lohnabrechnung

### 7. Surveys API v2 (Survey management API v2)

**Features:**
- Umfrage-Builder
- Verschiedene Fragetypen
- Anonyme/Nicht-anonyme Umfragen
- Auswertung & Reports
- Zeitgesteuerte Umfragen

## 📝 Wichtige Befehle

### Tests ausführen
```bash
# Einzelner Test
docker exec assixx-backend pnpm test -- backend/src/routes/__tests__/teams-v2.test.ts

# Alle v2 Tests
docker exec assixx-backend pnpm test -- --testPathPattern="v2\.test\.ts$"

# Mit Debug Output
docker exec assixx-backend pnpm test -- --verbose --runInBand
```

### TypeScript prüfen
```bash
docker exec assixx-backend pnpm run type-check
docker exec assixx-backend pnpm run build:ts
```

### API testen
```bash
# Login für Token
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@tenant1.com", "password": "AdminPass123!"}'

# Mit Token
curl -X GET http://localhost:3000/api/v2/teams \
  -H "Authorization: Bearer <token>"
```

## 🧪 Test-Pattern für API v2 Tests

### WICHTIG: Keine separate Test-DB!
- Tests laufen in der **GLEICHEN Datenbank** wie Development
- Isolation durch `__AUTOTEST__` Prefix für alle Test-Daten
- Cleanup löscht nur Daten mit diesem Prefix
- **Vorteil:** Echtes DB-Schema, keine Mocks!

### Wie Test-Daten funktionieren

**createTestUser() Pattern:**
```javascript
// Was du schreibst:
const user = await createTestUser(testDb, {
  email: "admin@test.com",
  password: "TestPass123!"
});

// Was tatsächlich erstellt wird:
// email: "__AUTOTEST__admin_1234567890_123@test.com"
// username: "__AUTOTEST__admin_1234567890_123"
```

**WICHTIG:** 
- `createTestUser()` fügt automatisch `__AUTOTEST__` Prefix hinzu
- Plus Timestamp für Eindeutigkeit
- **IMMER** `user.email` verwenden, NIE hardcoded!

### Cleanup Pattern
```javascript
// cleanupTestData() löscht automatisch alles mit __AUTOTEST__
await cleanupTestData(); // Löscht nur Test-Daten, keine echten Daten!
```

### Test Helper Functions
```javascript
// Verfügbar aus /backend/src/routes/mocks/database.ts
import {
  createTestDatabase,      // DB Connection erstellen
  cleanupTestData,        // Test-Daten löschen
  closeTestDatabase,      // DB Connection schließen
  createTestTenant,       // Tenant mit __AUTOTEST__ prefix
  createTestUser,         // User mit __AUTOTEST__ prefix
  createTestDepartment,   // Department für Tests
  createTestTeam          // Team für Tests (wenn vorhanden)
} from "../mocks/database";
```

### Typisches Test-Setup
```javascript
beforeAll(async () => {
  testDb = await createTestDatabase();
  await cleanupTestData(); // Alte Test-Daten entfernen
  
  // Tenant erstellen
  tenantId = await createTestTenant(testDb, "teamtest", "Test Company");
  
  // Admin User erstellen
  adminUser = await createTestUser(testDb, {
    email: "admin@test.com", // NICHT das verwenden!
    password: "AdminPass123!",
    role: "admin",
    tenant_id: tenantId
  });
  
  // Login mit GENERIERTER Email
  const loginRes = await request(app)
    .post("/api/v2/auth/login")
    .send({
      email: adminUser.email, // RICHTIG! Nutzt __AUTOTEST__ Email
      password: "AdminPass123!"
    });
  
  adminToken = loginRes.body.data.accessToken;
});

// Beispiel Test:
it("should create a new team", async () => {
  const response = await request(app)
    .post("/api/v2/teams")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Test Team",
      description: "A test team"
    });
    
  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.name).toBe("Test Team");
  expect(response.body.data.tenantId).toBe(tenantId);
});
```

## 🔍 Debugging-Tipps

### Bei Test-Fehlern
1. Prüfe ob User richtig erstellt wurde (mit __AUTOTEST__ prefix)
2. Nutze `console.log(testUser)` um generierte Email zu sehen
3. Prüfe JWT Token mit https://jwt.io
4. Schaue in API-V2-KNOWN-ISSUES.md für bekannte Probleme
5. Check: Verwendest du `testUser.email` oder hardcoded email?

### Bei TypeScript-Fehlern
1. Nutze `typed.auth()` wrapper für Route Handler
2. Import types aus `request.types.ts`
3. Vermeide `any` - nutze konkrete Types

## 🚀 Quick Start für nächste Session

### Projekt Setup (Falls neu)
```bash
# Working Directory WICHTIG!
cd /home/scs/projects/Assixx/docker

# Docker starten
docker-compose up -d

# Warten bis alles läuft (ca. 30 Sekunden)
sleep 30

# Status prüfen
../scripts/dev-status.sh

# Logs checken falls Probleme
docker-compose logs backend
```

### Direkt mit Entwicklung starten
```bash
# 1. Diese Datei lesen für Kontext
cat /home/scs/projects/Assixx/docs/api/todo_api.md

# 2. Beispiel einer fertigen v2 API anschauen
ls -la /home/scs/projects/Assixx/backend/src/routes/v2/departments/

# 3. Mit Teams API v2 starten!
cd /home/scs/projects/Assixx
mkdir -p backend/src/routes/v2/teams

# 4. Departments als Vorlage kopieren
cp -r backend/src/routes/v2/departments/* backend/src/routes/v2/teams/

# 5. VSCode oder Editor öffnen und anpassen
```

### Wichtige Dateien zum Lesen
1. **Beispiel einer fertigen API:** `/backend/src/routes/v2/users/`
2. **API Standards:** `/docs/api/API-V2-DEVELOPER-GUIDE.md`
3. **Bekannte Probleme:** `/docs/api/API-V2-KNOWN-ISSUES.md`
4. **Team Model:** `/backend/src/models/team.ts`

## ⚠️ WICHTIGE ERINNERUNGEN

1. **Multi-Tenant Isolation** ist KRITISCH - jede Query braucht tenant_id!
2. **Test User Emails** haben __AUTOTEST__ Prefix - nie hardcoden!
3. **JWT Tokens** brauchen email Parameter (26.07. gefixt)
4. **Service Layer Pattern** verwenden wie bei Users v2
5. **TypeScript strict** - keine `any` types!
6. **OpenAPI Docs** direkt mit implementieren
7. **Tests FIRST** - Wir machen API v2 damit Tests funktionieren!
8. **Konsistenz** - Jede API folgt den gleichen Standards

## 📊 Fortschritts-Metriken

### Gesamt-Status
- **APIs fertig:** 5/11 (45%)
- **Endpoints implementiert:** 49 aktiv + 5 NOT_IMPLEMENTED
- **Tests geschrieben:** 115+ (Auth: 11, Calendar: 55, Chat: 22, Departments: 27)
- **Arbeitszeit bisher:** ~30 Stunden
- **Geschätzte Zeit bis 100%:** ~35 Stunden

### Noch zu implementieren (6 APIs)
1. **Teams v2** - Team management API v2 - 8 Endpoints (~4h)
2. **Documents v2** - Document management API v2 - 10 Endpoints (~6h)
3. **Blackboard v2** - Company announcements API v2 - 6 Endpoints (~4h)
4. **KVP v2** - Continuous improvement process API v2 - 8 Endpoints (~5h)
5. **Shifts v2** - Shift planning API v2 - 12 Endpoints (~8h)
6. **Surveys v2** - Survey management API v2 - 10 Endpoints (~8h)

**Total:** 54 Endpoints, ~35 Stunden Restarbeit

## 🔗 Referenzen

- **Swagger UI:** http://localhost:3000/api-docs/v2
- **GitHub:** https://github.com/SCS-Technik/Assixx
- **Branch:** unit-tests--Github-Actions

---

## 🏁 Mission Statement

**Wir bauen API v2 nicht weil v1 "alt" ist, sondern weil:**
- v1 ist NICHT TESTBAR (nur 8% Tests bestehen)
- v1 hat KEINE konsistenten Standards
- v1 OpenAPI Spec stimmt nicht mit Realität überein
- v1 macht Wartung zum Albtraum

**API v2 ist unser Weg zu:**
- 100% Test Coverage
- Vorhersagbare, konsistente APIs
- Einfache Wartung und Erweiterung
- Professionelle Dokumentation

**Bei Fragen:** Schaue zuerst in API-V2-DEVELOPER-GUIDE.md oder API-V2-QUICK-REFERENCE.md