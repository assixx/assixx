# Assixx Project - Zentrale TODO-Liste

> **Letzte Aktualisierung:** 26.05.2025
> **Erstellt aus:** README.md, ROADMAP.md, CLAUDE.md, CLAUDE.local.md, SECURITY-IMPROVEMENTS.md, CHAT-SYSTEM-FIXES.md

## ✅ ERLEDIGTE AUFGABEN

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

## 🚨 KRITISCHE SICHERHEITS-TODOS (Höchste Priorität!)

Siehe [SECURITY-IMPROVEMENTS.md](./server/SECURITY-IMPROVEMENTS.md) für detaillierte Security-Aufgaben (15 Items).

## 📱 Feature-Entwicklung (Hohe Priorität)

### Q1 2025 - In Arbeit
- [ ] **Umfrage-Tool (Survey System)**
  - [x] Grundstruktur implementiert
  - [x] Admin-Interface
  - [x] Employee-Interface
  - [ ] Backend-Integration vervollständigen
  - [ ] Auswertungs-Dashboard
  - [ ] Export-Funktionen
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

### Erledigte Aufgaben: ✅ 45 Items
- **UI/UX & Design:** 15 Items
- **Features:** 20 Items
- **Dokumentation:** 5 Items
- **Bug Fixes:** 5 Items

### Offene Aufgaben: ⏳ 67 Items
- **Kritisch/Security:** 15 TODOs
- **Feature-Entwicklung:** 16 TODOs  
- **Erweiterungen:** 21 TODOs
- **Dokumentation:** 9 TODOs
- **Bugs:** 6 TODOs

**Gesamt:** 112 Items (45 erledigt, 67 offen)
**Fortschritt:** 40% abgeschlossen

---

## 🔄 Wartungshinweise

1. Diese TODO-Liste sollte wöchentlich aktualisiert werden
2. Erledigte Items mit Datum markieren
3. Neue TODOs immer mit Priorität und Kategorie versehen
4. Bei größeren Features: Unterpunkte erstellen
5. Security-TODOs haben IMMER höchste Priorität

## 📅 Nächste Review-Termine

- [ ] Wöchentliches TODO-Review: Jeden Montag
- [ ] Sprint-Planung: Alle 2 Wochen
- [ ] Quarterly Review: Ende März 2025

## 🏆 Meilensteine

- **Q4 2024:** Grundsystem mit 7 Hauptfeatures live ✅
- **Q1 2025:** UI/UX Überarbeitung, Survey-Tool
- **Q2 2025:** Mobile App, Urlaubssystem, Stripe
- **Q3 2025:** Mehrsprachigkeit, TPM-Kalender
- **Q4 2025:** Vollständige Feature-Suite