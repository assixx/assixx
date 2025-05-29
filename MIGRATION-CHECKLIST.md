# ✅ TypeScript Migration Checklist

## 🚀 Pre-Migration Checklist

- [ ] Full Backup erstellt
- [ ] Alle Tests laufen grün
- [ ] Team informiert
- [x] Feature-Branch erstellt: `feature/typescript-migration`

## 📦 Phase 1: Setup (Tag 1-2)

### Dependencies

- [x] `npm install --save-dev typescript`
- [x] `npm install --save-dev @types/node @types/express`
- [x] `npm install --save-dev @types/bcrypt @types/jsonwebtoken`
- [ ] `npm install --save-dev @types/mysql2 @types/multer` (mysql2 types nicht verfügbar)
- [x] `npm install --save-dev @types/cors @types/helmet`
- [x] `npm install --save-dev ts-node nodemon`

### Konfiguration

- [x] `tsconfig.json` erstellt
- [x] `nodemon.json` für TypeScript angepasst
- [x] Build-Scripts in package.json
- [x] `.gitignore` für dist/ Ordner

## 🏗️ Phase 2: Type Definitions (Tag 3-4)

### Core Types

- [x] `/backend/src/types/models.d.ts`
  - [x] User Interface
  - [x] Tenant Interface
  - [x] Document Interface
  - [x] Feature Interface
- [x] `/backend/src/types/api.d.ts`
  - [x] ApiResponse Type
  - [x] Request Types
  - [x] Error Types
- [x] `/backend/src/types/express.d.ts`
  - [x] Request Extensions
  - [x] Custom Middleware Types

## 🔄 Phase 3: Core Module Migration (Tag 5-10)

### Security Layer (Priorität 1)

- [x] `auth.service.js` → `auth.service.ts`
- [x] `auth.middleware.js` → `auth.middleware.ts`
- [x] `auth.js` → `auth.ts`
- [x] `tenant.middleware.js` → `tenant.middleware.ts`
- [x] `validators.js` → `validators.ts`
- [x] `security-enhanced.js` → `security-enhanced.ts`

### Database Layer

- [x] `database.js` → `database.ts`
- [x] `tenantDb.js` → `tenantDb.ts`
- [x] Alle Models (`/models/*.js` → `*.ts`)
  - [x] `user.js` → `user.ts`
  - [x] `tenant.js` → `tenant.ts`
  - [x] `department.js` → `department.ts`
  - [x] `document.js` → `document.ts`
  - [x] `feature.js` → `feature.ts`
  - [x] `team.js` → `team.ts`
  - [x] `adminLog.js` → `adminLog.ts`
  - [x] `blackboard.js` → `blackboard.ts`
  - [x] `calendar.js` → `calendar.ts`
  - [x] `kvp.js` → `kvp.ts`
  - [x] `shift.js` → `shift.ts`
  - [x] `survey.js` → `survey.ts`

### Services (Priorität 2) ✅ KOMPLETT

- [x] `user.service.js` → `user.service.ts`
- [x] `document.service.js` → `document.service.ts`
- [x] `tenant.service.js` → `tenant.service.ts`
- [x] `feature.service.js` → `feature.service.ts`
- [x] `admin.service.js` → `admin.service.ts`
- [x] `blackboard.service.js` → `blackboard.service.ts`
- [x] `calendar.service.js` → `calendar.service.ts`
- [x] `chat.service.js` → `chat.service.ts`
- [x] `department.service.js` → `department.service.ts`
- [x] `employee.service.js` → `employee.service.ts`
- [x] `kvp.service.js` → `kvp.service.ts`
- [x] `shift.service.js` → `shift.service.ts`
- [x] `survey.service.js` → `survey.service.ts`
- [x] `team.service.js` → `team.service.ts`

### Controllers

- [x] `auth.controller.js` → `auth.controller.ts`
- [x] `admin.controller.js` → `admin.controller.ts`
- [x] `blackboard.controller.js` → `blackboard.controller.ts`
- [x] `calendar.controller.js` → `calendar.controller.ts`
- [x] `chat.controller.js` → `chat.controller.ts`
- [x] `department.controller.js` → `department.controller.ts`
- [x] `document.controller.js` → `document.controller.ts`
- [x] `employee.controller.js` → `employee.controller.ts`
- [x] `feature.controller.js` → `feature.controller.ts`
- [x] `kvp.controller.js` → `kvp.controller.ts`
- [x] `shift.controller.js` → `shift.controller.ts`
- [x] `survey.controller.js` → `survey.controller.ts`
- [x] `team.controller.js` → `team.controller.ts`
- [x] `tenant.controller.js` → `tenant.controller.ts`

### Controllers ✅ KOMPLETT (13/13)

🎉 **ALLE CONTROLLER ERFOLGREICH MIGRIERT!**

### Routes (Priorität 3) - **25/25 Complete** ✅

- [x] `auth.routes.js` → `auth.routes.ts`
- [x] `auth.js` → `auth.ts` (route)
- [x] `admin.js` → `admin.ts` (route)
- [x] `areas.js` → `areas.ts` (route)
- [x] `blackboard.js` → `blackboard.ts` (route)
- [x] `calendar.js` → `calendar.ts` (route)
- [x] `chat.js` → `chat.ts` (route)
- [x] `departments.js` → `departments.ts` (route)
- [x] `documents.js` → `documents.ts` (route)
- [x] `employee.js` → `employee.ts` (route)
- [x] `features.js` → `features.ts` (route)
- [x] `html.routes.js` → `html.routes.ts` (route)
- [x] `index.js` → `index.ts` (route)
- [x] `kvp.js` → `kvp.ts` (route)
- [x] `legacy.routes.js` → `legacy.routes.ts` (route)
- [x] `machines.js` → `machines.ts` (route)
- [x] `root.js` → `root.ts` (route)
- [x] `shifts.js` → `shifts.ts` (route)
- [x] `signup.js` → `signup.ts` (route)
- [x] `surveys.js` → `surveys.ts` (route)
- [x] `teams.js` → `teams.ts` (route)
- [x] `unsubscribe.js` → `unsubscribe.ts` (route)
- [x] `user.js` → `user.ts` (route)
- [x] `users.js` → `users.ts` (route)

🎉 **ALLE ROUTES ERFOLGREICH MIGRIERT!**

### Core App Files (Priorität 4) ✅

- [x] `app.js` → `app.ts`
- [x] `server.js` → `server.ts`

🎉 **ALLE CORE APP FILES ERFOLGREICH MIGRIERT!**

### Utils (Priorität 5)

- [ ] `constants.js` → `constants.ts`
- [ ] `helpers.js` → `helpers.ts`
- [ ] `logger.js` → `logger.ts`
- [ ] `emailService.js` → `emailService.ts`
- [ ] `validators.js` → `validators.ts`

## 🧪 Phase 4: Testing (Tag 11-12)

- [ ] Test-Runner für TypeScript konfiguriert
- [ ] Unit Tests angepasst
- [ ] Integration Tests laufen
- [ ] E2E Tests funktionieren
- [ ] Coverage Report generiert

## 📊 Phase 5: ES Modules (Tag 13-17)

### Vorbereitung

- [ ] `"type": "module"` in package.json
- [ ] tsconfig.json für ES Modules
- [ ] Import-Map erstellt

### Migration

- [ ] require → import statements
- [ ] module.exports → export
- [ ] \_\_dirname Fixes
- [ ] Dynamic imports angepasst

## 🎯 Quality Gates

### TypeScript

- [ ] Keine impliziten `any` Types
- [ ] Strict Mode aktiviert
- [ ] 0 TypeScript Errors
- [ ] Type Coverage > 90%

### Allgemein

- [ ] Alle Tests grün
- [ ] Performance Tests bestanden
- [ ] Manuelle Tests erfolgreich
- [ ] Code Review durchgeführt

## 🚨 Rollback-Punkte

- [ ] Git Tag nach Setup: `pre-typescript-v1`
- [ ] Git Tag nach Core Types: `typescript-types-v1`
- [ ] Git Tag nach Security Layer: `typescript-security-v1`
- [ ] Git Tag nach Full Migration: `typescript-complete-v1`

## 📝 Notizen

**Probleme gefunden:**

- Pool query TypeScript Union Type Issues (gelöst mit type assertion)
- DbUser vs DatabaseUser type mismatch (gelöst mit converter functions)

**Gelöste Issues:**

- auth.ts, auth.service.ts, auth middleware erfolgreich migriert
- security-enhanced.ts, validators.ts erfolgreich migriert
- tenant middleware erfolgreich migriert
- database.ts und tenantDb.ts erfolgreich migriert
- ALLE Models erfolgreich zu TypeScript migriert (12 Models)
- ALLE Services erfolgreich zu TypeScript migriert (15 Services, inkl. auth.service.ts)

**Nächste Schritte:**

- Controllers migrieren (auth.controller.js als nächstes)
- ES Modules Migration nach TypeScript

**Hinweise zu den Services:**

- employee.service.js versucht '../models/employee' zu laden, was nicht existiert (verwendet user model)
- Viele generische Services (kvp, shift) passen nicht zu den spezifischen Model-Methoden
- Diese Inkonsistenzen sollten in einem separaten Refactoring behoben werden
