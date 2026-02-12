# Vacation System — Die 7 neuen Tabellen einfach erklaert

> **Stand:** 2026-02-12
> **Referenz:** [FEAT_VACCATION_MASTERPLAN.md](./FEAT_VACCATION_MASTERPLAN.md)
> **Spec:** [prompt_vacation.md](./prompt_vacation.md)

---

## 1. `vacation_holidays` — Feiertage

Speichert die Feiertage pro Firma. Weihnachten, Neujahr, Tag der Arbeit etc. Werden bei der Tageberechnung abgezogen — wenn du Mo-Fr Urlaub beantragst aber Mi Feiertag ist, zaehlt das System nur 4 Tage statt 5. Feiertage koennen `recurring=true` sein (jedes Jahr gleich, z.B. 01.01.) oder einmalig (z.B. Brueckentag).

| Spalte         | Typ          | Bedeutung                             |
| -------------- | ------------ | ------------------------------------- |
| `id`           | UUID         | Primaerschluessel (UUIDv7)            |
| `tenant_id`    | INTEGER      | Welche Firma                          |
| `holiday_date` | DATE         | Datum des Feiertags                   |
| `name`         | VARCHAR(100) | z.B. "Weihnachten", "Tag der Arbeit"  |
| `recurring`    | BOOLEAN      | `true` = jedes Jahr am gleichen Datum |
| `is_active`    | INTEGER      | 0=inaktiv, 1=aktiv, 4=geloescht       |
| `created_by`   | INTEGER      | Wer hat den Feiertag eingetragen      |

**Unique:** Ein Datum pro Firma nur einmal (`tenant_id + holiday_date`).

---

## 2. `vacation_entitlements` — Urlaubsanspruch

Eine Zeile pro Mitarbeiter pro Jahr. Sagt: "Mueller hat 2026 insgesamt 30 Tage, davon 3 Tage Uebertrag aus 2025, plus 2 Sondertage vom Chef." Kein `used_days`-Zaehler — wie viel verbraucht ist, wird immer LIVE aus den genehmigten Anträgen berechnet.

| Spalte                  | Typ          | Bedeutung                                  |
| ----------------------- | ------------ | ------------------------------------------ |
| `id`                    | UUID         | Primaerschluessel (UUIDv7)                 |
| `tenant_id`             | INTEGER      | Welche Firma                               |
| `user_id`               | INTEGER      | Welcher Mitarbeiter                        |
| `year`                  | INTEGER      | Fuer welches Jahr (z.B. 2026)              |
| `total_days`            | NUMERIC(4,1) | Grundanspruch (z.B. 30.0)                  |
| `carried_over_days`     | NUMERIC(4,1) | Uebertrag aus Vorjahr (z.B. 5.0)           |
| `additional_days`       | NUMERIC(4,1) | Sondertage vom Lead/Admin (z.B. 2.0)       |
| `carry_over_expires_at` | DATE         | Wann der Uebertrag verfaellt (z.B. 31.03.) |

**Unique:** Pro Mitarbeiter nur ein Eintrag pro Jahr (`tenant_id + user_id + year`).

**Balance-Berechnung (immer live):**

```
verfuegbar = total_days + effektiver_uebertrag + additional_days
verbraucht = SUM(genehmigte Anträge wo is_special_leave = false)
rest       = verfuegbar - verbraucht
```

---

## 3. `vacation_requests` — UrlaubsAnträge (Kerntabelle)

Der eigentliche Antrag. Wer will wann frei, welcher Typ (regulaer, Arztbesuch, Hochzeit, unbezahlt...), halbe Tage, wie viele Arbeitstage das System berechnet hat, wer genehmigen soll, aktueller Status (pending/approved/denied/withdrawn/cancelled). Plus die Sonderurlaub-Checkbox (`is_special_leave`) — wenn der Lead die setzt, wird nichts vom Kontingent abgezogen.

| Spalte             | Typ          | Bedeutung                                                                                                        |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `id`               | UUID         | Primaerschluessel (UUIDv7)                                                                                       |
| `tenant_id`        | INTEGER      | Welche Firma                                                                                                     |
| `requester_id`     | INTEGER      | Wer den Antrag stellt                                                                                            |
| `approver_id`      | INTEGER      | Wer genehmigen soll (NULL bei Auto-Genehmigung)                                                                  |
| `substitute_id`    | INTEGER      | Stellvertreter waehrend Abwesenheit (optional)                                                                   |
| `start_date`       | DATE         | Erster Urlaubstag                                                                                                |
| `end_date`         | DATE         | Letzter Urlaubstag                                                                                               |
| `half_day_start`   | ENUM         | `none` / `morning` / `afternoon` — erster Tag halbtags?                                                          |
| `half_day_end`     | ENUM         | `none` / `morning` / `afternoon` — letzter Tag halbtags?                                                         |
| `vacation_type`    | ENUM         | `regular`, `special_doctor`, `special_bereavement`, `special_birth`, `special_wedding`, `special_move`, `unpaid` |
| `status`           | ENUM         | `pending`, `approved`, `denied`, `withdrawn`, `cancelled`                                                        |
| `computed_days`    | NUMERIC(4,1) | Server-berechnete Arbeitstage (exkl. Wochenende + Feiertage)                                                     |
| `is_special_leave` | BOOLEAN      | Lead setzt: `true` = kein Abzug vom Kontingent                                                                   |
| `request_note`     | TEXT         | Kommentar vom Antragsteller                                                                                      |
| `response_note`    | TEXT         | Kommentar vom Lead (Pflicht bei Ablehnung)                                                                       |
| `responded_at`     | TIMESTAMPTZ  | Wann genehmigt/abgelehnt                                                                                         |
| `responded_by`     | INTEGER      | Wer genehmigt/abgelehnt hat                                                                                      |

**Status-Uebergaenge:**

```
pending → approved    (Lead genehmigt)
pending → denied      (Lead lehnt ab — Grund Pflicht)
pending → withdrawn   (Antragsteller zieht zurück)
approved → withdrawn  (Antragsteller storniert vor Urlaubsbeginn)
approved → cancelled  (Admin/Root storniert genehmigten Urlaub)
```

**Wichtige DB-Constraints:**

- `end_date >= start_date`
- `computed_days > 0` und Vielfaches von 0.5
- Bei einem einzigen Tag: maximal EINE Half-Day-Option (nicht beide)
- `is_special_leave = true` nur bei `status = 'approved'`
- `status = 'denied'` nur mit `response_note IS NOT NULL`

---

## 4. `vacation_request_status_log` — Statusverlauf

Jede Statusaenderung wird protokolliert. Antrag gestellt → pending. Genehmigt → approved. Storniert → cancelled. Append-only — nichts wird geloescht oder geaendert. Damit kann man nachvollziehen: Wer hat wann was gemacht?

| Spalte       | Typ         | Bedeutung                                   |
| ------------ | ----------- | ------------------------------------------- |
| `id`         | UUID        | Primaerschluessel (UUIDv7)                  |
| `tenant_id`  | INTEGER     | Welche Firma                                |
| `request_id` | UUID        | Welcher Antrag (FK auf `vacation_requests`) |
| `old_status` | ENUM        | Vorheriger Status (NULL bei Erstellung)     |
| `new_status` | ENUM        | Neuer Status                                |
| `changed_by` | INTEGER     | Wer die Aenderung gemacht hat               |
| `note`       | TEXT        | Optionaler Kommentar                        |
| `created_at` | TIMESTAMPTZ | Wann                                        |

**Kein `is_active`, kein `updated_at`** — reine Append-Only-Tabelle.
**GRANT:** Nur `SELECT, INSERT` (kein UPDATE/DELETE).

---

## 5. `vacation_blackouts` — Urlaubssperren

Zeitraeume, in denen kein Urlaub genommen werden darf. Z.B. "Inventur 15.-20. Maerz" oder "Messezeit Juni". Kann global (alle), pro Team oder pro Abteilung gelten. Wenn ein Mitarbeiter in einem gesperrten Zeitraum Urlaub beantragt → System blockt sofort.

| Spalte       | Typ          | Bedeutung                                    |
| ------------ | ------------ | -------------------------------------------- |
| `id`         | UUID         | Primaerschluessel (UUIDv7)                   |
| `tenant_id`  | INTEGER      | Welche Firma                                 |
| `name`       | VARCHAR(100) | z.B. "Inventur", "Jahresabschluss"           |
| `reason`     | VARCHAR(255) | Warum gesperrt (optional)                    |
| `start_date` | DATE         | Sperre von                                   |
| `end_date`   | DATE         | Sperre bis                                   |
| `scope_type` | VARCHAR(20)  | `global` / `team` / `department`             |
| `scope_id`   | INTEGER      | Team-ID oder Abteilungs-ID (NULL bei global) |
| `is_active`  | INTEGER      | 0=inaktiv, 1=aktiv, 4=geloescht              |
| `created_by` | INTEGER      | Wer die Sperre erstellt hat                  |

**Scope-Logik:**

- `global` + `scope_id = NULL` → gilt fuer alle Mitarbeiter
- `team` + `scope_id = 5` → gilt nur fuer Team mit ID 5
- `department` + `scope_id = 3` → gilt nur fuer Abteilung mit ID 3

---

## 6. `vacation_staffing_rules` — Mindestbesetzung pro Maschine

Sagt: "CNC-Fraese 1 braucht mindestens 3 Bediener." Wenn jemand Urlaub beantragt und danach nur noch 2 uebrig waeren, zeigt das System dem Lead eine Warnung (critical). Blockiert nicht automatisch — der Lead entscheidet.

| Spalte            | Typ     | Bedeutung                              |
| ----------------- | ------- | -------------------------------------- |
| `id`              | UUID    | Primaerschluessel (UUIDv7)             |
| `tenant_id`       | INTEGER | Welche Firma                           |
| `machine_id`      | INTEGER | Welche Maschine (FK auf `machines`)    |
| `min_staff_count` | INTEGER | Mindestanzahl Bediener (muss > 0 sein) |
| `is_active`       | INTEGER | 0=inaktiv, 1=aktiv, 4=geloescht        |
| `created_by`      | INTEGER | Wer die Regel erstellt hat             |

**Unique:** Pro Maschine nur eine Regel (`tenant_id + machine_id`).

**Kapazität s-Ampel:**

- `available > min` → OK (gruen)
- `available = min` → WARNING (gelb)
- `available < min` → CRITICAL (rot)

---

## 7. `vacation_settings` — Einstellungen pro Firma

Eine einzige Zeile pro Tenant. Globale Regeln: Wie viele Urlaubstage standardmaessig (30), wie viel Uebertrag maximal (10 Tage), bis wann Uebertrag verfaellt (31.03.), wie viel Vorlaufzeit ein Antrag braucht (0 Tage = sofort moeglich), maximale zusammenhaengende Urlaubstage (null = unbegrenzt).

| Spalte                      | Typ          | Bedeutung                                                         |
| --------------------------- | ------------ | ----------------------------------------------------------------- |
| `id`                        | UUID         | Primaerschluessel (UUIDv7)                                        |
| `tenant_id`                 | INTEGER      | Welche Firma                                                      |
| `default_annual_days`       | NUMERIC(4,1) | Standard-Jahresurlaub (Default: 30)                               |
| `max_carry_over_days`       | NUMERIC(4,1) | Max. Uebertrag ins naechste Jahr (Default: 10)                    |
| `carry_over_deadline_month` | INTEGER      | Monat bis wann Uebertrag genutzt werden muss (Default: 3 = Maerz) |
| `carry_over_deadline_day`   | INTEGER      | Tag des Deadline-Monats (Default: 31)                             |
| `advance_notice_days`       | INTEGER      | Mindest-Vorlaufzeit fuer Anträge in Tagen (Default: 0)            |
| `max_consecutive_days`      | INTEGER      | Max. zusammenhaengende Urlaubstage (NULL = unbegrenzt)            |

**Unique:** Genau eine Zeile pro Firma (`tenant_id`).

---

## Zusammenspiel

```
Mitarbeiter stellt Antrag
    |
    v
[holidays] ──→ Arbeitstage berechnen (Wochenenden + Feiertage raus)
    |
    v
[entitlements] ──→ Genug Resturlaub?
    |
    v
[blackouts] ──→ Urlaubssperre im Zeitraum?
    |
    v
[staffing_rules] ──→ Mindestbesetzung pro Maschine ok?
    |
    v
[settings] ──→ Vorlaufzeit eingehalten? Max. Tage ok?
    |
    v
Alles ok → Antrag landet als 'pending' in [requests]
    |
    v
Lead sieht Kapazität sanalyse → genehmigt/lehnt ab
    |
    v
[status_log] protokolliert jede Aenderung
```
