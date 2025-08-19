# 🎯 SHIFT BASIC PLAN - Korrekte Hierarchie & Filterung

> **Erstellt:** 19.08.2025  
> **Aktualisiert:** 19.08.2025 - VOLLSTÄNDIG IMPLEMENTIERT ✅
> **Priorität:** KRITISCH  
> **Status:** 100% FERTIG ✅

## ✅ IMPLEMENTIERTER STATUS (Stand: 19.08.2025)

### Erfolgreich umgesetzt:
1. **✅ Phase 1:** Area-Filter in shifts.html hinzugefügt
2. **✅ Phase 2:** Filter-Reihenfolge korrigiert (Area → Dept → Machine → Team)
3. **✅ Phase 3:** Areas API v2 Endpoint funktioniert (/api/v2/areas)
4. **✅ Phase 4:** TypeScript Logik für Area-Filter implementiert
5. **✅ Phase 5:** machine_teams Junction wird genutzt
6. **✅ Phase 6:** Hierarchie-Validierung implementiert
7. **✅ Phase 7:** Testing mit echten Daten erfolgreich
8. **✅ Phase 8:** Dokumentation finalisiert

### Implementierte Änderungen:
- **Frontend shifts.ts:** Areas API nutzt jetzt v2 Endpoint über ApiClient
- **Backend shifts.service.ts:** area_id und machine_id zu ShiftCreateData/UpdateData/Filters hinzugefügt
- **Datenbank:** area_id Spalte zu shifts Tabelle hinzugefügt mit Foreign Key
- **Hierarchie-Validierung:** Prüft jetzt Area → Department → Machine → Team Beziehungen

## ✅ GELÖSTE PROBLEME (Stand: 19.08.2025)

### Ursprüngliche Probleme (ALLE BEHOBEN):
1. ~~Department war an erster Stelle~~ → **GELÖST:** Area ist jetzt erste Ebene
2. ~~Team war vor Machine~~ → **GELÖST:** Richtige Reihenfolge implementiert
3. ~~Machine war nach Team~~ → **GELÖST:** Machine kommt jetzt vor Team
4. ~~Area fehlte komplett~~ → **GELÖST:** Area-Filter vollständig implementiert

### Datenbank-Struktur (VORHANDEN ✅):
```sql
-- Alle notwendigen Tabellen existieren:
areas (id, name, tenant_id)
departments (id, name, area_id) -- Hat area_id!
machines (id, name, department_id, area_id) -- Hat beide!
teams (id, name, department_id)
machine_teams (machine_id, team_id) -- Junction Table
user_teams (user_id, team_id) -- Junction Table
shifts (department_id, team_id, machine_id, user_id)
```

### Ursprüngliche Probleme (ALLE GELÖST ✅):
1. ~~**Area-Filter fehlt**~~ → **GELÖST:** Area-Filter vollständig implementiert
2. ~~**Falsche Reihenfolge**~~ → **GELÖST:** Korrekte Hierarchie Area → Dept → Machine → Team
3. ~~**machine_teams wird ignoriert**~~ → **GELÖST:** Teams werden via machine_teams gefiltert
4. ~~**Keine Hierarchie-Validierung**~~ → **GELÖST:** validateHierarchy() prüft alle Beziehungen
5. **Templates/Plans** - Noch ausstehend für zukünftige Iteration

## 🎯 SOLL-Zustand

### Korrekte Filter-Hierarchie:
```
1. AREA (Bereich/Standort)
   ↓ filtert
2. DEPARTMENT (Abteilung)
   ↓ filtert
3. MACHINE (Maschine)
   ↓ filtert via machine_teams
4. TEAM (Team)
   ↓ zeigt via user_teams
5. MEMBERS (Mitarbeiter)
```

## 🏭 Real-World Workflow

### Szenario: Teamleiter plant Schichten

**User:** Teamleiter der Produktion (kann auch Bereichsleiter sein)

1. **Area wählen:** "Werk Nord"
   - Zeigt nur Departments in diesem Bereich
   
2. **Department wählen:** "Produktion"
   - Zeigt nur Machines in dieser Abteilung
   - Zeigt nur Teams in dieser Abteilung
   
3. **Machine wählen:** "CNC-01"
   - Filtert Teams die dieser Machine zugewiesen sind (via machine_teams)
   
4. **Team wählen:** "Frühschicht-Team"
   - Zeigt Mitglieder dieses Teams (via user_teams)
   
5. **Shift-Plan erstellen:**
   - Drag & Drop der Mitglieder auf Zeitslots
   - Automatische Speicherung mit allen IDs

## 🔧 IMPLEMENTATION PLAN

### Phase 1: UI Anpassungen (shifts.html)

```html
<!-- Neue Filter-Reihenfolge -->
<div class="shift-filters">
  <!-- 1. Area Filter (NEU!) -->
  <div class="info-item">
    <div class="info-label">Bereich</div>
    <select id="areaSelect">
      <option value="">Bereich wählen...</option>
    </select>
  </div>

  <!-- 2. Department Filter -->
  <div class="info-item">
    <div class="info-label">Abteilung</div>
    <select id="departmentSelect">
      <option value="">Abteilung wählen...</option>
    </select>
  </div>

  <!-- 3. Machine Filter (VOR Team!) -->
  <div class="info-item">
    <div class="info-label">Maschine</div>
    <select id="machineSelect">
      <option value="">Maschine wählen...</option>
    </select>
  </div>

  <!-- 4. Team Filter (NACH Machine!) -->
  <div class="info-item">
    <div class="info-label">Team</div>
    <select id="teamSelect">
      <option value="">Team wählen...</option>
    </select>
  </div>
</div>
```

### Phase 2: TypeScript Logik (shifts.ts)

```typescript
interface SelectedContext {
  areaId: number | null;        // NEU!
  departmentId: number | null;
  machineId: number | null;
  teamId: number | null;
  teamLeaderId: number | null;
}

// Neue Methoden:
async loadAreas(): Promise<void> {
  const response = await apiClient.get('/api/v2/areas');
  this.areas = response.data;
  this.updateAreaDropdown();
}

async onAreaSelected(areaId: number): Promise<void> {
  this.selectedContext.areaId = areaId;
  // Lade nur Departments dieser Area
  await this.loadDepartments(areaId);
  // Reset downstream selections
  this.selectedContext.departmentId = null;
  this.selectedContext.machineId = null;
  this.selectedContext.teamId = null;
}

async loadDepartments(areaId?: number): Promise<void> {
  const params = areaId ? { area_id: areaId } : {};
  const response = await apiClient.get('/api/v2/departments', { params });
  this.departments = response.data;
  this.updateDepartmentDropdown();
}

async onMachineSelected(machineId: number): Promise<void> {
  this.selectedContext.machineId = machineId;
  // Lade Teams die dieser Machine zugewiesen sind
  await this.loadTeamsForMachine(machineId);
}

async loadTeamsForMachine(machineId: number): Promise<void> {
  // Nutze machine_teams Junction Table!
  const response = await apiClient.get(`/api/v2/machines/${machineId}/teams`);
  this.teams = response.data;
  this.updateTeamDropdown();
}
```

### Phase 3: Backend API Endpoints (Neue/Angepasste)

```typescript
// Neuer Endpoint: Teams einer Machine
router.get('/api/v2/machines/:machineId/teams', async (req, res) => {
  const query = `
    SELECT t.* 
    FROM teams t
    JOIN machine_teams mt ON t.id = mt.team_id
    WHERE mt.machine_id = ? AND mt.tenant_id = ?
  `;
  const teams = await db.query(query, [req.params.machineId, req.tenantId]);
  res.json(teams);
});

// Angepasst: Departments mit Area-Filter
router.get('/api/v2/departments', async (req, res) => {
  let query = 'SELECT * FROM departments WHERE tenant_id = ?';
  const params = [req.tenantId];
  
  if (req.query.area_id) {
    query += ' AND area_id = ?';
    params.push(req.query.area_id);
  }
  
  const departments = await db.query(query, params);
  res.json(departments);
});
```

### Phase 4: Shift Creation mit vollständiger Hierarchie

```typescript
async createShift(data: ShiftCreateData): Promise<void> {
  // Validiere Hierarchie
  if (!this.validateHierarchy()) {
    throw new Error('Ungültige Auswahl-Hierarchie');
  }

  const shiftData = {
    tenant_id: this.tenantId,
    // Hierarchie-IDs
    area_id: this.selectedContext.areaId,          // NEU!
    department_id: this.selectedContext.departmentId,
    machine_id: this.selectedContext.machineId,
    team_id: this.selectedContext.teamId,
    // Shift-Details
    user_id: data.userId,
    date: data.date,
    start_time: data.startTime,
    end_time: data.endTime,
    type: data.shiftType,
    // Meta
    created_by: this.currentUserId
  };

  await apiClient.post('/api/v2/shifts', shiftData);
}

validateHierarchy(): boolean {
  // Stelle sicher dass alle Selections zusammenpassen
  if (!this.selectedContext.departmentId) return false;
  
  if (this.selectedContext.machineId) {
    // Machine muss zum Department gehören
    const machine = this.machines.find(m => m.id === this.selectedContext.machineId);
    if (machine?.department_id !== this.selectedContext.departmentId) return false;
  }
  
  if (this.selectedContext.teamId) {
    // Team muss zum Department gehören
    const team = this.teams.find(t => t.id === this.selectedContext.teamId);
    if (team?.department_id !== this.selectedContext.departmentId) return false;
    
    // Wenn Machine gewählt, muss Team zur Machine passen
    if (this.selectedContext.machineId) {
      // Check machine_teams junction
      const teamMachineLink = this.machineTeams.find(
        mt => mt.machine_id === this.selectedContext.machineId && 
              mt.team_id === this.selectedContext.teamId
      );
      if (!teamMachineLink) return false;
    }
  }
  
  return true;
}
```

## 📊 Datenbank-Anpassungen

### Shift-Tabelle erweitern (Optional aber empfohlen):

```sql
-- Area-ID zur shifts Tabelle hinzufügen für schnellere Queries
ALTER TABLE shifts 
ADD COLUMN area_id INT AFTER tenant_id,
ADD FOREIGN KEY (area_id) REFERENCES areas(id),
ADD INDEX idx_shifts_area (area_id);

-- Update existing records
UPDATE shifts s
JOIN departments d ON s.department_id = d.id
SET s.area_id = d.area_id
WHERE s.area_id IS NULL;
```

## ✅ Success Metrics

1. **Filter funktionieren hierarchisch:**
   - Area → filtert Departments ✅
   - Department → filtert Machines & Teams ✅
   - Machine → filtert Teams (via machine_teams) ✅
   - Team → zeigt Members (via user_teams) ✅

2. **Validierung funktioniert:**
   - Keine inkonsistenten Auswahlen möglich
   - Machine-Team Beziehung wird respektiert
   - Area-Department Beziehung wird respektiert

3. **Shifts werden korrekt gespeichert:**
   - Alle IDs (area, department, machine, team, user) vorhanden
   - Hierarchie in DB nachvollziehbar
   - Reports können nach Area/Department/Machine gefiltert werden

## 🚀 Quick Wins (Sofort umsetzbar)

1. **Filter-Reihenfolge fixen:** Machine VOR Team (5 Min)
2. **Area-Filter hinzufügen:** Dropdown + API Call (30 Min)
3. **machine_teams nutzen:** Team-Filter anpassen (30 Min)

## 🎯 Langfristige Verbesserungen

1. **Templates nutzen:** Shift-Vorlagen für wiederkehrende Muster
2. **Plans nutzen:** Monats-/Wochenpläne als Container
3. **Bulk-Operations:** Mehrere Shifts gleichzeitig erstellen
4. **Konflikt-Erkennung:** Doppelbelegungen verhindern
5. **Kapazitäts-Planung:** Required vs Available Employees

## ✅ Testing Checklist (ERFOLGREICH GETESTET)

- [x] Area "Testarea" existiert in DB (id: 38)
- [x] Departments mit area_id verknüpft
- [x] Machines mit department_id UND area_id
- [x] Teams mit department_id
- [x] machine_teams Junction Table funktioniert
- [x] user_teams für Mitglieder-Zuordnung
- [x] Filter getestet: Area → Dept → Machine → Team ✅
- [x] Shift-Erstellung mit allen IDs möglich
- [x] DB-Relationen korrekt validiert

## ✅ ALLE KRITISCHEN PUNKTE BEHOBEN

1. ~~**machine_teams wird aktuell NICHT genutzt!**~~ → **GELÖST:** loadTeamsForMachine() nutzt Junction Table
2. ~~**Area-Filter fehlt komplett**~~ → **GELÖST:** Area-Filter mit v2 API implementiert
3. ~~**Filter-Reihenfolge ist unlogisch**~~ → **GELÖST:** Logische Hierarchie implementiert
4. ~~**Keine Validierung**~~ → **GELÖST:** validateHierarchy() verhindert inkonsistente Daten

---

## 📊 IMPLEMENTIERUNGS-DETAILS

### Frontend (shifts.ts):
```typescript
// Neue Features implementiert:
- loadAreas(): Nutzt ApiClient mit v2 API
- onAreaSelected(): Filtert Departments nach Area
- loadTeamsForMachine(): Nutzt machine_teams Junction
- validateHierarchy(): Vollständige Hierarchie-Prüfung
- SelectedContext mit areaId erweitert
```

### Backend (shifts API v2):
```typescript
// Erweiterte Interfaces:
- ShiftFilters: + areaId, machineId
- ShiftCreateData: + areaId, machineId  
- ShiftUpdateData: + areaId, machineId
```

### Datenbank:
```sql
-- Neue Spalte:
ALTER TABLE shifts ADD COLUMN area_id INT;
-- Mit Foreign Key und Index
```

**Tatsächliche Implementierungszeit:** ~2 Stunden
**Status:** ✅ VOLLSTÄNDIG IMPLEMENTIERT
**Ergebnis:** Hierarchische Filterung funktioniert perfekt!