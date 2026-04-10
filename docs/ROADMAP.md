# Assixx Roadmap

> **Letzte Aktualisierung:** 2026-04-02
> **Version:** 0.4.9
> **Tech Stack:** NestJS 11 + Fastify, SvelteKit 5, PostgreSQL 18 + RLS, Vitest
> **Domains:** assixx.com, assixx.de

---

## Completed

### Core Platform

- [x] Multi-Tenant Architektur mit Row Level Security (109 Tabellen, 114 Policies)
- [x] JWT Auth mit Token-Rotation, Reuse Detection, Family UUID
- [x] Rate Limiting (Redis-backed, ADR-001)
- [x] Global ResponseInterceptor + AllExceptionsFilter (ADR-007)
- [x] ClsService Tenant Context Isolation (ADR-006)
- [x] Hierarchisches RBAC (Root/Admin/Employee + Area/Department/Team Leads)
- [x] Per-User Feature Permissions (ADR-020)
- [x] Audit Trail mit monatlicher Partitionierung (ADR-009)

### Backend (NestJS 11 + Fastify)

- [x] Komplette API v2 Migration (24+ Controller, v1 geloescht)
- [x] Zod Validation (176 DTOs, kein class-validator)
- [x] @assixx/shared Workspace Package (ADR-015)
- [x] node-pg-migrate Migrations (ADR-014)
- [x] Real-Time Notifications via SSE (ADR-003)
- [x] WebSocket Chat

### Frontend (SvelteKit 5)

- [x] SvelteKit 5 mit Runes, adapter-node SSR
- [x] Design System (16 Phasen, 29 Komponenten, 200+ Varianten)
- [x] Tailwind v4 + Glassmorphism + Dark/Light Mode (ADR-017)
- [x] Fail-Closed RBAC via Route Groups (ADR-012)

### Features (Production-Ready)

- [x] Benutzerverwaltung (Rollen, Profile, Verfuegbarkeit)
- [x] Dokumentenverwaltung (Upload, Kategorien, Zugriffsrechte, Benachrichtigungen)
- [x] Gehaltsabrechnung (via Document Explorer: PDF Upload, Kategorisierung, Mitarbeiter-Zugriff)
- [x] Schwarzes Brett (Eintraege, Kommentare, Anhaenge, Lesebestaetigungen, Archiv)
- [x] Kalender (Events, Teilnehmer, Drag & Drop, ICS/CSV Export)
- [x] KVP-System (Vorschlaege, Workflow, Kommentare, Kategorien, Anhaenge)
- [x] Schichtplanung (Wochenansicht, Rotation, Drag & Drop)
- [x] Chat-System (Echtzeit WebSocket, Gruppen, Dateien, Read Receipts)
- [x] Umfrage-Tool (Templates, Statistiken, Antworten, Export)
- [x] Anlagen-Verwaltung (CRUD, Kategorien, Basic Wartung)
- [x] Abteilungen, Teams, Bereiche (CRUD, Hierarchie, Stats)
- [x] TPM -- Total Productive Maintenance (Wartungsplaene, Checklisten, Eskalation, Schedule Projection)
- [x] Urlaubsverwaltung (Antraege, Genehmigungsworkflow, Kontingente, Abwesenheitskalender)
- [x] Arbeitsauftraege (Status-Workflow, Foto-Dokumentation, SSE-Benachrichtigungen)
- [x] Freigaben-System (Mehrstufig, KVP-Integration, ADR-037)
- [x] Organigramm (Hierarchie-Darstellung, Positionskatalog)
- [x] Addon-System (22 Addons, A-la-carte Modell, ADR-033)
- [x] Delegierte Berechtigungen (Lead-Management, ADR-020)
- [x] Stellvertretung (Deputy Leads, ADR-039)

### Infrastruktur

- [x] Docker Setup (Backend, Frontend, Nginx, PostgreSQL, Redis)
- [x] CI/CD Pipeline mit GitHub Actions (ADR-013)
- [x] Monitoring: Sentry + Pino Logging (ADR-002)
- [x] Backup System (pg_dump, automatisiert)
- [x] Security Headers (Helmet, CORS, CSP)
- [x] 6955 Tests (5568 Unit + 430 Permission + 399 Frontend + 558 API), 91% Line Coverage (ADR-018)

---

## Phase 1 -- Core Feature Completion

> Pflicht-Features die zum Kern der Software gehoeren.
> Ohne diese ist Assixx kein vollstaendiges Produkt.

### ~~Urlaubsantrag-System~~ ✅ KOMPLETT (2026-03)

- [x] Antragsformular mit Kalender-Integration
- [x] Mehrstufiger Genehmigungsworkflow (Employee -> Lead -> Admin)
- [x] Resturlaubsberechnung und Kontingent-Verwaltung
- [x] Abwesenheitskalender (Team-Übersicht)
- [x] Blackout-Perioden, Halbtags-Splits, Feiertage
- [x] Kapazitaetsanalyse und Staffing-Rules

### ~~TPM-System -- Total Productive Maintenance~~ ✅ KOMPLETT (2026-03)

- [x] Wartungsplanung fuer Anlagen (Intervalle, Checklisten)
- [x] Digitale Checklisten mit Foto-Dokumentation
- [x] Automatische Erinnerungen (Faelligkeiten) + Eskalation
- [x] Wartungshistorie und Reports
- [x] Schedule Projection + Slot Assistant
- [x] Plan Revisions + Plan Approval Workflow
- [x] Schicht-Zuordnung fuer TPM-Karten
- [x] 364 Tests (278 Unit + 86 API)

### Schichttausch-Antrag (nicht implementiert)

Nicht-funktionaler Backend-Rumpf existiert (Endpoints, DTOs, DB-Tabelle),
aber kein funktionierendes Feature. Muss von Grund auf gebaut werden.

- [ ] Backend: Schema bereinigen, Service mit echtem Swap-Vollzug
- [ ] Zweistufiger Workflow: User B akzeptiert/lehnt ab, dann Admin genehmigt
- [ ] Tatsaechliche Swap-Transaktion (Shift Assignments tauschen)
- [ ] RLS-Policies fuer shift_swap_requests
- [ ] Frontend: Antrag erstellen, annehmen/ablehnen, Admin-Dashboard
- [ ] Benachrichtigungen (SSE) bei neuem Tausch-Antrag
- [ ] Unit + API Integration Tests

### Stripe Payment Integration (nicht begonnen)

Pflicht fuer Cloud/SaaS-Betrieb. On-Premise kann ohne Stripe laufen.
Kommt spaeter wenn Staging/Production vorbereitet wird.

- [ ] Stripe SDK Integration + Webhook-Handler
- [ ] Subscription-Pläne (Basic/Premium/Enterprise)
- [ ] Tenant-Signup mit Bezahlung (Registrierung -> Plan wählen -> Zahlung -> Tenant erstellt)
- [ ] Feature-Aktivierung per Plan (verknuepft mit ADR-020 Per-User Permissions)
- [ ] Automatische Rechnungserstellung
- [ ] Payment History Dashboard
- [ ] Kuendigungs- und Downgrade-Logik

---

## Phase 2 -- Vollstaendiger Funktionstest

> Alle Features muessen End-to-End funktionieren bevor Deployment beginnt.
> Besonders der Signup-Flow mit Bezahlung wurde bisher nicht getestet.

### E2E Feature-Testing

- [ ] Alle 19+ bestehenden Addons durchklicken und verifizieren
- [ ] Cross-Feature-Tests (z.B. Urlaub im Kalender sichtbar, TPM in Anlagen)
- [ ] Schichttausch vollstaendig testen (wenn implementiert)

### Signup + Payment + Feature-Aktivierung (kritischer Pfad)

- [ ] Neuen Tenant registrieren (Signup-Formular)
- [ ] Plan wählen und mit Stripe bezahlen
- [ ] Feature-Aktivierung per Plan verifizieren (Basic vs Premium vs Enterprise)
- [ ] Upgrade/Downgrade-Flow testen
- [ ] Kuendigungs-Flow testen
- [ ] Fehlerfaelle: Zahlung fehlgeschlagen, Karte abgelaufen, Doppel-Registrierung

### Regressions- und Lasttests

- [ ] Unit + API Test Suite gruen (alle ~6955 Tests)
- [ ] Multi-Tenant Isolation verifizieren (Tenant A sieht keine Daten von Tenant B)
- [ ] Performance-Test mit realistischen Datenmengen

---

## Phase 3 -- Deployment-Vorbereitung

> Alles was noetig ist bevor die Software auf einen echten Server kommt.

### HTTPS/TLS + Produktions-Infrastruktur

- [ ] Server mieten (Hetzner, Netcup o.ae.)
- [ ] DNS: assixx.de + assixx.com -> Server-IP
- [ ] SSL-Zertifikate (Let's Encrypt + Certbot)
- [ ] Nginx TLS-Konfiguration (Port 443, HSTS, moderne Cipher Suites)
- [ ] Erzwungene HTTP -> HTTPS Redirects
- [ ] Docker-Compose Produktions-Config fuer echten Server anpassen
- [ ] Backup-Strategie fuer Produktion (automatisiert, verschluesselt, off-site)
- [ ] Monitoring + Alerting fuer Produktion (Sentry, Uptime-Checks)

### Security Audit + Pentest

- [ ] OWASP Top 10 Checkliste durchgehen
- [ ] Dependency Audit (pnpm audit, known vulnerabilities)
- [ ] RLS-Policies verifizieren (kein Tenant-Datenleck)
- [ ] Auth-Flow Pentest (Token-Manipulation, Brute Force, Session Fixation)
- [ ] Input Validation Audit (SQL Injection, XSS, CSRF)
- [ ] Rate Limiting verifizieren unter Last
- [ ] Penetrationstest (extern oder mit Tools wie OWASP ZAP, Burp Suite)
- [ ] Gefundene Schwachstellen fixen

---

## Phase 4 -- Alpha (intern)

> Erste Deployment auf echtem Server. Nur internes Team testet.

- [ ] Deployment auf Server mit assixx.de
- [ ] Internes Team testet alle Features im Produktions-Modus
- [ ] Bug-Tracking und Fixing
- [ ] Performance-Monitoring unter realen Bedingungen
- [ ] Backup + Recovery testen (Backup einspielen, pruefen ob alles da ist)

---

## Phase 5 -- Beta (begrenzt extern)

> Ausgewaehlte Firmen testen die Software. Erste echte Nutzer ausserhalb des Teams.

- [ ] 2-5 ausgewaehlte Firmen einladen
- [ ] Onboarding-Prozess testen (Tenant-Erstellung, Admin-Setup, Mitarbeiter-Import)
- [ ] Feedback sammeln und priorisieren
- [ ] Kritische Bugs fixen
- [ ] UX-Verbesserungen basierend auf echtem Feedback
- [ ] Dokumentation fuer Endnutzer (Admin-Handbuch, Mitarbeiter-Guide)

---

## Phase 6 -- RC / Staging (zahlende Kunden)

> Release Candidate. Produktionsreif, erste zahlende Kunden moeglich.

- [ ] Stabilitaet verifiziert (keine kritischen Bugs seit X Wochen)
- [ ] SLA definieren (Uptime, Support-Zeiten, Response-Zeiten)
- [ ] AGB / Datenschutzerklaerung / Impressum
- [ ] Erste zahlende Kunden onboarden
- [ ] Support-Prozess etablieren
- [ ] Go-Live Entscheidung

---

## Post-Launch -- Erweiterungen

### Mehrsprachigkeit (i18n)

- [ ] i18n Framework Integration
- [ ] Deutsch (Default, bereits vorhanden)
- [ ] Englisch
- [ ] Tuerkisch, Polnisch (nach Bedarf)

### Mobile PWA

- [ ] Service Worker
- [ ] Offline-Funktionalitaet
- [ ] Push-Benachrichtigungen
- [ ] App-Installation (iOS/Android)

---

## Langfristig -- Enterprise / Skalierung

### Enterprise Features

- [ ] Single Sign-On (SSO / OAuth)
- [ ] Active Directory Integration
- [ ] White-Label Option (Tenant-eigenes Branding, Logo, Domain)
- [ ] QS-Checklisten (Qualitaetspruefung)

### Database Skalierung

- [ ] Encryption at Rest (pgcrypto oder Hoster-Disk-Encryption)
- [ ] SSL/TLS fuer DB-Verbindungen
- [ ] Regional Sharding (bei 100+ Kunden)
- [ ] Tenant-spezifische Encryption Keys (bei 1000+ Kunden)

### Compliance

- [ ] DSGVO-Compliance Tools (Datenloesch-Anfragen, Export, Einwilligungen)
- [ ] ISO 27001 Vorbereitung
- [ ] Audit-Trail Export fuer Zertifizierungen

---

## Optional (kein fester Zeitplan)

### KI-Integration

- Automatische Dokumentenkategorisierung
- Intelligente Suchfunktion
- Predictive Maintenance
- Chatbot fuer Mitarbeiter-Support

### Erweiterte Automatisierung

- Workflow-Engine
- IoT-Anbindung fuer Anlagenanbindung
- Echtzeit-Dashboards

---

## Verwandte Dokumente

- [FEATURES.md](./FEATURES.md) -- Feature-Details und Preismodelle
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) -- PostgreSQL + RLS
- [ADR Index](./infrastructure/adr/README.md) -- 39 Architecture Decision Records
- [HOW-TO-TEST-WITH-VITEST.md](./how-to/HOW-TO-TEST-WITH-VITEST.md) -- Testing Guide
