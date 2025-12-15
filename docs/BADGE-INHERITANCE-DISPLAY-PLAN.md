# Badge Inheritance Display Plan

**Erstellt:** 2025-11-29
**Status:** ✅ COMPLETED
**Ziel:** Konsistente Anzeige von vererbten Berechtigungen in Admin/Employee Tables

---

## 1. Problem-Analyse

### 1.1 Aktueller Status (Inkonsistent)

**Admin ID 35844 - Beispiel:**
```
Direkte Zuweisungen in DB:
├── admin_area_permissions: 1 Eintrag (area_id=51, "Bereich 1")
├── admin_department_permissions: 0 Einträge
└── user_teams: 0 Einträge (Admin darf nicht in user_teams!)

UI zeigt aktuell:
├── Bereiche: "1 Bereich" ✅ korrekt
├── Abteilungen: "Keine Abteilungen" ❌ INKONSISTENT (sollte "Vererbt" zeigen)
└── Teams: "Vererbt" ✅ korrekt
```

### 1.2 Das Vererbungs-System

Gemäß `ULTIMATE-PERMISSION-SYSTEM-PLAN.md`:

```
ADMIN mit Area-Permission:
└── → sieht ALLE Departments in dieser Area (vererbt via dept.area_id)
    └── → sieht ALLE Teams in diesen Departments (vererbt via team.department_id)

ADMIN mit Department-Permission:
└── → sieht ALLE Teams in diesem Department (vererbt via team.department_id)

EMPLOYEE mit Team-Zuweisung:
└── → gehört zu Department (vererbt via team.department_id)
    └── → gehört zu Area (vererbt via dept.area_id)
```

### 1.3 Inkonsistenz-Details

| Badge | Aktuelle Logik | Problem |
|-------|----------------|---------|
| Areas (Admin) | Zeigt direkte Zuweisungen | OK |
| Teams (Admin) | Zeigt "Vererbt" wenn Areas/Depts | OK ✅ |
| **Departments (Admin)** | Zeigt NUR direkte Zuweisungen | **INKONSISTENT** ❌ |
| Areas (Employee) | Zeigt direkte (die es nicht gibt!) | Sollte Vererbung zeigen |
| Departments (Employee) | Zeigt direkte | Sollte Vererbung zeigen |
| Teams (Employee) | Zeigt zugewiesene Teams | OK ✅ |

---

## 2. Lösung: Konsistentes Badge-System

### 2.1 Admin Badge Logik

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         ADMIN BADGE ANZEIGE LOGIK                             ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  AREAS BADGE (unverändert):                                                   ║
║  ├── hasFullAccess → "🌍 Alle" (primary badge)                                ║
║  ├── areas.length > 0 → "X Bereich(e)" mit Tooltip (info badge)              ║
║  └── areas.length = 0 → "Keine" (secondary badge)                            ║
║                                                                               ║
║  DEPARTMENTS BADGE (ÄNDERN!):                                                 ║
║  ├── hasFullAccess → "🌍 Vollzugriff" (primary badge)                         ║
║  ├── depts > 0 && areas > 0 → "X Abtlg. + Vererbt" (info + sitemap icon)     ║
║  ├── depts > 0 && areas = 0 → "X Abteilung(en)" mit Tooltip (info badge)     ║
║  ├── depts = 0 && areas > 0 → "🔗 Vererbt" (info badge, sitemap icon) ← NEU! ║
║  └── depts = 0 && areas = 0 → "Keine Abteilungen" (danger badge)             ║
║                                                                               ║
║  TEAMS BADGE (bereits korrekt):                                               ║
║  ├── hasFullAccess → "🌍 Alle" (primary badge)                                ║
║  ├── hasAreas || hasDepts → "🔗 Vererbt" (info badge, sitemap icon)           ║
║  └── sonst → "Keine" (secondary badge)                                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 2.2 Employee Badge Logik

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       EMPLOYEE BADGE ANZEIGE LOGIK                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Employee Zuweisungs-Flow:                                                    ║
║  ├── Employee wird NUR Teams zugewiesen (user_teams)                          ║
║  ├── Department kommt vom Team (team.department_id) → VERERBT                 ║
║  └── Area kommt vom Department (dept.area_id) → VERERBT                       ║
║                                                                               ║
║  AREAS BADGE (ÄNDERN!):                                                       ║
║  ├── hasFullAccess → "🌍 Alle" (primary badge)                                ║
║  ├── teams.length > 0 → "🔗 Vererbt" (info badge) ← NEU!                      ║
║  └── sonst → "Keine" (secondary badge)                                        ║
║                                                                               ║
║  DEPARTMENTS BADGE (ÄNDERN!):                                                 ║
║  ├── hasFullAccess → "🌍 Alle" (primary badge)                                ║
║  ├── depts.length > 0 → "X Abteilung(en)" mit Tooltip (direkte Zugehörigk.)  ║
║  ├── teams.length > 0 → "🔗 Vererbt" (info badge) ← NEU!                      ║
║  └── sonst → "Keine" (secondary badge)                                        ║
║                                                                               ║
║  TEAMS BADGE (unverändert):                                                   ║
║  ├── hasFullAccess → "🌍 Alle" (primary badge)                                ║
║  ├── teams.length > 0 → "X Team(s)" mit Tooltip (info badge)                 ║
║  └── sonst → "Keine" (secondary badge)                                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 2.3 Beispiel-Anzeigen nach Implementierung

**Admin Table:**

| Szenario | Bereiche | Abteilungen | Teams |
|----------|----------|-------------|-------|
| Admin mit 1 Area | `1 Bereich` | `🔗 Vererbt` | `🔗 Vererbt` |
| Admin mit 2 Areas | `2 Bereiche` | `🔗 Vererbt` | `🔗 Vererbt` |
| Admin mit 1 Dept | `Keine` | `1 Abteilung` | `🔗 Vererbt` |
| Admin mit Area+Dept | `1 Bereich` | `1 Abtlg. + Vererbt` | `🔗 Vererbt` |
| Admin ohne Zuweisungen | `Keine` | `Keine Abteilungen` | `Keine` |
| Full Access | `🌍 Alle` | `🌍 Vollzugriff` | `🌍 Alle` |

**Employee Table:**

| Szenario | Bereiche | Abteilungen | Teams |
|----------|----------|-------------|-------|
| Employee mit 1 Team | `🔗 Vererbt` | `🔗 Vererbt` | `1 Team` |
| Employee mit 2 Teams | `🔗 Vererbt` | `🔗 Vererbt` | `2 Teams` |
| Employee mit Dept-Zugehörigkeit | `🔗 Vererbt` | `1 Abteilung` | `Keine` |
| Employee ohne Zuweisungen | `Keine` | `Keine` | `Keine` |

---

## 3. Implementierungs-Tasks

### Phase 1: Admin Badges

- [x] **3.1.1** `admins/forms.ts` - `getDepartmentsBadge()` ändern ✅
  - Vererbungslogik hinzufügen wenn `areas.length > 0`
  - Kombinierte Anzeige wenn `depts > 0 && areas > 0`

### Phase 2: Employee Badges

- [x] **3.2.1** `employees/ui.ts` - `getAreasBadge()` ändern ✅
  - "Vererbt" anzeigen wenn `teams.length > 0`

- [x] **3.2.2** `employees/ui.ts` - `getDepartmentsBadge()` ändern ✅
  - "Vererbt" anzeigen wenn `teams.length > 0` und keine direkten Depts

### Phase 3: Verification

- [x] **3.3.1** Build ausführen ✅
- [x] **3.3.2** Type-Check ausführen ✅
- [x] **3.3.3** Manueller Test: Admin mit nur Area-Zuweisung ✅

---

## 4. Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `frontend/src/scripts/manage/admins/forms.ts` | `getDepartmentsBadge()` |
| `frontend/src/scripts/manage/employees/ui.ts` | `getAreasBadge()`, `getDepartmentsBadge()` |

---

## 5. Fortschritt

```
Phase 1 - Admin Badges:    [x] (1/1)
Phase 2 - Employee Badges: [x] [x] (2/2)
Phase 3 - Verification:    [x] [x] [x] (3/3)

GESAMT: 6/6 Tasks ✅
```

---

**Status:** COMPLETED (2025-11-29)

## 6. Implementierte Änderungen

### admins/forms.ts - getDepartmentsBadge()
- Full access → "Vollzugriff" badge
- Direct depts + areas → "X Abtlg. + Vererbt" mit Tooltip
- Only direct depts → "X Abteilung(en)" mit Tooltip
- Only areas (inherited) → "🔗 Vererbt" mit sitemap icon
- Nothing → "Keine Abteilungen" danger badge

### employees/ui.ts - getAreasBadge()
- Full access → "Alle" badge
- Direct areas → "X Bereich(e)" mit Tooltip
- Teams (inherited via teams→depts→areas) → "🔗 Vererbt" mit Tooltip
- Nothing → "Keine" secondary badge

### employees/ui.ts - getDepartmentsBadge()
- Full access → "Alle" badge
- Direct departments → "X Abteilung(en)" mit Tooltip
- Teams (inherited via teams→depts) → "🔗 Vererbt" mit Tooltip
- Legacy fallback → departmentName badge
- Nothing → "Keine" secondary badge
