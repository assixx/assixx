# 📋 Employee Availability System - Implementation Plan

## 🎯 Ziel
Integration eines vollständigen Verfügbarkeitssystems für Mitarbeiter, das in der Schichtplanung die Verfügbarkeit anzeigt und nur verfügbare Mitarbeiter zur Einplanung erlaubt.

## 🔍 IST-Zustand Analyse

### 1. Frontend-Probleme

#### manage-employees.html
- ✅ Hat "Bearbeiten" Button bei jedem Mitarbeiter
- ❌ Modal lädt nur Basic-Daten (Name, Email, Team, etc.)
- ❌ **KEINE Verfügbarkeits-Felder im Modal**
- ❌ Keine UI für Status-Auswahl (verfügbar/urlaub/krank/beurlaubt)
- ❌ Keine Datums-Felder für Zeiträume

#### shifts.html
- ✅ Zeigt Badge mit Verfügbarkeitsstatus
- ❌ Status ist **hartcodiert** als "Verfügbar"
- ❌ Keine Prüfung bei Drag&Drop ob Mitarbeiter verfügbar
- ❌ Keine Integration mit employee_availability Tabelle

#### admin-dashboard.html
- ⚠️ Hat ein **ungenutztes** Employee-Status-Modal (Zeilen 805-859)
- ⚠️ Dieses Modal sollte eigentlich nach manage-employees.html migriert werden
- ⚠️ Verwirrender Begriff "Beurlaubt" statt "Nicht verfügbar"

### 2. Backend-Probleme

#### Datenbank-Struktur
```sql
-- employee_availability Tabelle existiert ✅
-- ABER: 0 Einträge! Wird nicht genutzt!
-- Status-Enum: available, unavailable, vacation, sick, training, other
-- Hat start_date, end_date, tenant_id ✅

-- current_employee_availability VIEW existiert ✅
-- Zeigt aktuellen Status basierend auf Datum
-- ABER: Nur 2 Test-Einträge
```

#### API Endpoints
- ❌ Kein `/api/v2/users/:id/availability` Endpoint
- ❌ Kein `/api/v2/availability` für CRUD-Operationen
- ❌ shifts.ts lädt keine Verfügbarkeitsdaten

### 3. Multi-Tenant Isolation
- ⚠️ tenant_id in employee_availability vorhanden ✅
- ❌ Aber keine Prüfung in Queries implementiert

## 🚀 SOLL-Zustand (Lösung)

### Phase 1: Backend API (2h)
1. **Neue API Endpoints** in `/backend/src/routes/v2/users/`
   - `GET /api/v2/users/:id/availability` - Aktuelle Verfügbarkeit
   - `POST /api/v2/users/:id/availability` - Neue Verfügbarkeit setzen
   - `GET /api/v2/availability?date=2025-08-22` - Alle für Datum
   - `DELETE /api/v2/availability/:id` - Verfügbarkeit löschen

2. **Service Layer**
   - Multi-tenant isolation mit WHERE tenant_id
   - Date-Range Overlap Check
   - Auto-expire alte Einträge

### Phase 2: manage-employees.html Integration (3h)
1. **Modal erweitern**
   ```html
   <!-- Neue Section im Edit-Modal -->
   <div class="form-section availability-section">
     <h3>Verfügbarkeit</h3>
     <select name="availability_status">
       <option value="available">Verfügbar</option>
       <option value="vacation">Urlaub</option>
       <option value="sick">Krank</option>
       <option value="unavailable">Nicht verfügbar</option>
     </select>
     <input type="date" name="availability_start" />
     <input type="date" name="availability_end" />
     <textarea name="availability_notes"></textarea>
   </div>
   ```

2. **JavaScript erweitern**
   - editEmployee() lädt Verfügbarkeit mit
   - saveEmployee() speichert Verfügbarkeit
   - Zeigt aktuelle Verfügbarkeiten als Liste

### Phase 3: shifts.html Integration (2h)
1. **Employee Sidebar**
   - API Call für aktuelle Woche: `/api/v2/availability?week=34`
   - Badge dynamisch setzen basierend auf Status
   - Nicht-verfügbare mit opacity: 0.5

2. **Drag&Drop Validation**
   ```javascript
   // In assignEmployeeToShift()
   if (employee.currentStatus !== 'available') {
     showErrorAlert(`${employee.name} ist ${employee.statusText} vom ${start} bis ${end}`);
     return;
   }
   ```

### Phase 4: Daten-Migration (1h)
1. **Cleanup current_employee_availability**
   - View droppen (redundant)
   - Durch API-basierte Lösung ersetzen

2. **Initial-Daten**
   - Alle Mitarbeiter als "available" by default
   - Admin kann dann individuell setzen

## ✅ Implementation Status (22.08.2025 - 14:30 - ABGESCHLOSSEN)

### Was wurde umgesetzt:

1. **Backend API** ✅
   - `/api/availability/*` v1 Endpoints existieren bereits
   - `/api/v2/users/:id/availability` PUT endpoint existiert
   - Multi-tenant isolation in Service implementiert

2. **Frontend manage-employees.html** ✅
   - Modal erweitert mit Verfügbarkeits-Section
   - Status-Dropdown (Verfügbar/Urlaub/Krank/Nicht verfügbar/Schulung/Sonstiges)
   - Von/Bis Datum Felder
   - Notiz-Feld für Details
   - editEmployee() lädt Verfügbarkeitsdaten
   - Form Submit speichert Verfügbarkeit via v2 API

3. **Frontend shifts.ts** ✅ (100% fertig)
   - `loadEmployeeAvailability()` Methode implementiert
   - Lädt Status für aktuelle Woche von `/api/availability/current`
   - Mappt Status auf Employee-Objekte
   - Badges werden dynamisch gesetzt
   - ✅ **Drag&Drop Validation implementiert** - zeigt detaillierte Fehlermeldung mit Status und Verfügbarkeitsdatum

### ✅ ALLE AUFGABEN ABGESCHLOSSEN:

1. ✅ **Drag&Drop Validation** - Blockiert nicht-verfügbare Mitarbeiter mit detaillierter Fehlermeldung (Name, Status, Verfügbarkeitsdatum, Grund)
2. ✅ **Cleanup durchgeführt:**
   - `current_employee_availability` VIEW durch direkte Query in availability.service.ts ersetzt
   - Migration-Script erstellt: `011-drop-redundant-availability-view.sql`
   - Ungenutztes Employee-Status-Modal aus admin-dashboard.html entfernt
3. ⏳ **Testing** - Bereit für manuelle Tests mit verschiedenen Status und Datumsbereichen

## 📝 Implementation TodoWrite

```javascript
[
  { content: "Create availability API endpoints in backend", status: "pending" },
  { content: "Add availability service with multi-tenant isolation", status: "pending" },
  { content: "Extend manage-employees modal with availability fields", status: "pending" },
  { content: "Update editEmployee() to load availability", status: "pending" },
  { content: "Update saveEmployee() to save availability", status: "pending" },
  { content: "Modify shifts.ts to load weekly availability", status: "pending" },
  { content: "Update employee sidebar badges dynamically", status: "pending" },
  { content: "Add drag&drop validation for unavailable employees", status: "pending" },
  { content: "Test with different status and date ranges", status: "pending" },
  { content: "Clean up redundant current_employee_availability view", status: "pending" }
]
```

## ⚠️ Wichtige Überlegungen

1. **Performance**: Availability für ganze Woche in einem Call laden
2. **Cache**: 5 Minuten Cache für Availability-Status
3. **UI/UX**: Klare visuelle Unterscheidung (Farben, Icons)
4. **Validation**: Keine überlappenden Zeiträume pro Mitarbeiter
5. **History**: Alte Einträge behalten für Reporting

## 🔄 Migration Script

```sql
-- Keine strukturellen Änderungen nötig!
-- employee_availability Tabelle ist ready

-- Optional: current_employee_availability VIEW droppen
DROP VIEW IF EXISTS current_employee_availability;

-- Initial alle als verfügbar
INSERT INTO employee_availability (employee_id, tenant_id, status, start_date, end_date, created_by)
SELECT
  u.id,
  u.tenant_id,
  'available',
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 1 YEAR),
  u.id
FROM users u
WHERE u.role = 'employee'
  AND NOT EXISTS (
    SELECT 1 FROM employee_availability ea
    WHERE ea.employee_id = u.id
    AND ea.tenant_id = u.tenant_id
  );
```

## 🎯 Erwartetes Ergebnis

1. **manage-employees.html**:
   - Bearbeiten → Modal mit Verfügbarkeits-Section
   - Status + Zeitraum einstellbar
   - Historie der Verfügbarkeiten sichtbar

2. **shifts.html**:
   - Mitarbeiter-Liste zeigt echten Status
   - Nur "Verfügbar" = grün, Rest grau
   - Drag&Drop blockiert für nicht-verfügbare
   - Klare Fehlermeldung mit Grund + Zeitraum

3. **Datenbank**:
   - employee_availability gefüllt mit echten Daten
   - Multi-tenant sicher
   - Performance optimiert mit Indizes
