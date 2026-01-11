# Lead-ID Assignment Fix

> **Datum:** 2025-12-03
> **Status:** GELÖST
> **Betroffene Datei:** `backend/src/routes/v2/chat/chat-users.service.ts`

---

## Problem

Chat-Suche zeigte **keine Area/Department** für Admins an, obwohl diese als Leader zugewiesen waren.

```
Erwartet: "Aaron Swarz - Admin - Dosenabteilung"
Tatsächlich: "Aaron Swarz - Admin - [leer]"
```

---

## Ursache

Die Query berücksichtigte NUR:

- `admin_area_permissions` (explizite Permission)
- `admin_department_permissions` (explizite Permission)
- `user_departments` (Employee-Pfad)

**FEHLTE:** Die `lead_id` Spalten in `areas` und `departments` Tabellen!

```
areas.area_lead_id           → User ist Area-Leader
departments.department_lead_id → User ist Department-Leader
```

---

## Lösung (KISS)

Query erweitert um zusätzliche LEFT JOINs für Leader-Zuweisungen:

```sql
-- Lead path 1: areas.area_lead_id (user is area leader)
LEFT JOIN areas area_lead
  ON u.id = area_lead.area_lead_id
  AND area_lead.tenant_id = u.tenant_id

-- Lead path 2: departments.department_lead_id (user is dept leader)
LEFT JOIN departments dept_lead
  ON u.id = dept_lead.department_lead_id
  AND dept_lead.tenant_id = u.tenant_id
LEFT JOIN areas area_via_dept_lead
  ON dept_lead.area_id = area_via_dept_lead.id
```

COALESCE-Reihenfolge (Priorität):

```sql
-- Department
COALESCE(adp.department_id, dept_lead.id, ud.department_id)

-- Area
COALESCE(aap.area_id, area_lead.id, dep_admin.area_id, dept_lead.area_id, d.area_id)
```

---

## Zuweisungswege (Vollständig)

| Prio | Pfad                             | Beschreibung                |
| ---- | -------------------------------- | --------------------------- |
| 1    | `admin_area_permissions`         | Explizite Area-Berechtigung |
| 2    | `areas.area_lead_id`             | User ist Area-Leader        |
| 3    | `admin_department_permissions`   | Explizite Dept-Berechtigung |
| 4    | `departments.department_lead_id` | User ist Dept-Leader        |
| 5    | `user_departments`               | Employee-Zugehörigkeit      |

---

## Betroffene Rollen

| Rolle    | Kann Leader sein?         | Permission-Tabellen               |
| -------- | ------------------------- | --------------------------------- |
| Root     | Ja (area_lead, dept_lead) | Keine nötig (has_full_access)     |
| Admin    | Ja (area_lead, dept_lead) | admin_area/department_permissions |
| Employee | Nein                      | user_teams, user_departments      |

---

## Verwandte Docs

- [ULTIMATE-PERMISSION-SYSTEM-PLAN.md](./ULTIMATE-PERMISSION-SYSTEM-PLAN.md)
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md)
