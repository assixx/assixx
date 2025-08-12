# 🎯 SHIFT V2 ULTIMATE PLAN - OPTIMIZED

> **Erstellt:** 28.01.2025
> **Aktualisiert:** 09.02.2025
> **Version:** 2.1 (Mit Hierarchie-Foundation)
> **Priorität:** KRITISCH
> **Geschätzte Zeit:** 3-4 Tage

## 📝 UPDATE 09.02.2025 - Was wurde gemacht?

### ✅ ERLEDIGT - Hierarchie Foundation

1. **Area → Department Beziehung:**
   - `area_id` in departments Tabelle funktioniert = "Testarea"
   - Frontend sendet korrekt `areaId` (camelCase)
   - Backend speichert als `area_id` (snake_case)
   - V2 API vollständig implementiert

2. **User → Teams Beziehung:**
   - `user_teams` Junction-Tabelle implementiert
   - Team-Erstellung mit User-Zuweisung funktioniert
   - Multiple User können einem Team zugewiesen werden
   - Role-based assignment (member, lead, etc.)

3. **Machine → Teams Beziehung:**
   - `machine_teams` Junction-Tabelle existiert bereits
   - Teams können Maschinen zugewiesen bekommen
   - Many-to-Many Beziehung funktioniert

4. **Aktuelle Hierarchie-Struktur:**
   ```
   Areas (Bereiche)
   └── Departments (Abteilungen) [area_id]
       ├── Teams [department_id]
       │   ├── Users (via user_teams)
       │   └── Machines (via machine_teams)
       └── Users (direkt via department_id)
   ```

### ⚠️ NOCH OFFEN

- Employee Modal Dropdown-Bug (reagiert nicht auf Klicks) -> wurde 11.08.2025 gefixed siehe dropdown css bug fix.md und bug id mismatch.md
- Shift-System noch nicht angefangen
- Test-Daten für Teams/Maschinen fehlen

### 🎯 NÄCHSTE SCHRITTE

- Phase 1: Database Foundation fortsetzen
- Migration für `machine_id` in shifts Tabelle
- Test-Daten erstellen für vollständige Hierarchie

## 🏭 Real-World Workflow Verständnis

### Beispiel-Szenario: Firma mit 3 Abteilungen

```
FIRMA X
├── Abteilung: Produktion
│   ├── Maschinen: CNC-01, CNC-02, Laser-01
│   ├── Teams:
│   │   ├── Frühschicht-Team (3 Personen)
│   │   ├── Spätschicht-Team (3 Personen)
│   │   └── Nachtschicht-Team (3 Personen)
│   └── Mitarbeiter: 9 Total
│
├── Abteilung: Verpackung
│   ├── Maschinen: Pack-01, Pack-02
│   ├── Teams:
│   │   └── Verpackungs-Team (5 Personen)
│   └── Mitarbeiter: 5 Total
│
└── Abteilung: Qualitätskontrolle
    ├── Maschinen: QC-Scanner-01
    ├── Teams:
    │   └── QC-Team (2 Personen)
    └── Mitarbeiter: 2 Total
```

### Der Schichtplanungs-Workflow

**Als Bereichsleiter/Admin möchte ich:**

1. **Abteilung wählen** → "Produktion"
2. **Maschine wählen** → "CNC-01"
3. **Team wählen** → "Spätschicht-Team" (3 Personen: Anna, Bob, Chris)
4. **Personen sehen** → System zeigt Anna, Bob, Chris
5. **Drag & Drop Planung:**
   - Anna → Montag Frühschicht an CNC-01
   - Bob → Montag Spätschicht an CNC-01
   - Chris → Montag Nachtschicht an CNC-01
   - (Wiederhole für ganze Woche)

## 📊 Datenbank-Analyse (AKTUELL)

### Was wir haben ✅

```sql
shifts Tabelle:
- department_id ✅ (NOT NULL)
- team_id ✅ (nullable)
- user_id ✅ (Mitarbeiter)
- machine_id ❌ (FEHLT!)
```

### Was wir brauchen 🎯

```sql
shifts Tabelle MUSS haben:
- department_id (Abteilung)
- team_id (Team für Vorauswahl)
- machine_id (WO arbeitet die Person)
- user_id (WER arbeitet)
- date + start_time + end_time (WANN)
```

## 🔍 Problem-Analyse AKTUALISIERT (09.02.2025)

### 1. UI/UX Probleme

- **shifts.html hat NUR:** Department + Machine Filter
- **FEHLT:** Team Filter (kritisch für Workflow!)
- **FEHLT:** Drag & Drop für Personen-Zuweisung
- **FEHLT:** Wochenansicht mit allen Maschinen
- **BUG:** Employee Modal Dropdown reagiert nicht (trotz korrekter Daten)

### 2. Daten-Probleme

- **1 Team** in DB → Minimal testbar ✅
- **0 Maschinen** in DB → Kann nicht testen ❌
- **Keine Test-Mitarbeiter** mit Team-Zuordnung → Aber System bereit ✅

### 3. Business Logic Gaps ✅ GELÖST

- ✅ Mitarbeiter → Teams: `user_teams` Tabelle implementiert
- ✅ Maschinen → Teams: `machine_teams` Tabelle existiert
- ✅ Teams → Abteilungen: `teams.department_id` funktioniert
- ✅ Abteilungen → Areas: `departments.area_id` funktioniert
- ❌ Shifts → Machines: `shifts.machine_id` FEHLT noch!

## 📋 OPTIMIERTER 5-PHASEN-PLAN

### 🚦 STATUS ÜBERSICHT

- **Phase 0:** Hierarchie-Foundation ✅ ERLEDIGT (09.02.2025)
- **Phase 1:** Database Foundation 🔄 IN ARBEIT
- **Phase 2:** Test Data Setup ⏳ AUSSTEHEND
- **Phase 3:** 🧪 VOLLSTÄNDIGER HIERARCHIE-TEST ⚠️ KRITISCH (STOPP-PUNKT!)
- **Phase 4:** UI Implementation (Machines & Teams) ⏳ NUR NACH TEST!
- **Phase 5:** Enhanced Shift Planning UI ⏳ NUR NACH TEST!
- **Phase 6:** API Migration & Final Testing ⏳ AUSSTEHEND

## PHASE 0: Hierarchie-Foundation ✅ ERLEDIGT

**Status:** Abgeschlossen am 09.02.2025

- Area → Department → Team/Machine → User Hierarchie implementiert
- Junction Tables (user_teams, machine_teams) funktionieren
- V2 API unterstützt alle Beziehungen

## PHASE 1: Database Foundation 🔧

**Zeit:** 2 Stunden
**Status:** 🔄 IN ARBEIT
**Kritisch:** Security + Features

### Migration File: `004-shift-system-complete.sql`

```sql
-- =====================================================
-- SHIFT SYSTEM COMPLETE FIX
-- =====================================================

-- 1. Add machine_id to shifts (CRITICAL for machine assignment)
ALTER TABLE shifts
ADD COLUMN machine_id INT DEFAULT NULL AFTER team_id,
ADD CONSTRAINT fk_shifts_machine
    FOREIGN KEY (machine_id) REFERENCES machines(id)
    ON DELETE SET NULL,
ADD INDEX idx_shifts_machine (machine_id),
ADD INDEX idx_shifts_dept_team_machine (department_id, team_id, machine_id);

-- 2. Fix Multi-Tenant Isolation (SECURITY CRITICAL!)
ALTER TABLE shift_group_members
ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id,
ADD INDEX idx_sgm_tenant (tenant_id);

ALTER TABLE shift_notes
ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id,
ADD INDEX idx_sn_tenant (tenant_id);

ALTER TABLE shift_pattern_assignments
ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id,
ADD INDEX idx_spa_tenant (tenant_id);

ALTER TABLE shift_swaps
ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id,
ADD INDEX idx_ss_tenant (tenant_id);

-- 3. Ensure proper relationships
ALTER TABLE machines
ADD INDEX idx_machines_dept (department_id);

ALTER TABLE teams
ADD INDEX idx_teams_dept (department_id);

ALTER TABLE user_teams
ADD INDEX idx_user_teams_team (team_id),
ADD INDEX idx_user_teams_user (user_id);

-- 4. Add shift types enum if missing
ALTER TABLE shifts
MODIFY COLUMN type ENUM('early','late','night','day','flexible','standby','vacation','sick','holiday')
DEFAULT 'day';
```

## PHASE 2: Test Data Creation 📊

**Zeit:** 1 Stunde
**Muss VOR UI Implementation!**

### 2.1 Create Departments (falls nicht vorhanden)

```sql
-- Check existing departments
SELECT * FROM departments WHERE tenant_id = 8;

-- Create if needed
INSERT INTO departments (tenant_id, name, description) VALUES
(8, 'Produktion', 'Hauptproduktionsbereich'),
(8, 'Verpackung', 'Verpackung und Versand'),
(8, 'Qualitätskontrolle', 'QC und Testing');
```

### 2.2 Create Machines

```sql
INSERT INTO machines (tenant_id, name, model, manufacturer, department_id, status, machine_type) VALUES
-- Produktion (dept_id = 1)
(8, 'CNC-01', 'DMG MORI CMX 600', 'DMG MORI', 1, 'operational', 'production'),
(8, 'CNC-02', 'DMG MORI CMX 800', 'DMG MORI', 1, 'operational', 'production'),
(8, 'Laser-01', 'TruLaser 3030', 'TRUMPF', 1, 'operational', 'production'),
-- Verpackung (dept_id = 2)
(8, 'Pack-01', 'PackMaster 3000', 'Bosch', 2, 'operational', 'packaging'),
(8, 'Pack-02', 'PackMaster 3000', 'Bosch', 2, 'maintenance', 'packaging'),
-- QC (dept_id = 3)
(8, 'QC-Scanner-01', 'InspectPro X1', 'Zeiss', 3, 'operational', 'quality_control');
```

### 2.3 Create Teams

```sql
INSERT INTO teams (tenant_id, department_id, name, description, team_lead_id) VALUES
-- Produktion Teams
(8, 1, 'Frühschicht-Team', 'Frühschicht 06:00-14:00', NULL),
(8, 1, 'Spätschicht-Team', 'Spätschicht 14:00-22:00', NULL),
(8, 1, 'Nachtschicht-Team', 'Nachtschicht 22:00-06:00', NULL),
-- Verpackung Team
(8, 2, 'Verpackungs-Team', 'Hauptteam Verpackung', NULL),
-- QC Team
(8, 3, 'QC-Team', 'Qualitätskontrolle Team', NULL);
```

### 2.4 Create Test Users & Assign to Teams

```sql
-- Create test employees if not exist
INSERT INTO users (tenant_id, username, email, password_hash, first_name, last_name, role, department_id) VALUES
-- Spätschicht-Team Members
(8, 'anna.mueller', 'anna@example.com', '$2b$10$...', 'Anna', 'Müller', 'employee', 1),
(8, 'bob.schmidt', 'bob@example.com', '$2b$10$...', 'Bob', 'Schmidt', 'employee', 1),
(8, 'chris.weber', 'chris@example.com', '$2b$10$...', 'Chris', 'Weber', 'employee', 1),
-- Frühschicht-Team Members
(8, 'diana.meyer', 'diana@example.com', '$2b$10$...', 'Diana', 'Meyer', 'employee', 1),
(8, 'erik.wagner', 'erik@example.com', '$2b$10$...', 'Erik', 'Wagner', 'employee', 1),
(8, 'frank.becker', 'frank@example.com', '$2b$10$...', 'Frank', 'Becker', 'employee', 1);

-- Assign to teams (assume user IDs 20-25)
INSERT INTO user_teams (user_id, team_id, role, joined_at) VALUES
-- Spätschicht-Team (team_id = 2)
(20, 2, 'member', NOW()),
(21, 2, 'member', NOW()),
(22, 2, 'member', NOW()),
-- Frühschicht-Team (team_id = 1)
(23, 1, 'member', NOW()),
(24, 1, 'member', NOW()),
(25, 1, 'member', NOW());
```

## PHASE 3: 🧪 VOLLSTÄNDIGER HIERARCHIE-TEST (KRITISCH!)

**Zeit:** 1-2 Stunden
**⚠️ STOPP:** Erst testen, dann weitermachen!

### Test-Protokoll:

```bash
# Nach jedem Schritt: DB prüfen!
docker exec assixx-mysql mysql -u assixx_user -pAssixxP@ss2025! main

# Prüfungen:
SELECT * FROM areas WHERE name = 'Werk Nord';
SELECT * FROM departments WHERE area_id IS NOT NULL;
SELECT * FROM teams WHERE department_id IS NOT NULL;
SELECT * FROM user_teams WHERE team_id IS NOT NULL;
SELECT * FROM machine_teams WHERE team_id IS NOT NULL;
SELECT * FROM machines WHERE department_id IS NOT NULL;
```

### ✅ Erfolgskriterien für Phase 4:

- [ ] Alle Hierarchie-Ebenen korrekt verknüpft
- [ ] Junction Tables funktionieren (user_teams, machine_teams)
- [ ] Keine NULL-Werte wo Beziehungen erwartet werden
- [ ] Frontend zeigt alle Verknüpfungen korrekt an
- [ ] Employee Modal Dropdown MUSS funktionieren!

**NUR wenn ALLE Tests ✅ → Phase 4 starten!**

## PHASE 4: UI Implementation - Machines & Teams 🎨

**Zeit:** 8 Stunden
**VORAUSSETZUNG:** Phase 3 Tests bestanden!

### 3.1 Machines Management (`/admin-dashboard?section=machines`)

**Features:**

- Liste aller Maschinen mit Status-Anzeige
- Filter nach Abteilung, Status, Typ
- CRUD Operations
- QR-Code für jede Maschine
- Wartungsplan-Kalender
- Auslastungs-Statistik

**Key Implementation:**

```typescript
// machines-admin.ts
interface Machine {
  id: number;
  name: string;
  model: string;
  departmentId: number;
  departmentName?: string;
  status: "operational" | "maintenance" | "repair" | "standby";
  nextMaintenance?: Date;
  operatingHours: number;
  qrCode?: string;
}

class MachinesManager {
  async loadMachines(departmentId?: number) {
    const response = await apiClient.get("/api/v2/machines", {
      params: { departmentId },
    });
    return response.data;
  }

  generateQRCode(machineId: number) {
    return `https://api.qrserver.com/v1/create-qr-code/?data=MACHINE-${machineId}`;
  }
}
```

### 3.2 Teams Management (`/admin-dashboard?section=teams`)

**Features:**

- Teams nach Abteilung gruppiert
- Mitglieder-Verwaltung (Drag & Drop)
- Team-Kapazität Anzeige
- Schicht-Präferenzen
- Team-Leader Assignment

**Key Implementation:**

```typescript
// teams-admin.ts
interface Team {
  id: number;
  name: string;
  departmentId: number;
  departmentName?: string;
  teamLeadId?: number;
  members: TeamMember[];
  shiftPreference?: "early" | "late" | "night" | "flexible";
}

interface TeamMember {
  userId: number;
  userName: string;
  role: "leader" | "member";
  availability: "available" | "vacation" | "sick";
}

class TeamsManager {
  async loadTeams(departmentId?: number) {
    const response = await apiClient.get("/api/v2/teams", {
      params: { departmentId },
    });
    return response.data;
  }

  async addMember(teamId: number, userId: number) {
    return apiClient.post(`/api/v2/teams/${teamId}/members`, {
      userId,
    });
  }
}
```

### 3.3 Sidebar Navigation Update

```typescript
// unified-navigation.ts
const adminMenuItems = [
  // ... existing items ...
  {
    icon: "fa-users-cog",
    label: "Teams",
    href: "/admin-dashboard?section=teams",
    badge: teamCount, // Show team count
  },
  {
    icon: "fa-cogs",
    label: "Maschinen",
    href: "/admin-dashboard?section=machines",
    badge: machineCount, // Show machine count
  },
  // ... rest ...
];
```

## PHASE 5: Enhanced Shift Planning UI 🗓️

**Zeit:** 6 Stunden
**⚠️ VORAUSSETZUNG:** Phase 3 Tests ALLE bestanden!

### 4.1 Erweiterte shifts.html

```html
<!-- Filter Section mit 3 Dropdowns -->
<div class="shift-filters">
  <!-- 1. Department Selection -->
  <div class="filter-item">
    <label>Abteilung</label>
    <select id="departmentSelect">
      <option value="">Abteilung wählen...</option>
    </select>
  </div>

  <!-- 2. Machine Multi-Select -->
  <div class="filter-item">
    <label>Maschine(n)</label>
    <div class="multi-select" id="machineSelect">
      <div class="selected-items"></div>
      <button class="select-trigger">Maschinen wählen...</button>
    </div>
  </div>

  <!-- 3. Team Selection -->
  <div class="filter-item">
    <label>Team</label>
    <select id="teamSelect">
      <option value="">Team wählen...</option>
    </select>
  </div>
</div>

<!-- Team Members Panel (Drag Source) -->
<div class="team-members-panel">
  <h3>Team-Mitglieder</h3>
  <div id="availableMembers" class="member-list">
    <!-- Draggable member cards -->
  </div>
</div>

<!-- Weekly Shift Grid (Drop Target) -->
<div class="shift-grid">
  <table>
    <thead>
      <tr>
        <th>Maschine</th>
        <th>Schicht</th>
        <th>Mo</th>
        <th>Di</th>
        <th>Mi</th>
        <th>Do</th>
        <th>Fr</th>
        <th>Sa</th>
        <th>So</th>
      </tr>
    </thead>
    <tbody id="shiftGridBody">
      <!-- Generated rows per machine & shift type -->
    </tbody>
  </table>
</div>
```

### 4.2 Enhanced shifts.ts mit Drag & Drop

```typescript
class EnhancedShiftPlanning {
  private selectedDepartment: number | null = null;
  private selectedMachines: number[] = [];
  private selectedTeam: number | null = null;
  private teamMembers: TeamMember[] = [];
  private weeklyShifts: Map<string, ShiftAssignment> = new Map();

  async onTeamSelected(teamId: number) {
    // Load team members
    this.teamMembers = await this.loadTeamMembers(teamId);
    this.renderAvailableMembers();
    this.initDragAndDrop();
  }

  renderAvailableMembers() {
    const container = document.getElementById("availableMembers");
    container.innerHTML = this.teamMembers
      .map(
        (member) => `
      <div class="member-card" draggable="true" data-user-id="${member.userId}">
        <img src="${member.avatar}" alt="${member.name}">
        <div class="member-info">
          <div class="name">${member.name}</div>
          <div class="status ${member.availability}">${member.availability}</div>
        </div>
      </div>
    `,
      )
      .join("");
  }

  initDragAndDrop() {
    // Draggable members
    document.querySelectorAll(".member-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("userId", card.dataset.userId);
        card.classList.add("dragging");
      });
    });

    // Droppable shift cells
    document.querySelectorAll(".shift-cell").forEach((cell) => {
      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        cell.classList.add("drag-over");
      });

      cell.addEventListener("drop", async (e) => {
        e.preventDefault();
        const userId = e.dataTransfer.getData("userId");
        const machineId = cell.dataset.machineId;
        const date = cell.dataset.date;
        const shiftType = cell.dataset.shiftType;

        await this.assignShift(userId, machineId, date, shiftType);
        this.updateCell(cell, userId);
      });
    });
  }

  async assignShift(userId: number, machineId: number, date: string, shiftType: string) {
    const response = await apiClient.post("/api/v2/shifts", {
      userId,
      machineId,
      departmentId: this.selectedDepartment,
      teamId: this.selectedTeam,
      date,
      type: shiftType,
      startTime: this.getShiftStartTime(shiftType),
      endTime: this.getShiftEndTime(shiftType),
    });

    showSuccess(`Schicht zugewiesen: ${response.data.userName} → ${date} ${shiftType}`);
  }

  getShiftStartTime(type: string): string {
    const times = {
      early: "06:00",
      late: "14:00",
      night: "22:00",
    };
    return times[type] || "08:00";
  }

  getShiftEndTime(type: string): string {
    const times = {
      early: "14:00",
      late: "22:00",
      night: "06:00",
    };
    return times[type] || "17:00";
  }
}
```

## PHASE 6: Shifts v2 API Migration & Final Testing 🚀

**Zeit:** 4 Stunden
**VORAUSSETZUNG:** Alle vorherigen Phasen erfolgreich!

### 5.1 Feature Flag Implementation

```typescript
// shifts.ts
import { featureFlags } from "../utils/feature-flags";

class ShiftPlanningSystem {
  private useV2: boolean;

  constructor() {
    this.useV2 = featureFlags.isEnabled("USE_API_V2_SHIFTS");
  }

  async loadShifts(filters: ShiftFilters) {
    if (this.useV2) {
      return this.loadShiftsV2(filters);
    }
    return this.loadShiftsV1(filters);
  }

  private async loadShiftsV2(filters: ShiftFilters) {
    const response = await apiClient.get("/api/v2/shifts", {
      params: {
        departmentId: filters.departmentId,
        teamId: filters.teamId,
        machineId: filters.machineId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    });

    // Map v2 response to UI format
    return response.data.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user?.name,
      machineId: shift.machineId,
      machineName: shift.machine?.name,
      date: shift.date,
      type: shift.type,
      status: shift.status,
    }));
  }
}
```

### 5.2 Complete Integration Test

```typescript
// Test complete workflow
async function testShiftWorkflow() {
  // 1. Select department
  await shiftPlanner.selectDepartment(1); // Produktion

  // 2. Select machines
  await shiftPlanner.selectMachines([1, 2]); // CNC-01, CNC-02

  // 3. Select team
  await shiftPlanner.selectTeam(2); // Spätschicht-Team

  // 4. Verify members loaded
  assert(shiftPlanner.teamMembers.length === 3);

  // 5. Simulate drag & drop
  await shiftPlanner.assignShift(
    20, // Anna
    1, // CNC-01
    "2025-01-29",
    "late",
  );

  // 6. Verify assignment
  const shifts = await shiftPlanner.loadShifts({
    date: "2025-01-29",
  });
  assert(shifts.length > 0);
  assert(shifts[0].userId === 20);
}
```

## 🎯 Success Metrics

### User Story Completion

- [ ] Admin kann Abteilung wählen
- [ ] Admin kann Maschine(n) wählen
- [ ] Admin kann Team wählen
- [ ] Admin sieht Team-Mitglieder
- [ ] Admin kann per Drag & Drop Schichten zuweisen
- [ ] Zuweisungen werden in DB gespeichert
- [ ] Schichtplan ist visuell übersichtlich

### Technical Metrics

- [ ] Alle Tabellen haben tenant_id
- [ ] shifts hat machine_id
- [ ] Teams UI funktioniert
- [ ] Machines UI funktioniert
- [ ] Drag & Drop funktioniert
- [ ] v2 API ist integriert
- [ ] Performance < 200ms

## 📅 Neue Timeline

| Phase | Was                 | Dauer | Priorität |
| ----- | ------------------- | ----- | --------- |
| 1     | DB Migration        | 2h    | KRITISCH  |
| 2     | Test Data           | 1h    | HOCH      |
| 3     | Machines & Teams UI | 8h    | HOCH      |
| 4     | Enhanced Shift UI   | 6h    | HOCH      |
| 5     | v2 API Migration    | 4h    | MITTEL    |

**Total: 21 Stunden (3 Arbeitstage)**

## 🚨 Critical Path

```
1. DB Migration (Security!)
    ↓
2. Test Data (Can't test without)
    ↓
3. UI Implementation (Foundation)
    ↓
4. Enhanced Shifts (Core Feature)
    ↓
5. API Migration (Optimization)
```

---

## 📅 NÄCHSTE SCHRITTE FÜR 10.02.2025

### 1. SOFORT: Employee Modal Dropdown Fix

```javascript
// Problem: Dropdown reagiert nicht auf Klicks
// Lösung: Event Delegation Pattern von calendar.ts kopieren
// Datei: admin-dashboard.html
```

### 2. DANN: Phase 1 fortsetzen - DB Migration

```sql
-- Migration 004-shift-system-complete.sql
-- ADD machine_id to shifts table
ALTER TABLE shifts ADD COLUMN machine_id INT AFTER team_id;
ALTER TABLE shifts ADD CONSTRAINT fk_shifts_machine
  FOREIGN KEY (machine_id) REFERENCES machines(id);
```

### 3. DANACH: Test-Daten erstellen & Hierarchie testen

#### 🧪 KRITISCHE TEST-REIHENFOLGE (MUSS 100% funktionieren!)

```
1. Area erstellen → "Werk Nord"
2. Department mit Area → "Produktion" → Werk Nord
3. Employee/User erstellen → "Max Mustermann" → Produktion + optional Team
4. Team erstellen mit:
   - Department-Zuweisung → "Schicht A" → Produktion
   - Multiple User auswählen (Checkboxen) ✅
   - Multiple Maschinen auswählen (Checkboxen) ✅
5. Machine erstellen → "Drehbank 1" → Werk Nord + Produktion
6. DB-Kontrolle: Alle Verknüpfungen prüfen!
```

#### ⚠️ WICHTIG: Vollständiger Test BEVOR Phase 4!

- [ ] user_teams Tabelle: User-Team Verknüpfungen vorhanden?
- [ ] machine_teams Tabelle: Machine-Team Verknüpfungen vorhanden?
- [ ] departments.area_id: Korrekt gespeichert?
- [ ] teams.department_id: Korrekt gespeichert?
- [ ] machines.department_id + area_id: Korrekt gespeichert?
- [ ] **NUR wenn alles ✅ → Phase 4 beginnen!**

### 4. ERST NACH ERFOLGREICHEM TEST: Grundlegender Shift-Workflow

- Department auswählen → Teams laden → Mitglieder anzeigen
- Maschinen des Departments anzeigen
- Einfache Shift-Zuweisung (noch ohne Drag&Drop)

---

**Status:** Hierarchie-Foundation ✅ | Shift-System 🔄
**Priorität Morgen:** Dropdown-Fix → DB Migration → Test-Daten
**Erwartete Zeit:** 3-4 Stunden für Basis-Funktionalität
