# 📁 Assixx Projektstruktur

> **Letzte Aktualisierung:** 06.06.2025 - Weitere Updates und neue Tools  
> **Status:** ✅ Projekt-Struktur bereinigt und reorganisiert

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
├── database/             # Datenbank-Schema und Migrationen
├── docs/                 # Gesamte Projektdokumentation
├── scripts/              # Shell-Scripts und Utilities
├── docker/               # Docker-Konfigurationen
├── infrastructure/       # DevOps und Monitoring
├── tools/                # Setup-Tools
└── backups/              # Datenbank-Backups
```

## 🌳 Detaillierte Struktur

### 📁 Root-Verzeichnis (Aufgeräumt!)

```
/home/scs/projects/Assixx/
├── README.md             # Projekt-Hauptdokumentation
├── TODO.md               # Aktuelle Aufgabenliste
├── CLAUDE.md             # Claude AI Anweisungen
├── CLAUDE.local.md       # Lokale Notizen (nicht im Git)
├── LICENSE               # MIT Lizenz
├── COPYRIGHT             # Copyright-Informationen
├── package.json          # Root-Abhängigkeiten
├── package-lock.json
├── tsconfig.json         # TypeScript Root-Konfiguration
├── eslint.config.js      # ESLint-Konfiguration
├── nodemon.json          # Nodemon-Konfiguration
└── database-setup.sql    # Legacy DB-Setup (deprecated)
```

### 📁 docs/ (NEU - Alle Dokumentationen)

```
docs/
├── AKTIONSPLAN-BETA-FIXES.md    # Beta-Deployment Plan
├── ARCHITECTURE.md               # System-Architektur
├── BACKUP-GUIDE.md              # Backup-Anleitung
├── BEFORE-STARTING-DEV.md       # Dev-Checkliste
├── CONTRIBUTOR-AGREEMENT.md     # Contributor Agreement
├── DATABASE-SETUP-README.md     # Datenbank-Dokumentation
├── DATABASE-MIGRATION-GUIDE.md  # Migration Best Practices
├── DEPLOYMENT.md                # Deployment-Guide
├── DESIGN-STANDARDS.md          # UI/UX Standards
├── DEVELOPMENT-GUIDE.md         # Entwickler-Guide
├── DOCKER-BEGINNERS-GUIDE.md    # Docker Einführung
├── DOCKER-SETUP-SUMMARY.md      # Docker Setup Zusammenfassung
├── DOCKER-SETUP.md              # Docker Konfiguration
├── FEATURES.md                  # Feature-Dokumentation
├── FUNKTIONSTEST-ERGEBNISSE.md  # Test-Ergebnisse
├── FUNKTIONSTEST.md             # Test-Anleitung
├── GIT-BRANCH-STRATEGY.md       # Git-Workflow
├── PROJEKTSTRUKTUR.md           # Diese Datei
├── QUESTIONS.md                 # FAQ
├── ROADMAP.md                   # Projekt-Roadmap
├── SETUP-MACOS.md               # macOS Setup
├── SETUP-QUICKSTART.md          # Schnellstart
├── SETUP-UBUNTU-LINUX.md        # Ubuntu Setup
├── SETUP-WINDOWS-WSL.md         # Windows/WSL Setup
└── TERMS-OF-USE.md              # Nutzungsbedingungen
```

### 📁 scripts/ (NEU - Alle Shell-Scripts)

```
scripts/
├── apply-sql-updates.sh      # SQL-Updates anwenden
├── backup-database.sh        # Datenbank-Backup
├── dev-status.sh            # 🆕 Development Status Check
├── fix-esm-imports.js        # ESM Import Fixes
├── quick-backup.sh           # Schnelles Backup
├── regenerate-schema.sh      # Schema regenerieren
├── restore-database.sh       # Datenbank wiederherstellen
├── setup-backup-cron.sh      # Backup-Cron einrichten
├── setup-docker-db.sh        # Docker DB Setup
└── update-font-awesome.sh    # Font Awesome aktualisieren
```

### 📁 docker/ (NEU - Docker-Konfigurationen)

```
docker/
├── Dockerfile                    # Production Dockerfile
├── Dockerfile.dev               # Development Dockerfile
├── docker-compose.yml           # Production Compose
├── docker-compose.dev.yml       # Development Compose
└── docker-compose.monitoring.yml # Monitoring Stack
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
│   ├── 📂 controllers/    # MVC Controller
│   │   ├── admin.controller.ts
│   │   ├── auth.controller.ts
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
│   │   │   ├── add_blackboard_colors_tags.sql
│   │   │   ├── add_blackboard_feature.sql
│   │   │   ├── add_calendar_feature.sql
│   │   │   ├── add_kvp_feature.sql
│   │   │   ├── add_shift_planning_feature.sql
│   │   │   ├── add_survey_feature.js
│   │   │   ├── blackboard_schema.sql
│   │   │   ├── calendar_schema.sql
│   │   │   ├── create_shift_notes_table.sql
│   │   │   ├── kvp_schema.sql
│   │   │   └── survey_schema.sql
│   │   ├── admin_logs_schema.sql
│   │   ├── benutzerprofil_u_org.sql
│   │   ├── chat_schema_fixed.sql
│   │   ├── create_tenants_table.sql
│   │   ├── feature_management_schema.sql
│   │   └── tenantDb.ts
│   ├── 📂 middleware/     # Express Middleware
│   │   ├── auth.ts
│   │   ├── documentAccess.ts
│   │   ├── features.ts
│   │   ├── security-enhanced.ts
│   │   ├── tenant.ts
│   │   └── validators.ts
│   ├── 📂 models/         # Datenmodelle
│   │   ├── adminLog.ts
│   │   ├── blackboard.ts
│   │   ├── calendar.ts
│   │   ├── department.ts
│   │   ├── document.ts
│   │   ├── feature.ts
│   │   ├── kvp.ts
│   │   ├── shift.ts
│   │   ├── survey.ts
│   │   ├── team.ts
│   │   ├── tenant.ts
│   │   └── user.ts
│   ├── 📂 routes/         # API-Routen
│   │   ├── admin.ts
│   │   ├── areas.ts
│   │   ├── auth.ts
│   │   ├── auth.routes.ts
│   │   ├── blackboard.ts
│   │   ├── calendar.ts
│   │   ├── chat.ts
│   │   ├── departments.ts
│   │   ├── documents.ts
│   │   ├── employee.ts
│   │   ├── features.ts
│   │   ├── html.routes.ts
│   │   ├── index.ts
│   │   ├── kvp.ts
│   │   ├── legacy.routes.ts
│   │   ├── machines.ts
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
│   │   ├── emailService.ts
│   │   ├── helpers.ts
│   │   ├── logger.ts
│   │   ├── typeHelpers.ts
│   │   └── validators.ts
│   ├── app.ts             # Express App Konfiguration
│   ├── auth.ts            # Auth Utilities
│   ├── database.ts        # Datenbankverbindung
│   ├── server.ts          # Server Entry Point
│   └── websocket.ts       # WebSocket Handler
├── 📂 templates/          # E-Mail Templates
│   └── 📂 email/
│       ├── new-document.html
│       ├── notification.html
│       └── welcome.html
└── tsconfig.json          # TypeScript Konfiguration
```

## 📂 Frontend-Struktur (`/frontend`)

```
frontend/
├── 📂 dist/               # Build-Output (git-ignoriert)
├── 📂 public/             # Statische Assets
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
│   │   ├── archived-employees.html
│   │   ├── blackboard.html
│   │   ├── calendar.html
│   │   ├── chat.html
│   │   ├── design-standards.html
│   │   ├── document-upload.html
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
│   │   │   └── alerts.ts
│   │   ├── admin-config.ts
│   │   ├── admin-dashboard.ts
│   │   ├── admin-employee-search.ts
│   │   ├── auth.ts
│   │   ├── blackboard.ts
│   │   ├── calendar.ts
│   │   ├── chat.ts
│   │   ├── common.ts
│   │   ├── confirm-once.ts
│   │   ├── dashboard-scripts.ts
│   │   ├── employee-dashboard.ts
│   │   ├── employee-deletion.ts
│   │   ├── header-user-info.ts
│   │   ├── main.js
│   │   ├── manage-admins.ts
│   │   ├── profile-picture.ts
│   │   ├── root-dashboard.ts
│   │   ├── shifts-new.ts
│   │   ├── shifts.ts
│   │   ├── show-section.ts
│   │   └── upload-document.ts
│   └── 📂 styles/         # CSS-Dateien
│       ├── 📂 base/      # Basis-Styles
│       │   └── variables.css
│       ├── 📂 lib/       # Externe CSS
│       ├── 📂 webfonts/  # Font-Dateien
│       │   ├── fa-brands-400.ttf
│       │   ├── fa-brands-400.woff2
│       │   ├── fa-regular-400.ttf
│       │   ├── fa-regular-400.woff2
│       │   ├── fa-solid-900.ttf
│       │   ├── fa-solid-900.woff2
│       │   ├── fa-v4compatibility.ttf
│       │   └── fa-v4compatibility.woff2
│       ├── blackboard.css
│       ├── calendar.css
│       ├── chat-icons.css
│       ├── dashboard-theme.css
│       ├── main.css
│       ├── profile-picture.css
│       ├── shifts.css
│       ├── style.css
│       └── user-info-update.css
│   └── 📂 types/          # TypeScript Type Definitionen
│       ├── api.types.ts
│       ├── global.d.ts
│       └── utils.types.ts
├── index.html             # Entry Point
├── eslint.config.js       # ESLint Konfiguration
├── package.json           # Frontend Dependencies
├── postcss.config.js      # PostCSS Konfiguration
├── tsconfig.json          # TypeScript Konfiguration
├── tsconfig.node.json     # TypeScript Node Konfiguration
└── vite.config.js         # Vite Build Konfiguration
```

## 📂 Infrastructure (`/infrastructure`)

```
infrastructure/
├── 📂 docker/             # Docker-Konfigurationen
│   ├── backup-strategy.md # Backup-Strategie Dokumentation
│   ├── monitoring-setup.md # Monitoring Setup Guide
│   └── test-docker-build.sh # Docker Build Test-Script
├── 📂 kubernetes/         # K8s Manifeste
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
└── 📂 terraform/          # Infrastructure as Code
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
├── 📂 chat/               # Chat-Anhänge
├── 📂 chat-attachments/   # Alt (migration pending)
├── 📂 documents/          # Dokumenten-Uploads
├── 📂 kvp/               # KVP-Anhänge
├── 📂 kvp-attachments/   # Alt (migration pending)
├── 📂 profile-pictures/   # Profilbilder
└── 📂 profile_pictures/   # Alt (migration pending)
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

### 🚧 Migration-Status:

- ✅ Dokumentation nach `docs/` verschoben
- ✅ Scripts nach `scripts/` verschoben
- ✅ Docker-Files nach `docker/` verschoben
- ✅ Root-Verzeichnis aufgeräumt

### 📌 Nächste Schritte:

1. Git-Repository mit neuer Struktur committen
2. CI/CD Pipelines anpassen
3. Deployment-Scripts aktualisieren
4. Team über neue Struktur informieren

---

_Diese Datei wird bei Strukturänderungen aktualisiert._
