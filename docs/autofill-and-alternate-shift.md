# Implementierungsplan: Autofill & Alternierende Schichten

## Executive Summary

Implementierung von zwei kritischen Features für die Schichtplanung:

1. **Autofill**: Automatisches Ausfüllen von Wochenschichten beim Zuweisen
2. **Alternierende Schichtrotation**: Automatischer Wechsel zwischen Früh-/Spätschicht mit stabiler Nachtschicht

## 🎯 Ziele & Anforderungen

### Feature 1: Autofill (Quick-Win)

- **Ziel**: Zeitersparnis bei der Wochenplanung
- **Trigger**: Checkbox "Autofill" über "Verfügbare Mitarbeiter"
- **Aktion**: Bei Zuweisung eines Mitarbeiters zu einem Tag → automatisch alle Wochentage der gleichen Schicht füllen
- **Scope**: Nur aktuelle Woche, nur gleiche Schichtart

### Feature 2: Alternierende Rotation (Enterprise Feature)

- **Ziel**: Automatische Schichtrotation nach SAP-Standard
- **Pattern**: F↔S abwechselnd, N bleibt konstant
- **Trigger**: Checkbox "F und S abwechselnd und N bleibt"
- **Aktion**: Automatische Erstellung von Folgewochen mit rotierenden Schichten

## 🏗️ Technische Architektur

### Datenbank-Design (Best Practice nach Microsoft/SAP 2025)

#### Neue Tabelle: `shift_rotation_patterns`

```sql
CREATE TABLE shift_rotation_patterns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  plan_id INT NOT NULL,
  pattern_name VARCHAR(100) NOT NULL,
  pattern_type ENUM('fixed', 'alternating', 'custom') DEFAULT 'alternating',
  rotation_config JSON NOT NULL COMMENT 'Speichert Rotationslogik',
  is_active BOOLEAN DEFAULT true,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_tenant_plan (tenant_id, plan_id)
);
```

#### Neue Tabelle: `shift_rotation_assignments`

```sql
CREATE TABLE shift_rotation_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pattern_id INT NOT NULL,
  user_id INT NOT NULL,
  base_shift_type ENUM('early', 'late', 'night') NOT NULL,
  rotation_group INT DEFAULT 1 COMMENT 'Gruppe für Rotation (1=A, 2=B)',
  start_week INT NOT NULL COMMENT 'KW-Nummer Start',
  end_week INT DEFAULT NULL COMMENT 'KW-Nummer Ende (NULL = unbegrenzt)',
  FOREIGN KEY (pattern_id) REFERENCES shift_rotation_patterns(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_pattern (pattern_id, user_id),
  INDEX idx_user_week (user_id, start_week, end_week)
);
```

#### User-Settings mit Tenant-Isolation (`user_settings` Tabelle)

```sql
-- WICHTIG: user_settings hat KEINE tenant_id!
-- Tenant-Isolation erfolgt über JOIN mit users Tabelle!

-- User-spezifische Settings für Schichtplanung
INSERT INTO user_settings (user_id, setting_key, setting_value, value_type, category) VALUES
  (?, 'shift_autofill_enabled', 'false', 'boolean', 'shifts'),
  (?, 'shift_rotation_enabled', 'false', 'boolean', 'shifts'),
  (?, 'shift_autofill_config', '{"fillWeekdays":true,"skipWeekends":true}', 'json', 'shifts'),
  (?, 'shift_rotation_last_state', '{"active":false,"patternId":null}', 'json', 'shifts');

-- SICHERE Abfrage mit Tenant-Check über JOIN:
SELECT us.*, u.tenant_id
FROM user_settings us
INNER JOIN users u ON us.user_id = u.id
WHERE us.user_id = ?
AND u.tenant_id = ?  -- KRITISCH: Immer tenant_id prüfen!
AND us.category = 'shifts';
```

### JSON-Struktur für `rotation_config`

```json
{
  "type": "F_S_alternate",
  "pattern": {
    "early_late_rotation": {
      "cycle_weeks": 1,
      "groups": [
        { "id": 1, "week_odd": "early", "week_even": "late" },
        { "id": 2, "week_odd": "late", "week_even": "early" }
      ]
    },
    "night_fixed": true,
    "rotation_rules": {
      "skip_holidays": true,
      "skip_weekends": false,
      "min_rest_hours": 11
    }
  },
  "exceptions": [],
  "valid_from": "2025-01-01",
  "valid_until": null
}
```

## 📋 Implementierungsschritte

### Phase 1: UI-Komponenten (2h)

#### 1.1 Frontend - shifts.html

```html
<!-- Über "Verfügbare Mitarbeiter" einfügen -->
<div class="shift-controls">
  <label class="checkbox-label">
    <input type="checkbox" id="shift-autofill" />
    <span class="checkbox-text">Autofill</span>
    <span class="checkbox-hint">Woche automatisch füllen</span>
  </label>

  <label class="checkbox-label">
    <input type="checkbox" id="shift-rotation" />
    <span class="checkbox-text">F und S abwechselnd und N bleibt</span>
    <span class="checkbox-hint">Automatische Rotation</span>
  </label>
</div>
```

#### 1.2 CSS-Styling (von manage-admins übernehmen)

```css
.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 16px;
}

.checkbox-label:hover {

  border-color: rgba(33, 150, 243, 0.3);
  background: rgba(255, 255, 255, 0.05);
}

.checkbox-label:has(input:checked) {
  box-shadow: 0 0 20px rgba(33, 150, 243, 0.15);
  border-color: rgba(33, 150, 243, 0.5);
  background: rgba(33, 150, 243, 0.1);
}

.checkbox-hint {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}
```

### Phase 2: Frontend-Logik (4h)

#### 2.1 TypeScript - shifts.ts Erweiterungen

```typescript
// Neue Interfaces
interface ShiftAutofillConfig {
  enabled: boolean;
  fillWeekdays: boolean;
  skipWeekends: boolean;
  respectAvailability: boolean;
}

interface ShiftRotationConfig {
  enabled: boolean;
  pattern: 'F_S_alternate' | 'custom';
  nightFixed: boolean;
  autoGenerateWeeks: number; // Anzahl Wochen im Voraus
}

// Neue State-Variablen
private autofillConfig: ShiftAutofillConfig = {
  enabled: false,
  fillWeekdays: true,
  skipWeekends: true,
  respectAvailability: true
};

private rotationConfig: ShiftRotationConfig = {
  enabled: false,
  pattern: 'F_S_alternate',
  nightFixed: true,
  autoGenerateWeeks: 4
};

// Event Handler für Checkboxen
private setupShiftControls(): void {
  const autofillCheckbox = document.querySelector('shift-autofill') as HTMLInputElement;
  const rotationCheckbox = document.querySelector('shift-rotation') as HTMLInputElement;

  autofillCheckbox?.addEventListener('change', async (e) => {
    this.autofillConfig.enabled = (e.target as HTMLInputElement).checked;
    // Speichern in Datenbank statt LocalStorage
    await this.saveUserPreferenceToDatabase('shift_autofill_enabled', this.autofillConfig.enabled);
  });

  rotationCheckbox?.addEventListener('change', async (e) => {
    this.rotationConfig.enabled = (e.target as HTMLInputElement).checked;
    if (this.rotationConfig.enabled) {
      await this.showRotationSetupDialog();
    }
    // Speichern in Datenbank statt LocalStorage
    await this.saveUserPreferenceToDatabase('shift_rotation_enabled', this.rotationConfig.enabled);
  });
}

// Autofill-Logik
private async performAutofill(userId: number, day: string, shiftType: string): Promise<void> {
  if (!this.autofillConfig.enabled) return;

  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const currentWeekStart = this.getCurrentWeekStart();

  for (const weekDay of weekDays) {
    if (weekDay === day) continue; // Skip already assigned day

    const shiftData = {
      user_id: userId,
      date: this.calculateDateForDay(currentWeekStart, weekDay),
      shift_type: shiftType,
      plan_id: this.currentPlanId
    };

    await this.assignShiftSilently(shiftData);
  }

  this.showNotification('Woche automatisch ausgefüllt', 'success');
}
```

### Phase 3: Backend API (6h)

#### 3.1 Neue Endpoints in shifts.controller.ts

```typescript
// POST /api/v2/shifts/rotation/pattern
@typed.post('/rotation/pattern')
async createRotationPattern(req: TypedRequest, res: Response): Promise<void> {
  const { planId, pattern, config } = req.body;
  const result = await this.shiftsService.createRotationPattern(
    req.user.tenant_id,
    planId,
    pattern,
    config,
    req.user.id
  );
  res.json(result);
}

// GET /api/v2/shifts/rotation/preview
@typed.get('/rotation/preview')
async previewRotation(req: TypedRequest, res: Response): Promise<void> {
  const { planId, weeks } = req.query;
  const preview = await this.shiftsService.generateRotationPreview(
    req.user.tenant_id,
    Number(planId),
    Number(weeks)
  );
  res.json(preview);
}

// POST /api/v2/shifts/rotation/apply
@typed.post('/rotation/apply')
async applyRotation(req: TypedRequest, res: Response): Promise<void> {
  const { patternId, weeks } = req.body;
  const result = await this.shiftsService.applyRotationPattern(
    req.user.tenant_id,
    patternId,
    weeks
  );
  res.json(result);
}
```

#### 3.2 Service-Layer Implementierung

```typescript
// shifts.service.ts - Neue Methoden

async createRotationPattern(
  tenantId: number,
  planId: number,
  patternName: string,
  config: any,
  createdBy: number
): Promise<number> {
  const [result] = await this.db.execute(
    `INSERT INTO shift_rotation_patterns
     (tenant_id, plan_id, pattern_name, pattern_type, rotation_config, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, planId, patternName, 'alternating', JSON.stringify(config), createdBy]
  );

  return (result as any).insertId;
}

async generateRotationPreview(
  tenantId: number,
  planId: number,
  weeks: number
): Promise<ShiftRotationPreview[]> {
  // Komplexe Logik für Rotation-Preview
  const pattern = await this.getActivePattern(tenantId, planId);
  const assignments = await this.getPatternAssignments(pattern.id);

  const preview: ShiftRotationPreview[] = [];
  const currentWeek = this.getWeekNumber(new Date());

  for (let w = 0; w < weeks; w++) {
    const weekNum = currentWeek + w;
    const weekAssignments = this.calculateWeekAssignments(
      assignments,
      weekNum,
      pattern.rotation_config
    );
    preview.push({
      week: weekNum,
      year: new Date().getFullYear(),
      assignments: weekAssignments
    });
  }

  return preview;
}

private calculateWeekAssignments(
  assignments: any[],
  weekNum: number,
  config: any
): WeekAssignment[] {
  const result: WeekAssignment[] = [];
  const isOddWeek = weekNum % 2 === 1;

  for (const assignment of assignments) {
    if (assignment.base_shift_type === 'night') {
      // Nachtschicht bleibt konstant
      result.push({
        userId: assignment.user_id,
        shiftType: 'night',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });
    } else {
      // Früh/Spät alternierend
      const shiftType = this.determineShiftForWeek(
        assignment.rotation_group,
        isOddWeek
      );
      result.push({
        userId: assignment.user_id,
        shiftType,
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });
    }
  }

  return result;
}

private determineShiftForWeek(group: number, isOddWeek: boolean): string {
  // Gruppe 1: Ungerade Wochen = Früh, Gerade = Spät
  // Gruppe 2: Ungerade Wochen = Spät, Gerade = Früh
  if (group === 1) {
    return isOddWeek ? 'early' : 'late';
  } else {
    return isOddWeek ? 'late' : 'early';
  }
}
```

### Phase 4: Persistenz & State Management (3h)

#### 4.1 Datenbank-basierte User-Präferenzen (SICHER & PERSISTENT)

```typescript
// WICHTIG: KEIN LocalStorage! Alles in user_settings Tabelle speichern
// Vorteile: Sicher, Multi-Device-Sync, Backup-fähig, DSGVO-konform

// Speichern der User-Präferenzen in Datenbank
private async saveUserPreferenceToDatabase(key: string, value: any): Promise<void> {
  try {
    const response = await fetch('/api/v2/user/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({
        setting_key: key,
        setting_value: typeof value === 'object' ? JSON.stringify(value) : value,
        value_type: typeof value === 'boolean' ? 'boolean' :
                    typeof value === 'object' ? 'json' : 'string',
        category: 'shifts'
      })
    });

    if (!response.ok) throw new Error('Failed to save preference');

    // Optional: Cache in Memory für Performance
    this.userPreferencesCache[key] = value;

  } catch (error) {
    console.error('Error saving preference:', error);
    this.showNotification('Einstellung konnte nicht gespeichert werden', 'error');
  }
}

// Laden der User-Präferenzen beim Seitenaufruf
private async loadUserPreferencesFromDatabase(): Promise<void> {
  try {
    const response = await fetch('/api/v2/user/settings?category=shifts', {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) throw new Error('Failed to load preferences');

    const settings = await response.json();

    // Verarbeiten der Settings
    for (const setting of settings) {
      switch(setting.setting_key) {
        case 'shift_autofill_enabled':
          this.autofillConfig.enabled = setting.setting_value === 'true';
          const autofillCheckbox = document.querySelector('shift-autofill') as HTMLInputElement;
          if (autofillCheckbox) autofillCheckbox.checked = this.autofillConfig.enabled;
          break;

        case 'shift_rotation_enabled':
          this.rotationConfig.enabled = setting.setting_value === 'true';
          const rotationCheckbox = document.querySelector('shift-rotation') as HTMLInputElement;
          if (rotationCheckbox) rotationCheckbox.checked = this.rotationConfig.enabled;
          break;

        case 'shift_autofill_config':
          Object.assign(this.autofillConfig, JSON.parse(setting.setting_value));
          break;
      }
    }

    // Cache für schnelleren Zugriff
    this.userPreferencesCache = settings.reduce((acc, s) => {
      acc[s.setting_key] = s.setting_value;
      return acc;
    }, {});

  } catch (error) {
    console.error('Error loading preferences:', error);
    // Fallback auf Standard-Werte
    this.applyDefaultPreferences();
  }
}

// In-Memory Cache für Performance
private userPreferencesCache: Record<string, any> = {};
```

#### 4.2 Backend API für User-Settings

```typescript
// Backend: user-settings.controller.ts
import { typed } from '../../../middleware/typed';

// GET /api/v2/user/settings
@typed.get('/settings')
async getUserSettings(req: TypedRequest, res: Response): Promise<void> {
  const { category } = req.query;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;  // KRITISCH!

  // WICHTIG: Multi-Tenant-Isolation durch tenant_id Check!
  const settings = await this.userService.getUserSettings(userId, tenantId, category);
  res.json(settings);
}

// POST /api/v2/user/settings
@typed.post('/settings')
async saveUserSetting(req: TypedRequest, res: Response): Promise<void> {
  const { setting_key, setting_value, value_type, category } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenant_id;  // KRITISCH für Isolation!

  // Validierung
  if (!setting_key || setting_value === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // WICHTIG: Verify user belongs to tenant before saving!
  const userCheck = await this.db.execute(
    'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
    [userId, tenantId]
  );

  if (!userCheck[0].length) {
    return res.status(403).json({ error: 'Tenant isolation violation' });
  }

  // Speichern mit Audit-Log
  await this.userService.saveUserSetting(
    userId,
    tenantId,  // Pass tenant_id for cache invalidation
    setting_key,
    setting_value,
    value_type || 'string',
    category || 'general'
  );

  // Audit-Log für Compliance
  await rootLog({
    action: 'USER_SETTING_CHANGED',
    userId,
    details: { key: setting_key, category },
    tenant_id: req.user.tenant_id
  });

  res.json({ success: true });
}

// Service-Layer Implementierung
async saveUserSetting(
  userId: number,
  tenantId: number,  // Für Cache-Key
  key: string,
  value: any,
  valueType: string,
  category: string
): Promise<void> {
  // NOCHMAL prüfen ob User zum Tenant gehört (Defense in Depth)
  const [userCheck] = await this.db.execute(
    'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
    [userId, tenantId]
  );

  if (!userCheck.length) {
    throw new ForbiddenError('User does not belong to tenant');
  }

  // Upsert-Operation für user_settings
  await this.db.execute(
    `INSERT INTO user_settings (user_id, setting_key, setting_value, value_type, category)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     setting_value = VALUES(setting_value),
     value_type = VALUES(value_type),
     updated_at = CURRENT_TIMESTAMP`,
    [userId, key, value, valueType, category]
  );

  // Redis-Cache invalidieren mit tenant_id im Key
  await this.redis.del(`user_settings:${tenantId}:${userId}:${category}`);
  await this.redis.del(`user_settings:${tenantId}:${userId}:all`);
}

async getUserSettings(
  userId: number,
  tenantId: number,  // KRITISCH: tenant_id für Isolation!
  category?: string
): Promise<UserSetting[]> {
  // Check Redis-Cache first
  const cacheKey = `user_settings:${tenantId}:${userId}:${category || 'all'}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // SICHERE Query mit Tenant-Isolation über JOIN!
  const query = category
    ? `SELECT us.*
       FROM user_settings us
       INNER JOIN users u ON us.user_id = u.id
       WHERE us.user_id = ?
       AND u.tenant_id = ?  -- KRITISCH: Tenant-Check!
       AND us.category = ?`
    : `SELECT us.*
       FROM user_settings us
       INNER JOIN users u ON us.user_id = u.id
       WHERE us.user_id = ?
       AND u.tenant_id = ?`;  -- KRITISCH: Tenant-Check!

  const params = category ? [userId, tenantId, category] : [userId, tenantId];
  const [rows] = await this.db.execute(query, params);

  // Wenn User nicht zum Tenant gehört, gibt Query keine Ergebnisse zurück!
  if (!rows.length && category) {
    // Optional: Log potential tenant violation attempt
    await rootLog({
      action: 'TENANT_ISOLATION_CHECK',
      userId,
      tenantId,
      details: 'No settings found - possible tenant mismatch'
    });
  }

  // Cache for 5 minutes mit tenant_id im Key
  await this.redis.setex(cacheKey, 300, JSON.stringify(rows));

  return rows as UserSetting[];
}
```

## 🎨 UI/UX Considerations

### Visual Feedback

- **Autofill Active**: Blauer Glow-Effekt auf Shift-Grid
- **Rotation Active**: Grüner Badge "Rotation aktiv" über Grid
- **Preview Mode**: Ghost-Shifts in halbtransparenter Darstellung
- **Konflikt-Warnung**: Rote Markierung bei Überschneidungen

### User Flow

1. Admin aktiviert Checkbox
2. Bei Rotation: Setup-Dialog erscheint
3. Preview der nächsten 4 Wochen
4. Bestätigung oder Anpassung
5. Automatische Generierung

## 🔒 Sicherheit & Validierung

### Backend-Validierungen (KRITISCH!)

#### Multi-Tenant-Isolation (HÖCHSTE PRIORITÄT)

```typescript
// JEDE Query MUSS tenant_id prüfen!
const validateTenantAccess = (tenantId: number, userTenantId: number): void => {
  if (tenantId !== userTenantId) {
    throw new ForbiddenError('Tenant isolation violation detected');
  }
};

// Beispiel: Sichere Query mit Tenant-Check
async getShiftPlan(planId: number, userTenantId: number): Promise<ShiftPlan> {
  const [rows] = await this.db.execute(
    'SELECT * FROM shift_plans WHERE id = ? AND tenant_id = ?',
    [planId, userTenantId]  // IMMER tenant_id mit prüfen!
  );

  if (!rows.length) {
    throw new NotFoundError('Plan not found or access denied');
  }

  return rows[0];
}
```

#### Weitere Sicherheitsmaßnahmen

- **Berechtigungsprüfung**: Nur Admin-Role für Rotation-Patterns
- **Input-Validierung**: Strikte Typen-Prüfung mit TypeScript
- **SQL-Injection Schutz**: Prepared Statements überall
- **Rate-Limiting**: Max. 100 Shift-Operations pro Minute
- **Arbeitszeit-Compliance**: 11h Ruhezeit zwischen Schichten
- **Audit-Logging**: Alle Änderungen protokollieren

### Frontend-Validierungen

- **CSRF-Schutz**: Token bei allen POST-Requests
- **XSS-Prevention**: Keine innerHTML, nur textContent
- **Konflikt-Prüfung**: Warnung bei Überschneidungen
- **Bestätigungsdialoge**: Bei Massenänderungen
- **Undo-Funktionalität**: Letzte 10 Aktionen rückgängig machen
- **Session-Timeout**: Nach 30 Min Inaktivität

## 📊 Performance-Optimierung

### Datenbank

- Indizes auf häufig abgefragte Felder
- JSON-Aggregation für Bulk-Operations
- Prepared Statements für Rotation-Queries

### Frontend

- Debouncing bei Drag&Drop mit Autofill
- Lazy Loading der Rotation-Preview
- Cache für Mitarbeiter-Verfügbarkeit

## 🧪 Testing-Strategie

### Unit Tests

```typescript
describe('ShiftRotationService', () => {
  test('should alternate shifts correctly for odd weeks', () => {
    const result = service.determineShiftForWeek(1, true);
    expect(result).toBe('early');
  });

  test('should keep night shifts constant', () => {
    const assignments = service.calculateWeekAssignments([{ base_shift_type: 'night', user_id: 1 }], 22, defaultConfig);
    expect(assignments[0].shiftType).toBe('night');
  });
});
```

### Integration Tests

- Test Autofill mit verschiedenen Wochentagen
- Test Rotation über Monatsgrenzen
- Test Konfliktauflösung
- Test Multi-Tenant Isolation

## 📅 Zeitplan

| Phase      | Aufgabe           | Geschätzte Zeit | Priorität |
| ---------- | ----------------- | --------------- | --------- |
| 1          | UI-Komponenten    | 2h              | Hoch      |
| 2          | Autofill Frontend | 2h              | Hoch      |
| 3          | Autofill Backend  | 2h              | Hoch      |
| 4          | Rotation Frontend | 4h              | Mittel    |
| 5          | Rotation Backend  | 6h              | Mittel    |
| 6          | Persistenz        | 3h              | Mittel    |
| 7          | Testing           | 4h              | Hoch      |
| 8          | Dokumentation     | 2h              | Niedrig   |
| **Gesamt** |                   | **25h**         |           |

## 💾 Speicher-Strategie für Rotation (WICHTIGSTE ENTSCHEIDUNG!)

### Ansatz: Hybrid-Lösung (Best Practice 2025)

**NICHT Pre-Computing!** Stattdessen intelligente Lazy-Generation:

```typescript
// Pattern-basierte Berechnung statt Massenspeicherung
class ShiftRotationEngine {
  // Berechnet Schichten on-demand basierend auf Pattern
  async calculateShiftForUser(userId: number, date: Date, patternId: number): Promise<ShiftType> {
    // 1. Pattern aus Cache/DB laden
    const pattern = await this.getPattern(patternId);

    // 2. User-Assignment finden
    const assignment = await this.getUserAssignment(userId, patternId);

    // 3. KW berechnen
    const weekNumber = this.getWeekNumber(date);

    // 4. Schicht-Typ basierend auf Rotation berechnen
    if (assignment.base_shift_type === 'night') {
      return 'night'; // Nachtschicht bleibt konstant
    }

    // F/S Rotation basierend auf Woche
    const isOddWeek = weekNumber % 2 === 1;
    const group = assignment.rotation_group;

    return this.determineShiftByRotation(group, isOddWeek);
  }

  // Nur bei Bedarf generieren, nicht vorberechnen
  async generateWeekPlan(weekNumber: number): Promise<WeekPlan> {
    // Generiert NUR wenn angefordert
    // Speichert NUR wenn explizit bestätigt
    // Löscht alte Daten automatisch
  }
}
```

**Vorteile dieser Lösung:**

- ✅ Keine DB-Explosion (kein Pre-Computing für Jahre)
- ✅ Flexibel änderbar (Pattern-Updates sofort wirksam)
- ✅ Performance durch Redis-Cache
- ✅ DSGVO-konform (minimale Datenspeicherung)
- ✅ Skalierbar für tausende Mitarbeiter

## 🚀 Deployment-Strategie

### Feature Flags

```typescript
const FEATURES = {
  SHIFT_AUTOFILL: process.env.FEATURE_SHIFT_AUTOFILL === 'true',
  SHIFT_ROTATION: process.env.FEATURE_SHIFT_ROTATION === 'true',
};
```

### Rollout-Plan

1. **Phase 1**: Autofill für ausgewählte Tenants
2. **Phase 2**: Rotation im Beta-Test
3. **Phase 3**: Vollständiger Rollout

## 📝 Offene Fragen & Entscheidungen

### Zu klären mit Stakeholder

1. **Feiertage**: Sollen Feiertage bei Rotation übersprungen werden?
2. **Samstag**: Ist Samstag Teil der Rotation oder separat?
3. **Urlaub/Krankheit**: Wie wird mit Abwesenheiten umgegangen?
4. **Rückwirkend**: Können vergangene Wochen rotiert werden?
5. **Benachrichtigungen**: Email bei Rotation-Änderungen?

### Technische Entscheidungen

1. **Cache-Strategy**: Redis für Rotation-Patterns?
2. **Batch-Size**: Wie viele Wochen maximal generieren?
3. **Audit-Log**: Detailgrad der Änderungsprotokolle?

## 🎯 Success Metrics

- **Zeitersparnis**: 80% weniger Klicks für Wochenplanung
- **Fehlerreduktion**: 50% weniger manuelle Planungsfehler
- **User Satisfaction**: >4.5/5 Sterne Bewertung
- **Performance**: <500ms für 4-Wochen-Preview

## 🔄 Nächste Schritte

1. ✅ Review dieses Plans mit Team
2. ⬜ Datenbank-Migrationen erstellen
3. ⬜ UI-Komponenten implementieren
4. ⬜ Autofill-Feature entwickeln
5. ⬜ Rotation-Feature entwickeln
6. ⬜ Testing & QA
7. ⬜ Dokumentation für Endnutzer
8. ⬜ Beta-Test mit ausgewählten Kunden

---

**Erstellt am**: 24.08.2025
**Version**: 2.1
**Author**: Claude (Anthropic)
**Status**: 🟢 Überarbeitet & Optimiert

### Wichtigste Änderungen in v2.1

- ✅ **user_settings** mit Tenant-Isolation über JOIN mit users Tabelle
- ✅ **Kritischer Fix**: Tenant-ID Check bei allen user_settings Operationen
- ✅ **Datenbank-Persistenz** statt unsicherem LocalStorage
- ✅ **Multi-Tenant-Isolation** durch users.tenant_id JOIN
- ✅ **Defense in Depth**: Doppelte Tenant-Checks in Controller und Service
- ✅ **Lazy-Generation** statt DB-Explosion
- ✅ **Redis-Caching** mit tenant_id im Cache-Key
- ✅ **Audit-Logging** für Compliance und Isolation-Violations
