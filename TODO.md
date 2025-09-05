# Assixx TODO-Liste

## 🚀 AKTUELLER STATUS (20.08.2025)

**📁 Archiv:** Alte TODOs wurden verschoben → `/archive/TODO_bak_August.md` (nur zur Dokumentation)

### 🎯 Aktuelle Phase: API-V2-MIGRATION

#### 📚 Wichtige Dokumente (in dieser Reihenfolge lesen)

1. **Hauptdokument:** `/home/scs/projects/Assixx/TODO.md` (diese Datei)
2. **Frontend-Details:** `/home/scs/projects/Assixx/docs/api/API-V2-MIGRATION/API-V2-FRONTEND-MIGRATION-DETAILS.md`
3. **Checkliste:** `/home/scs/projects/Assixx/docs/api/API-V2-MIGRATION/API-V2-MASTERPLAN-CHECKLIST.md`
4. **Executive Summary:** `/home/scs/projects/Assixx/docs/api/API-V2-MIGRATION/API-V2-MIGRATION-EXECUTIVE-SUMMARY.md`
5. **Masterplan:** `/home/scs/projects/Assixx/docs/api/API-V2-MIGRATION/API-V2-MIGRATION-MASTERPLAN.md`

### ⚡ Workflow

1. **ZUERST:** Die Checkliste abarbeiten → `API-V2-MASTERPLAN-CHECKLIST.md` (Stand: 20.08.2025)
2. **DANACH:** Mit DEAL-BREAKER Features fortfahren (siehe unten)

---
dompurify überall implementieren (domutils ersetzen? wenn geht oder wenn nötig)

## 🔥 DEAL-BREAKER Features

### Urlaubsverwaltung System (20h)

- [ ] Urlaubsantrag erstellen + Formular
- [ ] Genehmigungsworkflow (Manager → Admin)
- [ ] Urlaubskalender-Ansicht (wer ist wann weg?)
- [ ] Resturlaub-Berechnung + Jahresübersicht
- [ ] Vertretungsregelung
- [ ] Mail-Benachrichtigungen bei Status-Änderungen
- [ ] API: /api/leave-requests (CRUD + Approval)

### Digitale Personalakte / Gehaltsabrechnung (15h)

- [ ] Sichere Upload-Funktion für PDFs
- [ ] Verschlüsselte Speicherung
- [ ] Mitarbeiter-Portal (nur eigene Dokumente)
- [ ] Kategorisierung (Vertrag, Zeugnis, Lohnabrechnung)
- [ ] Download mit Audit-Log
- [ ] Automatische Löschfristen (DSGVO)
- [ ] API: /api/employee-documents

### TPM System (Total Productive Maintenance) (30h)

- [ ] Wartungsplan pro Maschine definieren
- [ ] Automatische Erinnerungen
- [ ] Wartungsprotokolle digital erfassen
- [ ] Störmeldungen + QR-Code Scanning
- [ ] Ersatzteil-Management
- [ ] Ausfallzeiten-Statistik
- [ ] Predictive Maintenance Dashboard
- [ ] API: /api/maintenance

### Mobile Responsive Design (15h)

- [ ] Touch-optimierte Navigation
- [ ] Responsive Tables → Cards auf Mobile
- [ ] Progressive Web App (PWA) Setup
- [ ] Offline-Funktionalität für kritische Features
- [ ] Mobile-First CSS Refactoring
- [ ] Touch Gesten (Swipe für Navigation)

## PHASE 5 - Compliance & Polish

### DSGVO/Datenschutz (10h)

- [ ] Cookie-Consent Banner
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

### Version 0.1.0 - Stabile Entwicklungsversion ✅

1. [x] Funktionstests aller Features
2. [x] Docker Setup für einfaches Deployment
3. [x] Kritischster Bug behoben - Multi-Tenant Isolation
4. [x] API v2 Migration abgeschlossen

### Version 1.0.0 - Beta-Test Version

1. [ ] PHASE 4 - DEAL-BREAKER Features
   - Urlaubsantrag-System (MVP)
   - Gehaltsabrechnung Upload
   - TPM-System (Total Productive Maintenance)
   - Mobile Responsiveness
2. [ ] DSGVO Compliance + Beta-Test Tools
3. [ ] Performance Tests + Final Testing
4. [ ] Beta-Test Start

Neue Timeline:

- Version 0.1.0: ✅ FERTIG mit API v2!
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
