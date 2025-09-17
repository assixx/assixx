# 📅 Calendar v2 Masterplan - Ultimate Implementation Guide

## 🎯 Übersicht

Komplette Überarbeitung des Calendar-Systems mit verbesserter Filter-Logik, Multi-Tenant Isolation und klarer Event-Hierarchie.

## 📊 Aktuelle DB-Analyse

### Existierende Tabellen

1. **calendar_events** ✅ (Gut strukturiert)
2. **calendar_attendees** ⚠️ (Fehlt tenant_id!)
3. **calendar_recurring_patterns** ✅

### calendar_events Struktur (NEU - VERBESSERT)

```sql
- id (PK)
- tenant_id ✅ (Multi-Tenant)
- user_id (Ersteller)
- title, description, location
- start_date, end_date
- org_level ENUM('company','department','team','personal') ✅
- department_id INT NULL (NUR für department/team Events)
- team_id INT NULL (NUR für team Events)
- is_private (für private Events)
- allow_attendees BOOLEAN DEFAULT TRUE (für Teilnehmer-Einladungen)
- created_by_role ENUM('admin','lead','user') (für Berechtigungen)
- color, status, type
```

**WICHTIG:** Keine org_id Ambiguität mehr! Separate Spalten für department_id und team_id.

## 🔧 ERFORDERLICHE DB-ÄNDERUNGEN

### 1. calendar_events - org_id Split (NEU!) 🚨

```sql
-- Neue Migration: 017-calendar-split-org-id.sql
ALTER TABLE calendar_events
  ADD COLUMN department_id INT NULL AFTER org_level,
  ADD COLUMN team_id INT NULL AFTER department_id,
  ADD COLUMN allow_attendees BOOLEAN DEFAULT TRUE,
  ADD COLUMN created_by_role ENUM('admin','lead','user') DEFAULT 'user';

-- Migrate existing data
UPDATE calendar_events
SET department_id = org_id
WHERE org_level = 'department';

UPDATE calendar_events
SET team_id = org_id
WHERE org_level = 'team';

-- Add constraints
ALTER TABLE calendar_events
  ADD CONSTRAINT chk_department_required
    CHECK ((org_level != 'department' AND org_level != 'team') OR department_id IS NOT NULL),
  ADD CONSTRAINT chk_team_required
    CHECK (org_level != 'team' OR team_id IS NOT NULL);

-- Drop old ambiguous column (nach Verifikation!)
-- ALTER TABLE calendar_events DROP COLUMN org_id;
```

### 2. calendar_attendees - tenant_id (KRITISCH!) 🚨

**Migration Script bereit:** `/database/migrations/016-calendar-tenant-isolation.sql`

#### Ausführung

```bash
# 1. Backup erstellen (PFLICHT!)
bash scripts/quick-backup.sh "before_calendar_migration_$(date +%Y%m%d_%H%M%S)"

# 2. Migration kopieren und ausführen
docker cp database/migrations/016-calendar-tenant-isolation.sql assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main < /tmp/016-calendar-tenant-isolation.sql'

# 3. Verifizieren
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "DESCRIBE calendar_attendees;"'
```

#### Was macht die Migration

1. ✅ Prüft ob tenant_id bereits existiert (Safety)
2. ✅ Fügt tenant_id Spalte hinzu
3. ✅ Füllt tenant_id aus calendar_events Tabelle
4. ✅ Setzt tenant_id als NOT NULL
5. ✅ Erstellt Performance-Indexes
6. ✅ Fügt Foreign Key Constraint hinzu
7. ✅ Verifiziert alle Änderungen

## 🎨 NEUE FILTER-LOGIK

### Filter-Buttons (UI)

```html
<div class="tab-navigation mb-2" id="levelFilter">
  <button class="tab-btn active" data-value="all" id="filterAll">Gesamt</button>
  <button class="tab-btn" data-value="company" id="filterCompany">Firma</button>
  <button class="tab-btn" data-value="department" id="filterDepartment">Abteilung</button>
  <button class="tab-btn" data-value="team" id="filterTeam">Team</button>
  <button class="tab-btn" data-value="personal" id="filterPersonal">Meine</button>
</div>
```

### Filter-Definitionen

#### 1. **GESAMT** (Alle sichtbaren Events) - OPTIMIERT

```sql
-- Mit Performance-Optimierung und Pagination
SELECT DISTINCT e.* FROM calendar_events e
LEFT JOIN calendar_attendees a ON e.id = a.event_id
WHERE e.tenant_id = :tenantId
AND e.start_date >= :startDate  -- Zeitfenster-Filter
AND e.end_date <= :endDate
AND (
  -- Firmen-Events (alle sehen)
  e.org_level = 'company'
  -- Abteilungs-Events (nur eigene Abteilung)
  OR (e.org_level = 'department' AND e.department_id = :userDepartmentId)
  -- Team-Events (nur eigenes Team)
  OR (e.org_level = 'team' AND e.team_id = :userTeamId)
  -- Persönliche Events (erstellt oder eingeladen)
  OR e.user_id = :userId
  OR a.user_id = :userId
)
ORDER BY e.start_date ASC
LIMIT 500  -- Performance-Schutz
```

**Index-Strategie für Performance:**

```sql
CREATE INDEX idx_calendar_filter_optimized
ON calendar_events(tenant_id, start_date, end_date, org_level);

CREATE INDEX idx_calendar_user_events
ON calendar_events(tenant_id, user_id, start_date);
```

#### 2. **FIRMA** (Company-wide Events)

```sql
SELECT * FROM calendar_events
WHERE tenant_id = :tenantId
AND org_level = 'company'
```

#### 3. **ABTEILUNG** (Department Events)

```sql
SELECT e.*, COUNT(a.id) as attendee_count
FROM calendar_events e
LEFT JOIN calendar_attendees a ON e.id = a.event_id
WHERE e.tenant_id = :tenantId
AND e.org_level = 'department'
AND e.department_id = :userDepartmentId
AND e.start_date >= :startDate
AND e.end_date <= :endDate
GROUP BY e.id
ORDER BY e.start_date ASC
LIMIT 200
```

#### 4. **TEAM** (Team Events)

```sql
SELECT e.*, COUNT(a.id) as attendee_count
FROM calendar_events e
LEFT JOIN calendar_attendees a ON e.id = a.event_id
WHERE e.tenant_id = :tenantId
AND e.org_level = 'team'
AND e.team_id = :userTeamId
AND e.department_id = :userDepartmentId  -- Team gehört zu Department
AND e.start_date >= :startDate
AND e.end_date <= :endDate
GROUP BY e.id
ORDER BY e.start_date ASC
LIMIT 200
```

#### 5. **MEINE** (Personal Events)

```sql
SELECT DISTINCT e.* FROM calendar_events e
LEFT JOIN calendar_attendees a ON e.id = a.event_id
WHERE e.tenant_id = :tenantId
AND (
  e.user_id = :userId  -- Selbst erstellt
  OR a.user_id = :userId  -- Als Teilnehmer
)
AND e.org_level = 'personal'
```

## 📝 EVENT-ERSTELLUNG MODAL ANPASSUNGEN

### Neues Formular-Layout

```html
<!-- Event Level Auswahl -->
<div class="form-group">
  <label>Event-Ebene *</label>
  <select id="eventOrgLevel" class="form-control" required>
    <option value="personal">Persönlich</option>
    <option value="team">Team</option>
    <option value="department">Abteilung</option>
    <option value="company">Firma</option>
  </select>
</div>

<!-- Dynamisch: Nur bei team/department -->
<div class="form-group" id="orgIdGroup" style="display:none;">
  <label id="orgIdLabel">Auswahl</label>
  <select id="eventOrgId" class="form-control">
    <!-- Dynamisch gefüllt basierend auf org_level -->
  </select>
</div>

<!-- Teilnehmer: Nur bei personal/team Events -->
<div class="form-group" id="attendeesGroup">
  <label>Teilnehmer einladen</label>
  <div id="attendeesList">
    <!-- Checkbox-Liste mit Mitarbeitern -->
  </div>
</div>
```

### JavaScript Logic für Modal

```javascript
// Bei org_level Änderung
document.querySelector('eventOrgLevel').addEventListener('change', (e) => {
  const level = e.target.value;
  const orgIdGroup = document.querySelector('orgIdGroup');
  const attendeesGroup = document.querySelector('attendeesGroup');

  switch (level) {
    case 'company':
      orgIdGroup.style.display = 'none';
      attendeesGroup.style.display = 'none';
      break;
    case 'department':
      orgIdGroup.style.display = 'block';
      loadDepartments(); // Lade Abteilungen
      attendeesGroup.style.display = 'none';
      break;
    case 'team':
      orgIdGroup.style.display = 'block';
      loadTeams(); // Lade Teams
      attendeesGroup.style.display = 'block';
      break;
    case 'personal':
      orgIdGroup.style.display = 'none';
      attendeesGroup.style.display = 'block';
      break;
  }
});
```

## 🔌 API v2 Anpassungen

### GET /api/v2/calendar/events

```typescript
// Query Parameters mit Validierung
interface CalendarQuery {
  filter?: 'all' | 'company' | 'department' | 'team' | 'personal';
  start?: string;
  end?: string;
  page?: number;
  limit?: number;
}

// Service Methode mit Permission Checks
async getEvents(query: CalendarQuery, user: AuthUser) {
  const { filter = 'all', limit = 200, page = 1 } = query;

  // Performance-Schutz
  const safeLimit = Math.min(limit, 500);
  const offset = (page - 1) * safeLimit;

  switch(filter) {
    case 'company':
      return this.getCompanyEvents(user.tenantId, safeLimit, offset);
    case 'department':
      if (!user.departmentId) throw new Error('User has no department');
      return this.getDepartmentEvents(user.tenantId, user.departmentId, safeLimit, offset);
    case 'team':
      if (!user.teamId) throw new Error('User has no team');
      return this.getTeamEvents(user.tenantId, user.teamId, safeLimit, offset);
    case 'personal':
      return this.getPersonalEvents(user.tenantId, user.id, safeLimit, offset);
    default:
      return this.getAllVisibleEvents(user, safeLimit, offset);
  }
}
```

### POST /api/v2/calendar/events - MIT BERECHTIGUNGEN

```typescript
interface CreateEventDto {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  orgLevel: 'company' | 'department' | 'team' | 'personal';
  departmentId?: number; // Explizit für department/team Events
  teamId?: number; // Explizit für team Events
  attendeeIds?: number[]; // Für alle Event-Typen möglich
  isPrivate?: boolean;
  color?: string;
}

// Permission Check im Service
async createEvent(dto: CreateEventDto, user: AuthUser) {
  // BERECHTIGUNGS-CHECKS
  switch(dto.orgLevel) {
    case 'company':
      if (user.role !== 'admin') {
        throw new ForbiddenException('Only admins can create company events');
      }
      break;

    case 'department':
      if (!dto.departmentId) throw new BadRequestException('departmentId required');
      if (user.role !== 'admin' && user.role !== 'lead') {
        throw new ForbiddenException('Only admins and leads can create department events');
      }
      if (user.departmentId !== dto.departmentId && user.role !== 'admin') {
        throw new ForbiddenException('Cannot create events for other departments');
      }
      break;

    case 'team':
      if (!dto.teamId || !dto.departmentId) {
        throw new BadRequestException('teamId and departmentId required');
      }
      if (user.teamId !== dto.teamId && user.role !== 'admin') {
        throw new ForbiddenException('Cannot create events for other teams');
      }
      break;

    case 'personal':
      // Jeder kann persönliche Events erstellen
      break;
  }

  // Event erstellen mit expliziten Feldern
  const event = {
    ...dto,
    tenantId: user.tenantId,
    userId: user.id,
    departmentId: dto.departmentId || null,
    teamId: dto.teamId || null,
    createdByRole: user.role,
    allowAttendees: dto.attendeeIds && dto.attendeeIds.length > 0
  };

  return this.repository.create(event);
}
```

## 🎯 Frontend Integration (calendar.ts)

### Filter-Implementation mit State-Persistenz

```typescript
// Filter-State in localStorage speichern
let currentFilter = localStorage.getItem('calendarFilter') || 'all';

// Update loadCalendarEvents function mit Pagination
async function loadCalendarEvents(fetchInfo: FullCalendarFetchInfo): Promise<FullCalendarEventInput[]> {
  const params = new URLSearchParams({
    start: fetchInfo.startStr,
    end: fetchInfo.endStr,
    filter: currentFilter,
    limit: '200', // Performance-Limit
    page: '1',
  });

  const useV2 = featureFlags.isEnabled('USE_API_V2_CALENDAR');
  const apiUrl = useV2 ? `/api/v2/calendar/events?${params}` : `/api/calendar?${params}`;

  try {
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });

    if (!response.ok) {
      // Error handling für Berechtigungsfehler
      if (response.status === 403) {
        console.error('Permission denied for filter:', currentFilter);
        // Fallback zu personal wenn keine Berechtigung
        currentFilter = 'personal';
        localStorage.setItem('calendarFilter', currentFilter);
        return loadCalendarEvents(fetchInfo); // Retry mit personal
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Calendar load failed:', error);
    return [];
  }
}

// Filter-Button Handler mit State-Save
filterButtons.forEach((btn) => {
  document.querySelector(btn.id)?.addEventListener('click', () => {
    currentFilter = btn.value;
    localStorage.setItem('calendarFilter', currentFilter);
    calendar.refetchEvents();
  });
});
```

## 🔒 SICHERHEIT & MULTI-TENANT

### Wichtige Checks

1. **IMMER tenant_id prüfen** bei allen Queries
2. **Org-Level Berechtigungen:**
   - Company: Nur Admins können erstellen
   - Department: Department-Leads + Admins
   - Team: Team-Leads + Admins
   - Personal: Alle User

### Backend Validation

```typescript
// In calendar.service.ts
private validateEventAccess(event: CalendarEvent, user: AuthUser): boolean {
  // Tenant Check
  if (event.tenantId !== user.tenantId) return false;

  // Org Level Check
  switch(event.orgLevel) {
    case 'company':
      return true; // Alle im Tenant sehen
    case 'department':
      return event.orgId === user.departmentId;
    case 'team':
      return event.orgId === user.teamId;
    case 'personal':
      return event.userId === user.id ||
             this.isAttendee(event.id, user.id);
  }
}
```

## 📋 IMPLEMENTATION CHECKLISTE

### Phase 1: Database

- [ ] Backup der DB erstellen
- [ ] Migration 017-calendar-split-org-id.sql erstellen und ausführen (org_id Split)
- [ ] Migration 016-calendar-tenant-isolation.sql ausführen (tenant_id)
- [ ] Performance-Indexes erstellen

### Phase 2: Backend API v2

- [ ] calendar.service.ts Filter-Methoden mit Pagination implementieren
- [ ] Permission-Checks für Event-Erstellung (Admin/Lead/User)
- [ ] NULL-Handling für department_id/team_id
- [ ] Validation mit expliziten Error Messages
- [ ] Multi-Tenant Checks in JEDER Query
- [ ] Performance-Monitoring für Queries >100ms

### Phase 3: Frontend

- [ ] Filter-Buttons in calendar.html anpassen
- [ ] localStorage für Filter-State implementieren
- [ ] Error-Handling für 403 Forbidden
- [ ] Event-Modal mit separaten department_id/team_id Feldern
- [ ] Attendees für ALLE Event-Typen ermöglichen
- [ ] Loading-States während API-Calls
- [ ] Pagination-UI für >200 Events

### Phase 4: Testing

- [ ] Filter testen (alle 5 Varianten)
- [ ] Multi-Tenant Isolation testen
- [ ] Event-Erstellung für alle Level
- [ ] Berechtigungen prüfen

## 🎨 UI/UX Verbesserungen

### Event-Farben nach Level

```css
/* Company Events - Blau */
.fc-event[data-org-level='company'] {
  border-color: #1976d2;
  background-color: #2196f3;
}

/* Department Events - Grün */
.fc-event[data-org-level='department'] {
  border-color: #388e3c;
  background-color: #4caf50;
}

/* Team Events - Orange */
.fc-event[data-org-level='team'] {
  border-color: #f57c00;
  background-color: #ff9800;
}

/* Personal Events - Lila */
.fc-event[data-org-level='personal'] {
  border-color: #7b1fa2;
  background-color: #9c27b0;
}
```

### Event-Icons

```javascript
// Icons je nach Level
const eventIcons = {
  company: '🏢',
  department: '🏬',
  team: '👥',
  personal: '👤',
};
```

## 📊 Erwartete Verbesserungen

1. **Klarere Event-Hierarchie** - User verstehen sofort welche Events für wen sind
2. **Bessere Performance** - Gefilterte Queries statt alles laden
3. **Sicherheit** - Strikte Multi-Tenant Isolation
4. **UX** - Intuitive Filter und Farbcodierung

## ⚠️ WICHTIGE HINWEISE

1. **Backup vor Migration!**
2. **tenant_id in calendar_attendees ist KRITISCH für Sicherheit**
3. **org_id muss bei department/team Events gesetzt sein**
4. **Admins sollten Firma-Events erstellen können**
5. **Filter "Meine" zeigt NUR persönliche Events, nicht alle wo man dabei ist**

---

_Erstellt: 08.08.2025_
_Version: 1.0_
_Status: Ready for Implementation_
