# Assignment System - Analyse

**Erstellt:** 2025-11-27
**Status:** IST-Zustand Dokumentation

---

## 1. Rollen-Hierarchie

```
ROOT        → Voller Zugriff auf ganzen Tenant
ADMIN       → Root vergibt Zugriff
EMPLOYEE    → Admin vergibt Zugriff
```

---

## 2. Entities im System

| Entity           | Tabelle             | Hat Hierarchie?                |
| ---------------- | ------------------- | ------------------------------ |
| Area             | `areas`             | Ja (parent_id)                 |
| Department       | `departments`       | Nein (nur area_id)             |
| Department Group | `department_groups` | Ja (parent_group_id)           |
| Team             | `teams`             | Nein (nur department_id)       |
| Machine          | `machines`          | Nein (area_id + department_id) |
| User             | `users`             | Nein (nur department_id)       |

---

## 3. Aktuelle Zuweisungs-Tabellen

### Was EXISTIERT:

| Tabelle                        | Zweck              | Felder                                              |
| ------------------------------ | ------------------ | --------------------------------------------------- |
| `admin_department_permissions` | Admin → Department | admin_user_id, department_id, can_read/write/delete |
| `admin_group_permissions`      | Admin → Dept Group | admin_user_id, group_id, can_read/write/delete      |
| `user_teams`                   | User → Team        | user_id, team_id, role (member/lead)                |
| `users.department_id`          | User → Department  | Direkt in users Tabelle (1:1)                       |

### Was FEHLT:

| Tabelle                  | Zweck                   |
| ------------------------ | ----------------------- |
| `admin_area_permissions` | Admin → Area            |
| `admin_team_permissions` | Admin → Team            |
| `employee_*_permissions` | Employee Berechtigungen |

---

## 4. Code-Verhalten (Aktuell)

### departmentAccess.ts (Zeile 128-132):

```typescript
// Root and employees bypass department checks
if (user.role === 'root' || user.role === 'employee') {
  next(); // KEIN CHECK!
  return;
}
```

**Bedeutung:**

- ROOT: Bypassed alle Checks ✅ (gewollt)
- EMPLOYEE: Bypassed alle Checks ❌ (Problem?)
- ADMIN: Wird gegen `admin_department_permissions` geprüft ✅

---

## 5. Beziehungs-Diagramm (Vereinfacht)

```
TENANT
│
├── AREA ─────────────────┐
│   └── (parent_id)       │ area_id
│                         ▼
├── DEPARTMENT ◄──────────┘
│   │
│   ├── admin_department_permissions (Admin Zugriff)
│   ├── users.department_id (User Zuordnung)
│   │
│   └──► TEAM
│         └── user_teams (User Mitgliedschaft)
│
├── DEPARTMENT GROUP
│   ├── (parent_group_id)
│   ├── department_group_members (N:M zu Departments)
│   └── admin_group_permissions (Admin Zugriff)
│
└── MACHINE
    ├── area_id (Standort)
    ├── department_id (Zuständigkeit)
    └── machine_teams (N:M zu Teams)
```

---

## 6. Offene Fragen

1. **Area-Zuweisung:** Soll Admin auf Area-Ebene berechtigt werden können?

2. **Hierarchie-Vererbung:** Wenn Admin Area-Zugriff hat, hat er dann automatisch Zugriff auf alle Departments in der Area?

3. **Employee Permissions:** Wie soll Employee-Zugriff funktionieren?
   - Option A: Nur eigenes Department sehen
   - Option B: Explicit permissions wie Admin
   - Option C: Durch Team-Mitgliedschaft bestimmt

4. **Team-Zuweisung für Admins:** Brauchen Admins direkten Team-Zugriff oder reicht Department-Ebene?

5. **Machine-Zugriff:** Über Area, Department, oder Team?

---

## 7. Zusammenfassung

### Funktioniert:

- Admin → Department Zuweisung
- Admin → Department Group Zuweisung
- User → Team Mitgliedschaft
- User → Department Zuordnung (1:1)

### Fehlt:

- Admin → Area Zuweisung
- Admin → Team Zuweisung
- Employee Permission System
- Klare Hierarchie-Vererbungs-Logik

---

**Nächster Schritt:** Deine Concerns und gewünschtes Verhalten definieren.
