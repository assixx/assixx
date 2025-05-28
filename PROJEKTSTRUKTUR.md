# 📁 Assixx Projektstruktur

> **Letzte Aktualisierung:** 28.01.2025  
> **Status:** ✅ Aktuell und bereinigt nach Migration

## 🗂️ Hauptverzeichnisstruktur

```
Assixx/
├── 📂 backend/              # Backend-Server (Node.js/Express)
├── 📂 frontend/             # Frontend (Vanilla JS + Vite)
├── 📂 infrastructure/       # Deployment & DevOps
├── 📂 tools/               # Entwicklungswerkzeuge
├── 📂 uploads/             # User-Uploads (git-ignoriert)
├── 📄 .env                 # Umgebungsvariablen (git-ignoriert)
├── 📄 .gitignore          # Git-Ignore Konfiguration
├── 📄 database-setup.sql   # Haupt-Datenbankschema
├── 📄 eslint.config.js     # ESLint Konfiguration
├── 📄 jest.config.js       # Jest Test-Konfiguration
├── 📄 package.json         # Root NPM Konfiguration
└── 📄 [Dokumentation]      # Alle .md Dateien (siehe unten)
```

## 📂 Backend-Struktur (`/backend`)

```
backend/
├── 📂 logs/                # Anwendungslogs (git-ignoriert)
├── 📂 scripts/             # Utility-Skripte
│   ├── create-feature-tables.js
│   ├── send-bulk-email.js
│   ├── update-departments-db.js
│   └── update-users-add-archive.js
├── 📂 src/                 # Hauptquellcode
│   ├── 📂 config/         # Konfigurationsdateien
│   │   ├── featureCategories.js
│   │   └── tenants.js
│   ├── 📂 controllers/    # MVC Controller
│   │   ├── auth.controller.js
│   │   └── document.controller.js
│   ├── 📂 database/       # Datenbankskripte
│   │   ├── 📂 migrations/ # Migrationsskripte
│   │   └── tenantDb.js
│   ├── 📂 middleware/     # Express Middleware
│   │   ├── auth.js
│   │   ├── documentAccess.js
│   │   ├── features.js
│   │   ├── security.js
│   │   ├── tenant.js
│   │   └── validators.js
│   ├── 📂 models/         # Datenmodelle
│   │   ├── adminLog.js
│   │   ├── blackboard.js
│   │   ├── calendar.js
│   │   ├── department.js
│   │   ├── document.js
│   │   ├── feature.js
│   │   ├── kvp.js
│   │   ├── shift.js
│   │   ├── survey.js
│   │   ├── team.js
│   │   ├── tenant.js
│   │   └── user.js
│   ├── 📂 routes/         # API-Routen
│   │   ├── admin.js
│   │   ├── areas.js
│   │   ├── auth.js
│   │   ├── auth.routes.js
│   │   ├── blackboard.js
│   │   ├── calendar.js
│   │   ├── chat.js
│   │   ├── departments.js
│   │   ├── documents.js
│   │   ├── employee.js
│   │   ├── features.js
│   │   ├── html.routes.js
│   │   ├── index.js
│   │   ├── kvp.js
│   │   ├── legacy.routes.js
│   │   ├── machines.js
│   │   ├── root.js
│   │   ├── shifts.js
│   │   ├── signup.js
│   │   ├── surveys.js
│   │   ├── teams.js
│   │   ├── unsubscribe.js
│   │   ├── user.js
│   │   └── users.js
│   ├── 📂 services/       # Business Logic Services
│   │   ├── auth.service.js
│   │   ├── document.service.js
│   │   └── user.service.js
│   ├── 📂 utils/          # Hilfsfunktionen
│   │   ├── 📂 scripts/    # Utility-Skripte
│   │   ├── constants.js
│   │   ├── emailService.js
│   │   ├── helpers.js
│   │   ├── logger.js
│   │   └── validators.js
│   ├── app.js             # Express App Konfiguration
│   ├── auth.js            # Auth Utilities
│   ├── database.js        # Datenbankverbindung
│   ├── server.js          # Server Entry Point
│   ├── server-old.js      # Backup der alten Server-Datei
│   └── websocket.js       # WebSocket Handler
├── 📂 templates/          # E-Mail Templates
│   └── 📂 email/
│       ├── new-document.html
│       ├── notification.html
│       └── welcome.html
└── 📂 tests/              # Test-Suite
    ├── 📂 e2e/           # End-to-End Tests
    ├── 📂 integration/   # Integrationstests
    ├── 📂 performance/   # Performance Tests
    ├── 📂 unit/          # Unit Tests
    └── setup.js          # Test Setup
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
│   │   ├── 📂 admin/     # Admin-spezifische Seiten
│   │   ├── 📂 employee/  # Mitarbeiter-Seiten
│   │   ├── 📂 root/      # Root-User Seiten
│   │   ├── 📂 shared/    # Gemeinsame Seiten
│   │   └── [*.html]      # Einzelne Seiten
│   ├── 📂 scripts/        # JavaScript-Dateien
│   │   ├── 📂 components/ # Komponenten-Skripte
│   │   ├── 📂 core/      # Kernfunktionalität
│   │   ├── 📂 lib/       # Externe Bibliotheken
│   │   ├── 📂 pages/     # Seitenspezifische Skripte
│   │   ├── 📂 services/  # Frontend-Services
│   │   └── 📂 utils/     # Hilfsfunktionen
│   └── 📂 styles/         # CSS-Dateien
│       ├── 📂 base/      # Basis-Styles
│       ├── 📂 components/ # Komponenten-Styles
│       ├── 📂 layouts/   # Layout-Styles
│       ├── 📂 lib/       # Externe CSS
│       ├── 📂 pages/     # Seitenspezifische Styles
│       ├── 📂 themes/    # Theme-Dateien
│       ├── 📂 utils/     # Utility-Klassen
│       ├── 📂 vendors/   # Vendor-Overrides
│       └── 📂 webfonts/  # Font-Dateien
├── index.html             # Entry Point
├── package.json           # Frontend Dependencies
├── postcss.config.js      # PostCSS Konfiguration
└── vite.config.js         # Vite Build Konfiguration
```

## 📂 Infrastructure (`/infrastructure`)

```
infrastructure/
├── 📂 docker/             # Docker-Konfigurationen
├── 📂 kubernetes/         # K8s Manifeste
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

## 📄 Root-Dokumentation

| Datei                       | Beschreibung                   |
| --------------------------- | ------------------------------ |
| 📄 ARCHITECTURE.md          | Systemarchitektur & Tech Stack |
| 📄 CLAUDE.md                | AI-Assistenten Anweisungen     |
| 📄 CLAUDE.local.md          | Lokale AI-Anweisungen          |
| 📄 CONTRIBUTOR-AGREEMENT.md | Beitragsvereinbarung           |
| 📄 COPYRIGHT                | Copyright-Informationen        |
| 📄 DATABASE-SETUP-README.md | Datenbank-Setup Guide          |
| 📄 DEPLOYMENT.md            | Production Deployment Guide    |
| 📄 DESIGN-STANDARDS.md      | UI/UX Design Standards         |
| 📄 DEVELOPMENT-GUIDE.md     | Entwicklungsrichtlinien        |
| 📄 FEATURES.md              | Feature-Übersicht & Preise     |
| 📄 LICENSE                  | Lizenzinformationen            |
| 📄 MIGRATION-LOG.md         | Migrationsprotokoll            |
| 📄 MIGRATION-PLAN.md        | Migrationsplan (abgeschlossen) |
| 📄 PROJEKTSTRUKTUR-BETA.md  | Beta-Strukturplan              |
| 📄 PROJEKTSTRUKTUR.md       | Diese Datei                    |
| 📄 README.md                | Projekt-Übersicht              |
| 📄 ROADMAP.md               | Entwicklungsfahrplan           |
| 📄 SETUP-MACOS.md           | macOS Setup Guide              |
| 📄 SETUP-QUICKSTART.md      | Schnellstart Guide (veraltet)  |
| 📄 SETUP-UBUNTU-LINUX.md    | Ubuntu/Linux Setup Guide       |
| 📄 SETUP-WINDOWS-WSL.md     | Windows WSL Setup Guide        |
| 📄 TERMS-OF-USE.md          | Nutzungsbedingungen            |
| 📄 TODO.md                  | Aktuelle Aufgabenliste         |

## 🔄 Migration Status

### ✅ Abgeschlossene Migrationen:

- `server/` → `backend/` (28.01.2025)
- Static File Paths aktualisiert
- MVC-Architektur implementiert
- Frontend Build System eingerichtet

### 🚧 Ausstehende Bereinigungen:

- Upload-Verzeichnisse konsolidieren (duplicate folders)
- Frontend-Komponenten modularisieren
- Test-Coverage erweitern

## 📋 Wichtige Hinweise

1. **Git-ignorierte Verzeichnisse:**

   - `node_modules/` - NPM Pakete
   - `uploads/` - User-generierte Inhalte
   - `logs/` - Anwendungslogs
   - `dist/` - Build-Outputs
   - `.env` - Umgebungsvariablen

2. **Naming Conventions:**

   - Dateien: `kebab-case.js`
   - Komponenten: `PascalCase.js`
   - CSS: `kebab-case.css`
   - Routen: `plural-nouns.js`

3. **Verzeichniszwecke:**
   - `controllers/` - Request/Response Handling
   - `services/` - Business Logic
   - `models/` - Datenstrukturen
   - `middleware/` - Request Processing
   - `utils/` - Wiederverwendbare Funktionen

---

**Zuletzt bereinigt:** 28.01.2025 - Entfernung von Backup-Dateien, Logs, redundanten Verzeichnissen und alten HTML-Dateien
