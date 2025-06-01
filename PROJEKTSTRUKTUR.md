# 📁 Assixx Projektstruktur

> **Letzte Aktualisierung:** 30.05.2025  
> **Status:** 🔄 TypeScript Migration im Gange

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
│   │   └── tenantDb.ts
│   ├── 📂 middleware/     # Express Middleware
│   │   ├── auth.ts
│   │   ├── documentAccess.ts
│   │   ├── features.ts
│   │   ├── security.ts
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
│   ├── 📂 utils/          # Hilfsfunktionen
│   │   ├── 📂 scripts/    # Utility-Skripte (noch .js)
│   │   ├── constants.ts
│   │   ├── emailService.ts
│   │   ├── helpers.ts
│   │   ├── logger.ts
│   │   └── validators.ts
│   ├── app.ts             # Express App Konfiguration
│   ├── auth.ts            # Auth Utilities
│   ├── database.ts        # Datenbankverbindung
│   ├── server.ts          # Server Entry Point
│   ├── server-old.js      # Backup der alten Server-Datei
│   └── websocket.ts       # WebSocket Handler
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

| Datei                           | Beschreibung                    |
| ------------------------------- | ------------------------------- |
| 📄 ARCHITECTURE.md              | Systemarchitektur & Tech Stack  |
| 📄 BUGS-GEFUNDEN.md             | Dokumentierte Bugs aus Tests    |
| 📄 CLAUDE.md                    | AI-Assistenten Anweisungen      |
| 📄 CLAUDE.local.md              | Lokale AI-Anweisungen           |
| 📄 CONTRIBUTOR-AGREEMENT.md     | Beitragsvereinbarung            |
| 📄 COPYRIGHT                    | Copyright-Informationen         |
| 📄 DATABASE-SETUP-README.md     | Datenbank-Setup Guide           |
| 📄 DEPLOYMENT.md                | Production Deployment Guide     |
| 📄 DESIGN-STANDARDS.md          | UI/UX Design Standards          |
| 📄 DEVELOPMENT-GUIDE.md         | Entwicklungsrichtlinien         |
| 📄 FEATURES.md                  | Feature-Übersicht & Preise      |
| 📄 FUNKTIONSTEST.md             | Umfassender Funktionstestplan   |
| 📄 LICENSE                      | Lizenzinformationen             |
| 📄 MIGRATION-CHECKLIST.md       | TypeScript Migration Checklist  |
| 📄 MIGRATION-EXAMPLE.md         | TypeScript Migration Beispiele  |
| 📄 MIGRATION-LOG.md             | Migrationsprotokoll             |
| 📄 MIGRATION-PLAN.md            | Migrationsplan (abgeschlossen)  |
| 📄 MIGRATION-SUMMARY.md         | TypeScript Migration Zusammenf. |
| 📄 MIGRATION-TYPESCRIPT-PLAN.md | TypeScript Migrationsplan       |
| 📄 PROJEKTSTRUKTUR.md           | Diese Datei                     |
| 📄 README.md                    | Projekt-Übersicht               |
| 📄 ROADMAP.md                   | Entwicklungsfahrplan            |
| 📄 SETUP-MACOS.md               | macOS Setup Guide               |
| 📄 SETUP-QUICKSTART.md          | Schnellstart Guide (veraltet)   |
| 📄 SETUP-UBUNTU-LINUX.md        | Ubuntu/Linux Setup Guide        |
| 📄 SETUP-WINDOWS-WSL.md         | Windows WSL Setup Guide         |
| 📄 TERMS-OF-USE.md              | Nutzungsbedingungen             |
| 📄 TODO.md                      | Aktuelle Aufgabenliste          |

## 🔄 Migration Status

### ✅ Abgeschlossene Migrationen:

- `server/` → `backend/` (28.01.2025)
- Static File Paths aktualisiert
- MVC-Architektur implementiert
- Frontend Build System eingerichtet

### 🔄 Laufende Migrationen:

- **TypeScript Migration** (30.05.2025 - in Arbeit)
  - Backend-Quellcode von `.js` zu `.ts` konvertiert
  - Scripts-Ordner bleibt vorläufig bei `.js`
  - Typdefinitionen werden schrittweise hinzugefügt

### 🚧 Ausstehende Bereinigungen:

- Upload-Verzeichnisse konsolidieren (duplicate folders)
- Frontend-Komponenten modularisieren
- Test-Coverage erweitern
- TypeScript Konfiguration vervollständigen

## 📋 Wichtige Hinweise

1. **Git-ignorierte Verzeichnisse:**

   - `node_modules/` - NPM Pakete
   - `uploads/` - User-generierte Inhalte
   - `logs/` - Anwendungslogs
   - `dist/` - Build-Outputs
   - `.env` - Umgebungsvariablen

2. **Naming Conventions:**

   - Backend-Dateien: `kebab-case.ts`
   - Frontend-Dateien: `kebab-case.js`
   - Komponenten: `PascalCase.js`
   - CSS: `kebab-case.css`
   - Routen: `plural-nouns.ts`

3. **Verzeichniszwecke:**
   - `controllers/` - Request/Response Handling
   - `services/` - Business Logic
   - `models/` - Datenstrukturen
   - `middleware/` - Request Processing
   - `utils/` - Wiederverwendbare Funktionen

---

**Zuletzt bereinigt:** 28.01.2025 - Entfernung von Backup-Dateien, Logs, redundanten Verzeichnissen und alten HTML-Dateien
