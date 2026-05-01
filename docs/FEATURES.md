# Assixx Features & Overview

> **Last Updated:** 2026-03-11
> **Version:** 2.0.0
> **Status:** Production Ready (20 Addons: 8 Core + 12 Kaufbar)

## Table of Contents

1. [Current Features](#current-features)
2. [Addon Status Matrix](#addon-status-matrix-adr-033)
3. [Preismodell](#preismodell)
4. [Feature Details](#feature-details)
5. [Planned Features](#planned-features)

## Current Features

### Live Features (Production Ready)

#### 1. **User Management**

- Multi-Tenant Architecture with Subdomain Isolation
- Three User Roles: Root, Admin, Employee
- JWT-based Authentication
- **Mandatory Email-Based 2FA** on every password login + signup (ADR-054, hardcoded — no opt-out, no per-tenant flag, no "trust this device"). OAuth (Microsoft / Google) is exempt because the provider already enforces MFA upstream (DD-7).
- Profile Picture Upload
- Password Reset Functionality

#### 2. **Document Management**

- Upload/Download for PDF Documents
- Categorization (Payroll, Contracts, etc.)
- Access Control Management
- Version Control
- Search Functionality

#### 3. **Bulletin Board (Blackboard)**

- Company-wide Announcements
- Categories and Tags
- Color Coding for Priorities
- Read Confirmations
- Attachments (Images, PDFs)
- Organization Level Filters

#### 4. **Calendar**

- Event Management
- All-Day and Time-Based Events
- Drag & Drop Functionality
- Organization Levels (Company/Department/Team)
- iCal Export/Import
- Color Coding by Event Type

#### 5. **CIP System (Continuous Improvement Process)**

- Submit Improvement Proposals
- Status Tracking (Submitted -> Under Review -> Implemented)
- Points/Rewards System
- Categorization
- File Attachments
- Comment Functionality

#### 6. **Shift Planning**

- Weekly View with Drag & Drop
- Three Shift Types (Early/Late/Night)
- Employee Availability
- Department and Machine Filters
- Shift Information and Notes
- Shift Swap Requests (Employee-to-Employee, 2-Step Approval)
- Excel Export

#### 7. **Chat System**

- Real-Time Messaging (WebSocket)
- Individual and Group Chats
- File Attachments
- Typing Indicators
- Unread Messages Badge
- Tenant-Isolated Communication

#### 8. **Automatic Backup System**

- Daily Automatic Backups
- 30-Day Retention
- Easy Restoration
- Manual Quick Backups
- Backup Rotation (Daily/Weekly/Monthly)

#### 9. **Vacation Management** (NEW)

- Vacation Request Workflow (create, edit, respond, withdraw, cancel)
- Pre-Approval Capacity Analysis (team headcount, asset staffing, blackout conflicts, entitlement check)
- Multi-Level Approver Chain (team lead → deputy → area lead → admin)
- Half-Day Support (morning/afternoon at start/end of range)
- 7 Vacation Types (regular, doctor, bereavement, birth, wedding, move, unpaid)
- Entitlement Management (per-employee, per-year, carry-over, additional days)
- Blackout Periods (global, department, team, area scoped)
- Machine Staffing Rules (minimum headcount per asset)
- Holiday Management (recurring + one-time, per-tenant)
- Team Calendar Overview (approved vacations per member per day)
- Tenant-Wide Settings (default days, carry-over limits, notice period)
- Real-Time Notifications via SSE
- Status Audit Trail (append-only log with notes)
- 5 Admin Pages: Anträge, Regeln, Urlaubsansprüche, Feiertage, Übersicht

#### 10a. **Microsoft OAuth Sign-In für Tenant-Owner** (ADR-046 — System Feature)

- SSO via Azure AD für die `root`-Rolle (Tenant-Owner); Signup + Login per Klick
- Nur Work/School-Accounts (`/organizations/` Endpoint) — persönliche `@outlook.com`-Accounts werden von Microsoft abgelehnt (B2B-Filter)
- 3-Schichten-Defense: PKCE (RFC 7636) + Single-Use State-Nonce (Redis GETDEL, 10 min TTL) + id_token-Signatur-Verifikation (JWKS-Cache 24h)
- Atomare Tenant-Erstellung: tenant + user + oauth-link in **einer** Transaktion (R8 — keine halb-erstellten Tenants)
- Signup-Ticket-Pattern: Callback → Redis `signup-ticket` (15 min TTL) → Company-Details-Formular → atomic GETDEL beim Submit
- UNIQUE(provider, provider_user_id) — ein Microsoft-Konto → ein Assixx-Tenant (R3 duplicate-signup defence)
- `admin`- und `employee`-Rollen bleiben auf Passwort-Auth (OAuth explizit out-of-scope für V1)
- Frontend: Brand-Guideline-konformer "Mit Microsoft anmelden/registrieren"-Button, `/signup/oauth-complete` Pre-Fill-Formular
- **Profilbild-Auto-Sync** (2026-04-17): Microsoft 365 Profilbild wird beim Signup und bei jedem Login via Microsoft Graph `/me/photo` übernommen. ETag-gecached (`user_oauth_accounts.photo_etag`) → 95 % der Re-Logins überspringen den Binary-Download. Manuell hochgeladene Bilder werden **nie** überschrieben (Filename-Prefix-Konvention `oauth_`). Best-effort — Graph-Fehler brechen Login/Signup nie. Scope: `User.Read` delegated, kein Admin-Consent nötig.
- Architektur: ADR-046 (+ Amendment 2026-04-17), HOW-TO: `docs/how-to/HOW-TO-AZURE-AD-SETUP.md`

#### 10. **Addon-System** (ADR-033 — System Feature)

- Addon-basiertes SaaS-Modell (ersetzt Plan-Tiers, siehe ADR-033)
- 8 Core-Addons (immer aktiv) + 12 kaufbare Addons (je €10/Monat, 30 Tage Trial)
- Backend: `TenantAddonGuard` (APP_GUARD) on all Addon-Controllers
- Frontend: Sidebar-Filterung (SSR, kein Flash), Page-Level Guards, api-client 403-Handling
- Admin-Seite `/addons` für Addon-Verwaltung (Aktivieren/Deaktivieren/Trial)
- Separate `/addon-unavailable` Fehlerseite (vs. `/permission-denied` für Rollen)
- Rekursive Submenu-Filterung (leere Container werden entfernt)
- Deaktivierung erhält User-Permissions (sofortige Reaktivierung möglich)
- Architektur: ADR-033 (supersedes ADR-024, ADR-032)

#### 11. **TPM — Total Productive Maintenance** (NEW)

- Kamishibai Board (visual card management per asset per interval)
- Plan Management (create/edit/delete maintenance plans with intervals)
- 7 Interval Types (daily, weekly, monthly, quarterly, semi-annual, annual, custom)
- 4-State Card Status Machine (green → red → yellow → overdue)
- Execution Workflow (employee marks card as done, optional photo upload)
- Approval Workflow (team lead approves/rejects, card transitions accordingly)
- Escalation System (cron-based overdue detection with configurable threshold)
- Slot Availability Assistant (optimal maintenance time slot suggestions)
- Real-Time Notifications via SSE (due, overdue, approval required/result)
- Shift Grid Integration (TPM maintenance dates as overlay toggle)
- Machine History Bridge (approved executions → maintenance history)
- Configuration UI (escalation settings, card colors, card templates)
- Per-Tenant Color Customization (green/yellow/red/overdue colors)
- Card Templates with JSONB Custom Fields
- Time Estimates per Interval Type
- 364 Tests (278 unit + 86 API)
- Architecture: ADR-026

#### 12. **Arbeitsaufträge (Work Orders)** (NEW)

- Modulübergreifendes Arbeitsauftrag-System (TPM-Mängel, manuell)
- 4-Stufen-Lebenszyklus: Offen -> In Bearbeitung -> Erledigt -> Verifiziert
- N:M Mitarbeiter-Zuweisung (gefiltert nach Anlagen-Team)
- Foto-Dokumentation + Kommentarsystem
- Prioritäten (Hoch/Mittel/Niedrig) + Fälligkeitsdatum
- Real-time SSE-Benachrichtigungen (Zuweisung, Status, Fälligkeit, Verifizierung)
- Täglicher Fälligkeits-Cron (24h Vorwarnung)
- Employee-View (eigene Aufträge) + Admin-View (alle Aufträge)
- TPM-Integration: "Zuweisen" Button auf Mängelliste
- Audit-Logging für alle Mutationen

#### 13. **Dummy-Benutzer (Kiosk Accounts)** (NEW)

- Anonyme Display-Accounts für Firmen-TVs und Hallendisplays
- Auto-generierte Email + Personalnummer (kein manueller Aufwand)
- Manuelle Bezeichnung (z.B. "Halle 1 Display")
- Passwort mit Stärke-Indikator (zxcvbn)
- Team-Zuordnung (Multi-Select)
- Whitelist-Zugriff: Nur Schwarzes Brett, Kalender, TPM-Boards
- Automatischer Redirect zu /blackboard bei unerlaubtem Zugriff
- Verwaltet als Submenu unter Mitarbeiter (Admin) bzw. Administratoren (Root)
- 2-Stufen-Löschbestätigung (Soft-Delete)
- Activity Logging für alle Mutationen
- 89 Unit Tests + 18 API-Integrationstests

#### 13. **Freigaben (Approvals)** (Core Addon)

- Zentrales Freigabe-System für alle Module (KVP, Urlaub, Kalender, etc.)
- Konfigurierbare Approval Masters pro Addon (Team Lead, Area Lead, Department Lead, oder direkter Benutzer)
- Einfacher Lifecycle: pending → approved / rejected
- Self-Approval-Prevention (Antragsteller kann nicht selbst genehmigen)
- Approve/Reject Modals mit Begründungspflicht bei Ablehnung
- `/manage-approvals` — Dashboard für eingehende Freigaben
- `/settings/approvals` — Master-Konfiguration pro Modul
- Root + Admin mit Vollzugriff können immer genehmigen (by design)
- 104 Unit Tests + 24 API-Integrationstests
- ADR-037

#### 14. **Survey Tool (Umfragen)** (Kaufbares Addon)

- Admin kann Umfragen erstellen (Multiple Choice, Free Text, Anonym/Nicht-Anonym)
- Dynamische Sidebar: `/surveys` (Teilnehmen) für alle, `/manage-surveys` (Verwaltung) nur für Root, Admin-mit-full-access, Leads (Team/Area/Dept) und Deputies (ADR-039)
- Route Guard auf `/manage-surveys` (Defense-in-Depth: Redirect zu `/surveys` wenn nicht berechtigt)
- Legacy-Redirects für alte URLs (`/survey-admin` → `/manage-surveys`, `/survey-employee` → `/surveys`)
- Drei Permission-Module: `surveys-manage`, `surveys-participate`, `surveys-results` (ADR-020)
- Real-Time Badge-Counts via SSE (`NEW_SURVEY` Event)
- Activity Logging für alle Mutationen
- 205 Unit Tests + 10 API-Integrationstests

#### 15. **Schichtübergabe-Protokoll (Shift Handover)** (Submodul des Schichtplanung-Addons)

- Strukturierte Übergabe pro Schichtslot (`early`/`late`/`night`) statt Papier-Protokoll
- Team-Lead konfiguriert Templates mit Custom Fields (8 Typen: text/textarea/integer/decimal/date/time/boolean/select)
- Employee-Assignee schreibt Entwurf + submittet — Submit friert `schema_snapshot` ein (Drift-Safety, ADR-052 Decision 2)
- Read-View gegen `schema_snapshot`, nicht gegen Live-Template (Compliance-Audit-Trail)
- Bildanhänge (max. 5 pro Entry, je max. 5 MB; JPEG/PNG/WebP/HEIC)
- 24h-Auto-Lock via `@Cron('0 */6 * * *', timeZone:'Europe/Berlin')` — Cross-Tenant-Sweep via `sys_user` (BYPASSRLS)
- Sidebar-Submenu: `Schichtplanung ▸ Schichtplanung` (flach für alle) + `Schichtplanung ▸ Übergabe-Templates` (nur `canManage` via `applyShiftHandoverVariant`, ADR-045)
- Zwei neue Permission-Module unter dem Addon `shift_planning`: `shift-handover-templates` (canRead/canWrite/canDelete) + `shift-handover-entries` (canRead/canWrite/canDelete)
- Audit-Log-Einträge für Template-Upsert/Delete und Entry-Submit/Reopen (ActivityLoggerService)
- 95 Unit Tests + 39 API-Integrationstests
- ADR-052

## Addon Status Matrix (ADR-033)

> **Modell:** Core + À-la-carte Addons (keine Plan-Tiers mehr, siehe ADR-033)

| Addon                 | Typ     | Preis/Monat | Status |
| --------------------- | ------- | ----------- | ------ |
| Dashboard             | Core    | —           | Live   |
| Mitarbeiterverwaltung | Core    | —           | Live   |
| Abteilungen           | Core    | —           | Live   |
| Teams                 | Core    | —           | Live   |
| Kalender              | Core    | —           | Live   |
| Schwarzes Brett       | Core    | —           | Live   |
| Einstellungen         | Core    | —           | Live   |
| Benachrichtigungen    | Core    | —           | Live   |
| Organisationsstruktur | Core    | —           | Live   |
| Freigaben             | Core    | —           | Live   |
| Dokumente             | Kaufbar | €10         | Live   |
| Schichtplanung        | Kaufbar | €10         | Live   |
| Chat                  | Kaufbar | €10         | Live   |
| Umfragen              | Kaufbar | €10         | Live   |
| KVP                   | Kaufbar | €10         | Live   |
| Urlaubsverwaltung     | Kaufbar | €10         | Live   |
| TPM / Wartung         | Kaufbar | €10         | Live   |
| Arbeitsaufträge       | Kaufbar | €10         | Live   |
| Anlagen & Maschinen   | Kaufbar | €10         | Live   |
| Berichte              | Kaufbar | €10         | Live   |
| Protokoll & Audit     | Kaufbar | €10         | Live   |
| Platzhalter-Benutzer  | Kaufbar | €10         | Live   |

## Preismodell

### Core (Grundgebühr — Preis TBD)

- Unbegrenzte Benutzer (Root, Admin, Employee)
- 100 GB Storage (Default)
- 8 Core-Addons (immer aktiv)
- Email Support

### Kaufbare Addons — je €10/Monat (provisorisch)

- 30 Tage kostenloser Trial pro Addon
- Jederzeit aktivierbar und deaktivierbar
- Daten und Permissions bleiben bei Deaktivierung erhalten
- Sofortige Reaktivierung ohne Neueinrichtung

## Feature Details

### User Management in Detail

**Roles & Permissions:**

- **Root**: Full Access, Tenant Management, Billing
- **Admin**: Employee Management, Feature Configuration
- **Employee**: Access to Enabled Features

**Security:**

- Bcrypt Password Hashing
- JWT with 24h Expiration
- Tenant Isolation at DB Level
- Session Management
- **Tenant Domain Verification** (ADR-049): every tenant must prove DNS-TXT
  ownership of its company domain before user-creation unlocks. Signup
  hardening (3-layer email gate: format + disposable + freemail JSON) blocks
  free-mail / disposable signups before tenant creation. Microsoft OAuth
  signups auto-verify via Azure AD trust boundary (no DNS-TXT dance).
  Architectural test (`shared/src/architectural.test.ts`) blocks any future
  user-creation endpoint that skips the `assertVerified()` gate.
- **Forgot-Password Role-Gate + Root-Initiated Reset** (ADR-051): only
  `root` users may self-reset via `/auth/forgot-password`. Two independent
  gates (request + redemption) block admin/employee self-service; stolen
  tokens are burned + 403 on redemption even if the attacker already holds
  a valid hash. A Root can delegate a reset link to an admin/employee in
  the same tenant via a button in the Edit-Modal of `/manage-admins` or
  `/manage-employees` — separation of duties: Root issues the vehicle,
  target user sets the password (Root never sees the new credential).
  Root-on-Root admin-initiated reset is rejected to prevent takeover
  chains. Per-pair rate-limit (1 / 15 min) implemented via DB-lookup on
  `password_reset_tokens.initiated_by_user_id`. German-language blocked-
  and admin-initiated email templates (dark-mode MSO-compatible).
- **Mandatory Email-Based 2FA** (ADR-054): every password login + signup
  gates through a 6-character Crockford-Base32 code (alphabet
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, no `0/1/I/L/O` confusables, ~887 M
  permutations) emailed to the user's mailbox. Hardcoded — no opt-out,
  no per-tenant flag, no "trust this device" cookie. Code TTL 10 min,
  5 wrong attempts → 15-min user lockout, 60 s resend cooldown, max 3
  resends per challenge. Stored hashed at rest in Redis
  (`sha256(userId:code:purpose)`); challenge token transmitted via
  httpOnly+Secure+SameSite=Lax cookie with `maxAge` derived from
  `CODE_TTL_SEC` (R8 — tokens never in body). OAuth (Microsoft /
  Google) is exempt via `loginWithVerifiedUser()` — provider already
  enforces MFA upstream (DD-7). Email-change endpoint requires a
  **two-code verify** (old + new mailbox in the same transaction)
  to block session-hijack-driven account capture (DD-32 / R15).
  Failed SMTP delivery on signup is fail-loud: 503 returned and
  the half-created `tenants` + `users` rows are deleted in one
  transaction (anti subdomain-squatting, DD-14). Discriminated
  `LoginResult` from `auth.service.ts:222` forces frontend to handle
  both branches (`challenge_required` / `authenticated`) at compile
  time. Lost-mailbox recovery: company IT restores the mailbox; the
  `POST /users/:id/2fa/clear-lockout` endpoint clears only the 15-min
  lockout (not the 2FA requirement), Two-Root rule enforced
  (caller ≠ target). See [`HOW-TO-2FA-RECOVERY.md`](./how-to/HOW-TO-2FA-RECOVERY.md).
- **Root Account Lifecycle Protection** (ADR-055): four-layer defense
  prevents takeover and lock-out of `root` accounts across all four
  termination operations (Soft-Delete, Deactivate, Role-Demotion,
  Hard-Delete). (1) Frontend disables destructive controls on cross-root
  rows in `/manage-root` and surfaces a self-termination card on
  `/root-profile`. (2) Backend `RootProtectionService` blocks Root A →
  Root B termination, wired into 4 mutation paths plus a defensive
  role-block on the generic users archive. (3) Self-termination requires
  peer approval — `RootSelfTerminationService` runs the 7-day-TTL request
  workflow with single-pending-per-requester (DB unique partial index),
  24h post-rejection cooldown, `FOR UPDATE` row lock in the approve TX,
  and persistent notifications fanned out to all peer roots in tenant on
  request / approve / reject. (4) PostgreSQL trigger `trg_root_protection`
  (BEFORE UPDATE OR DELETE on `users`) backstops every layer including
  raw-psql access as `app_user`; Hybrid Option 1+ verifies a real approved
  row exists in a 5-min window before allowing the actor=approver flow
  through. Last-root protection (`tenant must keep ≥ 1 active root`)
  holds even with valid approval. `assixx_user` (DDL) + `sys_user`
  (cron / signup / tenant deletion) bypass cleanly per the Triple-User
  Model. 82 dedicated tests across 5 files (16 + 24 + 9 unit, 8 + 25 api).

### Document Management in Detail

**Supported Formats:**

- PDF (primary)
- Images (JPG, PNG)
- Office Documents (planned)

**Categories:**

- Payroll
- Employment Contracts
- Certificates
- Training Materials
- Miscellaneous

### Chat System in Detail

**Technology:**

- WebSocket
- PostgreSQL Message Storage
- File Upload up to 10MB
- Emoji Support

**Features:**

- Real-Time Synchronization
- Offline Message Queue
- Read Receipts (Backend ready)
- Typing Indicators

## Planned Features

### Q1 2025

- [x] Survey Tool → **Live als "Umfragen" (2026-04-14, canManageSurveys + ADR-020 Permissions)**
- [ ] Email Notifications
- [ ] Extended Search Functionality

### Q2 2025

- [x] Leave Management → **Live als "Vacation Management" (2026-02-13, ADR-023)**
- [ ] Mobile PWA
- [ ] Stripe Payment Integration
- [ ] Multi-Language Support (EN, TR, PL)

### Q3 2025

- [x] TPM Calendar → **Live als "TPM Wartung" (2026-02-19, ADR-026)**
- [ ] QA Checklists
- [ ] Extended Analytics
- [ ] API v2

### Q4 2025

- [ ] AI Integration
- [ ] Extended Automation
- [ ] Enterprise SSO
- [ ] Audit Compliance Module

## Technical Specifications

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical information.

## Further Documentation

- [Setup Guide](./SETUP-QUICKSTART.md)
- [API Documentation](./server/API-TEST-README.md)
- [Security Concept](./server/SECURITY-IMPROVEMENTS.md)
- [Deployment Guide](./DEPLOYMENT.md)
