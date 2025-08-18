# 📁 Assixx Projektstruktur

> **Letzte Aktualisierung:** 18.08.2025 - Komplette Neustrukturierung mit /config Ordner  
> **Status:** ✅ API v2 zu 100% implementiert, Frontend-Migration bei 48.4%
> **Branch:** feature/api-v2-frontend-migration

## 🏗️ Überblick

Das Assixx Multi-Tenant SaaS System ist ein Enterprise-Level Projekt mit klarer Trennung zwischen Legacy v1 und moderner v2 API.

### 🎯 Wichtigste Änderungen (August 2025)

- ✅ **NEUER `/config` Ordner** - Alle Konfigurationsdateien zentral organisiert
- ✅ **API v2 vollständig implementiert** - 27/27 APIs fertig mit 100% Test-Coverage
- ✅ **Frontend-Migration läuft** - 31/64 Dateien (48.4%) auf v2 API migriert
- ✅ **TypeScript überall** - Backend und Frontend vollständig typisiert
- ✅ **Docker-basierte Entwicklung** - Alle Services containerisiert
- ✅ **Automatisches Backup-System** - Täglich um 02:00 Uhr

## 📂 Hauptverzeichnisse

```
/home/scs/projects/Assixx/
├── 📁 config/           # 🆕 NEU! Zentrale Konfigurationsdateien
├── 📁 backend/          # TypeScript Backend (Express.js API)
├── 📁 frontend/         # TypeScript Frontend (Vite + Bootstrap)
├── 📁 database/         # Datenbank-Schema und Migrationen
├── 📁 docker/           # Docker-Orchestrierung
├── 📁 docs/             # Umfangreiche Dokumentation
├── 📁 scripts/          # Build & Deployment Scripts
├── 📁 backups/          # Automatische DB-Backups
├── 📁 infrastructure/   # Monitoring & DevOps
├── 📁 uploads/          # User-Uploads (git-ignoriert)
├── 📁 archive/          # Archivierte/temporäre Dateien
├── 📁 logs/             # Application Logs
└── 📁 screenshots/      # UI Screenshots für Dokumentation
```

## 🌳 Detaillierte Struktur

### 📁 Root-Verzeichnis

```
/home/scs/projects/Assixx/
├── 📄 README.md                    # Projekt-Hauptdokumentation
├── 📄 TODO.md                      # Aktuelle Aufgabenliste (TÄGLICH AKTUALISIERT!)
├── 📄 CLAUDE.md                    # Claude AI Anweisungen (PFLICHTLEKTÜRE!)
├── 📄 CLAUDE.local.md              # Lokale Notizen (nicht im Git)
├── 📄 LICENSE                      # MIT Lizenz
├── 📄 COPYRIGHT                    # Copyright-Informationen
├── 📄 package.json                 # Root-Dependencies (pnpm workspace)
├── 📄 pnpm-lock.yaml               # pnpm Lock-Datei
├── 📄 pnpm-workspace.yaml          # Monorepo-Konfiguration
├── 📄 tsconfig.json                # TypeScript Root-Config
├── 📄 tsconfig.test.json           # TypeScript Test-Config
├── 📄 .gitignore                   # Git Ignore-Patterns
├── 📄 .editorconfig                # Editor-Konfiguration
├── 📄 .stylelintcache              # Stylelint Cache (sollte in .gitignore)
└── 📄 .env.example                 # Beispiel für Umgebungsvariablen
```

### 📁 config/ (🆕 NEU - Zentrale Konfiguration)

> **WICHTIG:** Alle Build-Tools und Linter-Konfigurationen wurden hierher verschoben für bessere Organisation!

```
config/
├── 📄 eslint.config.js             # ESLint v9 Flat Config (für Root)
├── 📄 jest.config.js               # Jest Test-Framework Konfiguration
├── 📄 jest.setup.ts                # Jest Setup-Code (vor Tests)
├── 📄 jest.globalSetup.js          # Jest Global Setup (DB-Initialisierung)
├── 📄 jest.globalTeardown.js       # Jest Global Teardown (Cleanup)
├── 📄 nodemon.json                 # Nodemon für Development Server
├── 📄 prettier.config.json         # Code-Formatierung (2 Spaces, etc.)
├── 📄 .prettierignore              # Prettier Ignore-Patterns
├── 📄 purgecss.config.cjs          # PurgeCSS für ungenutztes CSS
├── 📄 stylelint.config.json        # CSS/SCSS Linting Regeln
├── 📄 stylelint.strict.json        # Strenge CSS-Regeln für Production
├── 📄 .stylelintignore             # Stylelint Ignore-Patterns
└── 📄 swc.config.json              # SWC TypeScript Compiler (schneller als tsc)
```

### 📁 backend/ (TypeScript Express API)

```
backend/
├── 📄 package.json                 # Backend-spezifische Dependencies
├── 📄 tsconfig.json                # TypeScript Config für Backend
├── 📄 tsconfig.build.json          # TypeScript Build Config
├── 📄 tsconfig.eslint.json         # TypeScript ESLint Config
├── 📄 eslint.config.js.bak         # 🗑️ DEPRECATED - Backup der alten Config
│
├── 📁 src/                         # Hauptquellcode
│   ├── 📄 app.ts                  # Express App Initialisierung
│   ├── 📄 server.ts               # Server Entry Point (PORT 3000)
│   ├── 📄 database.ts             # MySQL2 Connection Pool Manager
│   ├── 📄 auth.ts                 # Globale Auth-Utilities (Legacy)
│   ├── 📄 websocket.ts            # WebSocket Server für Chat
│   │
│   ├── 📁 config/                 # Backend-Konfigurationen
│   │   ├── 📄 database.ts         # DB-Connection Settings
│   │   ├── 📄 redis.ts            # Redis Cache Config
│   │   ├── 📄 swagger.ts          # API v1 Dokumentation (DEPRECATED)
│   │   ├── 📄 swagger-v2.ts       # API v2 Dokumentation (AKTUELL)
│   │   ├── 📄 tenants.ts          # Multi-Tenant Konfiguration
│   │   └── 📄 featureCategories.ts # Feature-Kategorien Definition
│   │
│   ├── 📁 controllers/            # 🗑️ LEGACY v1 Controllers (werden abgelöst)
│   │   └── [...].controller.ts    # 16 Legacy Controller-Dateien
│   │
│   ├── 📁 models/                 # Datenbank-Modelle (Shared zwischen v1/v2)
│   │   ├── 📄 blackboard.ts       # Schwarzes Brett Model
│   │   ├── 📄 calendar.ts         # Kalender-Events Model
│   │   ├── 📄 department.ts       # Abteilungen Model
│   │   ├── 📄 document.ts         # Dokumente Model
│   │   ├── 📄 feature.ts          # Feature-Flags Model
│   │   ├── 📄 kvp.ts              # KVP-Vorschläge Model
│   │   ├── 📄 machine.ts          # Maschinen Model
│   │   ├── 📄 plan.ts             # Subscription Plans Model
│   │   ├── 📄 rootLog.ts          # Root-User Logs Model
│   │   ├── 📄 shift.ts            # Schichtplanung Model
│   │   ├── 📄 survey.ts           # Umfragen Model
│   │   ├── 📄 team.ts             # Teams Model
│   │   ├── 📄 tenant.ts           # Mandanten Model
│   │   └── 📄 user.ts             # Benutzer Model
│   │
│   ├── 📁 services/               # Business Logic Services (Shared)
│   │   ├── 📄 admin.service.ts    # Admin-Verwaltung
│   │   ├── 📄 adminPermission.service.ts # Admin-Berechtigungen
│   │   ├── 📄 alerting.service.ts # Alert-System
│   │   ├── 📄 auth.service.ts     # Authentifizierung
│   │   ├── 📄 availability.service.ts # Verfügbarkeits-Management
│   │   ├── 📄 blackboard.service.ts # Schwarzes Brett
│   │   ├── 📄 calendar.service.ts  # Kalender-Funktionen
│   │   ├── 📄 chat.service.ts      # Chat-System
│   │   ├── 📄 department.service.ts # Abteilungs-Verwaltung
│   │   ├── 📄 departmentGroup.service.ts # Abteilungs-Gruppen
│   │   ├── 📄 document.service.ts  # Dokument-Verwaltung
│   │   ├── 📄 employee.service.ts  # Mitarbeiter-Verwaltung
│   │   ├── 📄 feature.service.ts   # Feature-Flag Management
│   │   ├── 📄 kvp.service.ts       # KVP-System
│   │   ├── 📄 kvpPermission.service.ts # KVP-Berechtigungen
│   │   ├── 📄 shift.service.ts     # Schichtplanung
│   │   ├── 📄 survey.service.ts    # Umfrage-System
│   │   ├── 📄 team.service.ts      # Team-Verwaltung
│   │   ├── 📄 tenant.service.ts    # Mandanten-Verwaltung
│   │   ├── 📄 tenantDeletion.service.ts # Mandanten-Löschung
│   │   └── 📄 user.service.ts      # Benutzer-Verwaltung
│   │
│   ├── 📁 middleware/             # Express Middleware Stack
│   │   ├── 📄 auth.ts             # JWT Authentication (v1)
│   │   ├── 📄 auth-refactored.ts  # Verbesserte Auth (v2)
│   │   ├── 📄 tenant.ts           # Multi-Tenant Isolation
│   │   ├── 📄 tenantIsolation.ts  # Erweiterte Tenant-Sicherheit
│   │   ├── 📄 tenantStatus.ts     # Tenant-Status Checks
│   │   ├── 📄 security.ts         # Basis-Sicherheit (Helmet, etc.)
│   │   ├── 📄 security-enhanced.ts # Erweiterte Sicherheit (CSRF, etc.)
│   │   ├── 📄 rateLimiter.ts      # Rate-Limiting Middleware
│   │   ├── 📄 validation.ts       # Request-Validierung
│   │   ├── 📄 features.ts         # Feature-Flag Checks
│   │   ├── 📄 departmentAccess.ts # Abteilungs-Zugriffskontrolle
│   │   ├── 📄 documentAccess.ts   # Dokument-Zugriffskontrolle
│   │   ├── 📄 pageAuth.ts         # Seiten-Autorisierung
│   │   ├── 📄 role.middleware.ts  # Rollen-basierte Zugriffskontrolle
│   │   ├── 📄 deprecation.ts      # API Deprecation Warnings
│   │   └── 📄 validators.ts       # Custom Express-Validators
│   │
│   ├── 📁 routes/                 # API-Routen Definition
│   │   ├── 📄 index.ts            # Route-Aggregator (registriert alle Routes)
│   │   ├── 📄 legacy.routes.ts    # Legacy Route Mappings
│   │   ├── 📄 html.routes.ts      # HTML-Seiten Routes
│   │   │
│   │   ├── 📁 [v1 Legacy Routes]  # 🗑️ DEPRECATED - werden schrittweise abgelöst
│   │   │   ├── 📄 admin.ts        # Admin-Management v1
│   │   │   ├── 📄 auth.ts         # Authentication v1
│   │   │   ├── 📄 availability.ts # Verfügbarkeit v1
│   │   │   ├── 📄 blackboard.ts   # Schwarzes Brett v1
│   │   │   ├── 📄 calendar.ts     # Kalender v1
│   │   │   ├── 📄 chat.ts         # Chat v1
│   │   │   ├── 📄 departments.ts  # Abteilungen v1
│   │   │   ├── 📄 documents.ts    # Dokumente v1
│   │   │   ├── 📄 employee.ts     # Mitarbeiter v1
│   │   │   ├── 📄 features.ts     # Features v1
│   │   │   ├── 📄 kvp.ts          # KVP v1
│   │   │   ├── 📄 machines.ts     # Maschinen v1
│   │   │   ├── 📄 plans.ts        # Plans v1
│   │   │   ├── 📄 role-switch.ts  # Rollen-Wechsel v1
│   │   │   ├── 📄 root.ts         # Root-Management v1
│   │   │   ├── 📄 shifts.ts       # Schichten v1
│   │   │   ├── 📄 signup.ts       # Registrierung v1
│   │   │   ├── 📄 surveys.ts      # Umfragen v1
│   │   │   ├── 📄 teams.ts        # Teams v1
│   │   │   ├── 📄 unsubscribe.ts  # Abmeldung v1
│   │   │   └── 📄 users.ts        # Benutzer v1
│   │   │
│   │   └── 📁 v2/                 # ✅ NEUE API v2 - Modular & TypeScript-First
│   │       │
│   │       ├── 📁 auth/           # Authentifizierung & Autorisierung
│   │       │   ├── 📄 auth.controller.ts      # Login, Logout, Validate
│   │       │   ├── 📄 auth.validation.ts      # Input-Validierung
│   │       │   └── 📄 index.ts                # Route-Export
│   │       │
│   │       ├── 📁 users/          # Benutzer-Verwaltung
│   │       │   ├── 📄 users.controller.ts     # CRUD + Profile
│   │       │   ├── 📄 users.service.ts        # Business Logic
│   │       │   ├── 📄 users.validation.ts     # Validierungs-Regeln
│   │       │   ├── 📄 users.types.ts          # TypeScript Types
│   │       │   └── 📄 index.ts                # Export
│   │       │
│   │       ├── 📁 calendar/       # ✅ Kalender-System (PRODUKTIV!)
│   │       │   ├── 📄 calendar.controller.ts  # Event-Management
│   │       │   ├── 📄 calendar.service.ts     # Kalender-Logik
│   │       │   └── 📄 index.ts                # Route-Export
│   │       │
│   │       ├── 📁 chat/           # Chat-System mit WebSocket
│   │       │   ├── 📄 chat.controller.ts      # Chat-Endpoints
│   │       │   ├── 📄 chat.service.ts         # Chat-Logic
│   │       │   ├── 📄 WEBSOCKET-NOTES.md      # WebSocket-Dokumentation
│   │       │   └── 📄 index.ts                # Export
│   │       │
│   │       ├── 📁 departments/    # Abteilungs-Verwaltung
│   │       │   ├── 📄 departments.controller.ts
│   │       │   ├── 📄 departments.service.ts
│   │       │   ├── 📄 departments.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 teams/          # Team-Verwaltung
│   │       │   ├── 📄 teams.controller.ts
│   │       │   ├── 📄 teams.service.ts
│   │       │   ├── 📄 teams.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 documents/      # Dokument-Management
│   │       │   ├── 📄 documents.controller.ts
│   │       │   ├── 📄 documents.service.ts
│   │       │   ├── 📄 documents.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 blackboard/     # Schwarzes Brett
│   │       │   ├── 📄 blackboard.controller.ts
│   │       │   ├── 📄 blackboard.service.ts
│   │       │   ├── 📄 blackboard.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 role-switch/    # Rollen-Wechsel Feature
│   │       │   ├── 📄 role-switch.controller.ts
│   │       │   ├── 📄 role-switch.service.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 kvp/            # KVP-System (Kontinuierlicher Verbesserungsprozess)
│   │       │   ├── 📄 kvp.controller.ts
│   │       │   ├── 📄 kvp.service.ts
│   │       │   ├── 📄 kvp.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 shifts/         # Schichtplanung
│   │       │   ├── 📄 shifts.controller.ts
│   │       │   ├── 📄 shifts.service.ts
│   │       │   ├── 📄 shifts.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 surveys/        # Umfrage-System
│   │       │   ├── 📄 surveys.controller.ts
│   │       │   ├── 📄 surveys.service.ts
│   │       │   ├── 📄 surveys.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 notifications/  # Benachrichtigungs-System
│   │       │   ├── 📄 notifications.controller.ts
│   │       │   ├── 📄 notifications.service.ts
│   │       │   ├── 📄 notifications.validation.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 settings/       # System-Einstellungen
│   │       │   ├── 📄 settings.controller.ts
│   │       │   ├── 📄 settings.service.ts
│   │       │   ├── 📄 settings.validation.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 machines/       # Maschinen-Verwaltung
│   │       │   ├── 📄 machines.controller.ts
│   │       │   ├── 📄 machines.service.ts
│   │       │   ├── 📄 types.ts
│   │       │   ├── 📄 validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 features/       # Feature-Flag Management
│   │       │   ├── 📄 features.controller.ts
│   │       │   ├── 📄 features.service.ts
│   │       │   ├── 📄 features.validation.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 plans/          # Subscription Plans
│   │       │   ├── 📄 plans.controller.ts
│   │       │   ├── 📄 plans.service.ts
│   │       │   ├── 📄 plans.validation.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 reports/        # Reporting & Analytics
│   │       │   ├── 📄 reports.controller.ts
│   │       │   ├── 📄 reports.service.ts
│   │       │   ├── 📄 reports.validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 areas/          # Bereichs-Verwaltung
│   │       │   ├── 📄 areas.controller.ts
│   │       │   ├── 📄 areas.service.ts
│   │       │   ├── 📄 areas.validation.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 root/           # Root-User Management
│   │       │   ├── 📄 root.controller.ts
│   │       │   ├── 📄 root.service.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 admin-permissions/ # Admin-Berechtigungen
│   │       │   ├── 📄 controller.ts
│   │       │   ├── 📄 service.ts
│   │       │   ├── 📄 types.ts
│   │       │   ├── 📄 validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 department-groups/ # Abteilungs-Gruppen
│   │       │   ├── 📄 controller.ts
│   │       │   ├── 📄 service.ts
│   │       │   ├── 📄 types.ts
│   │       │   ├── 📄 validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 roles/          # Rollen-Definitionen
│   │       │   ├── 📄 controller.ts
│   │       │   ├── 📄 service.ts
│   │       │   ├── 📄 types.ts
│   │       │   ├── 📄 validation.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 signup/         # Registrierungs-System
│   │       │   ├── 📄 controller.ts
│   │       │   ├── 📄 service.ts
│   │       │   ├── 📄 types.ts
│   │       │   ├── 📄 validation.ts
│   │       │   ├── 📄 debug.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       ├── 📁 logs/           # System-Logs
│   │       │   ├── 📄 logs.controller.ts
│   │       │   ├── 📄 logs.service.ts
│   │       │   ├── 📄 logs.validation.ts
│   │       │   ├── 📄 types.ts
│   │       │   └── 📄 index.ts
│   │       │
│   │       └── 📁 audit-trail/    # Audit-Trail System
│   │           ├── 📄 audit-trail.controller.ts
│   │           ├── 📄 audit-trail.service.ts
│   │           ├── 📄 audit-trail.validation.ts
│   │           ├── 📄 types.ts
│   │           └── 📄 index.ts
│   │
│   ├── 📁 types/                  # TypeScript Type Definitionen
│   │   ├── 📄 index.ts            # Type-Exports
│   │   ├── 📄 api.d.ts            # API Response/Request Types
│   │   ├── 📄 auth.types.ts       # Authentication Types
│   │   ├── 📄 database.types.ts   # Database Query Types
│   │   ├── 📄 express.d.ts        # Express Request Extensions
│   │   ├── 📄 express-extensions.d.ts # Weitere Express Extensions
│   │   ├── 📄 express-validator.d.ts  # Validator Types
│   │   ├── 📄 middleware.types.ts # Middleware Types
│   │   ├── 📄 models.d.ts         # Model Type Definitions
│   │   ├── 📄 request.types.ts    # Custom Request Types
│   │   ├── 📄 response.types.ts   # Custom Response Types
│   │   ├── 📄 security.types.ts   # Security-related Types
│   │   ├── 📄 survey.types.ts     # Survey-specific Types
│   │   └── 📄 tenant.types.ts     # Multi-Tenant Types
│   │
│   ├── 📁 utils/                  # Utility-Funktionen
│   │   ├── 📄 ServiceError.ts     # Custom Error-Klasse
│   │   ├── 📄 apiResponse.ts      # Standardisierte API-Responses
│   │   ├── 📄 constants.ts        # App-weite Konstanten
│   │   ├── 📄 db.ts               # Database Query Helper
│   │   ├── 📄 dbWrapper.ts        # DB Connection Wrapper
│   │   ├── 📄 dualLogger.ts       # Dual Logging (Console + File)
│   │   ├── 📄 emailService.ts     # E-Mail Versand (Nodemailer)
│   │   ├── 📄 employeeIdGenerator.ts # Mitarbeiter-ID Generator
│   │   ├── 📄 errorHandler.ts     # Global Error Handler
│   │   ├── 📄 fieldMapper.ts      # snake_case <-> camelCase Mapper
│   │   ├── 📄 fieldMapping.ts     # Legacy Field Mapping
│   │   ├── 📄 getCurrentDir.ts    # Directory Path Utils
│   │   ├── 📄 helpers.ts          # Allgemeine Helper-Funktionen
│   │   ├── 📄 logger.ts           # Winston Logger Config
│   │   ├── 📄 multitenantValidator.ts # Tenant-Validierung
│   │   ├── 📄 pathSecurity.ts     # Path Injection Schutz
│   │   ├── 📄 phoneValidator.ts   # Telefonnummer-Validierung
│   │   ├── 📄 routeHandlers.ts    # Route Handler Utilities
│   │   ├── 📄 session-security.ts # Session Security Utils
│   │   ├── 📄 typeHelpers.ts      # TypeScript Helper Functions
│   │   ├── 📄 uploadMiddleware.ts # Multer File Upload Config
│   │   └── 📄 validators.ts       # Custom Validation Functions
│   │
│   ├── 📁 workers/                # Background Workers
│   │   ├── 📄 deletionWorker.ts   # Tenant Deletion Worker
│   │   └── 📄 start-deletion-worker.js # Worker Starter Script
│   │
│   └── 📁 __tests__/              # Integration Tests
│       ├── 📄 setup.ts            # Test Environment Setup
│       ├── 📄 testUtils.ts        # Test Helper Functions
│       ├── 📄 test-env-setup.ts   # Environment Variables für Tests
│       ├── 📄 db-schema.sql       # Test Database Schema
│       ├── 📄 blackboard.integration.test.ts # Blackboard Tests
│       └── 📄 tenantDeletion.integration.test.ts # Deletion Tests
│
├── 📁 templates/                  # E-Mail Templates
│   └── 📁 email/
│       ├── 📄 new-document.html   # Neue Dokument Benachrichtigung
│       ├── 📄 notification.html   # Allgemeine Benachrichtigung
│       └── 📄 welcome.html        # Willkommens-E-Mail
│
├── 📁 scripts/                    # Backend-spezifische Scripts
│   ├── 📄 create-feature-tables.js # Feature-Tabellen erstellen
│   ├── 📄 fix-tenant-admins.js    # Tenant-Admin Fixes
│   ├── 📄 generate-controllers.js # Controller Generator
│   ├── 📄 send-bulk-email.js      # Massen-E-Mail Versand
│   └── 📁 setup/                  # Setup Scripts
│       ├── 📄 setup-database.js   # DB Setup
│       ├── 📄 setup-tenant.js     # Tenant Setup
│       └── 📄 setup-tenants.js    # Multi-Tenant Setup
│
├── 📁 uploads/                    # User-Upload Verzeichnisse
│   ├── 📁 blackboard/             # Blackboard Anhänge
│   ├── 📁 kvp/                    # KVP Anhänge
│   ├── 📁 profile_pictures/       # Profilbilder
│   └── 📁 profiles/               # Profil-Dateien
│
├── 📁 dist/                       # Build Output (git-ignoriert)
└── 📁 logs/                       # Application Logs (git-ignoriert)
```

### 📁 frontend/ (Vite TypeScript Frontend)

```
frontend/
├── 📄 package.json                # Frontend Dependencies
├── 📄 tsconfig.json               # TypeScript Config
├── 📄 tsconfig.node.json          # TypeScript Node Config
├── 📄 vite.config.js              # Vite Build Config (HMR)
├── 📄 postcss.config.js           # PostCSS Processing
├── 📄 eslint.config.js            # Frontend ESLint Config
├── 📄 eslint.config.js.bak        # Backup der alten Config
├── 📄 eslint.config.enterprise.js # Enterprise ESLint Rules
├── 📄 swagger.json                # API Specification
├── 📄 swagger-cleaned.json        # Bereinigte API Spec
│
├── 📁 public/                     # Statische Assets
│   ├── 📄 favicon.ico             # Browser Icon
│   └── 📄 feature-flags.js        # Runtime Feature Flags
│
├── 📁 src/                        # Frontend Source Code
│   ├── 📄 favicon.ico             # App Icon
│   ├── 📄 index.html.disabled     # Template (deaktiviert)
│   │
│   ├── 📁 assets/                 # Media Assets
│   │   └── 📁 images/
│   │       ├── 📄 logo.png        # App Logo
│   │       ├── 📄 logo.svg        # SVG Logo
│   │       ├── 📄 logo_collapsed.png # Collapsed Sidebar Logo
│   │       └── 📄 default-avatar.svg # Default User Avatar
│   │
│   ├── 📁 components/             # Wiederverwendbare Komponenten
│   │   └── 📄 blackboard-widget.js # Blackboard Widget Component
│   │
│   ├── 📁 generated/              # Auto-generierter Code
│   │   └── 📄 api-types.ts        # API TypeScript Types (aus Swagger)
│   │
│   ├── 📁 types/                  # TypeScript Definitionen
│   │   ├── 📄 api.types.ts        # API Type Definitions
│   │   ├── 📄 global.d.ts         # Globale Type Declarations
│   │   └── 📄 utils.types.ts      # Utility Type Definitions
│   │
│   ├── 📁 utils/                  # Frontend Utilities
│   │   ├── 📄 api-client.ts       # API Client mit Axios
│   │   ├── 📄 api-mappers.ts      # Data Transformation Mappers
│   │   ├── 📄 clean-swagger.js    # Swagger Spec Cleaner
│   │   ├── 📄 feature-flags.ts    # Feature Flag Logic
│   │   └── 📄 response-adapter.ts # Response Format Adapter
│   │
│   ├── 📁 pages/                  # HTML Seiten (Multi-Page App)
│   │   │
│   │   ├── 📄 index.html          # Landing Page
│   │   ├── 📄 login.html          # Login Seite
│   │   ├── 📄 signup.html         # Registrierung
│   │   │
│   │   ├── 📁 [Admin Bereich]     # Admin-spezifische Seiten
│   │   ├── 📄 admin-dashboard.html # Admin Dashboard
│   │   ├── 📄 admin-config.html   # Admin Konfiguration
│   │   ├── 📄 admin-profile.html  # Admin Profil
│   │   ├── 📄 manage-employees.html # Mitarbeiter-Verwaltung
│   │   ├── 📄 manage-departments.html # Abteilungs-Verwaltung
│   │   ├── 📄 manage-teams.html   # Team-Verwaltung
│   │   ├── 📄 manage-areas.html   # Bereichs-Verwaltung
│   │   ├── 📄 manage-machines.html # Maschinen-Verwaltung
│   │   ├── 📄 manage-department-groups.html # Abteilungs-Gruppen
│   │   ├── 📄 manage-root-users.html # Root-User Verwaltung
│   │   ├── 📄 archived-employees.html # Archivierte Mitarbeiter
│   │   ├── 📄 feature-management.html # Feature-Verwaltung
│   │   ├── 📄 org-management.html # Organisation-Verwaltung
│   │   ├── 📄 logs.html           # System-Logs
│   │   │
│   │   ├── 📁 [Employee Bereich]  # Mitarbeiter-Seiten
│   │   ├── 📄 employee-dashboard.html # Mitarbeiter Dashboard
│   │   ├── 📄 employee-profile.html # Mitarbeiter Profil
│   │   ├── 📄 employee-documents.html # Mitarbeiter Dokumente
│   │   │
│   │   ├── 📁 [Root Bereich]      # Root-User Seiten
│   │   ├── 📄 root-dashboard.html # Root Dashboard
│   │   ├── 📄 root-profile.html   # Root Profil
│   │   ├── 📄 root-features.html  # Root Feature-Management
│   │   │
│   │   ├── 📁 [Feature Seiten]    # Feature-spezifische Seiten
│   │   ├── 📄 blackboard.html     # Schwarzes Brett
│   │   ├── 📄 calendar.html       # Kalender (✅ v2 API!)
│   │   ├── 📄 chat.html           # Chat-System
│   │   ├── 📄 shifts.html         # Schichtplanung
│   │   ├── 📄 kvp.html            # KVP-System
│   │   ├── 📄 kvp-detail.html     # KVP Detail-Ansicht
│   │   ├── 📄 survey-admin.html   # Umfrage Admin
│   │   ├── 📄 survey-admin-test.html # Umfrage Test
│   │   ├── 📄 survey-employee.html # Umfrage Mitarbeiter
│   │   ├── 📄 survey-details.html # Umfrage Details
│   │   ├── 📄 survey-results.html # Umfrage Ergebnisse
│   │   │
│   │   ├── 📁 [Dokument Seiten]   # Dokument-Management
│   │   ├── 📄 documents.html      # Dokument-Übersicht
│   │   ├── 📄 document-upload.html # Dokument Upload
│   │   ├── 📄 documents-company.html # Firmen-Dokumente
│   │   ├── 📄 documents-department.html # Abteilungs-Dokumente
│   │   ├── 📄 documents-personal.html # Persönliche Dokumente
│   │   ├── 📄 documents-payroll.html # Gehalts-Dokumente
│   │   ├── 📄 documents-search.html # Dokument-Suche
│   │   ├── 📄 documents-team.html # Team-Dokumente
│   │   ├── 📄 salary-documents.html # Gehaltsabrechnungen
│   │   │
│   │   └── 📁 [Utility Seiten]    # Hilfs-Seiten
│   │       ├── 📄 profile.html    # Benutzerprofil
│   │       ├── 📄 account-settings.html # Account-Einstellungen
│   │       ├── 📄 hilfe.html      # Hilfe-Seite
│   │       ├── 📄 design-standards.html # Design-Richtlinien
│   │       ├── 📄 storage-upgrade.html # Speicher-Upgrade
│   │       └── 📄 tenant-deletion-status.html # Lösch-Status
│   │
│   ├── 📁 scripts/                # Frontend JavaScript/TypeScript
│   │   ├── 📄 main.js             # Haupt Entry Point
│   │   ├── 📄 common.ts           # Gemeinsame Funktionen
│   │   ├── 📄 auth.ts             # Frontend Auth Logic
│   │   ├── 📄 pageProtection.ts   # Seiten-Zugriffskontrolle
│   │   ├── 📄 layout-state.js     # Layout State Management
│   │   ├── 📄 show-section.ts     # Section Toggle Logic
│   │   ├── 📄 confirm-once.ts     # Einmal-Bestätigung
│   │   ├── 📄 header-user-info.ts # Header User Info
│   │   ├── 📄 role-switch.ts      # Rollen-Wechsel Logic
│   │   │
│   │   ├── 📁 components/         # Komponenten-Scripts
│   │   │   ├── 📄 breadcrumb.js   # Breadcrumb Navigation
│   │   │   ├── 📄 dropdowns.js    # Custom Dropdowns
│   │   │   ├── 📄 modals.js       # Modal Manager
│   │   │   ├── 📄 tooltips.js     # Tooltip Logic
│   │   │   ├── 📄 navigation.html # Navigation Template
│   │   │   └── 📄 unified-navigation.ts # Unified Nav System
│   │   │
│   │   ├── 📁 core/               # Core Functionality
│   │   │   ├── 📄 auth.js         # Auth Core
│   │   │   ├── 📄 navigation.js   # Navigation Core
│   │   │   ├── 📄 theme.js        # Theme Manager
│   │   │   └── 📄 utils.js        # Core Utils
│   │   │
│   │   ├── 📁 services/           # Frontend Services
│   │   │   ├── 📄 api.service.ts  # API Service Layer
│   │   │   ├── 📄 notification.service.ts # Notification Service
│   │   │   └── 📄 storage.service.ts # Local Storage Service
│   │   │
│   │   ├── 📁 utils/              # Utility Functions
│   │   │   ├── 📄 alerts.ts       # Alert System
│   │   │   ├── 📄 browser-fingerprint.ts # Browser Fingerprinting
│   │   │   ├── 📄 dropdown-manager.ts # Dropdown Management
│   │   │   ├── 📄 modal-manager.ts # Modal Management
│   │   │   └── 📄 session-manager.ts # Session Management
│   │   │
│   │   ├── 📁 pages/              # Seiten-spezifische Scripts
│   │   │   ├── 📄 dashboard.js    # Dashboard Logic
│   │   │   ├── 📄 landing.js      # Landing Page Logic
│   │   │   ├── 📄 kvp.ts          # KVP Page Logic
│   │   │   └── 📄 kvp-detail.ts   # KVP Detail Logic
│   │   │
│   │   ├── 📁 [Feature Scripts]   # Feature-spezifische Scripts
│   │   ├── 📄 blackboard.ts       # Schwarzes Brett (v1)
│   │   ├── 📄 blackboard-widget.js # Blackboard Widget
│   │   ├── 📄 update-blackboard-modal.js # Blackboard Modal
│   │   ├── 📄 calendar.ts         # Kalender (✅ v2 API!)
│   │   ├── 📄 chat.ts             # Chat (v2 migration läuft)
│   │   ├── 📄 shifts.ts           # Schichtplanung (v1)
│   │   │
│   │   ├── 📁 [Admin Scripts]     # Admin-spezifische Scripts
│   │   ├── 📄 admin-dashboard.ts  # Admin Dashboard
│   │   ├── 📄 admin-config.ts     # Admin Config
│   │   ├── 📄 admin-profile.ts    # Admin Profile
│   │   ├── 📄 admin-areas.ts      # Areas Management
│   │   ├── 📄 admin-employee-search.ts # Employee Search
│   │   ├── 📄 manage-employees.ts # Employee Management
│   │   ├── 📄 manage-departments.ts # Department Management
│   │   ├── 📄 manage-teams.ts     # Team Management
│   │   ├── 📄 manage-areas.ts     # Area Management
│   │   ├── 📄 manage-machines.ts  # Machine Management
│   │   ├── 📄 manage-department-groups.ts # Department Groups
│   │   ├── 📄 manage-root-users.ts # Root User Management
│   │   ├── 📄 manage-admins.ts    # Admin Management
│   │   ├── 📄 employee-deletion.ts # Employee Deletion
│   │   ├── 📄 logs.ts             # Log Viewer
│   │   │
│   │   ├── 📁 [Employee Scripts]  # Mitarbeiter Scripts
│   │   ├── 📄 employee-dashboard.ts # Employee Dashboard
│   │   ├── 📄 dashboard-scripts.ts # Dashboard Utils
│   │   │
│   │   ├── 📁 [Root Scripts]      # Root-User Scripts
│   │   ├── 📄 root-dashboard.ts   # Root Dashboard
│   │   │
│   │   └── 📁 [Document Scripts]  # Dokument Scripts
│   │       ├── 📄 document-base.ts # Document Base Class
│   │       ├── 📄 documents.ts    # Documents Main
│   │       ├── 📄 documents-company.ts # Company Docs
│   │       ├── 📄 documents-department.ts # Department Docs
│   │       ├── 📄 documents-personal.ts # Personal Docs
│   │       ├── 📄 documents-payroll.ts # Payroll Docs
│   │       ├── 📄 documents-search.ts # Document Search
│   │       ├── 📄 documents-team.ts # Team Docs
│   │       └── 📄 upload-document.ts # Upload Logic
│   │
│   └── 📁 styles/                 # CSS Styles
│       ├── 📄 main.css            # Haupt-Stylesheet
│       ├── 📄 style.css           # Legacy Styles
│       ├── 📄 utilities.css       # Utility Classes
│       │
│       ├── 📁 base/               # Basis-Styles
│       │   └── 📄 variables.css   # CSS Custom Properties
│       │
│       ├── 📁 [Component Styles]  # Komponenten-Styles
│       ├── 📄 dashboard-theme.css # Dashboard Theme
│       ├── 📄 blackboard.css      # Blackboard Styles
│       ├── 📄 blackboard-widget.css # Widget Styles
│       ├── 📄 blackboard-update.css # Update Modal
│       ├── 📄 calendar.css        # Calendar Styles
│       ├── 📄 chat-icons.css      # Chat Icons
│       ├── 📄 documents.css       # Document Styles
│       ├── 📄 shifts.css          # Shift Planning
│       ├── 📄 profile-picture.css # Profile Pictures
│       │
│       ├── 📁 [Font Styles]       # Schriftarten
│       ├── 📄 fonts-geist.css     # Geist Font
│       ├── 📄 fonts-nunito.css    # Nunito Font
│       ├── 📄 fonts-opensans.css  # Open Sans Font
│       │
│       └── 📁 webfonts/           # Font Files
│           └── [Font Awesome Fonts] # FA Icons
│
└── 📁 dist/                       # Build Output (git-ignoriert)
```

### 📁 database/ (Schema & Migrationen)

```
database/
├── 📄 README.md                   # Database Dokumentation
├── 📄 SCHEMA-SYNC-REPORT-20250616.md # Schema Sync Report
├── 📄 database-setup.sql          # Initial DB Setup
├── 📄 docker-init.sql             # Docker DB Initialization
├── 📄 tenant-isolation-analysis.md # Multi-Tenant Analyse
├── 📄 tenant-isolation-fixes.sql  # Tenant Isolation Fixes
│
├── 📁 [Aktuelle Schemas]          # Chronologische Schema-Versionen
├── 📄 current-schema-20250809_231757.sql # 🆕 NEUESTE VERSION
├── 📄 current-schema-20250726_135944.sql
├── 📄 current-schema-20250724_010501.sql
├── 📄 current-schema-20250724_005750.sql
├── 📄 current-schema-20250721_212244.sql
├── 📄 current-schema-20250718_231241.sql
├── 📄 current-schema-20250718_163327.sql
└── 📄 current-schema-20250616.sql
│
├── 📁 archive/                    # Archivierte Versionen
│   └── 📁 pre-20250616/           # Vor der großen Migration
│
├── 📁 schema/                     # Modulares Schema-System
│   ├── 📁 00-core/                # Kern-Tabellen
│   ├── 📁 01-features/            # Feature-System
│   └── 📁 02-modules/             # Feature-Module
│
├── 📁 migrations/                 # SQL Migrationen (chronologisch)
│   ├── [Tenant Isolation Fixes]
│   ├── [Feature Migrations]
│   ├── [System Improvements]
│   └── [Module-specific Updates]
│
└── 📁 test-data/                  # Test-Daten für Development
```

### 📁 docker/ (Container-Orchestrierung)

```
docker/
├── 📄 docker-compose.yml          # 🔴 PRODUKTION (Standard)
├── 📄 docker-compose.dev.yml      # 🟡 DEVELOPMENT (mit HMR)
├── 📄 docker-compose.test.yml     # 🟢 TESTING (für CI/CD)
├── 📄 docker-compose.test-fallback.yml # Fallback Tests
├── 📄 docker-compose.monitoring.yml # Monitoring Stack
├── 📄 Dockerfile                  # Production Multi-Stage Build
├── 📄 Dockerfile.dev              # Development mit Live-Reload
├── 📄 PERMISSIONS-FIX.md          # Permissions Dokumentation
├── 📄 docker-init.sh              # Container Init Script
├── 📄 docker-start.sh             # Start Script
├── 📄 docker-stop.sh              # Stop Script
├── 📄 setup-permissions.sh        # File Permission Setup
├── 📄 test-mysql-startup.sh       # MySQL Startup Test
├── 📁 scripts/                    # Docker Utility Scripts
└── 📁 uploads/                    # Mounted Upload Directory
```

### 📁 scripts/ (Build & Deployment Tools)

```
scripts/
├── 📁 [Database Scripts]          # DB Management
├── 📄 backup-database.sh          # Automatisches Backup
├── 📄 restore-database.sh         # Backup Restore
├── 📄 quick-backup.sh             # Schnelles manuelles Backup
├── 📄 export-current-schema.sh    # Schema Export
├── 📄 compare-db-schema.sh        # Schema Vergleich
├── 📄 regenerate-schema.sh        # Schema Regeneration
├── 📄 setup-docker-db.sh          # Docker DB Setup
├── 📄 setup-backup-cron.sh        # Cron Job Setup
│
├── 📁 [Development Scripts]       # Entwicklungs-Tools
├── 📄 dev-status.sh               # ⭐ Development Status Check
├── 📄 test-local.sh               # Lokale Tests ausführen
├── 📄 test-with-summary.sh        # Tests mit Zusammenfassung
├── 📄 check-types-prod.sh         # Production Type Check
│
├── 📁 [Code Quality Scripts]      # Code-Qualität
├── 📄 maintainability-progress.sh # Wartbarkeits-Fortschritt
├── 📄 fix-nullish-coalescing.js  # TypeScript Fixes
├── 📄 fix-promises.js             # Promise Fixes
├── 📄 fix-import-order.js         # Import Sortierung
├── 📄 fix-esm-imports.js          # ESM Import Fixes
│
└── 📁 [Frontend Scripts]          # Frontend Tools
    ├── 📄 migrate-inline-styles.sh # CSS Migration
    ├── 📄 add-layout-shift-fix.sh  # Layout Shift Fix
    └── 📄 update-font-awesome.sh   # Font Awesome Update
```

### 📁 backups/ (Automatische DB-Backups)

```
backups/
├── 📄 latest_backup.sql.gz        # Symlink zum neuesten Backup
├── 📄 cron.log                    # Backup Cron Log
│
├── 📁 daily/                      # Tägliche Backups (02:00 Uhr)
│   └── main_backup_[DATE].sql.gz
│
├── 📁 weekly/                     # Wöchentliche Backups
│   └── main_weekly_[DATE].sql.gz
│
├── 📁 monthly/                    # Monatliche Backups
│   └── assixx_monthly_[DATE].sql.gz
│
├── 📁 quick/                      # Manuelle Quick-Backups
│   └── quick_backup_[DATE]_[REASON].sql.gz
│
└── 📁 tenant-specific/            # Tenant-spezifische Backups
    └── tenant_[ID]_final_[TIMESTAMP].sql.gz
```

### 📁 docs/ (Umfangreiche Dokumentation)

```
docs/
├── 📁 [Kern-Dokumentation]        # Wichtigste Dokumente
├── 📄 PROJEKTSTRUKTUR.md          # Diese Datei
├── 📄 ARCHITECTURE.md             # System-Architektur
├── 📄 TYPESCRIPT-STANDARDS.md     # ⭐ TypeScript Best Practices
├── 📄 DESIGN-STANDARDS.md         # UI/UX Glassmorphismus
├── 📄 DATABASE-MIGRATION-GUIDE.md # DB Migration Guide
├── 📄 FEATURES.md                 # Feature-Liste mit Preisen
├── 📄 BEFORE-STARTING-DEV.md      # ⭐ Täglich vor Start lesen!
│
├── 📁 api/                        # API Dokumentation
│   ├── 📄 API-V2-DEVELOPER-GUIDE.md # v2 API Guide
│   ├── 📄 API-V2-STATUS.md        # v2 Status (100% fertig!)
│   ├── 📄 MIGRATION-GUIDE-V1-TO-V2.md # Migration Guide
│   └── 📄 current-openapi-spec.json # OpenAPI Spec
│
├── 📁 fixed-bugs/                 # Behobene Bugs
│   └── [Bug-Fix Dokumentationen]
│
└── 📁 [Weitere Dokumentationen]   # Testing, Security, etc.
```

## 📋 Wichtige Hinweise

### ✅ API v2 Migration Status

- **Backend:** 27/27 APIs implementiert (100%) ✅
- **Frontend:** 31/64 Dateien migriert (48.4%) 🔄
- **Aktuell produktiv:** Calendar v2 mit Badge-System
- **Nächste Migration:** shifts.ts und shifts.html

### 🔒 Multi-Tenant Isolation

> **KRITISCH:** Alle Queries MÜSSEN `tenant_id` berücksichtigen!  
> Niemals Daten zwischen Tenants mischen!

### 🛠️ Entwicklungs-Workflow

1. **Vor Start:** `/scripts/dev-status.sh` ausführen
2. **Docker aus:** `/home/scs/projects/Assixx/docker` starten
3. **Bei Änderungen:** TypeScript kompilieren mit `pnpm run build:ts`
4. **Tests:** Immer mit `pnpm test` vor Commit

### 📦 Package Manager

> **WICHTIG:** Nur `pnpm` verwenden, nicht `npm`!  
> Workspace-Setup in `pnpm-workspace.yaml`

### 🎨 Design-Standards

- **Glassmorphismus** ist Standard
- **Keine Modals** für Dateneingabe (nur Inline-Forms)
- **Custom Dropdowns** statt native `<select>`

### 🔐 Sicherheit

- **JWT Secret** in `.env` konfigurieren
- **CSRF Protection** aktiviert
- **Rate Limiting** auf allen APIs
- **Path Injection** Protection implementiert

---

_Diese Datei wird bei Strukturänderungen aktualisiert. Letzte Aktualisierung: 18.08.2025_
_Branch: feature/api-v2-frontend-migration_