# ADR-032: Feature-Katalog und Plan-Tier-Zuordnung

| Metadata                | Value                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| **Status**              | **Superseded** by [ADR-033: Addon-basiertes SaaS-Modell](./ADR-033-addon-based-saas-model.md) |
| **Date**                | 2026-03-10                                                                                    |
| **Decision Makers**     | SCS Technik                                                                                   |
| **Affected Components** | PostgreSQL (`features`, `plans`, `plan_features`), Seeds, Backend, Frontend Sidebar           |
| **Related ADRs**        | ADR-020 (Per-User Permissions), ADR-024 (Frontend Feature Guards)                             |

---

## Context

### Das Problem: Undokumentierter Feature-Katalog mit inkonsistenten Daten

Assixx hat 20 Features, 3 Pläne und 60 `plan_features`-Zuordnungen — aber **keine einzige Stelle**, die den vollständigen Feature-Katalog mit Plan-Zuordnung dokumentiert. Die einzige Quelle war die Seed-Datei (`001_global-seed-data.sql`), die zwei widersprüchliche Wahrheiten enthielt:

1. **`features.category`** — ENUM (`basic`, `core`, `premium`, `enterprise`) pro Feature
2. **`plan_features.is_included`** — Tatsächliche Zuordnung Feature → Plan

Diese widersprachen sich massiv:

| Feature       | `features.category` | Basic `is_included` | Erwartung basierend auf category |
| ------------- | ------------------- | ------------------- | -------------------------------- |
| `audit_trail` | **enterprise**      | **true** ✗          | false (nur Enterprise)           |
| `work_orders` | **premium**         | **true** ✗          | false (ab Professional)          |
| `assets`      | **premium**         | **true** ✗          | false (ab Professional)          |
| `reports`     | **premium**         | **true** ✗          | false (ab Professional)          |
| `vacation`    | **basic**           | **false** ✗         | true (ab Basic)                  |
| `teams`       | **core**            | **false** ✗         | true (alle Pläne)                |

**Konsequenz:** Kein Entwickler, kein Admin und kein Kunde konnte zuverlässig sagen, welches Feature in welchem Plan enthalten ist. Die Seed-Daten waren die einzige Source of Truth — und diese war fehlerhaft.

### Anforderungen

- Vollständiger Feature-Katalog als Single Source of Truth (diese ADR)
- `features.category` und `plan_features.is_included` müssen konsistent sein
- Klare Tier-Hierarchie: höherer Plan ⊇ niedrigerer Plan (kein Feature darf in Basic enthalten sein, aber in Professional fehlen)
- Jedes Feature mit Beschreibung, Kategorie, Permission-Modulen und Plan-Zuordnung dokumentiert

---

## Decision

### Tier-Hierarchie: Kategorie = Plan-Zugehörigkeit

Die `features.category` ENUM definiert verbindlich, ab welchem Plan ein Feature verfügbar ist:

```
┌─────────────────────────────────────────────────────┐
│  Enterprise (€299/Monat, ∞ MA, ∞ Admins, 1 TB)     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Professional (€149/Monat, 50 MA, 3 Admins) │    │
│  │  ┌─────────────────────────────────────┐    │    │
│  │  │  Basic (€49/Monat, 10 MA, 1 Admin)  │    │    │
│  │  │                                      │    │    │
│  │  │  basic + core Features               │    │    │
│  │  └─────────────────────────────────────┘    │    │
│  │  + premium Features                         │    │
│  └─────────────────────────────────────────────┘    │
│  + enterprise Features                              │
└─────────────────────────────────────────────────────┘
```

**Regel:** `plan_features.is_included` ergibt sich deterministisch aus `features.category`:

| `features.category` | Basic | Professional | Enterprise |
| ------------------- | ----- | ------------ | ---------- |
| `basic`             | ✓     | ✓            | ✓          |
| `core`              | ✓     | ✓            | ✓          |
| `premium`           | ✗     | ✓            | ✓          |
| `enterprise`        | ✗     | ✗            | ✓          |

### Pläne

| Plan             | Code           | Preis/Monat | Max MA | Max Admins | Storage  | Features          |
| ---------------- | -------------- | ----------- | ------ | ---------- | -------- | ----------------- |
| **Basic**        | `basic`        | €49         | 10     | 1          | 100 GB   | 11 (basic + core) |
| **Professional** | `professional` | €149        | 50     | 3          | 500 GB   | 17 (+premium)     |
| **Enterprise**   | `enterprise`   | €299        | ∞      | ∞          | 1.000 GB | 20 (alle)         |

---

## Feature-Katalog (20 Features)

### Kategorie: `basic` — Ab Basic-Plan (6 Features)

| #   | Code            | Name               | Beschreibung                                                                        | Permission-Module                                                                                                                            |
| --- | --------------- | ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `dashboard`     | Dashboard          | Zentrale Übersicht mit Kennzahlen, Aktivitäten und Schnellzugriff                   | — (Core-Feature, kein Guard)                                                                                                                 |
| 2   | `calendar`      | Kalender           | Gemeinsamer Unternehmenskalender mit Termin- und Ereignisverwaltung                 | `calendar-events` (R/W/D)                                                                                                                    |
| 3   | `blackboard`    | Schwarzes Brett    | Digitales schwarzes Brett für Ankündigungen, Kommentare und Archiv                  | `blackboard-posts` (R/W/D), `blackboard-comments` (R/W/D), `blackboard-archive` (R/W)                                                        |
| 4   | `settings`      | Einstellungen      | Mandanten-Einstellungen (Branding, Defaults, Konfiguration)                         | `settings-tenant` (W/D)                                                                                                                      |
| 5   | `vacation`      | Urlaubsverwaltung  | Digitale Urlaubsanträge, Genehmigungsworkflow, Vertreterregelung, Kapazitätsprüfung | `vacation-requests` (R/W/D), `vacation-rules` (R/W/D), `vacation-entitlements` (R/W/D), `vacation-holidays` (R/W/D), `vacation-overview` (R) |
| 6   | `notifications` | Benachrichtigungen | Push-Benachrichtigungen, SSE-Streaming, Benachrichtigungsverwaltung                 | `notifications-manage` (R/W)                                                                                                                 |

### Kategorie: `core` — Ab Basic-Plan, Infrastruktur-Features (5 Features)

| #   | Code          | Name                  | Beschreibung                                                         | Permission-Module                                            |
| --- | ------------- | --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| 7   | `employees`   | Mitarbeiterverwaltung | Benutzer anlegen, bearbeiten, deaktivieren; Verfügbarkeitsverwaltung | `employees-manage` (R/W/D), `employees-availability` (R/W/D) |
| 8   | `departments` | Abteilungen           | Abteilungen und Bereiche verwalten (Organisationsstruktur)           | `departments-manage` (W/D), `areas-manage` (W/D)             |
| 9   | `teams`       | Teams                 | Teams verwalten, Mitglieder und Anlagen zuordnen                     | `teams-manage` (W/D)                                         |
| 10  | `documents`   | Dokumente             | Dokumentenverwaltung mit Upload, Archiv und Zugriffskontrolle        | `documents-files` (R/W/D), `documents-archive` (R/W)         |
| 11  | `dummy_users` | Platzhalter-Benutzer  | Anonyme Anzeige-Accounts für Fabrik-Bildschirme (Kiosk-Modus)        | `dummy-users-manage` (R/W/D)                                 |

### Kategorie: `premium` — Ab Professional-Plan (6 Features)

| #   | Code             | Name                    | Beschreibung                                                          | Permission-Module                                                                       |
| --- | ---------------- | ----------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 12  | `shift_planning` | Schichtplanung          | Schichtpläne erstellen, Tauschbörse, Rotation, Schichtzeiten          | `shift-plan` (R/W/D), `shift-swap` (R/W), `shift-rotation` (R/W/D), `shift-times` (R/W) |
| 13  | `chat`           | Chat                    | Team-Chat mit Gesprächen und Nachrichten                              | `chat-conversations` (R/W/D), `chat-messages` (R/W/D)                                   |
| 14  | `surveys`        | Umfragen                | Umfragen erstellen, durchführen und auswerten                         | `surveys-manage` (R/W/D), `surveys-participate` (R/W), `surveys-results` (R)            |
| 15  | `work_orders`    | Arbeitsaufträge         | Modulübergreifendes Auftragssystem für Mängelbeseitigung und Aufgaben | `work-orders-manage` (R/W/D), `work-orders-execute` (R/W)                               |
| 16  | `assets`         | Anlagen & Maschinen     | Anlagen-/Maschinenverwaltung mit Verfügbarkeitstracking               | `assets-manage` (W/D), `assets-availability` (W/D)                                      |
| 17  | `reports`        | Berichte & Auswertungen | Unternehmensberichte, Analytics und Datenexporte                      | `reports-view` (R), `reports-export` (R/W)                                              |

### Kategorie: `enterprise` — Nur Enterprise-Plan (3 Features)

| #   | Code          | Name              | Beschreibung                                                                     | Permission-Module                                                                                             |
| --- | ------------- | ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 18  | `kvp`         | KVP               | Kontinuierlicher Verbesserungsprozess — Vorschlagswesen und Kommentare           | `kvp-suggestions` (R/W/D), `kvp-comments` (R/W/D)                                                             |
| 19  | `tpm`         | TPM / Wartung     | Total Productive Maintenance — Kamishibai Board, Wartungspläne, Intervall-Karten | `tpm-plans` (R/W/D), `tpm-cards` (R/W/D), `tpm-executions` (R/W), `tpm-config` (R/W), `tpm-locations` (R/W/D) |
| 20  | `audit_trail` | Protokoll & Audit | Audit-Protokollierung, Compliance-Berichte, Aufbewahrungsverwaltung              | `audit-view` (R), `audit-export` (R/W), `audit-retention` (R/D)                                               |

---

## Zusammenfassung: Plan → Features

### Basic (11 Features)

`dashboard`, `calendar`, `blackboard`, `settings`, `vacation`, `notifications`, `employees`, `departments`, `teams`, `documents`, `dummy_users`

### Professional (17 Features)

Alles aus Basic **+** `shift_planning`, `chat`, `surveys`, `work_orders`, `assets`, `reports`

### Enterprise (20 Features)

Alles aus Professional **+** `kvp`, `tpm`, `audit_trail`

---

## Permission-Module Übersicht (42 Module in 19 Kategorien)

| Feature        | Module                 | canRead | canWrite | canDelete |
| -------------- | ---------------------- | ------- | -------- | --------- |
| employees      | employees-manage       | ✓       | ✓        | ✓         |
| employees      | employees-availability | ✓       | ✓        | ✓         |
| departments    | departments-manage     | —       | ✓        | ✓         |
| departments    | areas-manage           | —       | ✓        | ✓         |
| teams          | teams-manage           | —       | ✓        | ✓         |
| documents      | documents-files        | ✓       | ✓        | ✓         |
| documents      | documents-archive      | ✓       | ✓        | —         |
| dummy_users    | dummy-users-manage     | ✓       | ✓        | ✓         |
| calendar       | calendar-events        | ✓       | ✓        | ✓         |
| blackboard     | blackboard-posts       | ✓       | ✓        | ✓         |
| blackboard     | blackboard-comments    | ✓       | ✓        | ✓         |
| blackboard     | blackboard-archive     | ✓       | ✓        | —         |
| settings       | settings-tenant        | —       | ✓        | ✓         |
| vacation       | vacation-requests      | ✓       | ✓        | ✓         |
| vacation       | vacation-rules         | ✓       | ✓        | ✓         |
| vacation       | vacation-entitlements  | ✓       | ✓        | ✓         |
| vacation       | vacation-holidays      | ✓       | ✓        | ✓         |
| vacation       | vacation-overview      | ✓       | —        | —         |
| notifications  | notifications-manage   | ✓       | ✓        | —         |
| shift_planning | shift-plan             | ✓       | ✓        | ✓         |
| shift_planning | shift-swap             | ✓       | ✓        | —         |
| shift_planning | shift-rotation         | ✓       | ✓        | ✓         |
| shift_planning | shift-times            | ✓       | ✓        | —         |
| chat           | chat-conversations     | ✓       | ✓        | ✓         |
| chat           | chat-messages          | ✓       | ✓        | ✓         |
| surveys        | surveys-manage         | ✓       | ✓        | ✓         |
| surveys        | surveys-participate    | ✓       | ✓        | —         |
| surveys        | surveys-results        | ✓       | —        | —         |
| work_orders    | work-orders-manage     | ✓       | ✓        | ✓         |
| work_orders    | work-orders-execute    | ✓       | ✓        | —         |
| assets         | assets-manage          | —       | ✓        | ✓         |
| assets         | assets-availability    | —       | ✓        | ✓         |
| reports        | reports-view           | ✓       | —        | —         |
| reports        | reports-export         | ✓       | ✓        | —         |
| kvp            | kvp-suggestions        | ✓       | ✓        | ✓         |
| kvp            | kvp-comments           | ✓       | ✓        | ✓         |
| tpm            | tpm-plans              | ✓       | ✓        | ✓         |
| tpm            | tpm-cards              | ✓       | ✓        | ✓         |
| tpm            | tpm-executions         | ✓       | ✓        | —         |
| tpm            | tpm-config             | ✓       | ✓        | —         |
| tpm            | tpm-locations          | ✓       | ✓        | ✓         |
| audit_trail    | audit-view             | ✓       | —        | —         |
| audit_trail    | audit-export           | ✓       | ✓        | —         |
| audit_trail    | audit-retention        | ✓       | —        | ✓         |

---

## Seed-Korrektur (begleitend zu dieser ADR)

Die `plan_features`-Seed-Daten wurden korrigiert, sodass `is_included` deterministisch aus `features.category` folgt:

**Änderungen:**

| Feature          | Basic vorher | Basic nachher | Pro vorher | Pro nachher |
| ---------------- | ------------ | ------------- | ---------- | ----------- |
| `teams`          | false        | **true**      | true       | true        |
| `vacation`       | false        | **true**      | false      | **true**    |
| `shift_planning` | false        | false         | true       | true        |
| `chat`           | false        | false         | true       | true        |
| `surveys`        | false        | false         | true       | true        |
| `work_orders`    | **true**     | false         | true       | true        |
| `assets`         | **true**     | false         | true       | true        |
| `reports`        | **true**     | false         | true       | true        |
| `audit_trail`    | **true**     | false         | **true**   | false       |

---

## Alternatives Considered

### Option A: `category` als rein informatives Label belassen

`features.category` hätte keine Bindung an Pläne. Die einzige Source of Truth wäre `plan_features`.

**Verworfen:** Führt zu genau der Inkonsistenz, die dieses ADR korrigiert. Zwei widersprüchliche Wahrheiten ohne Validierung sind schlimmer als eine klare Regel.

### Option B: `category` ENUM entfernen, nur `plan_features` behalten

Kein `category`-Feld auf `features`. Plan-Zuordnung ausschließlich über die Mapping-Tabelle.

**Verworfen:** `category` ist wertvoll als schnelle Klassifizierung (z.B. UI-Badge "Premium Feature", Sortierung im Feature-Store). Es braucht nur Konsistenz, nicht Entfernung.

### Option C: Feature-Bundles statt Tier-Hierarchie

Pläne enthalten beliebige Feature-Kombinationen ohne Hierarchie (z.B. Basic hat Chat aber nicht Calendar).

**Verworfen:** Widerspricht dem Industriestandard (SaaS-Tiers sind immer inklusiv: höherer Plan ⊇ niedrigerer Plan). Beliebige Zuordnung ist für den Vertrieb nicht kommunizierbar.

---

## Consequences

### Positive

1. **Single Source of Truth** — Diese ADR dokumentiert jeden Feature-Code, jede Beschreibung, jedes Permission-Modul und jede Plan-Zuordnung
2. **Deterministische Zuordnung** — `features.category` bestimmt eindeutig, in welchen Plänen ein Feature enthalten ist
3. **Inklusive Hierarchie** — Enterprise ⊇ Professional ⊇ Basic (kein Feature geht beim Upgrade verloren)
4. **Onboarding-Dokument** — Neue Entwickler verstehen das Feature-System in 5 Minuten
5. **Seed-Korrektur** — 9 fehlerhafte `plan_features`-Zuordnungen bereinigt

### Negative

1. **Kein Runtime-Enforcement** — Die Regel "category = Plan-Tier" wird nicht durch DB-Constraints erzwungen
2. **Manuelles Dokument** — Diese ADR muss bei neuen Features aktualisiert werden

### Mitigations

| Problem                          | Mitigation                                                |
| -------------------------------- | --------------------------------------------------------- |
| Neue Features ohne ADR-Update    | Code Review Checklist: "Feature in ADR-032 dokumentiert?" |
| category vs. plan_features Drift | Seed-Datei enthält Kommentar mit Verweis auf diese ADR    |
| Kein DB-Constraint               | Zukünftig: CHECK-Constraint oder Seed-Validierungsskript  |

---

## References

- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — Permission-Registry-Pattern
- [ADR-024: Frontend Feature Guards](./ADR-024-frontend-feature-guards.md) — Frontend-seitige Feature-Gating-Architektur
- [Seed-Datei](../../../database/seeds/001_global-seed-data.sql) — Source of Truth für initiale Plan-/Feature-Daten
- [DATABASE-MIGRATION-GUIDE.md](../../DATABASE-MIGRATION-GUIDE.md) — Seed-Konventionen
