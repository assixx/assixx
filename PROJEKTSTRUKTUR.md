# 📁 Assixx Projektstruktur

> **Letzte Aktualisierung:** 28.05.2025  
> **Projekt:** Multi-Tenant SaaS für Industriefirmen

## 🗂️ Hauptverzeichnis (`/Assixx`)

```
Assixx/
├── 📄 Dokumentation (Root-Ebene)
│   ├── ARCHITECTURE.md          # System-Architektur & Tech Stack
│   ├── CLAUDE.md               # AI Assistant Anweisungen
│   ├── CLAUDE.local.md         # Lokale Entwickler-Notizen
│   ├── DATABASE-SETUP-README.md # Datenbank-Schema Dokumentation
│   ├── DEPLOYMENT.md           # Deployment-Anleitung
│   ├── DESIGN-STANDARDS.md     # UI/UX Design Standards (Glassmorphismus)
│   ├── DEVELOPMENT-GUIDE.md    # Entwickler-Leitfaden
│   ├── FEATURES.md            # Feature-Übersicht
│   ├── PROJEKTSTRUKTUR.md     # Diese Datei
│   ├── README.md              # Projekt-Übersicht
│   ├── ROADMAP.md             # Entwicklungs-Roadmap
│   ├── SETUP-QUICKSTART.md    # Schnellstart-Anleitung
│   ├── TODO.md                # Zentrale TODO-Liste
│   └── TERMS-OF-USE.md        # Nutzungsbedingungen
│
├── 📋 Konfiguration & Setup
│   ├── .github/               # GitHub-Konfiguration
│   │   ├── CODEOWNERS         # Code-Verantwortliche
│   │   └── dependabot.yml     # Dependency Updates
│   ├── .gitignore             # Git-Ausschlüsse
│   ├── database-setup.sql     # Initial DB Setup
│   ├── package-lock.json      # NPM Lock-Datei
│   ├── setup-windows.ps1      # Windows Setup-Skript
│   └── setup-wsl-ubuntu.sh    # Linux/WSL Setup-Skript
│
├── 📜 Rechtliches
│   ├── COPYRIGHT              # Copyright-Informationen
│   ├── LICENSE                # MIT Lizenz
│   └── CONTRIBUTOR-AGREEMENT.md # Beitragsvereinbarung
│
└── 🖥️ server/                 # Hauptanwendung
```

## 🖥️ Server-Verzeichnis (`/server`)

### 📁 Hauptstruktur

```
server/
├── 🔧 Konfiguration
│   ├── .env                   # Umgebungsvariablen (nicht in Git)
│   ├── .env.example           # Beispiel-Umgebungsvariablen
│   ├── .prettierrc            # Code-Formatierung
│   ├── eslint.config.js       # Linting-Regeln
│   ├── package.json           # NPM-Abhängigkeiten
│   └── package-lock.json      # NPM Lock-Datei
│
├── 🚀 Hauptdateien
│   ├── server.js              # Express Server (Haupteinstiegspunkt)
│   ├── index.js               # Server-Starter
│   ├── database.js            # Datenbank-Verbindung
│   ├── auth.js                # JWT-Authentifizierung
│   └── websocket.js           # WebSocket für Chat
│
├── 📊 Logs
│   ├── combined.log           # Alle Logs
│   └── error.log              # Fehler-Logs
│
└── 🔍 Hilfsdateien
    ├── check-root-tenant.js   # Tenant-Überprüfung
    ├── check-survey.js        # Survey-Feature Check
    └── debug-features.js      # Feature-Debugging
```

### 📂 Unterverzeichnisse

#### 🔐 `/middleware` - Express Middleware
```
middleware/
├── auth.js                # Token-Validierung
├── documentAccess.js      # Dokument-Zugriffskontrolle
├── features.js            # Feature-Flags
├── security.js            # Sicherheits-Header
├── security-enhanced.js   # Erweiterte Sicherheit
├── tenant.js              # Multi-Tenant Isolation
└── validators.js          # Input-Validierung
```

#### 🗄️ `/models` - Datenbank-Modelle
```
models/
├── adminLog.js            # Admin-Aktivitäten
├── blackboard.js          # Schwarzes Brett
├── calendar.js            # Kalender-Events
├── department.js          # Abteilungen
├── document.js            # Dokumente
├── feature.js             # Feature-Management
├── kvp.js                 # Verbesserungsvorschläge
├── shift.js               # Schichtplanung
├── survey.js              # Umfragen
├── team.js                # Teams
├── tenant.js              # Mandanten
└── user.js                # Benutzer
```

#### 🛣️ `/routes` - API-Endpunkte
```
routes/
├── admin.js               # Admin-APIs
├── areas.js               # Bereiche (unused)
├── auth.js                # Login/Logout
├── blackboard.js          # Schwarzes Brett API
├── calendar.js            # Kalender API
├── chat.js                # Chat API
├── departments.js         # Abteilungen API
├── documents.js           # Dokumente API
├── employee.js            # Mitarbeiter API
├── features.js            # Feature-Management API
├── kvp.js                 # KVP API
├── machines.js            # Maschinen (unused)
├── root.js                # Root-User API
├── shifts.js              # Schichtplanung API
├── signup.js              # Registrierung API
├── surveys.js             # Umfragen API
├── teams.js               # Teams API
├── unsubscribe.js         # E-Mail Abmeldung
├── user.js                # Benutzerprofil API
└── users.js               # Benutzerverwaltung API
```

#### 🗃️ `/database` - Datenbank-Schemas
```
database/
├── migrations/            # Feature-Migrationen
│   ├── add_blackboard_colors_tags.sql
│   ├── add_blackboard_feature.sql
│   ├── add_calendar_feature.sql
│   ├── add_kvp_feature.sql
│   ├── add_shift_planning_feature.sql
│   ├── add_survey_feature.js
│   ├── blackboard_schema.sql
│   ├── calendar_schema.sql
│   ├── kvp_schema.sql
│   └── survey_schema.sql
│
├── SQL-Dateien
│   ├── add_archive_column_to_users.sql
│   ├── admin_logs_schema.sql
│   ├── benutzerprofil_u_org.sql
│   ├── chat_schema.sql
│   ├── create_tenants_table.sql
│   ├── feature_management_schema.sql
│   ├── update_departments_table.sql
│   ├── update_documents_table.sql
│   └── update_users_table_add_archive.sql
│
└── tenantDb.js            # Multi-Tenant DB-Logik
```

#### 🌐 `/public` - Frontend (Statische Dateien)
```
public/
├── 📄 HTML-Seiten (33 Dateien)
│   ├── index.html              # Landing Page
│   ├── login.html              # Anmeldung
│   ├── signup.html             # Registrierung
│   │
│   ├── 👤 Admin-Bereich
│   │   ├── admin-dashboard.html
│   │   ├── admin-config.html
│   │   ├── archived-employees.html
│   │   ├── document-upload.html
│   │   ├── feature-management.html
│   │   ├── org-management.html
│   │   ├── survey-admin.html
│   │   └── survey-results.html
│   │
│   ├── 👷 Mitarbeiter-Bereich
│   │   ├── employee-dashboard.html
│   │   ├── employee-documents.html
│   │   ├── employee-profile.html
│   │   ├── salary-documents.html
│   │   └── survey-employee.html
│   │
│   ├── 🔧 Root-Bereich
│   │   ├── root-dashboard.html
│   │   ├── root-features.html
│   │   ├── root-features-old.html
│   │   └── root-profile.html
│   │
│   └── 🛠️ Gemeinsame Features
│       ├── blackboard.html      # Schwarzes Brett
│       ├── calendar.html        # Kalender
│       ├── chat.html           # Chat-System
│       ├── kvp.html            # Verbesserungsvorschläge
│       ├── shifts.html         # Schichtplanung
│       ├── profile.html        # Profilverwaltung
│       ├── profile-picture.html # Profilbild
│       ├── settings.html       # Einstellungen
│       ├── hilfe.html          # Hilfe-Seite
│       ├── dashboard.html      # Allgemeines Dashboard
│       ├── design-standards.html # Design-Dokumentation
│       ├── survey-details.html # Umfrage-Details
│       └── survey-employee.html # Mitarbeiter-Umfragen
│
├── 🎨 CSS-Stile
│   └── css/
│       ├── dashboard-theme.css  # Hauptthema (Glassmorphismus)
│       ├── style.css           # Legacy-Stile
│       ├── styles.css          # Weitere Stile
│       ├── user-info-update.css # Header-Benutzerinfo
│       ├── blackboard.css      # Schwarzes Brett
│       ├── calendar.css        # Kalender-Stile
│       ├── chat-icons.css      # Chat-Icons
│       ├── profile-picture.css # Profilbild-Stile
│       ├── shifts.css          # Schichtplanung
│       └── lib/                # Externe CSS
│           ├── bootstrap.min.css
│           └── fontawesome.min.css
│
├── 💻 JavaScript
│   └── js/
│       ├── 📱 Feature-Skripte
│       │   ├── admin-dashboard.js
│       │   ├── blackboard.js
│       │   ├── calendar.js
│       │   ├── chat.js
│       │   ├── kvp.js (in HTML)
│       │   ├── shifts.js
│       │   └── shifts-new.js
│       │
│       ├── 👤 Benutzer-Skripte
│       │   ├── auth.js
│       │   ├── employee-dashboard.js
│       │   ├── profile-picture.js
│       │   ├── header-user-info.js
│       │   └── root-dashboard.js
│       │
│       ├── 🔧 Hilfs-Skripte
│       │   ├── common.js
│       │   ├── dashboard-scripts.js
│       │   ├── upload-document.js
│       │   ├── admin-config.js
│       │   ├── admin-employee-search.js
│       │   ├── employee-deletion.js
│       │   ├── confirm-once.js
│       │   └── show-section.js
│       │
│       ├── 📚 Externe Bibliotheken
│       │   └── lib/
│       │       ├── bootstrap.bundle.min.js
│       │       └── marked.min.js
│       │
│       └── 🧩 Komponenten
│           └── components/
│               ├── navigation.html
│               └── unified-navigation.js
│
├── 🖼️ Bilder & Assets
│   ├── images/
│   │   ├── logo.png
│   │   ├── logo.svg
│   │   └── default-avatar.svg
│   ├── favicon.ico
│   └── components/
│       └── blackboard-widget.js
│
└── 🔤 Webfonts
    └── css/webfonts/        # Font Awesome Fonts
```

#### 📤 `/uploads` - Benutzer-Uploads
```
uploads/
├── chat/                # Chat-Anhänge
├── documents/           # Hochgeladene Dokumente
├── kvp/                 # KVP-Anhänge
│   └── attachments-*.png/jpg
└── profile_pictures/    # Profilbilder
```

#### 🛠️ `/utils` - Hilfsfunktionen
```
utils/
├── emailService.js      # E-Mail-Versand
├── logger.js           # Winston Logger
└── scripts/            # Utility-Skripte
    ├── connect-mysql-interactive.js
    ├── create-employee.js
    ├── hash_password.js
    ├── show-tables.js
    ├── update-all-user-info.js
    ├── update-auth.js
    └── update-user-info-styles.js
```

#### 📧 `/templates` - E-Mail-Vorlagen
```
templates/
└── email/
    ├── new-document.html    # Neue Dokument-Benachrichtigung
    ├── notification.html    # Allgemeine Benachrichtigung
    └── welcome.html         # Willkommens-E-Mail
```

#### 🔧 `/scripts` - Admin-Skripte
```
scripts/
├── create-feature-tables.js  # Feature-Tabellen erstellen
├── send-bulk-email.js       # Massen-E-Mail
├── update-departments-db.js  # Abteilungen aktualisieren
└── update-users-add-archive.js # Archiv-Feature
```

#### ⚙️ `/config` - Konfigurationsdateien
```
config/
├── featureCategories.js     # Feature-Kategorien
└── tenants.js              # Tenant-Konfiguration
```

## 📊 Statistiken

- **HTML-Seiten:** 33
- **JavaScript-Dateien:** 35+
- **CSS-Dateien:** 11
- **API-Routes:** 20
- **Datenbank-Modelle:** 12
- **Middleware:** 7

## 🚀 Features

### Implementierte Features:
- ✅ Multi-Tenant Architektur
- ✅ JWT-Authentifizierung
- ✅ Dokumentenverwaltung
- ✅ Schwarzes Brett (Blackboard)
- ✅ Kalender-System
- ✅ KVP-System (Kontinuierlicher Verbesserungsprozess)
- ✅ Schichtplanung
- ✅ Chat-System (WebSocket)
- ✅ Umfrage-Tool (In Entwicklung)
- ✅ Glassmorphismus UI-Design

### Geplante Features:
- ⏳ Urlaubsantrag-System
- ⏳ Mobile PWA
- ⏳ Stripe Payment Integration
- ⏳ TPM-Kalender
- ⏳ Mehrsprachigkeit (i18n)

## 🔒 Sicherheit

- JWT-basierte Authentifizierung
- Multi-Tenant Isolation
- Input-Validierung
- Rate Limiting
- Security Headers (CSP, HSTS, etc.)
- SQL Injection Protection

## 📝 Hinweise

1. **node_modules/** Verzeichnisse sind aus der Struktur ausgeschlossen
2. **.git/** Verzeichnis ist ausgeschlossen
3. Upload-Inhalte sind aus Datenschutzgründen ausgeschlossen
4. Alle URLs verwenden Clean URLs ohne .html Endungen
5. Glassmorphismus-Design ist durchgängig implementiert

---

**Zuletzt aktualisiert:** 28.05.2025