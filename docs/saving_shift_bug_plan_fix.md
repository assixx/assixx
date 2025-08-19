# 🚨 SHIFT SAVING BUG FIX PLAN - Korrektes Datenmodell Implementation

## 📊 AKTUELLE SITUATION (FALSCH)

### Was passiert aktuell beim Speichern:
- ❌ 10 Einträge direkt in `shifts` Tabelle
- ❌ `plan_id` = NULL (kein Schichtplan erstellt)
- ❌ `machine_id` = NULL (wird nicht gespeichert)
- ❌ Notizen redundant 10x in `shifts.notes` 
- ❌ Keine Einträge in `shift_assignments`
- ❌ Keine Einträge in `shift_notes`
- ❌ Keine Einträge in `shift_plans`

### Probleme:
1. **Falsches Datenmodell**: Direkte Speicherung in shifts statt korrekter Struktur
2. **Keine Editierbarkeit**: Ohne plan_id kann der Plan nicht wieder geladen werden
3. **Redundanz**: "Testnotiz" 10x statt 1x
4. **Fehlende Verknüpfungen**: machine_id wird nicht gespeichert
5. **KRITISCH: GET /api/shifts lädt nichts** - Der v1 Endpoint erwartet `shift_assignments`:
   ```sql
   -- v1 API GET /api/shifts sucht nach:
   FROM shift_assignments sa
   JOIN shifts s ON sa.shift_id = s.id
   WHERE sa.status = 'accepted'
   -- Aber wir haben keine shift_assignments erstellt!
   ```

## ✅ KORREKTES DATENMODELL

### Hierarchie:
```
shift_plans (1)
    ├── shifts (n) - Schicht-Definitionen/Zeitslots
    │   └── shift_assignments (n) - Mitarbeiter-Zuordnungen
    └── shift_notes (n) - Tagesnotizen
```

### Korrekte Speicherung sollte sein:

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
    department_id, team_id, machine_id,
    created_by
) VALUES (
    5115, 31, 35491,
    '2025-08-18', '2025-08-18 06:00:00', '2025-08-18 14:00:00',
    'early', 'planned',
    2765, 2080, 166,
    [current_user_id]
);
-- OHNE notes! (gehört in shift_notes)
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

#### 4. **shift_assignments** (Optional für erweiterte Features)
```sql
-- Für zukünftige Features wie Verfügbarkeit, Anfragen etc.
INSERT INTO shift_assignments (
    tenant_id, shift_id, user_id,
    assignment_type, status, assigned_by
) VALUES (
    5115, [shift_id], 35491,
    'assigned', 'accepted', [current_user_id]
);
```

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Backend API v2 Anpassung

#### 1.1 Neue Endpoint-Struktur
```typescript
// POST /api/v2/shifts/plan
interface CreateShiftPlanRequest {
  startDate: string;
  endDate: string;
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
      const id = await trx('shifts').insert({
        tenant_id: req.user.tenantId,
        plan_id: plan.id,
        user_id: shift.userId,
        date: shift.date,
        start_time: `${shift.date} ${shift.startTime}:00`,
        end_time: `${shift.date} ${shift.endTime}:00`,
        type: shift.type,
        department_id: data.departmentId,
        team_id: data.teamId,
        machine_id: data.machineId,
        status: 'planned',
        created_by: req.user.id
      });
      shiftIds.push(id);
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
  <button id="saveShiftsBtn" class="btn btn-primary">
    <i class="fas fa-save"></i> Speichern
  </button>
  <!-- NEU: Bearbeiten Button -->
  <button id="editShiftsBtn" class="btn btn-secondary" style="display: none;">
    <i class="fas fa-edit"></i> Bearbeiten
  </button>
</div>
```

```typescript
// Edit Handler für CRUD Update
private setupEditButton(): void {
  const editBtn = document.getElementById('editShiftsBtn');
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
  const editBtn = document.getElementById('editShiftsBtn') as HTMLButtonElement;
  const saveBtn = document.getElementById('saveShiftsBtn') as HTMLButtonElement;
  
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

#### 2.2 Plan laden für Edit
```typescript
async loadShiftPlan(): Promise<void> {
  if (!this.selectedContext.teamId) return;
  
  // Lade existierenden Plan
  const response = await this.apiClient.request('/shifts/plan', {
    method: 'GET',
    params: {
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

#### Neue Endpoints:
1. **POST /api/v2/shifts/plan** - Erstellt kompletten Schichtplan
2. **GET /api/v2/shifts/plan** - Lädt existierenden Plan
3. **PUT /api/v2/shifts/plan/:id** - Aktualisiert Plan
4. **DELETE /api/v2/shifts/plan/:id** - Löscht kompletten Plan

#### Bestehende anpassen:
1. **GET /api/v2/shifts** - Muss plan_id, machine_id, notes zurückgeben
2. **POST /api/v2/shifts** - Nur für einzelne Schichten (nicht für Plan)

## 📋 TESTING CHECKLIST

### Nach Implementation testen:

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
2. **HOCH**: machine_id korrekt speichern
3. **MITTEL**: Notizen in shift_notes statt redundant
4. **NIEDRIG**: shift_assignments für zukünftige Features

## ⚠️ WICHTIGE HINWEISE

- **Transaction nutzen**: Alles oder nichts beim Speichern
- **Tenant-Isolation**: IMMER tenant_id prüfen
- **Unique Constraints**: shift_notes hat unique(tenant_id, date)
- **Plan-Status**: draft → published → locked workflow
- **Berechtigungen**: created_by und approved_by tracken

## 🚀 NÄCHSTE SCHRITTE

1. Backend-Service für Plan-Erstellung implementieren
2. Frontend auf neue API umstellen
3. Migrations für fehlende Constraints
4. Test-Suite für Plan-Management
5. UI für Plan-Status-Workflow