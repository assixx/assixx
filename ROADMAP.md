# Assixx Roadmap - SaaS-Plattform für Industriefirmen

## Vision
Assixx wird eine vollständige SaaS-Plattform für Industriefirmen, die modular erweiterbare Features anbietet und Kunden ermöglicht, nur für die Funktionen zu bezahlen, die sie tatsächlich benötigen.

## Feature-Management-System (bereits implementiert)

### Basis-Features (€0/Monat)
- ✅ Mitarbeiterverwaltung (bis 10 Mitarbeiter)
- ✅ Basis-Dokumentenupload
- ✅ Lohnabrechnungsverwaltung

### Premium-Features (€49/Monat)
- ✅ Unbegrenzte Mitarbeiter
- ✅ E-Mail-Benachrichtigungen (bis 1000/Monat)
- ✅ Erweiterte Berichte
- ✅ Audit Logs

### Enterprise-Features (€149/Monat)
- ✅ API-Zugang
- ✅ Custom Branding
- ✅ Priority Support
- ✅ Automatisierung
- ✅ Multi-Mandanten-Verwaltung
- ✅ Unbegrenzte E-Mail-Benachrichtigungen

## Prioritäten für die nächsten Phasen

### Priorität 1: Kernfeatures für Produktionsbetriebe

1. **Blackboard-System** ✅ VOLLSTÄNDIG IMPLEMENTIERT
   - [x] Firmenweit sichtbares Blackboard für allgemeine Ankündigungen
   - [x] Abteilungsspezifische Blackboards (nur für Mitglieder sichtbar)
   - [x] Team-basierte Blackboards für spezifische Arbeitsgruppen
   - [x] Benutzerfreundliches UI für Eintragsmanagement mit Glassmorphismus-Design
   - [x] Leserechte für Mitarbeiter, volle Rechte für Admins
   - [x] Lesebestätigungsfunktion für wichtige Mitteilungen
   - [x] Priorisierung von Ankündigungen (niedrig, normal, hoch, kritisch)
   - [x] Ablaufdatum für zeitlich begrenzte Ankündigungen
   - [x] **NEU:** Farb- und Tag-System für bessere Kategorisierung
   - [x] **NEU:** Erweiterte Filter-Funktionen (Priorität, Tags, Farben, Organisationsebene)
   - [x] **NEU:** Moderne UI mit Card-Layout und visuellen Prioritätsindikatoren

2. **Firmenkalender** ✅ VOLLSTÄNDIG IMPLEMENTIERT
   - [x] Zentraler Firmenkalender für allgemeine Events
   - [x] Abteilungsspezifische Kalender für interne Meetings
   - [x] Team-spezifische Kalender für Schichten und Arbeitspläne
   - [x] Integration mit Dashboard und Navigation
   - [x] Erinnerungsfunktion für wichtige Termine
   - [x] **NEU:** Benutzerdefinierte Farbauswahl für Kalendereinträge
   - [x] **NEU:** FullCalendar Integration mit Event-Display und Tooltips
   - [x] **NEU:** Event-Bearbeitung mit vollständiger Formular-Validierung
   - [x] **NEU:** Automatische Farb-Fallbacks basierend auf Organisationsebenen

3. **Schichtplanungs-Tool** ✅ VOLLSTÄNDIG IMPLEMENTIERT
   - [x] Interaktiver Schichtplaner mit Drag & Drop für Team- und Abteilungsleiter
   - [x] Wöchentliche Schichtplanansicht mit Navigation zwischen Kalenderwochen
   - [x] Validierung verhindert Doppelzuweisungen am selben Tag
   - [x] Multi-Tenant Support mit vollständiger Datenbankintegration
   - [x] Glassmorphismus-Design im Dashboard-Stil
   - [x] Auto-Save Funktionalität für Wochennotizen
   - [x] API-Endpunkte für Schichten, Maschinen und Bereiche
   - [x] **NEU:** Vollständiges Datenbankschema mit 8 Tabellen (shifts, shift_assignments, etc.)
   - [x] **NEU:** Context-Selection für Abteilung, Maschine, Teamleiter und Bereich
   - [x] **NEU:** Drei-Schicht-System (Früh, Spät, Nacht) mit visualisierter Zuordnung
   - [ ] Automatische Schichtplanerstellung basierend auf Verfügbarkeiten
   - [ ] Mitarbeiter-Tauschbörse für Schichten
   - [ ] Benachrichtigungen über Schichtänderungen
   - [ ] Überstunden- und Fehlzeitenerfassung

4. **KVP-System (Kontinuierlicher Verbesserungsprozess)** ✅ VOLLSTÄNDIG IMPLEMENTIERT
   - [x] Kontinuierlicher Verbesserungsprozess mit vollständiger CRUD-Funktionalität
   - [x] Kategorisierte Vorschläge mit Prioritätssystem (niedrig, normal, hoch, kritisch)
   - [x] File-Upload System mit Bildvorschau und sicherem Download
   - [x] Status-Management mit 7 verschiedenen Status und farbiger Visualisierung
   - [x] Employee-Berechtigungen: Eigene Vorschläge erstellen, bearbeiten und löschen
   - [x] Admin-Berechtigungen: Status ändern, archivieren, alle Vorschläge verwalten
   - [x] Modal-System mit Vollbild-Bildansicht und Attachment-Download
   - [x] Status-Historie-Tracking für Audit-Trail
   - [x] Points-System für Gamification (Grundstruktur implementiert)
   - [x] Ultra-modernes Glassmorphismus-Design mit Gradient-Status-Badges
   - [x] Multi-Tenant Support mit vollständiger Datenbankintegration (7 Tabellen)
   - [x] Responsive Design für Desktop und Mobile
   - [ ] Erweiterte Bewertungs- und Kommentarfunktion
   - [ ] Automatisierte E-Mail-Benachrichtigungen bei Status-Änderungen
   - [ ] Erweiterte Reporting und Analytics für Management

5. **Chat-Funktion** 💬 ✅ VOLLSTÄNDIG IMPLEMENTIERT
   - [x] WebSocket-basierte Echtzeit-Kommunikation implementiert
   - [x] Chat-UI mit modernem Glassmorphismus-Design
   - [x] Unterhaltungs-Management (Erstellen, Anzeigen, Wechseln, Löschen)
   - [x] Multi-User Gruppenchats
   - [x] Nachrichten senden und empfangen in Echtzeit
   - [x] Zeitgesteuerte Nachrichtenzustellung (Pause/Nach Feierabend)
   - [x] Typing-Indikator mit animierten Punkten
   - [x] Online-Status-Anzeige
   - [x] Datenbankschema mit 6 Tabellen implementiert
   - [x] Chat in Navigation integriert (Admin & Employee)
   - [x] Backend-Endpoints für Löschen/Archivieren
   - [x] Dateianhänge und Bildversand
   - [x] Nachrichtensuche mit Live-Filter
   - [x] Emoji-Picker mit 8 Kategorien
   - [x] Verbesserte Mobile Responsiveness
   - [ ] Push-Benachrichtigungen
   - [ ] Nachrichtenreaktionen
   - [ ] Verschlüsselte Nachrichten

### Priorität 2: Wichtige Funktionen

1. **Umfrage-Tool** 📊
   - [ ] Erstellung von Multiple-Choice-Umfragen durch Admins
   - [ ] Verpflichtende Umfragen für Mitarbeiter
   - [ ] Automatische Auswertung und Visualisierung der Ergebnisse
   - [ ] Anonyme Umfragen für sensible Themen
   - [ ] Export von Umfrageergebnissen

2. **Urlaubsantrag-System** 🏖️
   - [ ] Digitale Urlaubsanträge von Mitarbeitern an Admins
   - [ ] Übersicht über verfügbare Urlaubstage
   - [ ] Genehmigungsprozess mit Benachrichtigungen
   - [ ] Kalenderverfügbarkeit zur Vermeidung von Engpässen
   - [ ] Übersicht für Admins über alle eingereichten Anträge

3. **Lohnabrechnungs-Erweiterungen** 📑
   - [ ] Sichere Datei-Uploads mit Verschlüsselung
   - [ ] Automatische Kategorisierung
   - [ ] Versionskontrolle für Dokumente
   - [ ] Massenupload-Funktion
   - [ ] Automatische Benachrichtigungen bei neuen Dokumenten

4. **TPM-Kalender (Total Productive Maintenance)** 🔧
   - [ ] Terminplanung für Maschinenwartungen
   - [ ] Wiederkehrende Wartungsintervalle
   - [ ] Zuständigkeitsverwaltung für Maintenance-Teams
   - [ ] Dokumentation durchgeführter Wartungen
   - [ ] Warnungen bei überfälligen Wartungsterminen

### Priorität 3: Zusätzliche Features

1. **Qualitätssicherungs-Checklisten** ✓
   - [ ] Digitale Checklisten für Qualitätskontrollen
   - [ ] Fotodokumentation von Qualitätsmängeln
   - [ ] Automatische Benachrichtigung bei Abweichungen
   - [ ] Trendanalyse von Qualitätsproblemen
   - [ ] Integration mit KVP-System

2. **Mehrsprachige Unterstützung** 🌐
   - [ ] Grundlegende Mehrsprachigkeit (DE, EN)
   - [ ] Erweiterung um weitere Sprachen (PL, TR)
   - [ ] Sprachauswahl im Benutzerprofil
   - [ ] Automatische Spracherkennung
   - [ ] Übersetzungsmanagement-System

3. **Erweiterte Benachrichtigungen** 🔔
   - [ ] E-Mail-Templates anpassbar
   - [ ] SMS-Benachrichtigungen (optional)
   - [ ] In-App Push-Notifications
   - [ ] Benachrichtigungs-Center
   - [ ] Eskalationsregeln

4. **Erweiterte Benutzerverwaltung** 👥
   - [ ] Single Sign-On (SSO)
   - [ ] Active Directory Integration
   - [ ] Detaillierte Audit-Trails
   - [ ] Session-Management
   - [ ] IP-Whitelisting

5. **Mobile PWA** 📱
   - [ ] Service Worker für Offline-Funktionalität
   - [ ] Push-Notifications
   - [ ] Touch-optimierte UI-Elemente
   - [ ] App-Icon und Manifest
   - [ ] Automatische Updates

6. **Reporting & Analytics** 📈
   - [ ] Dashboard mit KPIs
   - [ ] Exportfunktionen (Excel, PDF)
   - [ ] Benutzerdefinierte Berichte
   - [ ] Automatische Reports per E-Mail
   - [ ] Trend-Analysen

7. **Skill-Matrix/Qualifikationsmanagement** 🏢
   - [ ] Übersicht über Qualifikationen und Zertifikate
   - [ ] Automatische Erinnerungen bei auslaufenden Zertifikaten
   - [ ] Planung von Weiterbildungen
   - [ ] Personalbedarfsplanung basierend auf Qualifikationsanforderungen
   - [ ] Integration mit Schichtplanung

8. **Stripe Integration** 💳
   - [ ] Payment Routes erstellen
   - [ ] Webhook Handler
   - [ ] Automatische Feature-Aktivierung nach Zahlung
   - [ ] Rechnungsstellung und Zahlungsverfolgung
   - [ ] Subscription Management

## Monetarisierung

### Preismodell (bereits implementiert)
- **Basic**: €0/Monat (Grundfunktionen)
- **Premium**: €49/Monat (Erweiterte Features)
- **Enterprise**: €149/Monat (Alle Features)
- **Custom**: Individuelle Preise für Großkunden

### Payment Integration (geplant)
1. **Stripe Integration**
   - [ ] Automatische Abrechnung
   - [ ] Kreditkartenzahlung
   - [ ] SEPA-Lastschrift
   - [ ] Rechnungsstellung

2. **Customer Portal**
   - [ ] Subscription Management
   - [ ] Zahlungsmethoden verwalten
   - [ ] Rechnungshistorie
   - [ ] Feature-Upgrades/Downgrades

3. **Billing Features**
   - [ ] Automatische Rechnungserstellung
   - [ ] Prorata-Abrechnung
   - [ ] Gutschein-System
   - [ ] Mengenrabatte
   - [ ] Jahresabonnements

## Feature-Aktivierung nach Zahlung

### Bereits implementiert:
- ✅ Feature-Toggle-System
- ✅ Usage-Tracking
- ✅ Admin-Interface für Feature-Management
- ✅ API für Feature-Checks

### Geplant:
1. **Automatische Aktivierung**
   - [ ] Webhook von Stripe
   - [ ] Sofortige Feature-Freischaltung
   - [ ] Benachrichtigung an Kunden
   - [ ] Automatische Deaktivierung bei Zahlungsausfall

2. **Trial-Management**
   - [ ] 14-Tage kostenlose Testphase
   - [ ] Automatische Umstellung nach Trial
   - [ ] Reminder vor Trial-Ende
   - [ ] Feature-Limits während Trial

3. **Usage-Based Pricing**
   - [ ] Zählung von API-Calls
   - [ ] Dokumenten-Upload-Limits
   - [ ] E-Mail-Kontingente
   - [ ] Automatische Upgrades bei Überschreitung

## Technische Roadmap

### Q1 2025 ✅ VOLLSTÄNDIG ABGESCHLOSSEN (100%)
- [x] **Blackboard-System vollständig implementiert** ✅
  - [x] Farb- und Tag-System für Kategorisierung
  - [x] Erweiterte Filter-Funktionen
  - [x] Glassmorphismus-Design mit modernen UI-Elementen
- [x] **Firmenkalender vollständig implementiert** ✅
  - [x] Benutzerdefinierte Farbauswahl für Events
  - [x] FullCalendar Integration mit interaktiven Features
  - [x] Event-Management mit CRUD-Funktionalität
- [x] **Schichtplanungs-Tool vollständig implementiert** ✅
- [x] **KVP-System vollständig implementiert** ✅
- [x] **Chat-Funktion vollständig implementiert** ✅
  - [x] WebSocket-Server läuft
  - [x] UI mit Glassmorphismus-Design
  - [x] Emoji-Picker mit 8 Kategorien
  - [x] Nachrichtensuche und Filter
  - [x] Löschen/Archivieren von Nachrichten
  - [x] Unterhaltungen löschen

### Q2 2025
- [ ] Umfrage-Tool entwickeln
- [ ] Urlaubsantrags-Management
- [ ] Lohnabrechnungs-Erweiterungen
- [ ] TPM-Kalender und Wartungsplanung

### Q3 2025
- [ ] Qualitätssicherungs-Checklisten
- [ ] Mehrsprachigkeit implementieren (DE, EN, PL)
- [ ] Erweiterte Benachrichtigungen
- [ ] Erweiterte Benutzerverwaltung

### Q4 2025
- [ ] Mobile PWA für Produktionsarbeiter
- [ ] Reporting & Analytics
- [ ] Skill-Matrix/Qualifikationsmanagement
- [ ] Stripe Integration

## Organisationsstruktur in Assixx

### Definitionen
- **Team**: Eine Gruppe von Mitarbeitern, die an denselben Maschinen arbeiten und einem Teamleiter zugeordnet sind
- **Abteilung**: Alle Mitarbeiter, die einem Abteilungsleiter oder Bereichsleiter zugeordnet sind
- **Firma**: Die Gesamtheit aller Abteilungen und Teams

## KPIs und Erfolgsmessung

### Business KPIs
- Anzahl aktiver Kunden
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (CLV)
- Churn Rate

### Technische KPIs
- Uptime (Ziel: 99.9%)
- Response Time (< 200ms)
- Error Rate (< 0.1%)
- Feature Adoption Rate
- Customer Satisfaction Score

## Nächste Schritte

1. **Sofort**: KVP-System entwickeln (Schichtplanungs-Tool ✅ abgeschlossen)
2. **Diese Woche**: Chat-Funktion implementieren
3. **Nächste Woche**: Umfrage-Tool entwickeln
4. **Dieser Monat**: Umfrage-Tool und Urlaubsantrag-System
5. **Dieses Quartal**: Lohnabrechnungs-Erweiterungen und TPM-Kalender

## Kontakt

Für Fragen zur Roadmap:
- Product Owner: Simon Öztürk
- Tech Lead: [Name]
- Support: support@assixx.com