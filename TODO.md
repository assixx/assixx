# Assixx TODO-Liste

## 🔴 WICHTIG - HIER WEITERMACHEN (19.07.2025)

**Branch:** unit-tests--Github-Actions  
**Problem:** Jest Tests hängen in GitHub Actions (laufen ewig, brechen nicht ab)  
**Gelöst:** 
- ✅ Alle import.meta.url Fehler behoben
- ✅ Jest läuft, aber Tests hängen wegen offener DB-Verbindungen
- ✅ forceExit und detectOpenHandles zu jest.config.cjs hinzugefügt

**Nächste Schritte:**
1. GitHub Actions Workflow Ergebnisse prüfen (sollte mit forceExit jetzt funktionieren)
2. Fehlgeschlagene Tests debuggen (vermutlich Auth/Mock Probleme)
3. DB Verbindungen in Tests richtig schließen (cleanupTestData)

**Status:** 6 Tests erfolgreich, 11 fehlgeschlagen, 7 hingen fest

---

## AKTUELLE PHASE

Was: Kompletter Testdurchlauf v0.1.0 - Stabilität sichern
Ziel: Neuer Tenant erstellen und ALLE Features bis Tenant-Löschung testen
Status: Erster Testdurchlauf abgeschlossen - Jetzt systematisches Debugging
Branch: debugging/v0.1.0--R2Stable (Haupt-Branch) / unit-tests--Github-Actions (aktuell)
Fokus: Stabilität, Debugging, Unit Tests einführen
Nächster Schritt: Unit Tests zum Laufen bringen, dann neuen Tenant erstellen und kompletten Durchlauf starten

## AKTUELLER FOKUS

### Neuer Testdurchlauf für Version 0.1.0 Stabilität

- Ziel: Wiederholte Testdurchläufe bis alles stabil läuft
- Methode: Neuen Tenant erstellen -> Alle Features testen -> Tenant löschen -> Wiederholen
- Parallel: Unit Tests einführen für automatisiertes Testing
- Fortschritt: Nach jedem Test dokumentieren
- Code-Qualität während Tests beachten:
  - [ ] Keine TypeScript any types verwenden
  - [ ] Regelmäßig pnpm run typecheck ausführen
  - [ ] ESLint errors sofort beheben
  - [ ] HINWEIS: 56 TypeScript Errors in Test-Dateien sind bekannt und können ignoriert werden (betreffen nur Tests, nicht Produktionscode)

### Testing-Checkliste für jede Seite/Funktion:

#### UI/UX Testing

- [ ] Design konsistent mit Glassmorphismus Standards
- [ ] Alle Buttons/Links funktionieren
- [ ] Hover-Effekte vorhanden
- [ ] Responsive auf verschiedenen Bildschirmgrößen
- [ ] Ladezeiten akzeptabel

#### Funktionalität

- [ ] Alle Features funktionieren wie erwartet
- [ ] Fehlerbehandlung vorhanden
- [ ] Validierungen funktionieren
- [ ] Daten werden korrekt gespeichert/geladen

#### Benutzerfreundlichkeit

- [ ] Intuitive Navigation
- [ ] Klare Beschriftungen
- [ ] Hilfetexte wo nötig
- [ ] Feedback bei Aktionen
- [ ] Ladeanimationen vorhanden

#### Sicherheit & Multi-Tenant

- [ ] Nur eigene Daten sichtbar
- [ ] Berechtigungen korrekt
- [ ] Session-Management stabil

## SICHERHEITS-UPDATES & BUGS

### ✅ Role-Switch Sicherheitsanalyse - ABGESCHLOSSEN (10.07.2025)

- [x] Visueller Indikator: Bereits vorhanden (Active Role Badge)
- [x] Multi-Tab Sync: Funktioniert bereits korrekt
- [x] Daten-Isolation: Als Employee nur eigene Daten (funktioniert)
- [x] Login-Reset: Root geht nach Login immer zu root-dashboard (funktioniert)
- [x] **Status:** System ist sicher und produktionsreif
- [ ] Optional: Erweiterte Logs mit was_role_switched Flag
- [ ] Optional: Zusätzlicher gelber Warning-Banner

### ✅ Role-Switch Foreign Key Constraint Bug - BEHOBEN (10.07.2025)

- [x] Problem: role-switch.ts versuchte department_id = 1 zu setzen bei neuen Tenants ohne Departments
- [x] Symptom: 500 Error beim Wechsel zu Mitarbeiter-Ansicht
- [x] Error: "Cannot add or update a child row: a foreign key constraint fails"
- [x] Ursache: Neue Tenants haben noch keine Departments angelegt
- [x] Lösung: department_id wird nicht mehr automatisch gesetzt, kann NULL bleiben
- [x] **BEHOBEN:** Role-Switch funktioniert jetzt auch bei Tenants ohne Departments

### ✅ AdminLog Model admin_id vs user_id Bug - BEHOBEN (10.07.2025)

- [x] Problem: AdminLog Model verwendete `admin_id` aber die Datenbank hat `user_id` Spalte
- [x] Symptom: 500 Error beim Rollenwechsel (root-to-admin, etc.)
- [x] Error: "Unknown column 'admin_id' in 'field list'"
- [x] Lösung: AdminLog Model angepasst um `user_id` statt `admin_id` zu verwenden
- [x] **BEHOBEN:** Alle SQL Queries im AdminLog Model verwenden jetzt korrekt `user_id`

### ✅ User.update() Method ohne tenant_id Check - BEHOBEN (10.07.2025)

- [x] Problem: Die User.update() Methode in /backend/src/models/user.ts verwendet nur WHERE id = ? ohne tenant_id Überprüfung
- [x] Risiko: Theoretisch könnte jemand User aus anderen Tenants updaten
- [x] Lösung: WHERE-Klausel sollte WHERE id = ? AND tenant_id = ? verwenden
- [x] Priorität: HOCH - sollte vor Beta-Test behoben werden
- [x] **BEHOBEN:** tenantId Parameter ist jetzt verpflichtend in folgenden Methoden:
  - `User.update()` - Hauptmethode
  - `User.updateProfilePicture()` - Profilbild Update
  - `User.archiveUser()` - User archivieren
  - `User.unarchiveUser()` - User wiederherstellen
  - `User.findArchivedUsers()` - Archivierte User anzeigen (jetzt mit tenant_id Filter)
- [x] TypeScript Build erfolgreich - alle Aufrufe verwenden bereits tenantId korrekt

## PHASE 4: DEAL-BREAKER Features (NACH Version 0.1.0)

KRITISCH: Ohne diese Features ist das System für Industriefirmen NICHT nutzbar!
HINWEIS: Implementierung erst NACH Version 0.1.0 (stabile Basis mit allen funktionierenden Features)
Start: Voraussichtlich in 2-3 Wochen

### 1. Urlaubsantrag-System (MVP) - WOCHE 1

- [ ] Backend API (/api/vacation)
- [ ] Datenbank-Schema (vacation_requests, vacation_balances)
- [ ] Antragsformular (einfache Version)
- [ ] Admin-Genehmigung Workflow
- [ ] Kalender-Integration
- [ ] E-Mail Benachrichtigung
- [ ] Resturlaub-Berechnung

### 2. Gehaltsabrechnung Upload - WOCHE 1-2

- [ ] Backend API für Lohndokumente (/api/payroll)
- [ ] Sicherer Upload für Lohnabrechnungen
- [ ] Verschlüsselung für sensible Daten
- [ ] Archivierung nach gesetzlichen Vorgaben (10 Jahre)
- [ ] Batch-Upload für HR
- [ ] Integration mit DATEV/SAP (Beta-Kunden fragen)

### 3. TPM-System (Total Productive Maintenance) - WOCHE 2-3

- [ ] Backend API für Wartungsplanung (/api/tpm)
- [ ] Datenbank-Schema für Maschinen & Wartungen
- [ ] Wartungsplan-Templates (Industrie-Standards)
- [ ] QR-Code für Maschinen-Identifikation
- [ ] Mobile-First Wartungs-Checklisten
- [ ] Automatische Erinnerungen (E-Mail + In-App)
- [ ] Wartungshistorie & Reports
- [ ] Offline-Viewing mit PWA

### 4. Mobile Responsiveness - PARALLEL

- [ ] Alle Hauptseiten auf Tablet/Mobile testen
- [ ] Navigation für Touch optimieren
- [ ] Schichtplan Mobile-View
- [ ] Chat Mobile-Optimierung
- [ ] TPM Mobile-First Design
- [ ] PWA Manifest & Service Worker

## PHASE 5: Beta-Test Features

### Data Privacy & Compliance

- [ ] DSGVO-konforme Datenlöschung
- [ ] Audit-Log für sensible Operationen
- [ ] Cookie-Banner implementieren
- [ ] Datenschutzerklärung-Seite
- [ ] Recht auf Datenauskunft (Export)
- [ ] Anonymisierung von Altdaten

### Beta-Test Specifics

- [ ] Demo-Daten Generator
- [ ] Beta-Tester Onboarding Videos
- [ ] Rollback-Strategie bei Probleme
- [ ] SLA Definition
- [ ] Beta-Feedback Auswertungs-Dashboard

## AKTUELLE Entwicklungs-Reihenfolge

### Version 0.1.0 - Stabile Entwicklungsversion

1. [x] Funktionstests aller Features
2. [x] Docker Setup für einfaches Deployment
3. [x] Kritischster Bug behoben - Multi-Tenant Isolation
4. [ ] Systematisches Testing & Debugging (AKTUELL)
5. [ ] Code-Cleanup & Dokumentation

### Version 1.0.0 - Beta-Test Version

6. [ ] PHASE 4 - DEAL-BREAKER Features (erst nach 0.1.0)
   - Urlaubsantrag-System (MVP)
   - Gehaltsabrechnung Upload
   - TPM-System (Total Productive Maintenance)
   - Mobile Responsiveness
7. [ ] DSGVO Compliance + Beta-Test Tools
8. [ ] Performance Tests + Final Testing
9. [ ] Beta-Test Start

Neue Timeline:

- Version 0.1.0: 2-3 Wochen (Stabilisierung)
- Version 1.0.0: 4-5 Wochen (Features + Beta-Vorbereitung)
- Beta-Start: Nach Version 1.0.0
- Beta-Dauer: 4-6 Wochen

Fokus: Qualität vor Quantität - Lieber weniger Features die perfekt funktionieren!

## Offene Fragen für Beta-Planung

1. Beta-Timeline: Konkretes Startdatum?
2. Maschinen-Typen: Welche Hersteller/Modelle für TPM?
3. Lohnsysteme: DATEV, SAP oder andere?
4. Hosting: On-Premise oder Cloud-Präferenz?
5. Mobile Usage: Smartphones oder Tablets dominant?
6. Sprachen: Nur Deutsch oder auch EN/TR/PL?
