# 🚨 SHIFT SAVING BUG FIX PLAN - Korrektes Datenmodell Implementation

## 📅 USER SZENARIO: Albert Einstein & Mahatma Gandhi

- **Albert Einstein**: Frühschicht Mo-Fr (5 Schichten)
- **Mahatma Gandhi**: Spätschicht Mo-Fr (5 Schichten)
- **Total**: 10 Schichten für KW 34/2025
- **Team**: 2080, Machine: 166, Area: 38, Department: 2765
- **Notiz**: "Testnotiz" (soll nur 1x pro Tag gespeichert werden)

## 📊 AKTUELLE SITUATION (FALSCH)

### Was passiert aktuell beim Speichern

- ❌ 10 Einträge direkt in `shifts` Tabelle
- ❌ `plan_id` = NULL (kein Schichtplan erstellt)
- ❌ `machine_id` = NULL (wird nicht gespeichert)
- ❌ Notizen redundant 10x in `shifts.notes`
- ❌ Keine Einträge in `shift_notes`
- ❌ Keine Einträge in `shift_plans`

### Probleme

1. **Falsches Datenmodell**: Direkte Speicherung in shifts statt korrekter Struktur
2. **Keine Editierbarkeit**: Ohne plan_id kann der Plan nicht wieder geladen werden
3. **Redundanz**: "Testnotiz" 10x statt 1x
4. **Fehlende Verknüpfungen**: machine_id wird nicht gespeichert
5. **Frontend nutzt noch alten v1 Endpoint** - GET /api/shifts statt /api/v2/shifts

## ✅ KORREKTES DATENMODELL

### Hierarchie

```text
shift_plans (1)
    ├── shifts (n) - Schichten mit direkter Mitarbeiter-Zuordnung
    └── shift_notes (n) - Tagesnotizen
```

### Korrekte Speicherung sollte sein

#### 1. **shift_plans** (1 Eintrag)

```sql
INSERT INTO shift_plans (
    tenant_id, name, description,
    department_id, team_id,
    start_date, end_date,
    status, created_by
) VALUES (
    5115, 'Wochenplan KW 34/2025', 'Team 2080 - Machine 166',
    2765, 2080,
    '2025-08-18', '2025-08-24',
    'draft', [current_user_id]
);
-- Returns: plan_id = 31
```

#### 2. **shifts** (10 Einträge mit plan_id)

```sql
INSERT INTO shifts (
    tenant_id, plan_id, user_id,
    date, start_time, end_time,
    type, status,
    department_id, team_id, machine_id, area_id,
    created_by
) VALUES (
    5115, 31, 35491,
    '2025-08-18', '2025-08-18 06:00:00', '2025-08-18 14:00:00',
    'early', 'planned',
    2765, 2080, 166, 38,
    [current_user_id]
);
-- OHNE notes! (gehört in shift_notes)
-- area_id MUSS auch gespeichert werden!
```

#### 3. **shift_notes** (1 Eintrag pro Tag mit Notiz)

```sql
INSERT INTO shift_notes (
    tenant_id, date, notes, created_by
) VALUES (
    5115, '2025-08-18', 'Testnotiz', [current_user_id]
);
-- Nur 1x pro Tag, nicht pro Schicht!
```

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Backend API v2 Anpassung

#### 1.1 Neue Endpoint-Struktur

```typescript
// POST /api/v2/shifts/plan
interface CreateShiftPlanRequest {
  startDate: string;
  endDate: string;
  areaId: number; // NEU: area_id muss auch gespeichert werden!
  departmentId: number;
  teamId: number;
  machineId: number;
  name?: string;
  description?: string;
  shifts: Array<{
    userId: number;
    date: string;
    type: 'early' | 'late' | 'night';
    startTime: string;
    endTime: string;
  }>;
  dailyNotes: Record<string, string>; // { "2025-08-18": "Testnotiz" }
}

// Response
interface CreateShiftPlanResponse {
  planId: number;
  shiftIds: number[];
  noteIds: number[];
}
```

#### 1.2 Service-Methode

```typescript
async createShiftPlan(data: CreateShiftPlanRequest): Promise<CreateShiftPlanResponse> {
  const trx = await db.transaction();

  try {
    // 1. Create shift_plan
    const plan = await trx('shift_plans').insert({
      tenant_id: req.user.tenantId,
      name: data.name || `Wochenplan KW ${getWeekNumber(data.startDate)}`,
      department_id: data.departmentId,
      team_id: data.teamId,
      start_date: data.startDate,
      end_date: data.endDate,
      status: 'draft',
      created_by: req.user.id
    });

    // 2. Create shifts with plan_id
    const shiftIds = [];
    for (const shift of data.shifts) {
      const [shiftResult] = await trx('shifts').insert({
        tenant_id: req.user.tenantId,
        plan_id: plan.id,
        user_id: shift.userId,
        date: shift.date,
        start_time: `${shift.date} ${shift.startTime}:00`,
        end_time: `${shift.date} ${shift.endTime}:00`,
        type: shift.type,
        area_id: data.areaId,  // NEU: area_id speichern!
        department_id: data.departmentId,
        team_id: data.teamId,
        machine_id: data.machineId,
        status: 'planned',
        created_by: req.user.id
      });

      shiftIds.push(shiftResult.insertId);
    }

    // 3. Create daily notes (nur wenn vorhanden)
    const noteIds = [];
    for (const [date, notes] of Object.entries(data.dailyNotes)) {
      if (notes && notes.trim()) {
        const id = await trx('shift_notes').insert({
          tenant_id: req.user.tenantId,
          date: date,
          notes: notes,
          created_by: req.user.id
        }).onDuplicateKeyUpdate(['notes', 'updated_at']);
        noteIds.push(id);
      }
    }

    await trx.commit();
    return { planId: plan.id, shiftIds, noteIds };

  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
```

### Phase 2: Frontend Anpassung

#### 2.0 Admin Actions - Bearbeiten Button hinzufügen

```html
<!-- In shifts.html bei Admin Actions -->
<div class="admin-actions">
  <button id="saveShiftsBtn" class="btn btn-primary"><i class="fas fa-save"></i> Speichern</button>
  <!-- NEU: Bearbeiten Button -->
  <button id="editShiftsBtn" class="btn btn-cancel" style="display: none;">
    <i class="fas fa-edit"></i> Bearbeiten
  </button>
</div>
```

```typescript
// Edit Handler für CRUD Update
private setupEditButton(): void {
  const editBtn = document.querySelector('editShiftsBtn');
  editBtn?.addEventListener('click', async () => {
    if (!this.currentPlanId) {
      showErrorAlert('Kein Schichtplan zum Bearbeiten vorhanden');
      return;
    }

    try {
      // Lade existierenden Plan
      await this.loadShiftPlan();

      // Aktiviere Edit-Modus
      this.isEditMode = true;
      this.showEditModeUI();

    } catch (error) {
      showErrorAlert('Fehler beim Laden des Schichtplans');
    }
  });
}

// Zeige Edit-Button wenn Plan existiert
private updateActionButtons(): void {
  const editBtn = document.querySelector('editShiftsBtn') as HTMLButtonElement;
  const saveBtn = document.querySelector('saveShiftsBtn') as HTMLButtonElement;

  if (this.currentPlanId) {
    editBtn.style.display = 'inline-block';
    saveBtn.textContent = this.isEditMode ? 'Aktualisieren' : 'Speichern';
  } else {
    editBtn.style.display = 'none';
    saveBtn.textContent = 'Speichern';
  }
}
```

#### 2.1 Shift-Speicherung umbauen

```typescript
async saveShifts(): Promise<void> {
  // Sammle Daten für Plan
  const planData: CreateShiftPlanRequest = {
    startDate: this.startDate,
    endDate: this.endDate,
    areaId: this.selectedContext.areaId!,  // NEU: area_id mitsenden!
    departmentId: this.selectedContext.departmentId!,
    teamId: this.selectedContext.teamId!,
    machineId: this.selectedContext.machineId!,
    shifts: [],
    dailyNotes: {}
  };

  // Sammle alle Schichten
  this.weeklyShifts.forEach((assignments, key) => {
    const [date, shiftType] = key.split('_');
    assignments.forEach(assignment => {
      planData.shifts.push({
        userId: assignment.employeeId,
        date: date,
        type: shiftType as 'early' | 'late' | 'night',
        startTime: this.getShiftStartTime(shiftType),
        endTime: this.getShiftEndTime(shiftType)
      });
    });
  });

  // Sammle Notizen (einmal pro Tag!)
  const processedDates = new Set<string>();
  this.shiftDetails.forEach((detail, key) => {
    const [date] = key.split('_');
    if (detail.notes && !processedDates.has(date)) {
      planData.dailyNotes[date] = detail.notes;
      processedDates.add(date);
    }
  });

  // Speichere Plan
  const response = await this.apiClient.request('/shifts/plan', {
    method: 'POST',
    body: JSON.stringify(planData)
  });

  // Speichere plan_id für späteren Edit
  this.currentPlanId = response.planId;
}
```

#### 2.2 Frontend loadShifts() auf API v2 umstellen

```typescript
// ALT (v1 API):
private async loadShifts(): Promise<void> {
  const response = await fetch(`/api/shifts?start=${startDate}&end=${endDate}`);
}

// NEU (v2 API):
private async loadShifts(): Promise<void> {
  // ApiClient nutzt automatisch /api/v2 prefix!
  const response = await this.apiClient.request('/shifts', {
    params: {
      startDate: this.startDate,
      endDate: this.endDate,
      teamId: this.selectedContext.teamId,
      machineId: this.selectedContext.machineId,
      planId: this.currentPlanId  // Falls vorhanden
    }
  });

  // v2 API gibt direkt shifts zurück, nicht shift_assignments
  this.processShifts(response.shifts);
}
```

#### 2.3 Automatisches Laden nach Team-Auswahl

```typescript
// WICHTIG: Nach Team-Auswahl automatisch prüfen ob Plan existiert!
private async onTeamSelected(teamId: number): Promise<void> {
  this.selectedContext.teamId = teamId;

  // Automatisch versuchen existierenden Plan zu laden
  await this.loadShiftPlan();

  // Update UI basierend auf Ergebnis
  this.updateActionButtons();
}
```

#### 2.3 Plan laden für Edit

```typescript
async loadShiftPlan(): Promise<void> {
  if (!this.selectedContext.teamId) return;

  // Lade existierenden Plan
  const response = await this.apiClient.request('/shifts/plan', {
    method: 'GET',
    params: {
      areaId: this.selectedContext.areaId,
      departmentId: this.selectedContext.departmentId,
      teamId: this.selectedContext.teamId,
      machineId: this.selectedContext.machineId,
      startDate: this.startDate,
      endDate: this.endDate
    }
  });

  if (response.plan) {
    this.currentPlanId = response.plan.id;

    // Lade Schichten in UI
    response.shifts.forEach(shift => {
      const key = `${shift.date}_${shift.type}`;
      this.weeklyShifts.set(key, [{
        employeeId: shift.user_id,
        employeeName: shift.user_name
      }]);
    });

    // Lade Notizen
    response.notes.forEach(note => {
      // Setze Notiz für alle Schichten des Tages
      ['early', 'late', 'night'].forEach(type => {
        const key = `${note.date}_${type}`;
        if (this.shiftDetails.has(key)) {
          this.shiftDetails.get(key)!.notes = note.notes;
        }
      });
    });

    this.renderWeekPlan();
  }
}
```

### Phase 3: API Endpoints

#### Neue Endpoints

1. **POST /api/v2/shifts/plan** - Erstellt kompletten Schichtplan
2. **GET /api/v2/shifts/plan** - Lädt existierenden Plan
3. **PUT /api/v2/shifts/plan/:id** - Aktualisiert Plan
4. **DELETE /api/v2/shifts/plan/:id** - Löscht kompletten Plan

#### Bestehende anpassen

1. **GET /api/v2/shifts** - Muss plan_id, machine_id, notes zurückgeben
2. **POST /api/v2/shifts** - Nur für einzelne Schichten (nicht für Plan)

## 📋 TESTING CHECKLIST

### Nach Implementation testen

1. **Speichern:**
   - [ ] shift_plans hat 1 Eintrag mit korrekten Daten
   - [ ] shifts hat 10 Einträge mit plan_id
   - [ ] machine_id ist korrekt gespeichert
   - [ ] shift_notes hat max. 5 Einträge (Mo-Fr)
   - [ ] Keine redundanten Notizen

2. **Laden:**
   - [ ] Filter setzen (Area → Department → Machine → Team)
   - [ ] Woche auswählen
   - [ ] Plan wird automatisch geladen
   - [ ] Alle Zuordnungen korrekt angezeigt
   - [ ] Notizen korrekt pro Tag angezeigt

3. **Editieren:**
   - [ ] Bestehenden Plan laden
   - [ ] Änderungen vornehmen
   - [ ] Speichern aktualisiert existierenden Plan
   - [ ] Keine Duplikate entstehen

## 🎯 PRIORITÄTEN

1. **HÖCHSTE**: Plan-basiertes Speichern implementieren
2. **HÖCHSTE**: Frontend komplett auf API v2 umstellen (kein v1 mehr!)
3. **HOCH**: machine_id und area_id korrekt speichern
4. **HOCH**: Automatisches Laden nach Team-Auswahl
5. **MITTEL**: Notizen in shift_notes statt redundant

## ⚠️ WICHTIGE HINWEISE

- **Transaction nutzen**: Alles oder nichts beim Speichern
- **Tenant-Isolation**: IMMER tenant_id prüfen
- **Unique Constraints**: shift_notes hat unique(tenant_id, date)
- **Plan-Status**: draft → published → locked workflow
- **Berechtigungen**: created_by und approved_by tracken

## ✅ ENTSCHIEDEN: Mehrere Mitarbeiter pro Schicht - Option A

**Frontend erlaubt bereits mehrere Mitarbeiter per Drag&Drop in eine Schicht!**

### Gewählte Lösung: Option A - Mehrere Einträge in shifts Tabelle

```sql
-- Für jeden Mitarbeiter ein separater Eintrag mit gleichem plan_id
INSERT INTO shifts (plan_id, date, start_time, end_time, user_id, type, team_id, machine_id) VALUES
(31, '2025-08-18', '06:00', '14:00', 35491, 'early', 2080, 166),  -- Einstein
(31, '2025-08-18', '06:00', '14:00', 35490, 'early', 2080, 166);  -- Gandhi

-- plan_id gruppiert automatisch zusammengehörige Schichten!
```

**Vorteile:**

- ✅ Einfachste Lösung, funktioniert SOFORT
- ✅ Kein DB-Schema Change nötig
- ✅ plan_id gruppiert automatisch
- ✅ Jeder Mitarbeiter hat eigene shift_id (für Krankmeldung, Tausch etc.)
- ✅ Kompatibel mit bestehendem Code

**Implementation im Backend:**

````typescript
// In createShiftPlan():
for (const shift of data.shifts) {
  // shifts Array kann mehrere Einträge mit gleicher Zeit haben!
  await trx('shifts').insert({
    plan_id: plan.id,
    user_id: shift.userId,
    date: shift.date,
    start_time: `${shift.date} ${shift.startTime}:00`,
    end_time: `${shift.date} ${shift.endTime}:00`,
    type: shift.type,
    // Alle haben gleiche Werte:
    team_id: data.teamId,
    machine_id: data.machineId,
    department_id: data.departmentId
  });
}

## 🗄️ DATENBANK-MIGRATION ERFORDERLICH

### Migration für shift_plans Tabelle
```sql
-- Prüfen ob machine_id column in shift_plans existiert
ALTER TABLE shift_plans
ADD COLUMN IF NOT EXISTS machine_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS area_id INT DEFAULT NULL,
ADD CONSTRAINT fk_shift_plans_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_shift_plans_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_shift_plans_machine ON shift_plans(machine_id);
CREATE INDEX IF NOT EXISTS idx_shift_plans_area ON shift_plans(area_id);
````

### Migration ausführen (siehe DATABASE-MIGRATION-GUIDE.md)

```bash
# 1. Backup
bash scripts/quick-backup.sh "before_shift_fix_$(date +%Y%m%d_%H%M%S)"

# 2. Migration erstellen
cat > database/migrations/004-shift-plans-fix.sql << 'EOF'
-- Add machine_id and area_id to shift_plans
ALTER TABLE shift_plans
ADD COLUMN IF NOT EXISTS machine_id INT DEFAULT NULL AFTER team_id,
ADD COLUMN IF NOT EXISTS area_id INT DEFAULT NULL AFTER machine_id;

-- Add foreign keys
ALTER TABLE shift_plans
ADD CONSTRAINT fk_shift_plans_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_shift_plans_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shift_plans_machine ON shift_plans(machine_id);
CREATE INDEX IF NOT EXISTS idx_shift_plans_area ON shift_plans(area_id);
EOF

# 3. Migration ausführen
docker cp database/migrations/004-shift-plans-fix.sql assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main < /tmp/004-shift-plans-fix.sql'

# 4. Verifizieren
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "DESCRIBE shift_plans;"'
```

## 🚀 NÄCHSTE SCHRITTE

1. **ZUERST**: Datenbank-Migration ausführen (shift_plans erweitern)
2. Backend-Service für Plan-Erstellung implementieren
3. Frontend auf neue API umstellen
4. Test-Suite für Plan-Management
5. UI für Plan-Status-Workflow
