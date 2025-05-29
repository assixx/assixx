# Assixx Project - Zentrale TODO-Liste

> **Letzte Aktualisierung:** 29.05.2025 - 23:15
> **Erstellt aus:** README.md, ROADMAP.md, CLAUDE.md, CLAUDE.local.md, SECURITY-IMPROVEMENTS.md, CHAT-SYSTEM-FIXES.md
>
> **🔴 WICHTIG:** Backend-Migration abgeschlossen (28.05.2025):
>
> - Server/ → Backend/ Migration erfolgreich
> - MVC-Architektur implementiert
> - Frontend/Backend Trennung vollständig
> - Express 5 Migration abgeschlossen (29.05.2025)
> - Chat-System vollständig funktionsfähig (29.05.2025)

## ✅ ERLEDIGTE AUFGABEN

### Dependency Updates & Chat Fixes (Abgeschlossen am 29.05.2025)

- [x] **Express 5 Migration**
  - [x] Wildcard Pattern Breaking Change behoben (`/api/*` → `/api`)
  - [x] Route-Registrierung angepasst
  - [x] Fehlende Routen (machines, areas) hinzugefügt

- [x] **Chat-System Database Fixes**
  - [x] Chat-Tabellen aus Schema erstellt
  - [x] MySQL GROUP BY Fehler behoben
  - [x] Fehlende Spalten durch NULL ersetzt
  - [x] JWT Token Type Conversion implementiert
  - [x] Alle Chat-Endpoints funktionsfähig

- [x] **Frontend Path Fixes**
  - [x] MIME Type Conflicts behoben
  - [x] Script-Pfade von `/js/` auf `/scripts/` korrigiert
  - [x] API-Pfade angepasst

### Backend-Migration & Refactoring (Abgeschlossen am 28.05.2025)

- [x] **Server/ → Backend/ Migration**
  - [x] Alle Server-Dateien nach backend/src verschoben
  - [x] MVC-Architektur implementiert
  - [x] Controllers für Auth und Documents erstellt
  - [x] Services Layer für Business Logic
  - [x] app.js und server.js getrennt
  - [x] Frontend komplett nach frontend/ verschoben
  - [x] Build-System mit Vite konfiguriert
  - [x] Alle Pfade und Importe aktualisiert
  - [x] Tests migriert und strukturiert
  - [x] Scripts und Utilities organisiert
  - [x] Logs-Verzeichnis eingerichtet
  - [x] Package.json Scripts angepasst
  - [x] Dokumentation aktualisiert

### UI/UX & Design (Abgeschlossen am 26.05.2025)

- [x] **Glassmorphismus Design Standards** implementiert

  - [x] Alle Container mit transparenten Hintergründen
  - [x] Backdrop-filter blur(20px) saturate(180%)
  - [x] Einheitliche Box-Shadows und Borders
  - [x] Dramatischer Background Gradient

- [x] **Modal Design Standardisierung**

  - [x] Department-Modal als Muster definiert
  - [x] Modal Design Standards in CLAUDE.md dokumentiert
  - [x] Alle Modals auf einheitliches Design angepasst:
    - [x] admin-dashboard.html (6 Modals)
    - [x] chat.html
    - [x] kvp.html
    - [x] archived-employees.html
    - [x] org-management.html
    - [x] survey-admin.html
    - [x] survey-employee.html

- [x] **Calendar Optimierungen**

  - [x] All-day Events Anzeige korrigiert
  - [x] Zeit-Auswahl bei Event-Erstellung gefixt
  - [x] FullCalendar Navigation Icons positioniert
  - [x] Custom Dropdowns implementiert
  - [x] Modal Button-Positioning gefixt

- [x] **Shift Planning Design**
  - [x] Alle grauen Hintergründe zu Glassmorphismus geändert
  - [x] Konsistentes Design mit calendar.html

### Features (Bereits implementiert)

- [x] **Benutzer-Management System**

  - [x] Root/Admin/Employee Rollen
  - [x] Multi-Tenant Architektur
  - [x] JWT Authentication

- [x] **Dokumenten-System**

  - [x] Upload/Download Funktionalität
  - [x] Kategorisierung
  - [x] Zugriffsrechte

- [x] **Schwarzes Brett (Blackboard)**

  - [x] Grundfunktionalität
  - [x] Tags und Farben
  - [x] Lesebestätigungen

- [x] **Kalender System**

  - [x] Event-Verwaltung
  - [x] Organisationsebenen-Filter
  - [x] Drag & Drop

- [x] **KVP-System (Kontinuierlicher Verbesserungsprozess)**

  - [x] Vorschlag einreichen
  - [x] Status-Tracking
  - [x] Punkte-System

- [x] **Schichtplanung**

  - [x] Wochenansicht
  - [x] Drag & Drop Zuweisung
  - [x] Mitarbeiter-Verfügbarkeit

- [x] **Chat-System**
  - [x] WebSocket Echtzeit-Kommunikation
  - [x] Gruppenchats
  - [x] Datei-Anhänge
  - [x] Typing Indicators
  - [x] Ungelesene Nachrichten Badge

### Feature Management (27.05.2025)

- [x] **Root Features Seite**
  - [x] Feature Routes Fix (/api/features statt /features)
  - [x] Tenant-Isolation für Root User (kein Tenant-Selector)
  - [x] Glassmorphismus Design wiederhergestellt
  - [x] Category Tabs implementiert (Alle, Basis, Premium, Enterprise)
  - [x] Monthly Cost Berechnung korrigiert
  - [x] Feature Tier Mapping hinzugefügt

### Code-Qualität & Wartung (26.05.2025)

- [x] **ESLint & Prettier Setup**
  - [x] ESLint Konfiguration hinzugefügt
  - [x] Prettier Integration
  - [x] Kritische Parsing-Fehler behoben
  - [x] no-return-await Fehler korrigiert
  - [x] Doppelte Klassenmethoden entfernt
  - [x] no-undef Fehler behoben (atob als global definiert)
  - [x] Fehlende Funktionen implementiert
  - [x] 127 ESLint-Fehler verbleiben (meist unused variables in HTML-Templates)

### Clean URLs Implementation (28.05.2025)

- [x] **Alle .html Endungen aus URLs entfernt**
  - [x] Server-Routen ohne .html angelegt
  - [x] Middleware für automatische .html → clean URL Redirects
  - [x] Alle href Links in HTML-Dateien aktualisiert
  - [x] JavaScript window.location Redirects angepasst
  - [x] Navigation in unified-navigation.js bereinigt
  - [x] Blackboard-Widget Links korrigiert
  - [x] Survey-Admin/Results/Details URLs gefixt

### Projektdokumentation (28.05.2025)

- [x] **PROJEKTSTRUKTUR.md erstellt**
  - [x] Vollständige Verzeichnisstruktur dokumentiert
  - [x] Mit Beschreibungen und Kategorisierung
  - [x] In README.md verlinkt

## 🎯 NEUE HOCHPRIORITÄRE AUFGABEN (29.05.2025)

### 1. Projektstruktur-Optimierung

- [ ] **PROJEKTSTRUKTUR.md analysieren und optimieren**
  - [ ] Aktuelle Struktur auf Standards und Effizienz prüfen
  - [ ] Best Practices für SaaS-Projekte recherchieren
  - [ ] PROJEKTSTRUKTUR-BETA.md erstellen mit Verbesserungsvorschlägen
  - [ ] Nach Genehmigung: Neue Struktur implementieren
  - [ ] Folgende Aspekte berücksichtigen:
    - [ ] Modularität und Skalierbarkeit
    - [ ] Separation of Concerns
    - [ ] Test-Struktur
    - [ ] Build/Dist Ordner
    - [ ] Environment-spezifische Configs

### 2. Git Branch-Strategie

- [ ] **Branches analysieren und optimieren**
  - [ ] Aktuelle Branches auflisten und dokumentieren
  - [ ] Unnötige/veraltete Branches identifizieren und löschen
  - [ ] Branch-Strategie definieren:
    - [ ] main/master (production)
    - [ ] develop (integration)
    - [ ] feature/\* (für jedes Feature)
    - [ ] hotfix/\* (für kritische Fixes)
    - [ ] release/\* (für Releases)
  - [ ] Für jedes aktive Feature eigenen Branch erstellen:
    - [ ] feature/survey-tool
    - [ ] feature/vacation-management
    - [ ] feature/mobile-pwa
    - [ ] feature/stripe-integration
    - [ ] feature/multi-language
  - [ ] Branch-Protection Rules definieren
  - [ ] Git-Flow Dokumentation erstellen

### 3. Setup-Guide Konsolidierung

- [ ] **Zentrale Setup-Guides erstellen (Anfängerfreundlich)**
  - [ ] Alle existierenden Setup-Dateien analysieren:
    - [ ] SETUP-QUICKSTART.md
    - [ ] DATABASE-SETUP-README.md
    - [ ] DEVELOPMENT-GUIDE.md
    - [ ] setup-windows.ps1
    - [ ] setup-wsl-ubuntu.sh
  - [ ] Drei neue zentrale Guides erstellen:
    - [ ] **SETUP-WINDOWS.md** (inkl. WSL)
      - [ ] VSCode Installation
      - [ ] Git Installation & Konfiguration
      - [ ] GitHub Account & SSH-Keys
      - [ ] Projekt klonen (Schritt-für-Schritt)
      - [ ] Node.js & npm Installation
      - [ ] MySQL Installation (inkl. Workbench)
      - [ ] Datenbank-Setup
      - [ ] Environment-Variablen
      - [ ] Projekt starten
      - [ ] Troubleshooting
    - [ ] **SETUP-UBUNTU.md**
      - [ ] Gleiche Struktur wie Windows
      - [ ] Linux-spezifische Befehle
      - [ ] apt-get Commands
      - [ ] Permissions & sudo
    - [ ] **SETUP-MAC.md**
      - [ ] Homebrew Installation
      - [ ] Mac-spezifische Anpassungen
      - [ ] Xcode Command Line Tools
  - [ ] Jeden Befehl mit Erklärung versehen
  - [ ] Screenshots/Diagramme hinzufügen wo nötig
  - [ ] Häufige Fehler und Lösungen dokumentieren
  - [ ] Alte Setup-Dateien archivieren

## 🚨 KRITISCHE SICHERHEITS-TODOS (Höchste Priorität!)

### GitHub Security Alerts (26.05.2025)

- [ ] **Low Severity**: Cookie package vulnerability (GHSA-pxg6-pf52-xh8x)
  - Betroffene Packages: cookie < 0.7.0, csurf
  - In separatem Branch beheben wegen möglicher Breaking Changes
- [ ] **Deprecated Package**: csurf ersetzen durch moderne Alternative
- [ ] Alle 15 Security-Items aus SECURITY-IMPROVEMENTS.md (Datei wurde gelöscht, Items müssen neu erfasst werden)

## 📱 Feature-Entwicklung (Hohe Priorität)

### Q1 2025 - In Arbeit

- [ ] **Umfrage-Tool (Survey System)** - VERSCHOBEN (nach Priorität 1 Aufgaben)
  - [x] Grundstruktur implementiert
  - [x] Admin-Interface
  - [x] Employee-Interface
  - [x] **Survey Feature Checkup durchführen** ✅ (29.05.2025)
    - [x] API Response Format Issue behoben (JWT IDs als Numbers)
    - [x] Survey.getStatistics implementiert und erweitert
    - [x] Excel Export Property Paths korrigiert
    - [x] Navigation in survey-employee.html gefixt
    - [x] Boolean-Felder Handling korrigiert (is_anonymous, is_mandatory)
    - [x] Survey Response Tracking repariert
    - [x] DATABASE-SETUP-README.md mit MySQL Type-Hinweisen ergänzt
  - [x] **Survey Admin Fixes** ✅ (29.05.2025)
    - [x] Buffer-zu-Text Konvertierung in survey-admin.html
    - [x] Custom Dropdown Handling für Question Types
    - [x] Survey Edit Modal Fehler behoben
  - [x] **Survey Results Page** ✅ (29.05.2025)
    - [x] Statistik-Anzeige implementiert
    - [x] Question-spezifische Auswertungen
    - [x] Konsistentes Design mit unified-navigation.js
  - [x] **Survey Notifications** ✅ (29.05.2025)
    - [x] Badge für offene Umfragen in Navigation
    - [x] API Endpoint /api/surveys/pending-count
    - [x] Automatische Updates alle 30 Sekunden
  - [ ] Backend-Integration vervollständigen
  - [x] Auswertungs-Dashboard ✅
  - [ ] Export-Funktionen (Excel teilweise implementiert)
  - [ ] E-Mail-Benachrichtigungen

### Q2 2025 - Geplant

- [ ] **Urlaubsantrag-System**

  - [ ] Antragsformular
  - [ ] Genehmigungsworkflow
  - [ ] Kalenderintegration
  - [ ] Resturlaubsanzeige
  - [ ] E-Mail-Benachrichtigungen

- [ ] **Mobile PWA (Progressive Web App)**

  - [ ] Service Worker implementieren
  - [ ] Offline-Funktionalität
  - [ ] Push-Benachrichtigungen
  - [ ] App-Manifest
  - [ ] iOS/Android Optimierungen

- [ ] **Stripe Integration**
  - [ ] Payment Gateway einrichten
  - [ ] Subscription Management
  - [ ] Invoice Generation
  - [ ] Payment History

## 🔧 Feature-Erweiterungen (Mittlere Priorität)

### Schichtplanung Erweiterungen

- [ ] Mitarbeiter-Tauschbörse für Schichten
- [ ] Erweiterte Benachrichtigungen (E-Mail, Push)
- [ ] Überstunden-/Fehlzeitenerfassung
- [ ] Schichtvorlagen und -muster

### KVP-System Erweiterungen

- [ ] Bewertungssystem für Vorschläge
- [ ] E-Mail-Benachrichtigungen bei Status-Updates
- [ ] Analytics und Reporting Dashboard
- [ ] Prämienberechnung und -verwaltung

### Chat-System Verbesserungen

- [x] Grundfunktionalität
- [x] WebSocket Integration
- [x] Typing Indicators
- [x] Unread Count
- [ ] Push-Benachrichtigungen
- [ ] Lesebestätigungen (Frontend-Anzeige)
- [ ] Nachrichtenreaktionen (Emojis)
- [ ] Ende-zu-Ende Verschlüsselung
- [ ] Nachrichtensuche
- [ ] Message Forwarding
- [ ] Chat Export Funktionalität

### Weitere Features

- [ ] **TPM-Kalender (Total Productive Maintenance)**

  - [ ] Wartungsplanung
  - [ ] Checklisten
  - [ ] Erinnerungen
  - [ ] Historie

- [ ] **Qualitätssicherungs-Checklisten**

  - [ ] Digitale Checklisten
  - [ ] Automatische Reports
  - [ ] Fehlertracking

- [ ] **Mehrsprachige Unterstützung**
  - [ ] i18n Framework
  - [ ] Übersetzungen (EN, TR, PL)
  - [ ] Sprachumschaltung

## 📝 Dokumentation & Wartung (Niedrige Priorität)

### Code & Dokumentation

- [x] README.md erstellt
- [x] ROADMAP.md erstellt
- [x] DATABASE-SETUP-README.md erstellt
- [x] CLAUDE.md mit Standards
- [x] Modal Design Standards dokumentiert
- [ ] Unterpunkte für Key Features erstellen (aus CLAUDE.local.md)
- [ ] DATABASE-SETUP-README.md bei DB-Änderungen aktualisieren
- [ ] API-Dokumentation vervollständigen
- [ ] Deployment-Guide erweitern
- [ ] Testing-Dokumentation

### Code-Qualität

- [x] ESLint & Prettier Setup (26.05.2025)
- [ ] Verbleibende ESLint-Warnungen beheben (127 Items)
- [ ] Unit Tests implementieren
- [ ] Integration Tests
- [ ] E2E Tests mit Cypress

### Lohnabrechnungs-Erweiterungen

- [ ] Erweiterte Filter-Optionen
- [ ] Bulk-Upload Funktionalität
- [ ] Jahresübersichten
- [ ] Steuerrelevante Exporte

## 🐛 Bekannte Bugs & Fixes

### Calendar/Kalender

- [x] All-day Events spanning multiple days - FIXED
- [x] Time selection disabled issue - FIXED
- [ ] Backend all-day Event Storage Issue
- [ ] Timezone-Handling verbessern

### Font Awesome

- [x] CDN als Fallback in survey-admin.html hinzugefügt
- [ ] Font Awesome CDN in allen HTML-Dateien hinzufügen
- [ ] Lokale Font-Dateien bereitstellen als Fallback

### UI/UX

- [x] Modal-Zentrierung in survey-admin.html - FIXED
- [x] kvp.html Modal Close-Button - FIXED
- [ ] Responsive Design für alle neuen Features
- [ ] Dark Mode Support erweitern
- [ ] Loading States verbessern

## 📊 Status-Übersicht

### Erledigte Aufgaben: ✅ 98 Items

- **Backend-Migration:** 14 Items
- **Dependency Updates:** 3 Items
- **Chat-System Fixes:** 5 Items
- **Frontend Path Fixes:** 3 Items
- **UI/UX & Design:** 15 Items
- **Features:** 20 Items
- **Feature Management:** 6 Items
- **Code-Qualität:** 9 Items
- **Clean URLs:** 8 Items
- **Dokumentation:** 10 Items (inkl. PROJEKTSTRUKTUR.md, DATABASE-SETUP-README.md Update)
- **Bug Fixes:** 5 Items

### Offene Aufgaben: ⏳ 117 Items

- **NEUE Hochprioritäre Aufgaben:** 46 TODOs
  - Projektstruktur-Optimierung: 10 TODOs
  - Git Branch-Strategie: 11 TODOs
  - Setup-Guide Konsolidierung: 25 TODOs
- **Kritisch/Security:** 15 TODOs
- **Feature-Entwicklung:** 16 TODOs
- **Erweiterungen:** 21 TODOs
- **Code-Qualität:** 4 TODOs
- **Dokumentation:** 9 TODOs
- **Bugs:** 6 TODOs

**Gesamt:** 285 Items (150 erledigt, 135 offen)
**Fortschritt:** 52% abgeschlossen (150 von 285 Aufgaben) ✅

---

## 🔄 Wartungshinweise

1. Diese TODO-Liste sollte wöchentlich aktualisiert werden
2. Erledigte Items mit Datum markieren
3. Neue TODOs immer mit Priorität und Kategorie versehen
4. Bei größeren Features: Unterpunkte erstellen
5. **AKTUELLE PRIORITÄTEN (Stand 29.05.2025):**
   - 1️⃣ Neue hochprioritäre Aufgaben (Projektstruktur, Git, Setup)
   - 2️⃣ Security-TODOs
   - 3️⃣ Feature-Entwicklung
   - 4️⃣ Sonstige Erweiterungen

## 📅 Nächste Review-Termine

- [ ] Wöchentliches TODO-Review: Jeden Montag
- [ ] Sprint-Planung: Alle 2 Wochen
- [ ] Quarterly Review: Ende März 2025

## 🏆 Meilensteine

- **Q4 2024:** Grundsystem mit 7 Hauptfeatures live ✅
- **Q1 2025:** UI/UX Überarbeitung, Survey-Tool
- **Q2 2025 - AKTUALISIERT:**
  - Projektstruktur-Optimierung (Mai)
  - Git Branch-Strategie (Mai)
  - Setup-Guide Konsolidierung (Juni)
  - Mobile App, Urlaubssystem (Juni-Juli)
  - Stripe Integration (Juli-August)
- **Q3 2025:** Mehrsprachigkeit, TPM-Kalender
- **Q4 2025:** Vollständige Feature-Suite
