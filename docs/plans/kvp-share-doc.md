# KVP Sichtbarkeits- und Teilen-Logik

> **Version:** 1.0.0 | **Datum:** 2026-01-23 | **Status:** Spezifikation

---

## Grundprinzip

**Multi-Tenant-Isolation ist Pflicht!** Alle Abfragen müssen `tenant_id` filtern.

**Admin/Root haben KEINEN automatischen Vollzugriff** auf KVP - nur wenn `users.full_access = TRUE` in der DB.

---

## Hierarchie-Struktur

```
tenant_id (Firma)
  └── areas (area_lead_id)
       └── departments (department_lead_id, area_id)
            └── teams (team_lead_id, department_id)
                 └── users (via user_teams, user_departments)
```

---

## Sichtbarkeits-Stufen

### Stufe 1: Team-weit (DEFAULT)

**Wann:** Employee erstellt KVP → automatisch `org_level = 'team'`, `org_id = team_id`

**Wer sieht es:**
| Rolle | Sieht KVP? | Grund |
|-------|------------|-------|
| Creator (`submitted_by`) | ✅ JA | Eigener Vorschlag |
| Team-Mitglieder (`user_teams.team_id`) | ✅ JA | Gleiche Team-Zugehörigkeit |
| Team-Lead (`teams.team_lead_id`) | ✅ JA | Führt das Team |
| Department-Lead | ❌ NEIN | Nicht auf dieser Stufe |
| Area-Lead | ❌ NEIN | Nicht auf dieser Stufe |
| Admin/Root | ❌ NEIN | Kein automatischer Zugriff! |
| Admin/Root mit `full_access=TRUE` | ✅ JA | Explizites Flag |

**SQL-Bedingung:**

```sql
WHERE (
  s.submitted_by = :userId
  OR s.team_id IN (SELECT team_id FROM user_teams WHERE user_id = :userId)
  OR s.team_id IN (SELECT id FROM teams WHERE team_lead_id = :userId)
)
```

---

### Stufe 2: Abteilung-weit (Department)

**Wann:** Admin/Root teilt KVP auf Abteilungs-Ebene → `org_level = 'department'`, `org_id = department_id`

**Wer sieht es:**
| Rolle | Sieht KVP? | Grund |
|-------|------------|-------|
| **Alle von Stufe 1** | ✅ JA | Vererbung |
| Department-Mitglieder (`user_departments.department_id`) | ✅ JA | Direkte Zuordnung |
| Alle Teams im Department (`teams.department_id`) | ✅ JA | **Vererbung!** Team gehört zu Dept |
| Department-Lead (`departments.department_lead_id`) | ✅ JA | Führt die Abteilung |
| Area-Lead | ❌ NEIN | Nicht auf dieser Stufe |
| Admin/Root ohne `full_access` | ❌ NEIN | Kein automatischer Zugriff |

**SQL-Bedingung (zusätzlich zu Stufe 1):**

```sql
OR (
  s.org_level = 'department' AND (
    -- Direkte Department-Zuordnung
    s.org_id IN (SELECT department_id FROM user_departments WHERE user_id = :userId)
    -- User ist in einem Team das zu diesem Department gehört (VERERBUNG!)
    OR s.org_id IN (
      SELECT t.department_id
      FROM teams t
      JOIN user_teams ut ON ut.team_id = t.id
      WHERE ut.user_id = :userId
    )
    -- User ist Department-Lead
    OR s.org_id IN (SELECT id FROM departments WHERE department_lead_id = :userId)
  )
)
```

---

### Stufe 3: Bereich-weit (Area)

**Wann:** Admin/Root teilt KVP auf Bereichs-Ebene → `org_level = 'area'`, `org_id = area_id`

**Wer sieht es:**
| Rolle | Sieht KVP? | Grund |
|-------|------------|-------|
| **Alle von Stufe 1 + 2** | ✅ JA | Vererbung |
| Alle Departments in der Area | ✅ JA | **Vererbung!** Dept gehört zu Area |
| Alle Teams in Departments der Area | ✅ JA | **Doppelte Vererbung!** |
| Area-Lead (`areas.area_lead_id`) | ✅ JA | Führt den Bereich |
| Admin/Root ohne `full_access` | ❌ NEIN | Kein automatischer Zugriff |

**SQL-Bedingung (zusätzlich zu Stufe 1+2):**

```sql
OR (
  s.org_level = 'area' AND (
    -- User ist in einem Department das zu dieser Area gehört
    s.org_id IN (
      SELECT d.area_id
      FROM departments d
      JOIN user_departments ud ON ud.department_id = d.id
      WHERE ud.user_id = :userId
    )
    -- User ist in einem Team dessen Department zu dieser Area gehört (VERERBUNG!)
    OR s.org_id IN (
      SELECT d.area_id
      FROM departments d
      JOIN teams t ON t.department_id = d.id
      JOIN user_teams ut ON ut.team_id = t.id
      WHERE ut.user_id = :userId
    )
    -- User ist Area-Lead
    OR s.org_id IN (SELECT id FROM areas WHERE area_lead_id = :userId)
  )
)
```

---

### Stufe 4: Firmenweit (Company)

**Wann:** Admin/Root teilt KVP firmenweit → `org_level = 'company'`, `org_id = 0` (oder tenant_id)

**Wer sieht es:**
| Rolle | Sieht KVP? | Grund |
|-------|------------|-------|
| **ALLE User im Tenant** | ✅ JA | Firmenweit = alle |

**SQL-Bedingung:**

```sql
OR s.org_level = 'company'
```

---

## Vollständige SQL-Logik

```sql
-- Basis: Tenant-Isolation IMMER!
WHERE s.tenant_id = :tenantId
AND (
  -- Eigene Vorschläge (immer sichtbar)
  s.submitted_by = :userId

  -- Oder: umgesetzt (public für alle im Tenant)
  OR s.status = 'implemented'

  -- Oder: User hat has_full_access Flag (existiert bereits in DB!)
  OR EXISTS (SELECT 1 FROM users WHERE id = :userId AND has_full_access = TRUE)

  -- Stufe 1: Team-weit
  OR (
    s.org_level = 'team' AND (
      -- Team-Mitglied
      s.org_id IN (SELECT team_id FROM user_teams WHERE user_id = :userId)
      -- Team-Lead
      OR s.org_id IN (SELECT id FROM teams WHERE team_lead_id = :userId)
    )
  )

  -- Stufe 2: Department-weit (inkl. Vererbung von Teams)
  OR (
    s.org_level = 'department' AND (
      -- Direkte Department-Zuordnung
      s.org_id IN (SELECT department_id FROM user_departments WHERE user_id = :userId)
      -- Team gehört zu Department (VERERBUNG)
      OR s.org_id IN (
        SELECT t.department_id FROM teams t
        JOIN user_teams ut ON ut.team_id = t.id
        WHERE ut.user_id = :userId
      )
      -- Department-Lead
      OR s.org_id IN (SELECT id FROM departments WHERE department_lead_id = :userId)
    )
  )

  -- Stufe 3: Area-weit (inkl. Vererbung von Departments und Teams)
  OR (
    s.org_level = 'area' AND (
      -- Department gehört zu Area
      s.org_id IN (
        SELECT d.area_id FROM departments d
        JOIN user_departments ud ON ud.department_id = d.id
        WHERE ud.user_id = :userId
      )
      -- Team → Department → Area (DOPPELTE VERERBUNG)
      OR s.org_id IN (
        SELECT d.area_id FROM departments d
        JOIN teams t ON t.department_id = d.id
        JOIN user_teams ut ON ut.team_id = t.id
        WHERE ut.user_id = :userId
      )
      -- Area-Lead
      OR s.org_id IN (SELECT id FROM areas WHERE area_lead_id = :userId)
    )
  )

  -- Stufe 4: Firmenweit
  OR s.org_level = 'company'
)
```

---

## Teilen-Berechtigungen

| Aktion                | Wer darf?                                       |
| --------------------- | ----------------------------------------------- |
| KVP erstellen         | Employee (in seinem Team)                       |
| Auf Team teilen       | Admin, Root                                     |
| Auf Department teilen | Admin, Root                                     |
| Auf Area teilen       | Admin, Root                                     |
| Firmenweit teilen     | Admin, Root                                     |
| Teilen rückgängig     | Admin, Root, oder wer geteilt hat (`shared_by`) |

---

## Datenbank-Felder (kvp_suggestions)

| Feld        | Typ       | Beschreibung                                   |
| ----------- | --------- | ---------------------------------------------- |
| `org_level` | ENUM      | 'team', 'department', 'area', 'company'        |
| `org_id`    | INTEGER   | ID des Teams/Departments/Areas (0 für company) |
| `is_shared` | BOOLEAN   | TRUE wenn explizit geteilt (nicht nur default) |
| `shared_by` | INTEGER   | User-ID wer geteilt hat                        |
| `shared_at` | TIMESTAMP | Wann geteilt wurde                             |
| `team_id`   | INTEGER   | Original-Team (für Rückgängig)                 |

---

## Wichtige Hinweise

1. **Vererbung ist KEY**: Team-Mitglied sieht Department-KVP wenn sein Team zu dem Department gehört!

2. **`has_full_access = TRUE` = Globaler Override**
   - User mit diesem Flag kann ALLES sehen, schreiben und löschen (Read, Write, Delete)
   - Gilt für KVP und alle anderen Features
   - **SPÄTER:** In Einstellungen pro Feature konfigurierbar (z.B. "KVP: Admins sehen alle Vorschläge" abwählbar)

3. **Implementierte KVPs**: Immer sichtbar für alle im Tenant (Best Practices teilen)

4. **Creator sieht immer**: Eigene Vorschläge sind immer sichtbar

5. **Leads bekommen automatisch Zugriff**: team_lead_id, department_lead_id, area_lead_id

---

## Änderungen am aktuellen Code

### kvp.service.ts - getUserOrgInfo erweitern

Aktuell gibt nur zurück:

```typescript
{
  (team_id, department_id, area_id);
}
```

Muss erweitert werden um:

- Teams wo User Lead ist
- Departments wo User Lead ist
- Areas wo User Lead ist
- Team's Department (für Vererbung)
- Department's Area (für Vererbung)

### kvp.service.ts - buildEmployeeVisibility komplett neu

Die aktuelle Implementierung prüft nur direkte Zugehörigkeit, nicht die Vererbung!

---

## Diagramm: Sichtbarkeits-Vererbung

```
┌─────────────────────────────────────────────────────────────────┐
│                     STUFE 4: COMPANY                             │
│                   (Alle im Tenant sehen)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌──────────────────────────────────────────────────────┐     │
│    │                  STUFE 3: AREA                        │     │
│    │   (Area-Lead + alle Depts + alle Teams in Depts)     │     │
│    ├──────────────────────────────────────────────────────┤     │
│    │                                                       │     │
│    │   ┌────────────────────────────────────────────┐     │     │
│    │   │            STUFE 2: DEPARTMENT              │     │     │
│    │   │  (Dept-Lead + Dept-Members + alle Teams)   │     │     │
│    │   ├────────────────────────────────────────────┤     │     │
│    │   │                                             │     │     │
│    │   │   ┌──────────────────────────────────┐     │     │     │
│    │   │   │        STUFE 1: TEAM (DEFAULT)   │     │     │     │
│    │   │   │   (Creator + Team-Lead + Members)│     │     │     │
│    │   │   └──────────────────────────────────┘     │     │     │
│    │   │                                             │     │     │
│    │   └────────────────────────────────────────────┘     │     │
│    │                                                       │     │
│    └──────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Vererbung: Team ⊂ Department ⊂ Area ⊂ Company
```

---

**Nächste Schritte:**

1. [x] `users.has_full_access` Spalte prüfen - **EXISTIERT BEREITS!** (boolean)
2. [x] `getExtendedUserOrgInfo()` erstellt - sammelt alle Memberships, Lead-Positionen und Vererbungsketten
3. [x] `buildVisibilityClause()` komplett neu geschrieben - ersetzt `buildEmployeeVisibility()`
4. [x] `listSuggestions()` aktualisiert - Visibility für ALLE User (nicht nur Employees)
5. [x] `getSuggestionById()` aktualisiert - Visibility für ALLE User
6. [x] `getUnconfirmedCount()` aktualisiert - Visibility für ALLE User
7. [x] `getAttachment()` aktualisiert - gleiche Visibility-Regeln wie KVP
8. [x] `hasExtendedOrgAccess()` erstellt - prüft Zugriff mit Vererbung
9. [ ] Frontend anpassen (Share-Modal zeigt nur erlaubte Optionen) - **OPTIONAL**
10. [ ] Tests schreiben für alle 4 Stufen
        alert info design sysetm kompnente
