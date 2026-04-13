# Brainstorming: Vacation Request System (Urlaubsantrag)

> **Created:** 2026-02-12
> **Status:** Decisions Finalized — Implementierung beginnt
> **Feature:** Roadmap Next — Vacation / Leave Request Management
> **Participants:** SCS + Claude
> **Masterplan:** [prompt_vacation.md](./prompt_vacation.md)

---

## 1. Kernidee

Mitarbeiter stellen UrlaubsAnträge, die von ihrem direkten Vorgesetzten genehmigt oder abgelehnt werden. Das System zeigt dabei automatisch Kapazität swarnungen an (Mindestbesetzung pro Anlage, bereits genehmigte Urlaube, Sperrzeitraeume).

---

## 2. Genehmigungskette (Approval Chain)

| Antragsteller                 | Genehmigung durch                                                   | Logik                      |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------- |
| Employee (role=employee)      | `team_lead_id` des Teams (oder `deputy_lead_id` wenn Lead abwesend) | Teamleiter kennt Kapazität |
| Admin (role=admin)            | `area_lead_id` der Area                                             | Bereichsleiter genehmigt   |
| Admin ohne Area-Lead          | Keine Genehmigung noetig                                            | Auto-approved              |
| Area Lead (area_lead_id User) | Keine Genehmigung noetig                                            | Selbstverantwortlich       |
| Root (role=root)              | Keine Genehmigung noetig                                            | System-Admin               |

**Entscheidung:** Root und Area-Lead-User brauchen KEINE Genehmigung — sie tragen ihren Urlaub direkt ein (Status = approved).

**Neu (Q&A):** Deputy-Lead (`deputy_lead_id` auf `teams` Tabelle) springt ein wenn `team_lead_id` abwesend ist.

---

## 3. Bestehende DB-Strukturen (recherchiert)

### Bereits vorhanden und relevant:

| Tabelle                 | Relevante Spalten                                                                                                                                                                         | Nutzung                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `employee_availability` | id (SERIAL PK), employee_id, tenant_id, status (ENUM: available/unavailable/vacation/sick/training/other), start_date, end_date, reason, notes, created_by, created_at, updated_at        | **Wird umbenannt zu `user_availability`** — Availability-Tracking mit Historie |
| `absences`              | id (SERIAL PK), tenant_id, user_id, type (ENUM: vacation/sick/training/other), status (ENUM: pending/approved/rejected/cancelled), start_date, end_date, reason, approved_by, approved_at | **Legacy — wird gedroppt.** Nie im Backend verdrahtet (0 Referenzen).          |
| `teams`                 | id, tenant_id, team_lead_id (FK users.id), name, department_id, is_active                                                                                                                 | Wer genehmigt Employee-Anträge. **Bekommt `deputy_lead_id`.**                  |
| `areas`                 | id, area_lead_id (FK users.id)                                                                                                                                                            | Wer genehmigt Admin-Anträge                                                    |
| `machines`              | id (SERIAL PK), area_id, department_id, status, name                                                                                                                                      | Anlagen-Inventar                                                               |
| `machine_teams`         | asset_id, team_id, is_primary                                                                                                                                                             | Welches Team bedient welche Anlage                                             |
| `user_teams`            | user_id, team_id, role                                                                                                                                                                    | Employee-Team-Zuordnung                                                        |
| `user_departments`      | user_id, department_id, is_primary                                                                                                                                                        | Employee-Abteilungs-Zuordnung                                                  |
| `users`                 | id (SERIAL PK), role (ENUM: root/admin/employee), has_full_access, is_active, tenant_id                                                                                                   | Rollen und Berechtigungen                                                      |
| `addons`                | id (SERIAL PK), code (UNIQUE), name, category (ENUM: basic/core/premium/enterprise)                                                                                                       | Addon-Flags (global, kein RLS)                                                 |
| `tenant_addons`         | tenant_id, feature_id                                                                                                                                                                     | Welcher Tenant hat welche Features aktiv                                       |
| `audit_trail`           | PARTITIONED BY RANGE (created_at)                                                                                                                                                         | Audit-Logging                                                                  |
| `notifications`         | type, priority, recipient_type                                                                                                                                                            | SSE-basiertes Notification-System                                              |

### Wichtige Erkenntnisse:

1. **Kein `machine_operators`-Table** — Anlagen sind Teams zugewiesen, nicht einzelnen Personen
2. **`employee_availability` nur fuer Employees** — **RESOLVED:** Umbenennen zu `user_availability`, `employee_id` → `user_id`
3. **`absences` Tabelle existiert** — Legacy, nie verdrahtet (0 Backend-Referenzen). Wird gedroppt.
4. **Mindestbesetzung pro Anlage** = Alle User im zugewiesenen Team (`machine_teams` + `user_teams`)
5. **Availability-Modal** existiert unter `manage-employees/_lib/AvailabilityModal.svelte` mit History-Seite
6. **Backend-Code der geaendert werden muss** bei Availability-Rename:
   - `backend/src/nest/users/user-availability.service.ts` — Tabellen/Spalten-Namen in SQL
   - `backend/src/nest/teams/teams.service.ts` — LEFT JOIN auf `employee_availability`
   - `backend/src/nest/users/users.helpers.ts` — Kommentare
   - `backend/src/nest/users/users.types.ts` — Kommentare
7. **Newest Table Pattern** (e2e_key_escrow): `id UUID PRIMARY KEY` (application-generated UUIDv7)
8. **tenant_id ist INTEGER** ueberall (nicht UUID)
9. **Existing `employee_availability` Index-Namen** (aus Baseline): `idx_19227_*` — muessen bei Rename gedroppt werden
10. **FK-Constraint-Namen**: `fk_availability_tenant`, `fk_availability_employee`, `fk_availability_created_by`
11. **Trigger-Funktion**: `on_update_current_timestamp_employee_availability()` — muss umbenannt werden
12. **Sequence**: `employee_availability_id_seq` — muss umbenannt werden

---

## 4. Entscheidungen aus Brainstorming

### 4.1 Mindestbesetzung

- **IMMER pro Anlage** (nicht pro Team)
- Logik: Anlage -> machine_teams -> user_teams -> verfuegbare User zaehlen
- Lead muss Mindestbesetzung pro Anlage definieren koennen
- **Eigene Tabelle:** `vacation_staffing_rules` (UUID PK, UNIQUE tenant_id+asset_id)

### 4.2 Halbe Tage & Zeitvariablen

- Default: 1 ganzer Tag
- Halbe Tage moeglich (Vormittag/Nachmittag)
- **ENUM:** `vacation_half_day` = 'none' | 'morning' | 'afternoon'
- **Constraint:** Bei Single-Day-Request max EINE half-day Option (nicht beide)
- Weitere Sondervariablen spaeter erweiterbar

### 4.3 Urlaubstypen

| Typ                   | Beschreibung            | Kontingent                                                          |
| --------------------- | ----------------------- | ------------------------------------------------------------------- |
| `regular`             | Regulaerer Jahresurlaub | Aus Urlaubsanspruch (z.B. 30 Tage)                                  |
| `special_doctor`      | Arztbesuch              | Default: zieht ab. Lead kann `is_special_leave` setzen → kein Abzug |
| `special_bereavement` | Beerdigung 1. Grades    | Default: zieht ab. Lead kann `is_special_leave` setzen → kein Abzug |
| `special_birth`       | Geburt eines Kindes     | Default: zieht ab. Lead kann `is_special_leave` setzen → kein Abzug |
| `special_wedding`     | Eigene Hochzeit         | Default: zieht ab. Lead kann `is_special_leave` setzen → kein Abzug |
| `special_move`        | Umzug                   | Default: zieht ab. Lead kann `is_special_leave` setzen → kein Abzug |
| `unpaid`              | Unbezahlter Urlaub      | Kein Kontingent, aber Genehmigung noetig. Keine Balance-Pruefung.   |

**Sonderurlaub-Logik (Q&A A7):** KEIN separates Kontingent. Default: Sonderurlaub zieht vom regulaeren Kontingent ab. Lead hat bei Genehmigung eine Checkbox `is_special_leave` — wenn gesetzt, kein Abzug. Lead kann auch `additional_days` zum Kontingent hinzufügen.

### 4.4 Stellvertreter (Substitute)

- Bei Antragstellung optional: Stellvertreter benennen (substitute_id auf vacation_requests)
- Lead sieht wer einspringt
- **RESOLVED:** Availability wird fuer ALLE User funktionieren (Tabelle umbenannt: `employee_availability` → `user_availability`, Spalte: `employee_id` → `user_id`)
- **Neu:** `deputy_lead_id` auf `teams` Tabelle fuer Stellvertreter-Lead

### 4.5 Feiertage

- **Nicht dynamisch einstellen** durch jeden User
- Root oder Admin mit `has_full_access = true` kann Feiertage fuer den Tenant eintragen
- Feiertage werden bei Tagesberechnung abgezogen (z.B. Antrag Mo-Fr aber Mi ist Feiertag = 4 Tage statt 5)
- **Eigene Tabelle:** `vacation_holidays` (UUID PK, UNIQUE tenant_id+holiday_date)
- **Recurring:** `recurring=true` → jedes Jahr am gleichen Datum (matching via MONTH+DAY)
- **V1 Limitation:** Bewegliche Feiertage (Ostern, Pfingsten) muessen Jährlich manuell als non-recurring eingetragen werden

### 4.6 Urlaubstagekonto

- Employee UND Lead sehen immer: "X von Y Tagen uebrig"
- Resturlaubsuebertragung ins neue Jahr
- Admin kann einstellen: Verfallsdatum (z.B. 31.03), maximale Uebertragstage
- **RESOLVED (Q&A A4):** KEIN `used_days` Counter. Balance wird BERECHNET aus approved Requests. Kein fragiler denormalisierter Zaehler.
- **RESOLVED (Q&A A5):** `computed_days` (Arbeitstage) wird server-seitig berechnet, NIEMALS vom Client gesendet.
- **RESOLVED (Q&A A8):** Cross-Year Splitting — Urlaub ueber Jahreswechsel wird pro Kalenderjahr aufgesplittet und vom jeweiligen Jahres-Entitlement abgezogen.

### 4.7 Urlaubssperren (Blackout Periods)

- Lead/Admin definiert Zeitraeume wo kein Urlaub genommen werden darf
- Grund angeben (z.B. "Inventur", "Jahresabschluss", "Messezeit")
- Employee sieht Sperre direkt beim Antrag stellen
- **Eigene Tabelle:** `vacation_blackouts` (UUID PK, scope_type: global/team/department)
- **Scope:** Global (alle), Team-spezifisch, oder Abteilungs-spezifisch

---

## 5. Dynamische Hinweise (Kernfeature)

### 5.1 Was der Lead sieht bei eingehenden Anträgen:

```
+---------------------------------------------------+
| Urlaubsantrag: Max Mueller                        |
| 15.03 - 22.03.2026 (6 Arbeitstage)               |
|                                                   |
| Kapazität sanalyse:                               |
| - Team "CNC-Fertigung": 8 Mitarbeiter            |
| - Bereits im Urlaub: Schmidt (15-19.03)           |
| - Mindestbesetzung Anlage CNC-1: 3 noetig      |
| - Verfuegbar nach Genehmigung: 6 (OK)            |
|                                                   |
| - Anlage "CNC-Fraese 2": 2 Bediener noetig     |
| - Verfuegbar: 3 -> nach Genehmigung: 2 (KNAPP)   |
|                                                   |
| - Resturlaub Mueller: 18/30 Tagen                 |
| - Stellvertreter: Lisa Weber (verfuegbar)         |
|                                                   |
| [x] Sonderregelung (kein Abzug vom Kontingent)    |
|                                                   |
| [Genehmigen]  [Ablehnen + Grund]                  |
+---------------------------------------------------+
```

### 5.2 Was der Employee sieht beim Antrag stellen:

```
+---------------------------------------------------+
| Neuer Urlaubsantrag                               |
|                                                   |
| Von: [15.03.2026]  Bis: [22.03.2026]             |
| Typ: [Regulaerer Urlaub]                          |
| Halber Tag: [ ] Erster Tag  [ ] Letzter Tag       |
|                                                   |
| Verfuegbarkeit:                                   |
| - 6 Arbeitstage (exkl. Wochenende + Feiertage)   |
| - Dein Restanspruch: 18 Tage (OK)                 |
| - Team-Auslastung: 1/8 im Urlaub (OK)            |
| - Keine Urlaubssperre (OK)                        |
| - Mindestbesetzung CNC-1: 3/3 (KNAPP)            |
|                                                   |
| Stellvertreter: [Lisa Weber (dropdown)]           |
| Kommentar: [________________________]             |
| [Antrag absenden]                                 |
+---------------------------------------------------+
```

---

## 6. Seiten-Übersicht

| Seite                    | Rolle                        | Inhalt                                                                                       |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `/vacation`              | Employee                     | Eigene Anträge, Inline-Formular neuer Antrag, Restanspruch, Kalender-Preview mit Team-Urlaub |
| `/vacation`              | Lead/Admin                   | Eingehende Anträge + Kapazität s-Hinweise + Genehmigen/Ablehnen + eigene Anträge             |
| `/vacation`              | Root/Area-Lead               | Direkte Eintragung (kein Approval noetig) + Übersicht                                        |
| `/vacation/rules`        | Lead/Admin/Root              | Mindestbesetzung pro Anlage, Urlaubssperren, Vorlaufzeit                                     |
| `/vacation/overview`     | Lead/Admin/Root              | Team-Kalender, Jahresuebersicht, Statistiken                                                 |
| `/vacation/entitlements` | Admin/Root                   | Urlaubsansprüche pro Mitarbeiter, Übertrag-Einstellungen                                     |
| `/vacation/holidays`     | Root / has_full_access Admin | Feiertage fuer Tenant verwalten                                                              |

---

## 7. Weitere Ideen (V2 / Spaeter)

- **Eskalation/Timeout:** Auto-Reminder wenn Lead X Tage nicht reagiert
- **Kalender-Integration (erweitert):** Tiefere Integration mit Calendar-Feature (V1 macht Frontend-Merge)
- **Jahresuebersicht/Export:** HR-Export aller Mitarbeiter (Anspruch/Genommen/Rest) als CSV/Excel
- **Benachrichtigungen (erweitert):** Volle Email-Integration sobald SMTP konfiguriert (V1 hat Email-Stub)
- **Automatische Ablehnung:** Wenn Mindestbesetzung unterschritten wird, kann System automatisch ablehnen (mit Override-Option fuer Lead)
- **Automatische Schicht-Umplanung:** Urlaub genehmigt → Schicht automatisch umplanen mit Bestaetigung
- **Bewegliche Feiertage:** Admin-Tool fuer automatische Berechnung (Ostern, Pfingsten etc.)
- **Multi-Team Support:** Aktuell 1 Team pro Employee (Business Rule A1)

---

## 8. Offene Punkte → RESOLVED

| #   | Punkt                                                     | Entscheidung                                                                                                                              | Referenz                  |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | `employee_availability` umbenennen oder separate Tabelle? | **Umbenennen zu `user_availability`**, `employee_id` → `user_id`. Legacy `absences` droppen.                                              | Q&A A12                   |
| 2   | Genauer Sonderurlaubs-Katalog (Tage pro Typ)              | **Kein separates Kontingent.** Lead markiert bei Genehmigung als `is_special_leave` → kein Abzug. Lead kann `additional_days` hinzufügen. | Q&A A7                    |
| 3   | Individuelle Operator-Zuordnung noetig?                   | **Nein.** Team-basiert reicht. 1 Team pro Employee (Business Rule).                                                                       | Q&A A1                    |
| 4   | Integration mit Shift-Modul?                              | **V1: Warnung an Lead** wenn Schichten im Urlaubszeitraum existieren. NICHT automatisch loeschen. V2: Automatische Umplanung.             | prompt_vacation Phase 4.2 |

---

## 9. Architektur-Entscheidungen (Q&A Session)

Folgende Entscheidungen wurden in der Q&A-Session getroffen und sind **bindend** fuer die Implementierung. Vollstaendige Details im [Masterplan](./prompt_vacation.md) Abschnitt 0.

| #   | Entscheidung                                 | Begruendung                                                                                           |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A1  | **1 Team pro Employee** (Business Rule)      | Vereinfacht Kapazität sberechnung. Validation bei Team-Zuweisung.                                     |
| A2  | **Feature Flag** `vacation` (category=basic) | Tenant kann deaktivieren. Teil des Basic-Pakets.                                                      |
| A3  | **3 getrennte Regel-Tabellen**               | `vacation_blackouts`, `vacation_staffing_rules`, `vacation_settings` statt einer `vacation_rules`.    |
| A4  | **Kein `used_days` Counter**                 | Balance wird BERECHNET aus approved Requests. Kein fragiler Zaehler.                                  |
| A5  | **`computed_days` server-seitig**            | Niemals vom Client. Server berechnet aus Datum + Feiertage + halbe Tage.                              |
| A6  | **`deputy_lead_id` auf `teams`**             | Stellvertreter-Lead fuer Genehmigungen.                                                               |
| A7  | **Sonderurlaub via `is_special_leave`**      | Checkbox bei Genehmigung. Default: zieht ab. Lead kann Abzug verhindern + Tage hinzufügen.            |
| A8  | **Cross-Year Splitting**                     | Urlaub ueber Jahreswechsel: Tage pro Kalenderjahr berechnet und vom jeweiligen Entitlement abgezogen. |
| A9  | **UUID PRIMARY KEY** (UUIDv7)                | Folgt neuestem Pattern. Application-generated via `uuidv7()`.                                         |
| A10 | **Email + SSE Notifications**                | SSE sofort (ADR-003). Email-Interface als Stub vorbereitet.                                           |
| A11 | **Audit Trail in V1**                        | `vacation_request_status_log` + globaler `audit_trail`.                                               |
| A12 | **Availability komplett erneuern**           | `employee_availability` → `user_availability`. Legacy `absences` droppen.                             |
| A13 | **`cancelled` vs `withdrawn`**               | `withdrawn` = Requester zieht zurück. `cancelled` = Admin storniert genehmigten Urlaub.               |

---

**Naechster Schritt:** Implementierung gemaess [prompt_vacation.md](./prompt_vacation.md) — Phase 1 (DB Migrations) zuerst.
