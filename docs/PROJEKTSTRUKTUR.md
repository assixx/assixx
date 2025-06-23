# 📁 Assixx Projektstruktur

> **Letzte Aktualisierung:** 16.06.2025 - Vollständige Aktualisierung nach pnpm Migration  
> **Status:** ✅ Projekt-Struktur aktualisiert und kommentiert

## 🏗️ Überblick

Das Projekt wurde neu strukturiert für bessere Übersichtlichkeit:

- ✅ Root-Verzeichnis aufgeräumt
- ✅ Dokumentation in `docs/` verschoben
- ✅ Scripts in `scripts/` organisiert
- ✅ Docker-Dateien in `docker/` zusammengefasst
- ✅ Nur essenzielle Dateien im Root belassen

## 📂 Hauptverzeichnisse

```
/home/scs/projects/Assixx/
├── backend/              # TypeScript Backend (Express.js)
├── frontend/             # Frontend (Vite + TypeScript)
├── database/             # Datenbank-Schema und Migrationen (NEUE STRUKTUR!)
├── docs/                 # Gesamte Projektdokumentation
├── scripts/              # Shell-Scripts und Utilities
├── docker/               # Docker-Konfigurationen
├── infrastructure/       # DevOps und Monitoring
├── tools/                # Setup-Tools
├── uploads/              # User-Uploads (git-ignoriert)
└── backups/              # Datenbank-Backups
```

## 🌳 Detaillierte Struktur

### 📁 Root-Verzeichnis (Aufgeräumt!)

```
/home/scs/projects/Assixx/
├── README.md             # Projekt-Hauptdokumentation
├── TODO.md               # Aktuelle Aufgabenliste (TÄGLICH AKTUALISIERT!)
├── CLAUDE.md             # Claude AI Anweisungen (PFLICHTLEKTÜRE!)
├── CLAUDE.local.md       # Lokale Notizen (nicht im Git)
├── LICENSE               # MIT Lizenz
├── COPYRIGHT             # Copyright-Informationen
├── package.json          # Root-Abhängigkeiten (pnpm)
├── pnpm-lock.yaml        # pnpm Lock-Datei (automatisch generiert)
├── tsconfig.json         # TypeScript Root-Konfiguration
├── tsconfig.test.json    # TypeScript Test-Konfiguration
├── eslint.config.js      # ESLint v9 Flat Config
├── jest.config.js        # Jest Test-Konfiguration
├── nodemon.json          # Nodemon für Dev-Server
├── .prettierrc.json      # Prettier Code-Formatierung
├── .prettierignore       # Prettier Ignore-Patterns
├── .swcrc                # SWC Transpiler Config
├── .gitignore            # Git Ignore-Patterns
├── .env                  # Umgebungsvariablen (NICHT IM GIT!)
├── .env.example          # Beispiel für .env
└── .env.local            # Lokale Überschreibungen (NICHT IM GIT!)
```

### 📁 docs/ (NEU - Alle Dokumentationen)

```
docs/
├── ARCHITECTURE.md               # System-Architektur (WICHTIG!)
├── BACKUP-GUIDE.md              # Backup-Anleitung
├── BEFORE-STARTING-DEV.md       # Dev-Checkliste (PFLICHT VOR START!)
├── CHAT-WEBSOCKET-FIX-SUMMARY.md # WebSocket Fixes Dokumentation
├── CONTRIBUTOR-AGREEMENT.md     # Contributor Agreement
├── DATABASE-SETUP-README.md     # Datenbank-Dokumentation (BEI DB-ÄNDERUNGEN UPDATEN!)
├── DATABASE-MIGRATION-GUIDE.md  # Migration Best Practices (WICHTIG!)
├── DEPLOYMENT.md                # Deployment-Guide
├── DESIGN-STANDARDS.md          # UI/UX Standards (GLASSMORPHISMUS!)
├── DOCKER-BEGINNERS-GUIDE.md    # Docker Einführung
├── DOCKER-SETUP-SUMMARY.md      # Docker Setup Zusammenfassung
├── DOCKER-SETUP.md              # Docker Konfiguration
├── FEATURES.md                  # Feature-Dokumentation
├── HEADER-PROBLEM.md            # Header UI Problem Dokumentation
├── KEY-FEATURES.md              # Wichtige Features Übersicht
├── MODAL-PROBLEM.md             # Modal UI Problem Dokumentation
├── NAVIGATION-CONTAINER.md      # Navigation Container Dokumentation
├── PNPM-MIGRATION.md            # pnpm Migration Guide
├── PROJEKTSTRUKTUR.md           # Diese Datei (BEI ÄNDERUNGEN UPDATEN!)
├── QUESTIONS.md                 # FAQ
├── ROADMAP.md                   # Projekt-Roadmap
├── TERMS-OF-USE.md              # Nutzungsbedingungen
├── TYPESCRIPT-STANDARDS.md      # TypeScript Code Standards
├── UNIT-TESTS.md                # Unit Testing Guide
└── abteilung_Zuweisung_root.md  # Abteilungs-Zuweisung Dokumentation
```

### 📁 scripts/ (NEU - Alle Shell-Scripts)

```
scripts/
├── apply-sql-updates.sh          # SQL-Updates anwenden
├── backup-database.sh            # Datenbank-Backup (täglich 02:00)
├── dev-status.sh                 # 🆕 Development Status Check (NÜTZLICH!)
├── fix-esm-imports.js            # ESM Import Fixes für TypeScript
├── package.json                  # ESM Support ({"type": "module"})
├── quick-backup.sh               # Schnelles Backup (manuell)
├── regenerate-schema.sh          # Schema regenerieren
├── restore-database.sh           # Datenbank wiederherstellen
├── run-blackboard-migration.sh   # Blackboard Migration Script
├── run-migration.sh              # Allgemeines Migration Script
├── setup-backup-cron.sh          # Backup-Cron einrichten
├── setup-docker-db.sh            # Docker DB Setup
└── update-font-awesome.sh        # Font Awesome aktualisieren
```

### 📁 docker/ (NEU - Docker-Konfigurationen)

```
docker/
├── Dockerfile                    # Production Dockerfile (Multi-stage)
├── Dockerfile.dev               # Development Dockerfile (mit Live-Reload)
├── docker-compose.yml           # Production Compose (HAUPTDATEI!)
├── docker-compose.dev.yml       # Development Compose (Alternative)
├── docker-compose.monitoring.yml # Monitoring Stack (Prometheus/Grafana)
├── docker-compose.test.yml      # Test Compose für CI/CD
├── docker-compose               # Docker Compose Binary (executable)
├── docker-start.sh              # Docker Start Script
├── docker-stop.sh               # Docker Stop Script
├── run-migration.sh             # Migration Runner für Docker
├── .env.docker                  # Docker Environment (NICHT IM GIT!)
└── .env.docker.example          # Docker Environment Beispiel
```

## 📂 Backend-Struktur (`/backend`)

```
backend/
├── 📂 database/            # Datenbank-Migrationsdateien
│   └── 📂 migrations/     # SQL-Migrationsskripte
│       └── create_message_status_table.sql
├── 📂 logs/                # Anwendungslogs (git-ignoriert)
├── 📂 scripts/             # Utility-Skripte
│   ├── create-feature-tables.js
│   ├── generate-controllers.js
│   ├── send-bulk-email.js
│   └── 📂 setup/         # Setup-Skripte
│       ├── setup-database.js
│       ├── setup-tenant.js
│       └── setup-tenants.js
├── 📂 src/                 # Hauptquellcode
│   ├── 📂 config/         # Konfigurationsdateien
│   │   ├── featureCategories.ts
│   │   └── tenants.ts
│   ├── 📂 controllers/    # MVC Controller (TypeScript)
│   │   ├── admin.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── availability.controller.ts  # 🆕 Verfügbarkeits-Management
│   │   ├── blackboard.controller.ts
│   │   ├── calendar.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── department.controller.ts
│   │   ├── document.controller.ts
│   │   ├── employee.controller.ts
│   │   ├── feature.controller.ts
│   │   ├── kvp.controller.ts
│   │   ├── shift.controller.ts
│   │   ├── survey.controller.ts
│   │   ├── team.controller.ts
│   │   └── tenant.controller.ts
│   ├── 📂 database/       # Datenbankskripte
│   │   ├── 📂 migrations/ # Migrationsskripte
│   │   │   ├── add_availability_columns.sql      # 🆕 Verfügbarkeits-Spalten
│   │   │   ├── add_blackboard_colors_tags.sql
│   │   │   ├── add_blackboard_feature.sql
│   │   │   ├── add_calendar_feature.sql
│   │   │   ├── add_calendar_recurrence.sql       # 🆕 Kalender-Wiederholung
│   │   │   ├── add_kvp_feature.sql
│   │   │   ├── add_shift_planning_feature.sql
│   │   │   ├── add_survey_feature.js
│   │   │   ├── blackboard_schema.sql
│   │   │   ├── calendar_schema.sql
│   │   │   ├── create_message_status_table.sql   # Message Status Tracking
│   │   │   ├── create_shift_notes_table.sql
│   │   │   ├── kvp_schema.sql
│   │   │   └── survey_schema.sql
│   │   ├── admin_logs_schema.sql
│   │   ├── benutzerprofil_u_org.sql
│   │   ├── chat_schema_fixed.sql
│   │   ├── create_tenants_table.sql
│   │   ├── feature_management_schema.sql
│   │   └── tenantDb.ts                          # TypeScript DB Helper
│   ├── 📂 middleware/     # Express Middleware
│   │   ├── auth.ts                # JWT Authentication
│   │   ├── documentAccess.ts      # Dokument-Zugriffskontrolle
│   │   ├── features.ts            # Feature-Flag Checks
│   │   ├── pageAuth.ts            # 🆕 Seiten-Authentifizierung
│   │   ├── security-enhanced.ts   # Erweiterte Sicherheit (CSRF, etc.)
│   │   ├── tenant.ts              # Multi-Tenant Isolation
│   │   └── validators.ts          # Express-Validator Middleware
│   ├── 📂 models/         # Datenmodelle (TypeScript)
│   │   ├── 📂 __tests__/         # Model Unit Tests
│   │   ├── adminLog.ts
│   │   ├── blackboard.ts
│   │   ├── calendar.ts
│   │   ├── department.ts
│   │   ├── document.ts
│   │   ├── feature.ts
│   │   ├── kvp.ts
│   │   ├── plan.ts               # 🆕 Plan Model
│   │   ├── shift.ts
│   │   ├── survey.ts
│   │   ├── team.ts
│   │   ├── tenant.ts
│   │   └── user.ts
│   ├── 📂 routes/         # API-Routen (RESTful)
│   │   ├── 📂 __tests__/         # Route Tests
│   │   ├── admin.ts
│   │   ├── areas.ts
│   │   ├── auth.ts
│   │   ├── auth.routes.ts
│   │   ├── availability.ts       # 🆕 Verfügbarkeits-Routen
│   │   ├── blackboard.ts
│   │   ├── calendar.ts
│   │   ├── chat.ts
│   │   ├── departments.ts
│   │   ├── documents.ts
│   │   ├── employee.ts
│   │   ├── features.ts
│   │   ├── html.routes.ts        # HTML Seiten-Routen
│   │   ├── index.ts              # Route Aggregator
│   │   ├── kvp.ts
│   │   ├── legacy.routes.ts      # Legacy Support
│   │   ├── machines.ts
│   │   ├── plans.ts              # 🆕 Plan-Routen
│   │   ├── role-switch.ts        # 🆕 Rollen-Wechsel
│   │   ├── root.ts
│   │   ├── shifts.ts
│   │   ├── signup.ts
│   │   ├── surveys.ts
│   │   ├── teams.ts
│   │   ├── unsubscribe.ts
│   │   ├── user.ts
│   │   └── users.ts
│   ├── 📂 services/       # Business Logic Services
│   │   ├── admin.service.ts
│   │   ├── auth.service.ts
│   │   ├── availability.service.ts # 🆕 Verfügbarkeits-Service
│   │   ├── blackboard.service.ts
│   │   ├── calendar.service.ts
│   │   ├── chat.service.ts
│   │   ├── department.service.ts
│   │   ├── document.service.ts
│   │   ├── employee.service.ts
│   │   ├── feature.service.ts
│   │   ├── kvp.service.ts
│   │   ├── shift.service.ts
│   │   ├── survey.service.ts
│   │   ├── team.service.ts
│   │   ├── tenant.service.ts
│   │   └── user.service.ts
│   ├── 📂 types/          # TypeScript Type Definitionen
│   │   ├── api.d.ts
│   │   ├── auth.types.ts
│   │   ├── database.types.ts
│   │   ├── express.d.ts
│   │   ├── index.d.ts
│   │   ├── models.d.ts
│   │   ├── request.types.ts
│   │   ├── survey.types.ts
│   │   └── tenant.types.ts
│   ├── 📂 utils/          # Hilfsfunktionen
│   │   ├── 📂 scripts/    # Utility-Skripte (noch .js)
│   │   │   ├── check-root-tenant.js
│   │   │   ├── check-survey.js
│   │   │   ├── connect-mysql-interactive.js
│   │   │   ├── create-employee.js
│   │   │   ├── debug-features.js
│   │   │   ├── hash_password.js
│   │   │   └── show-tables.js
│   │   ├── constants.ts
│   │   ├── emailService.ts        # Email mit Nodemailer
│   │   ├── employeeIdGenerator.ts # 🆕 Mitarbeiter-ID Generator
│   │   ├── helpers.ts
│   │   ├── logger.ts              # Winston Logger
│   │   ├── typeHelpers.ts         # TypeScript Helpers
│   │   └── validators.ts          # Custom Validators
│   ├── 📂 __tests__/      # Allgemeine Tests
│   ├── app.ts             # Express App Konfiguration
│   ├── auth.ts            # Auth Utilities (Legacy)
│   ├── database.ts        # MySQL2 Connection Pool
│   ├── server.ts          # Server Entry Point (PORT 3000)
│   └── websocket.ts       # WebSocket Handler (Chat)
├── 📂 scripts/            # Backend-spezifische Scripts
│   ├── create-feature-tables.js
│   ├── fix-tenant-admins.js      # 🆕 Tenant Admin Fix
│   ├── generate-controllers.js
│   ├── send-bulk-email.js
│   └── 📂 setup/         # Setup-Skripte
│       ├── setup-database.js
│       ├── setup-tenant.js
│       └── setup-tenants.js
├── 📂 templates/          # E-Mail Templates
│   └── 📂 email/
│       ├── new-document.html
│       ├── notification.html
│       └── welcome.html
├── tsconfig.json          # TypeScript Konfiguration
├── tsconfig.build.json    # TypeScript Build Config
└── tsconfig.eslint.json   # TypeScript ESLint Config
```

## 📂 Frontend-Struktur (`/frontend`)

```
frontend/
├── 📂 dist/               # Build-Output (git-ignoriert)
├── 📂 public/             # Statische Assets
│   ├── 📂 scripts/          # 🆕 Externe Bibliotheken
│   │   └── 📂 lib/           # Third-party Libraries
│   │       └── fullcalendar/   # FullCalendar Library
│   ├── 📂 styles/           # 🆕 Externe Styles
│   │   └── 📂 lib/           # Third-party Styles
│   └── favicon.ico
├── 📂 src/                # Quellcode
│   ├── 📂 assets/         # Medien & Schriften
│   │   ├── 📂 fonts/     # Schriftarten
│   │   ├── 📂 icons/     # Icon-Dateien
│   │   └── 📂 images/    # Bilder
│   │       ├── default-avatar.svg
│   │       ├── logo.png
│   │       └── logo.svg
│   ├── 📂 components/     # Wiederverwendbare Komponenten
│   │   ├── blackboard-widget.js
│   │   ├── 📂 modals/
│   │   ├── 📂 navigation/
│   │   └── 📂 widgets/
│   ├── 📂 pages/          # HTML-Seiten
│   │   ├── admin-config.html
│   │   ├── admin-dashboard.html
│   │   ├── admin-profile.html         # 🆕 Admin Profil Seite
│   │   ├── archived-employees.html
│   │   ├── blackboard.html
│   │   ├── blackboard-modal-update.html # 🆕 Blackboard Update Modal
│   │   ├── calendar.html
│   │   ├── chat.html
│   │   ├── design-standards.html
│   │   ├── document-upload.html
│   │   ├── documents-company.html      # 🆕 Firmen-Dokumente
│   │   ├── documents-department.html   # 🆕 Abteilungs-Dokumente
│   │   ├── documents-payroll.html      # 🆕 Gehalts-Dokumente
│   │   ├── documents-personal.html     # 🆕 Persönliche Dokumente
│   │   ├── documents-search.html       # 🆕 Dokument-Suche
│   │   ├── documents-team.html         # 🆕 Team-Dokumente
│   │   ├── employee-dashboard.html
│   │   ├── employee-documents.html
│   │   ├── employee-profile.html
│   │   ├── feature-management.html
│   │   ├── hilfe.html
│   │   ├── index.html
│   │   ├── kvp.html
│   │   ├── login.html
│   │   ├── manage-admins.html
│   │   ├── org-management.html
│   │   ├── profile-picture.html
│   │   ├── profile.html
│   │   ├── root-dashboard.html
│   │   ├── root-features.html
│   │   ├── root-profile.html
│   │   ├── salary-documents.html
│   │   ├── shifts.html
│   │   ├── signup.html
│   │   ├── storage-upgrade.html
│   │   ├── survey-admin.html
│   │   ├── survey-details.html
│   │   ├── survey-employee.html
│   │   └── survey-results.html
│   ├── 📂 scripts/        # JavaScript/TypeScript-Dateien
│   │   ├── 📂 components/ # Komponenten-Skripte
│   │   │   ├── dropdowns.js
│   │   │   ├── modals.js
│   │   │   ├── navigation.html
│   │   │   ├── tooltips.js
│   │   │   └── unified-navigation.ts
│   │   ├── 📂 core/      # Kernfunktionalität
│   │   │   ├── auth.js
│   │   │   ├── navigation.js
│   │   │   ├── theme.js
│   │   │   └── utils.js
│   │   ├── 📂 lib/       # Externe Bibliotheken
│   │   ├── 📂 pages/     # Seitenspezifische Skripte
│   │   │   ├── dashboard.js
│   │   │   └── landing.js
│   │   ├── 📂 services/  # Frontend-Services
│   │   │   ├── api.service.ts
│   │   │   ├── notification.service.ts
│   │   │   └── storage.service.ts
│   │   ├── 📂 utils/     # Hilfsfunktionen
│   │   │   ├── alerts.ts
│   │   │   └── modal-manager.ts      # 🆕 Modal Manager
│   │   ├── admin-config.ts
│   │   ├── admin-dashboard.ts
│   │   ├── admin-employee-search.ts
│   │   ├── admin-profile.ts           # 🆕 Admin Profil Script
│   │   ├── auth.ts
│   │   ├── blackboard.ts
│   │   ├── calendar.ts
│   │   ├── chat.ts
│   │   ├── common.ts
│   │   ├── confirm-once.ts
│   │   ├── dashboard-scripts.ts
│   │   ├── document-base.ts           # 🆕 Dokument Basis-Klasse
│   │   ├── documents-company.ts       # 🆕 Firmen-Dokumente Script
│   │   ├── documents-department.ts    # 🆕 Abteilungs-Dokumente Script
│   │   ├── documents-payroll.ts       # 🆕 Gehalts-Dokumente Script
│   │   ├── documents-personal.ts      # 🆕 Persönliche Dokumente Script
│   │   ├── documents-search.ts        # 🆕 Dokument-Suche Script
│   │   ├── documents-team.ts          # 🆕 Team-Dokumente Script
│   │   ├── employee-dashboard.ts
│   │   ├── employee-deletion.ts
│   │   ├── header-user-info.ts
│   │   ├── main.js
│   │   ├── manage-admins.ts
│   │   ├── pageProtection.ts          # 🆕 Seiten-Schutz
│   │   ├── profile-picture.ts
│   │   ├── role-switch.ts             # 🆕 Rollen-Wechsel Script
│   │   ├── root-dashboard.ts
│   │   ├── shifts-new.ts
│   │   ├── shifts.ts
│   │   ├── show-section.ts
│   │   ├── update-blackboard-modal.js  # 🆕 Blackboard Modal Update
│   │   └── upload-document.ts
│   └── 📂 styles/         # CSS-Dateien
│       ├── 📂 base/      # Basis-Styles
│       │   └── variables.css        # CSS Custom Properties
│       ├── 📂 lib/       # Externe CSS
│       ├── 📂 webfonts/  # Font-Awesome Fonts
│       │   ├── fa-brands-400.ttf
│       │   ├── fa-brands-400.woff2
│       │   ├── fa-regular-400.ttf
│       │   ├── fa-regular-400.woff2
│       │   ├── fa-solid-900.ttf
│       │   ├── fa-solid-900.woff2
│       │   ├── fa-v4compatibility.ttf
│       │   └── fa-v4compatibility.woff2
│       ├── blackboard.css
│       ├── blackboard-update.css   # 🆕 Blackboard Update Styles
│       ├── blackboard-widget.css   # 🆕 Blackboard Widget Styles
│       ├── calendar.css
│       ├── chat-icons.css
│       ├── dashboard-theme.css
│       ├── documents.css           # 🆕 Dokument-Styles
│       ├── main.css                # Haupt-Stylesheet
│       ├── profile-picture.css
│       ├── shifts.css
│       ├── style.css               # Legacy Styles
│       └── user-info-update.css
│   └── 📂 types/          # TypeScript Type Definitionen
│       ├── api.types.ts
│       ├── global.d.ts
│       └── utils.types.ts
├── node_modules_old_backup/  # 🔄 Backup vor pnpm Migration
├── index.html             # Entry Point
├── eslint.config.js       # ESLint Konfiguration
├── package.json           # Frontend Dependencies (pnpm)
├── pnpm-lock.yaml         # pnpm Lock-Datei
├── postcss.config.js      # PostCSS Konfiguration
├── tsconfig.json          # TypeScript Konfiguration
├── tsconfig.node.json     # TypeScript Node Konfiguration
└── vite.config.js         # Vite Build Konfiguration (HMR)
```

## 📂 Database-Struktur (`/database`) 🆕 WICHTIG!

```
database/
├── README.md                        # Database Dokumentation
├── SCHEMA-SYNC-REPORT-20250616.md  # Schema Synchronisation Report
├── 📂 archive/                      # Archivierte DB-Versionen
│   └── 📂 pre-20250616/            # Vor der großen Migration
├── current-schema-20250616.sql      # Aktuelles Schema (MASTER!)
├── docker-init.sql                  # Docker DB Initialisierung
├── 📂 migrations/                   # Neue Migrationen
│   ├── 20250616_001_initial_schema.sql
│   ├── 20250616_002_add_features.sql
│   └── ... weitere Migrationen
├── 📂 schema/                       # Modulare Schema-Dateien
│   ├── 001_core_tables.sql         # Kern-Tabellen
│   ├── 002_auth_system.sql         # Auth & Permissions
│   ├── 003_feature_system.sql      # Feature Management
│   ├── 004_document_system.sql     # Dokument-System
│   ├── 005_communication.sql       # Chat & Notifications
│   ├── 006_organization.sql        # Teams & Abteilungen
│   ├── 007_kvp_system.sql          # KVP Feature
│   ├── 008_survey_system.sql       # Survey Feature
│   ├── 009_calendar_system.sql     # Kalender Feature
│   ├── 010_shift_planning.sql      # Schichtplanung
│   ├── 011_blackboard.sql          # Schwarzes Brett
│   └── 999_indexes_constraints.sql # Indizes & Constraints
├── tenant-isolation-analysis.md     # Multi-Tenant Analyse
└── tenant-isolation-fixes.sql       # Tenant Isolation Fixes
```

## 📂 Infrastructure (`/infrastructure`)

```
infrastructure/
├── README.md              # Infrastructure Dokumentation
├── 📂 docker/             # Docker-Konfigurationen
│   ├── backup-strategy.md # Backup-Strategie Dokumentation
│   ├── monitoring-setup.md # Monitoring Setup Guide
│   └── test-docker-build.sh # Docker Build Test-Script
├── 📂 kubernetes/         # K8s Manifeste (zukünftig)
├── 📂 monitoring/         # Monitoring-Konfigurationen
│   ├── 📂 grafana/       # Grafana Dashboards
│   │   └── 📂 provisioning/
│   │       ├── 📂 dashboards/
│   │       └── 📂 datasources/
│   │           └── prometheus.yml
│   ├── alertmanager.yml  # Alert Manager Konfiguration
│   ├── alerts.yml        # Prometheus Alert-Regeln
│   ├── loki-config.yml   # Loki Log-Aggregation
│   ├── prometheus.yml    # Prometheus Konfiguration
│   └── promtail-config.yml # Promtail Log-Collector
├── 📂 nginx/             # Nginx Konfigurationen
│   └── nginx.conf.example # Beispiel Nginx-Konfiguration
└── 📂 terraform/          # Infrastructure as Code (zukünftig)
```

## 📂 Tools (`/tools`)

```
tools/
├── 📂 scripts/            # Entwicklungsskripte
└── 📂 setup/              # Setup-Automatisierung
    ├── setup-windows.ps1  # Windows PowerShell Setup
    └── setup-wsl-ubuntu.sh # WSL/Ubuntu Setup
```

## 📂 Uploads (Git-ignoriert)

```
uploads/
├── 📂 blackboard/         # Schwarzes Brett Anhänge
│   └── 📂 [tenant_id]/   # Tenant-spezifische Ordner
├── 📂 chat/               # Chat-Anhänge (NEU)
├── 📂 chat-attachments/   # Alt (migration pending)
├── 📂 documents/          # Dokumenten-Uploads
│   └── 📂 [tenant_id]/   # Tenant-spezifische Ordner
├── 📂 kvp/               # KVP-Anhänge (NEU)
├── 📂 kvp-attachments/   # Alt (migration pending)
├── 📂 profile-pictures/   # Profilbilder (NEU)
└── 📂 profile_pictures/   # Alt (migration pending)

💡 Hinweis: Alle Uploads sind tenant-isoliert!
```

## 📋 Wichtige Dateien

### Backend

- `backend/src/server.ts` - Server Entry Point
- `backend/src/app.ts` - Express App Setup
- `backend/src/database.ts` - DB Connection Management

### Frontend

- `frontend/src/index.html` - SPA Entry Point
- `frontend/src/scripts/auth.ts` - Authentifizierung
- `frontend/src/styles/style.css` - Haupt-Stylesheet

### Konfiguration

- `.env` - Umgebungsvariablen (nicht im Git!)
- `docker/.env.docker` - Docker Environment

## 📝 Hinweise zur Struktur

### ✅ Vorteile der neuen Struktur:

1. **Sauberes Root-Verzeichnis** - Nur essenzielle Dateien
2. **Organisierte Dokumentation** - Alles in `docs/`
3. **Zentrale Scripts** - Alle Scripts in `scripts/`
4. **Docker-Organisation** - Alle Docker-Files zusammen
5. **Bessere Übersichtlichkeit** - Logische Gruppierung
6. **TypeScript Migration** - Backend vollständig migriert
7. **pnpm Paketmanager** - Schneller und effizienter als npm

### 🚧 Migration-Status (16.06.2025):

- ✅ Dokumentation nach `docs/` verschoben
- ✅ Scripts nach `scripts/` verschoben
- ✅ Docker-Files nach `docker/` verschoben
- ✅ Root-Verzeichnis aufgeräumt
- ✅ TypeScript Backend Migration abgeschlossen
- ✅ pnpm Migration erfolgreich
- ✅ Express-Validator v7 Kompatibilität gelöst
- ✅ CI/CD Pipeline repariert

### 🆕 Neue Features & Änderungen:

1. **Verfügbarkeits-Management** - Neue Controller, Services & Routes
2. **Erweiterte Dokument-Verwaltung** - Kategorisierte Dokument-Seiten
3. **Verbesserte Admin-Features** - Admin-Profil, Rollen-Wechsel
4. **Modulare Datenbank-Struktur** - Schema in Module aufgeteilt
5. **Docker Compose Test Setup** - Für CI/CD Testing

### 📌 Wichtige Hinweise:

- **Multi-Tenant Isolation** ist kritisch - alle Features müssen tenant_id beachten!
- **Glassmorphismus Design** ist Standard - siehe DESIGN-STANDARDS.md
- **TypeScript** ist Pflicht für neuen Backend-Code
- **pnpm** ist der Standard-Paketmanager (nicht npm!)
- **Docker** ist die Haupt-Entwicklungsumgebung

---

_Diese Datei wird bei Strukturänderungen aktualisiert. Letzte Aktualisierung: 16.06.2025_
