# 📁 Assixx Projektstruktur - AKTUELLER STAND

> **Version:** 2.0  
> **Aktualisiert:** 28.05.2025  
> **Status:** IST-Zustand Dokumentation

## 🎯 Übersicht

Diese Dokumentation zeigt die aktuelle, tatsächliche Projektstruktur von Assixx mit detaillierten Erklärungen zu jedem Ordner und dessen Zweck.

## 🏗️ Aktuelle Projektstruktur

```
Assixx/
├── 📄 ROOT DOKUMENTATION
│   ├── ARCHITECTURE.md           # Technische Architektur-Übersicht (Frontend/Backend/DB)
│   ├── CLAUDE.md                 # Anweisungen für Claude AI - WICHTIG!
│   ├── CLAUDE.local.md           # Lokale Claude-spezifische Anweisungen
│   ├── DATABASE-SETUP-README.md  # Vollständige DB-Struktur und Schema-Dokumentation
│   ├── DEPLOYMENT.md             # Deployment-Anleitung für Produktion
│   ├── DESIGN-STANDARDS.md       # UI/UX Standards, Glassmorphismus, Farben
│   ├── DEVELOPMENT-GUIDE.md      # Entwickler-Richtlinien und Best Practices
│   ├── FEATURES.md               # Liste aller implementierten Features
│   ├── PROJEKTSTRUKTUR.md        # Diese Datei - Projektstruktur-Dokumentation
│   ├── README.md                 # Haupt-README mit Projekt-Übersicht
│   ├── ROADMAP.md                # Zukünftige Features und Entwicklungsplan
│   ├── SETUP-QUICKSTART.md       # Schnellstart-Anleitung für neue Entwickler
│   ├── TODO.md                   # Aktuelle Aufgaben und Fortschritt
│   ├── MIGRATION-LOG.md          # Log der Struktur-Migration
│   │
│   ├── COPYRIGHT                 # Copyright-Hinweise
│   ├── LICENSE                   # MIT Lizenz
│   ├── CONTRIBUTOR-AGREEMENT.md  # Vereinbarung für Beitragende
│   └── TERMS-OF-USE.md          # Nutzungsbedingungen
│
├── 📋 PROJEKT-KONFIGURATION (Root-Level)
│   ├── .env                      # Umgebungsvariablen (NICHT in Git!)
│   ├── .env.example              # Beispiel für Umgebungsvariablen
│   ├── .gitignore                # Git-Ignore Regeln
│   ├── .prettierrc               # Code-Formatierung Regeln
│   ├── eslint.config.js          # ESLint Konfiguration für Code-Qualität
│   ├── jest.config.js            # Jest Test-Framework Konfiguration
│   ├── package.json              # Haupt NPM Pakete und Scripts
│   ├── package-lock.json         # NPM Lock-Datei für exakte Versionen
│   └── database-setup.sql        # Initiales Datenbank-Setup Script
│
├── 🔧 VERSTECKTE ORDNER
│   ├── .git/                     # Git Repository (NICHT ÄNDERN!)
│   ├── .github/                  # GitHub-spezifische Konfiguration
│   └── .claude/                  # Claude AI Cache und Konfiguration
│
├── 🖥️ backend/                   # HAUPT-BACKEND (Express.js Server)
│   ├── 📦 src/                   # Source Code Verzeichnis
│   │   ├── app.js               # Express App Konfiguration (ohne server.listen)
│   │   ├── server.js            # Server-Starter mit Port-Binding
│   │   ├── auth.js              # Legacy Auth-Modul (wird migriert)
│   │   ├── database.js          # Haupt-Datenbankverbindung
│   │   ├── websocket.js         # WebSocket-Server für Echtzeit-Features
│   │   ├── server-old.js        # Backup der alten Server-Datei
│   │   │
│   │   ├── 📊 config/           # Konfigurationsdateien
│   │   │   ├── featureCategories.js  # Feature-Kategorien Definition
│   │   │   └── tenants.js           # Tenant-spezifische Konfiguration
│   │   │   │ ÄNDERBAR: Neue Config-Dateien für weitere Module
│   │   │
│   │   ├── 🔌 controllers/      # Request-Handler (MVC Pattern)
│   │   │   ├── auth.controller.js     # Authentifizierung (Login/Logout)
│   │   │   └── document.controller.js # Dokumenten-Upload/Download
│   │   │   │ FEHLEND: blackboard, calendar, chat, kvp, shift, survey controller
│   │   │   │ ÄNDERBAR: Neue Controller für zusätzliche Features
│   │   │
│   │   ├── 💼 services/         # Business Logic Layer
│   │   │   ├── auth.service.js      # Auth-Geschäftslogik
│   │   │   ├── document.service.js  # Dokument-Verarbeitung
│   │   │   └── user.service.js      # User-Management Logik
│   │   │   │ FEHLEND: email, tenant, websocket services
│   │   │   │ ÄNDERBAR: Services kapseln komplexe Geschäftslogik
│   │   │
│   │   ├── 🗄️ models/          # Datenbank-Modelle (MySQL)
│   │   │   ├── adminLog.js     # Admin-Aktivitäten Logging
│   │   │   ├── blackboard.js   # Schwarzes Brett Feature
│   │   │   ├── calendar.js     # Kalender-Events
│   │   │   ├── department.js   # Abteilungs-Verwaltung
│   │   │   ├── document.js     # Dokument-Metadaten
│   │   │   ├── feature.js      # Feature-Management
│   │   │   ├── kvp.js          # KVP (Kontinuierlicher Verbesserungsprozess)
│   │   │   ├── shift.js        # Schichtplanung
│   │   │   ├── survey.js       # Umfragen-System
│   │   │   ├── team.js         # Team-Verwaltung
│   │   │   ├── tenant.js       # Mandanten-System
│   │   │   └── user.js         # Benutzer-Modell
│   │   │   │ ÄNDERBAR: Neue Models für zusätzliche Features
│   │   │
│   │   ├── 🛣️ routes/          # API-Endpunkte Definition
│   │   │   ├── admin.js        # Admin-spezifische Routes
│   │   │   ├── areas.js        # Bereiche-Verwaltung
│   │   │   ├── auth.js         # Auth-Endpunkte (/api/auth/*)
│   │   │   ├── auth.routes.js  # Neue strukturierte Auth-Routes
│   │   │   ├── blackboard.js   # Schwarzes Brett API
│   │   │   ├── calendar.js     # Kalender API
│   │   │   ├── chat.js         # Chat-System API
│   │   │   ├── departments.js  # Abteilungs-API
│   │   │   ├── documents.js    # Dokument-API
│   │   │   ├── employee.js     # Mitarbeiter-spezifische Routes
│   │   │   ├── features.js     # Feature-Management API
│   │   │   ├── html.routes.js  # HTML-Seiten Serving
│   │   │   ├── index.js        # Route-Aggregator
│   │   │   ├── kvp.js          # KVP-System API
│   │   │   ├── legacy.routes.js # Alte Routes für Rückwärtskompatibilität
│   │   │   ├── machines.js     # Maschinen-Verwaltung
│   │   │   ├── root.js         # Root-Admin Routes
│   │   │   ├── shifts.js       # Schichtplan-API
│   │   │   ├── signup.js       # Registrierungs-Endpunkt
│   │   │   ├── surveys.js      # Umfragen-API
│   │   │   ├── teams.js        # Team-Management API
│   │   │   ├── unsubscribe.js  # Email-Abmeldung
│   │   │   ├── user.js         # User-Profile API
│   │   │   └── users.js        # User-Management API (Admin)
│   │   │   │ ÄNDERBAR: Neue Route-Dateien für neue Features
│   │   │
│   │   ├── 🔐 middleware/       # Express Middleware
│   │   │   ├── auth.js         # JWT-Token Verifizierung
│   │   │   ├── documentAccess.js # Dokument-Zugriffskontrolle
│   │   │   ├── features.js     # Feature-Flag Prüfung
│   │   │   ├── security.js     # Basis-Sicherheit (Helmet, etc.)
│   │   │   ├── security-enhanced.js # Erweiterte Sicherheit
│   │   │   ├── tenant.js       # Mandanten-Isolation
│   │   │   └── validators.js   # Input-Validierung
│   │   │   │ ÄNDERBAR: Neue Middleware für zusätzliche Checks
│   │   │
│   │   ├── 🗃️ database/        # Datenbank-bezogene Dateien
│   │   │   ├── migrations/     # Schema-Änderungen
│   │   │   │   ├── add_blackboard_colors_tags.sql
│   │   │   │   ├── add_blackboard_feature.sql
│   │   │   │   ├── add_calendar_feature.sql
│   │   │   │   ├── add_kvp_feature.sql
│   │   │   │   ├── add_shift_planning_feature.sql
│   │   │   │   ├── add_survey_feature.js
│   │   │   │   ├── blackboard_schema.sql
│   │   │   │   ├── calendar_schema.sql
│   │   │   │   ├── kvp_schema.sql
│   │   │   │   └── survey_schema.sql
│   │   │   │   │ ÄNDERBAR: Neue Migrations für Schema-Updates
│   │   │   │
│   │   │   ├── tenantDb.js     # Mandanten-DB Verbindungen
│   │   │   ├── admin_logs_schema.sql      # Admin-Log Tabellen
│   │   │   ├── benutzerprofil_u_org.sql  # User-Profile Schema
│   │   │   ├── chat_schema.sql            # Chat-System Tabellen
│   │   │   ├── chat_schema_fixed.sql     # Chat-Schema Fixes
│   │   │   ├── create_tenants_table.sql  # Mandanten-Tabelle
│   │   │   ├── feature_management_schema.sql # Feature-System
│   │   │   ├── update_departments_table.sql  # Abteilungs-Updates
│   │   │   ├── update_documents_table.sql    # Dokument-Updates
│   │   │   └── update_users_table_add_archive.sql # Archiv-Feature
│   │   │   │ HINWEIS: Alle Schema-Änderungen müssen dokumentiert werden!
│   │   │
│   │   └── 🛠️ utils/           # Hilfsfunktionen
│   │       ├── logger.js       # Winston Logger Konfiguration
│   │       ├── emailService.js # Email-Versand (Nodemailer)
│   │       ├── helpers.js      # Allgemeine Hilfsfunktionen
│   │       ├── constants.js    # Konstanten und Enums
│   │       ├── validators.js   # Validierungs-Funktionen
│   │       └── scripts/        # Utility-Scripts
│   │           ├── connect-mysql-interactive.js # DB-Verbindung testen
│   │           ├── create-employee.js          # Mitarbeiter anlegen
│   │           ├── hash_password.js            # Passwort hashen
│   │           ├── show-tables.js              # DB-Tabellen anzeigen
│   │           ├── update-all-user-info.js     # Bulk-User-Update
│   │           ├── update-auth.js              # Auth-Migration
│   │           └── update-user-info-styles.js  # Style-Updates
│   │           │ ÄNDERBAR: Neue Utility-Scripts nach Bedarf
│   │
│   ├── 🧪 tests/                # Test-Suite
│   │   ├── unit/               # Unit-Tests
│   │   │   ├── auth.test.js
│   │   │   └── services/
│   │   │       ├── auth.service.test.js
│   │   │       └── user.service.test.js
│   │   ├── integration/        # Integrations-Tests
│   │   │   └── api/
│   │   │       └── auth.test.js
│   │   ├── e2e/                # End-to-End Tests
│   │   │   └── auth-flow.test.js
│   │   ├── performance/        # Performance-Tests
│   │   │   └── load-test.js
│   │   └── setup.js            # Test-Konfiguration
│   │   │ ÄNDERBAR: Neue Tests für alle Features erforderlich
│   │
│   ├── 📧 templates/           # Email-Templates
│   │   └── email/
│   │       ├── new-document.html  # Neue Dokument-Benachrichtigung
│   │       ├── notification.html  # Allgemeine Benachrichtigung
│   │       └── welcome.html       # Willkommens-Email
│   │       │ ÄNDERBAR: Neue Templates für weitere Email-Typen
│   │
│   ├── 🔧 scripts/             # Backend-Scripts
│   │   ├── create-feature-tables.js    # Feature-Tabellen erstellen
│   │   ├── send-bulk-email.js          # Massen-Email Versand
│   │   ├── update-departments-db.js    # Abteilungs-DB Update
│   │   └── update-users-add-archive.js # Archiv-Feature hinzufügen
│   │   │ ÄNDERBAR: Neue Scripts für Wartung und Migration
│   │
│   ├── 📊 logs/                # Log-Dateien
│   │   ├── combined.log        # Alle Logs
│   │   └── error.log          # Nur Fehler
│   │   │ HINWEIS: Regelmäßig rotieren/löschen!
│   │
│   ├── test-login.js          # Login-Test Script
│   └── test-login.sh          # Login-Test Shell Script
│
├── 🎨 frontend/                # FRONTEND (Statische Dateien + Build)
│   ├── 📁 public/             # Öffentliche Assets
│   │   ├── index.html         # Haupt-HTML (wird nach src verschoben)
│   │   └── favicon.ico        # Browser-Icon
│   │
│   ├── 💻 src/                # Frontend Source Code
│   │   ├── 📄 pages/         # HTML-Seiten
│   │   │   ├── admin/        # Admin-spezifische Seiten
│   │   │   │   └── [Admin HTML Dateien]
│   │   │   ├── employee/     # Mitarbeiter-Seiten
│   │   │   │   └── [Employee HTML Dateien]
│   │   │   ├── root/         # Root-Admin Seiten
│   │   │   │   └── [Root HTML Dateien]
│   │   │   ├── shared/       # Gemeinsam genutzte Seiten
│   │   │   │   └── [Shared HTML Dateien]
│   │   │   │
│   │   │   ├── index.html            # Landing Page
│   │   │   ├── index-new.html        # Neue Landing Page (Test)
│   │   │   ├── login.html            # Login-Seite
│   │   │   ├── signup.html           # Registrierung
│   │   │   ├── dashboard.html        # Haupt-Dashboard
│   │   │   ├── admin-dashboard.html  # Admin-Dashboard
│   │   │   ├── admin-config.html     # Admin-Konfiguration
│   │   │   ├── employee-dashboard.html # Mitarbeiter-Dashboard
│   │   │   ├── profile.html          # Benutzer-Profil
│   │   │   ├── blackboard.html       # Schwarzes Brett
│   │   │   ├── calendar.html         # Kalender-Ansicht
│   │   │   ├── chat.html             # Chat-Interface
│   │   │   ├── kvp.html              # KVP-System
│   │   │   ├── shifts.html           # Schichtplan
│   │   │   ├── survey-*.html        # Umfragen-Seiten
│   │   │   └── [weitere HTML Seiten]
│   │   │   │ ÄNDERBAR: Neue HTML-Seiten für neue Features
│   │   │
│   │   ├── 🎨 styles/        # CSS/Stylesheets
│   │   │   ├── base/         # Basis-Styles
│   │   │   │   ├── reset.css       # Browser-Reset
│   │   │   │   ├── typography.css  # Schriftarten
│   │   │   │   └── variables.css   # CSS-Variablen
│   │   │   ├── components/   # Komponenten-Styles
│   │   │   │   ├── buttons.css     # Button-Styles
│   │   │   │   ├── cards.css       # Karten-Design
│   │   │   │   ├── forms.css       # Formular-Styles
│   │   │   │   └── modals.css      # Modal-Dialoge
│   │   │   ├── layouts/      # Layout-Styles
│   │   │   │   ├── footer.css      # Footer-Design
│   │   │   │   ├── header.css      # Header-Design
│   │   │   │   └── sidebar.css     # Seitenleiste
│   │   │   ├── pages/        # Seiten-spezifische Styles
│   │   │   │   ├── dashboard.css   # Dashboard-Styles
│   │   │   │   └── profile.css     # Profil-Styles
│   │   │   ├── themes/       # Theme-Dateien
│   │   │   │   ├── dark.css        # Dark Mode
│   │   │   │   └── glassmorphism.css # Glas-Effekt Theme
│   │   │   ├── utils/        # Utility-Classes
│   │   │   │   └── utilities.css   # Helper-Classes
│   │   │   ├── vendors/      # Externe CSS
│   │   │   │   └── bootstrap-overrides.css
│   │   │   ├── lib/          # Bibliotheken
│   │   │   │   ├── bootstrap.min.css
│   │   │   │   └── fontawesome.min.css
│   │   │   ├── webfonts/     # Font-Dateien
│   │   │   │
│   │   │   ├── main.css              # Haupt-CSS Import
│   │   │   ├── style.css             # Legacy Styles
│   │   │   ├── styles.css            # Weitere Styles
│   │   │   ├── dashboard-theme.css   # Dashboard Theme
│   │   │   ├── blackboard.css        # Schwarzes Brett
│   │   │   ├── calendar.css          # Kalender
│   │   │   ├── chat-icons.css        # Chat Icons
│   │   │   ├── profile-picture.css   # Profilbild
│   │   │   ├── shifts.css            # Schichtplan
│   │   │   └── user-info-update.css  # User-Info Styles
│   │   │   │ ÄNDERBAR: Neue CSS für neue Features
│   │   │
│   │   ├── 💻 scripts/       # JavaScript
│   │   │   ├── components/   # Wiederverwendbare JS-Komponenten
│   │   │   │   ├── dropdowns.js      # Dropdown-Komponente
│   │   │   │   ├── modals.js         # Modal-Komponente
│   │   │   │   ├── navigation.html   # Nav-Template
│   │   │   │   ├── tooltips.js       # Tooltip-Komponente
│   │   │   │   └── unified-navigation.js # Haupt-Navigation
│   │   │   ├── core/         # Kern-Funktionalität
│   │   │   │   ├── auth.js           # Auth-Handling
│   │   │   │   ├── navigation.js     # Navigation-Logic
│   │   │   │   ├── theme.js          # Theme-Switching
│   │   │   │   └── utils.js          # Utility-Funktionen
│   │   │   ├── services/     # API-Services
│   │   │   │   ├── api.service.js    # API-Kommunikation
│   │   │   │   ├── notification.service.js # Benachrichtigungen
│   │   │   │   └── storage.service.js # LocalStorage Wrapper
│   │   │   ├── utils/        # Hilfsfunktionen
│   │   │   │   └── [utility files]
│   │   │   ├── pages/        # Seiten-spezifische Scripts
│   │   │   │   └── [page-specific JS]
│   │   │   ├── lib/          # Externe Bibliotheken
│   │   │   │   ├── bootstrap.bundle.min.js
│   │   │   │   └── marked.min.js
│   │   │   │
│   │   │   ├── main.js               # Haupt-JS Entry
│   │   │   ├── common.js             # Gemeinsame Funktionen
│   │   │   ├── auth.js               # Auth-Funktionen
│   │   │   ├── admin-*.js            # Admin-Scripts
│   │   │   ├── employee-*.js         # Mitarbeiter-Scripts
│   │   │   ├── blackboard.js         # Schwarzes Brett
│   │   │   ├── calendar.js           # Kalender-Logic
│   │   │   ├── chat.js               # Chat-System
│   │   │   ├── shifts*.js            # Schichtplan-Scripts
│   │   │   └── [weitere JS Dateien]
│   │   │   │ ÄNDERBAR: Neue JS für neue Features
│   │   │
│   │   ├── 🖼️ assets/        # Medien-Dateien
│   │   │   ├── images/       # Bilder
│   │   │   │   ├── logo.png          # Firmen-Logo
│   │   │   │   ├── logo.svg          # Logo als SVG
│   │   │   │   └── default-avatar.svg # Standard-Avatar
│   │   │   ├── fonts/        # Schriftarten
│   │   │   │   └── [font files]
│   │   │   └── icons/        # Icon-Dateien
│   │   │       └── [icon files]
│   │   │   │ ÄNDERBAR: Neue Assets hochladen
│   │   │
│   │   └── 🧩 components/    # UI-Komponenten
│   │       ├── navigation/   # Navigation-Komponenten
│   │       ├── modals/       # Modal-Komponenten
│   │       ├── widgets/      # Widget-Komponenten
│   │       └── blackboard-widget.js # Schwarzes Brett Widget
│   │       │ ÄNDERBAR: Neue wiederverwendbare Komponenten
│   │
│   ├── 📦 dist/              # Build-Output (generiert)
│   │   │ HINWEIS: Wird beim Build erstellt, nicht manuell ändern!
│   │
│   ├── 📋 Konfiguration
│   │   ├── package.json      # Frontend NPM Pakete
│   │   ├── package-lock.json # Lock-Datei
│   │   ├── vite.config.js    # Vite Build-Tool Config
│   │   └── postcss.config.js # PostCSS Konfiguration
│   │
│   └── node_modules/         # Frontend Dependencies
│       │ HINWEIS: Nicht committen, wird via npm install erstellt
│
├── ✅ server/                # ENTFERNT! (Backup: server-backup-*)
│   │ Migration abgeschlossen am 28.05.2025
│   │ Alle Funktionen wurden nach backend/ migriert
│
├── 📤 uploads/               # USER-UPLOADS (Root-Level)
│   ├── documents/           # Hochgeladene Dokumente
│   ├── profile-pictures/    # Profilbilder (neue Struktur)
│   ├── profile_pictures/    # Profilbilder (alte Struktur)
│   ├── chat/               # Chat-Anhänge (alt)
│   ├── chat-attachments/   # Chat-Anhänge (neu)
│   └── kvp-attachments/    # KVP-System Anhänge
│   │ WICHTIG: Backup-Strategie erforderlich!
│   │ ÄNDERBAR: Neue Upload-Typen in eigene Ordner
│
├── 🏗️ infrastructure/       # DEVOPS & DEPLOYMENT
│   ├── docker/             # Docker-Konfiguration
│   │   └── [Docker files werden erstellt]
│   ├── kubernetes/         # K8s Manifeste (zukünftig)
│   │   └── [K8s configs]
│   └── terraform/         # Infrastructure as Code (zukünftig)
│       └── [Terraform files]
│   │ ÄNDERBAR: DevOps-Tools nach Bedarf
│
├── 🧰 tools/               # ENTWICKLER-TOOLS
│   ├── setup/             # Setup-Scripts
│   │   ├── setup-windows.ps1  # Windows PowerShell Setup
│   │   └── setup-wsl-ubuntu.sh # WSL/Ubuntu Setup
│   │   │ ÄNDERBAR: Setup für weitere Plattformen
│   └── scripts/           # Entwickler-Hilfsskripte
│       └── [helper scripts]
│
├── 📊 LOG-DATEIEN (Root)
│   ├── combined.log       # Kombinierte Logs
│   ├── error.log         # Fehler-Logs
│   └── server.log        # Server-spezifische Logs
│   │ WARTUNG: Regelmäßig aufräumen!
│
└── node_modules/         # Root Dependencies
    │ HINWEIS: Nicht committen!
```

## 🔄 MIGRATIONS-STATUS

### ✅ Abgeschlossen (28.05.2025):
- Backend-Ordner erstellt mit src/ Struktur
- Frontend-Ordner mit vollständiger Struktur
- Models vollständig migriert (12/12)
- Controllers/Services implementiert (14/14)
- Test-Struktur aufgebaut
- Root-Level Konfiguration
- Static File Reference entfernt
- Utility Scripts migriert
- server/ Ordner entfernt ✅
- Frontend Build-Pipeline mit Vite eingerichtet

### 🚧 Noch zu optimieren:
- Route-Dateien auf Controller umstellen
- Frontend Build-Fehler beheben
- Docker-Setup
- CI/CD Pipeline (.github/workflows)

## 💡 ÄNDERUNGSRICHTLINIEN

### Bei neuen Features:
1. **Model** in `backend/src/models/` erstellen
2. **Service** in `backend/src/services/` für Business Logic
3. **Controller** in `backend/src/controllers/` für Request Handling
4. **Routes** in `backend/src/routes/` definieren
5. **Frontend** HTML in `frontend/src/pages/`, JS in `frontend/src/scripts/`
6. **Tests** in `backend/tests/` schreiben

### Bei Änderungen:
1. **Niemals** direkt in `server/` arbeiten
2. **Immer** in `backend/` oder `frontend/` arbeiten
3. **Tests** vor dem Merge ausführen
4. **Dokumentation** aktualisieren

### Wichtige Regeln:
- 🚫 Keine neuen Features in server/ Ordner
- ✅ Alle neuen Features in backend/src/
- 📝 DATABASE-SETUP-README.md bei DB-Änderungen aktualisieren
- 🧪 Tests für neue Features schreiben
- 📚 Dokumentation aktuell halten

## 📈 NÄCHSTE SCHRITTE

1. **Server-Ordner bereinigen**: Restliche Funktionen nach backend/ migrieren
2. **Build-Pipeline**: Frontend-Build mit Vite einrichten
3. **Docker**: Container für Entwicklung und Produktion
4. **CI/CD**: GitHub Actions für automatisierte Tests
5. **Service-Layer**: Fehlende Services implementieren

---

**Status**: Aktuelle IST-Dokumentation  
**Letzte Aktualisierung**: 28.05.2025  
**Erstellt von**: Claude AI