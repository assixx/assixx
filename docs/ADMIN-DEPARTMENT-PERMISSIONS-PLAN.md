# 🎯 Implementierungsplan: Admin-Abteilungszuweisungen

**Erstellt:** 16.06.2025
**Status:** Genehmigt - Bereit zur Implementierung
**Priorität:** HOCH
**Geschätzte Dauer:** 2-3 Tage

## 📋 Übersicht

Dieses Dokument beschreibt den detaillierten Implementierungsplan für das granulare Berechtigungssystem für Admins. Root-User können Admins spezifische Abteilungen zuweisen und deren Zugriffsrechte kontrollieren.

## 🎯 Kernfunktionen

1. **Root kann Abteilungen erstellen** (wie Admin) siehe sidbar bei admin-dashboard -> im Prinzip gleich.
2. **Root kann Abteilungsgruppen erstellen und verwalten**:
   - Hierarchische Gruppierung (z.B. "Produktion" → "Gelbe Dosen", "Rote Dosen")
   - Flexible Zuordnung von Abteilungen zu Gruppen
3. **Root muss beim Admin-Erstellen Berechtigungen zuweisen**:
   - Keine Abteilungen (**DEFAULT** - Security by Design)
   - Spezifische Abteilungen (department_id)
   - Abteilungsgruppen (automatisch alle untergeordneten Abteilungen)
   - Alle Abteilungen
4. **Manage-Admins Seite erweitern**:
   - Bearbeiten-Modal: Abteilungen/Gruppen zuweisen/entziehen
   - Visuelle Darstellung der Hierarchie
5. **User Info Card in Sidebar**:
   - Badge zeigt zugewiesene Abteilungen/Gruppen für Admins

## 📝 Detaillierter Implementierungsplan

### Phase 1: Vorbereitung

- [ ] **Dokumentation lesen**:
  - `design-standards.md` - UI/UX Richtlinien und design-standards.html (villeicht DESIGN-Standards.html)
  - `development-guide.md` - Entwicklungsstandards
  - `navigation-container.md` - Navigation-Integration
  - `typescript-standards.md` - TypeScript Best Practices
- [ ] Datenbank-Backup erstellen
- [ ] Branch erstellen: `feature/admin-department-permissions`

### Phase 2: Backend-Implementierung

#### Datenbank-Schema

```sql
-- Neue Tabelle für Admin-Abteilungs-Berechtigungen
CREATE TABLE admin_department_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    admin_user_id INT NOT NULL,
    department_id INT NOT NULL,
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    assigned_by INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_admin_dept (tenant_id, admin_user_id, department_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- Index für Performance
CREATE INDEX idx_admin_permissions ON admin_department_permissions(admin_user_id, tenant_id);

-- Neue Tabelle für Abteilungsgruppen (Hierarchische Struktur)
CREATE TABLE department_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_group_id INT NULL, -- Für verschachtelte Gruppen
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_name (tenant_id, name),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_group_id) REFERENCES department_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Verknüpfungstabelle: Welche Abteilungen gehören zu welcher Gruppe
CREATE TABLE department_group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    group_id INT NOT NULL,
    department_id INT NOT NULL,
    added_by INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_member (group_id, department_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES department_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Admin-Berechtigungen können auch auf Gruppen vergeben werden
CREATE TABLE admin_group_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    admin_user_id INT NOT NULL,
    group_id INT NOT NULL,
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    assigned_by INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_admin_group (tenant_id, admin_user_id, group_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES department_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- Performance Indizes
CREATE INDEX idx_group_members ON department_group_members(department_id, group_id);
CREATE INDEX idx_admin_group_perms ON admin_group_permissions(admin_user_id, tenant_id);
```

#### API-Endpoints

```typescript
// Neue Endpoints in backend/src/routes/admin-permissions.ts
GET    /api/admin-permissions/:adminId              // Abteilungen eines Admins abrufen
POST   /api/admin-permissions                       // Berechtigungen setzen/aktualisieren
DELETE /api/admin-permissions/:adminId/:departmentId // Einzelne Berechtigung entfernen
GET    /api/admin-permissions/my-departments        // Eigene Abteilungen (für Sidebar)
POST   /api/admin-permissions/bulk                  // Bulk-Operations

// Neue Endpoints für Gruppen-Berechtigungen
POST   /api/admin-permissions/groups                // Gruppen-Berechtigungen setzen
DELETE /api/admin-permissions/:adminId/group/:groupId // Gruppen-Berechtigung entfernen

// Neue Endpoints in backend/src/routes/department-groups.ts
GET    /api/department-groups                       // Alle Gruppen abrufen
GET    /api/department-groups/hierarchy             // Hierarchische Struktur
POST   /api/department-groups                       // Neue Gruppe erstellen
PUT    /api/department-groups/:id                   // Gruppe bearbeiten
DELETE /api/department-groups/:id                   // Gruppe löschen
POST   /api/department-groups/:id/departments       // Abteilungen zur Gruppe hinzufügen
DELETE /api/department-groups/:id/departments/:deptId // Abteilung aus Gruppe entfernen
```

#### Middleware-Erweiterung

```typescript
// backend/src/middleware/departmentAccess.ts
export const checkDepartmentAccess = async (req, res, next) => {
  const { user } = req;
  const { department_id } = req.body || req.query || req.params;

  // Root und Employees überspringen
  if (user.role === 'root' || user.role === 'employee') {
    return next();
  }

  // Admin: Prüfe Berechtigungen
  if (user.role === 'admin' && department_id) {
    const hasAccess = await AdminPermissionService.hasAccess(user.id, department_id, user.tenant_id);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Keine Berechtigung für diese Abteilung',
      });
    }
  }

  next();
};
```

#### Service-Layer

```typescript
// backend/src/services/adminPermission.service.ts
class AdminPermissionService {
  // Prüft ob Admin Zugriff hat (inkl. Gruppen-Berechtigungen)
  async hasAccess(adminId, departmentId, tenantId);

  // Holt alle Abteilungen eines Admins (direkt + über Gruppen)
  async getAdminDepartments(adminId, tenantId);

  // Setzt Berechtigungen (überschreibt bestehende)
  async setPermissions(adminId, departmentIds, assignedBy, tenantId);

  // Setzt Gruppen-Berechtigungen
  async setGroupPermissions(adminId, groupIds, assignedBy, tenantId);

  // Entfernt einzelne Berechtigung
  async removePermission(adminId, departmentId, tenantId);

  // Entfernt Gruppen-Berechtigung
  async removeGroupPermission(adminId, groupId, tenantId);

  // Audit-Log für Änderungen
  async logPermissionChange(action, adminId, targetId, targetType, changedBy);
}

// backend/src/services/departmentGroup.service.ts
class DepartmentGroupService {
  // Erstellt neue Gruppe
  async createGroup(name, description, parentGroupId, tenantId, createdBy);

  // Fügt Abteilungen zur Gruppe hinzu
  async addDepartmentsToGroup(groupId, departmentIds, tenantId, addedBy);

  // Holt alle Abteilungen einer Gruppe (rekursiv)
  async getGroupDepartments(groupId, tenantId);

  // Holt Gruppen-Hierarchie
  async getGroupHierarchy(tenantId);

  // Löscht Gruppe (mit Prüfung auf Berechtigungen)
  async deleteGroup(groupId, tenantId);
}
```

### Phase 3: Frontend - Admin Creation

#### Admin-Erstellungsformular erweitern

```html
<!-- In signup.html nach Role-Auswahl -->
<div id="departmentPermissionsSection" class="form-section" style="display:none;">
  <h4>Abteilungszuweisungen</h4>
  <div class="info-box warning">
    <i class="fas fa-info-circle"></i>
    Aus Sicherheitsgründen haben neue Admins standardmäßig keinen Zugriff auf Abteilungen.
  </div>

  <div class="permission-type-selection">
    <label class="radio-label">
      <input type="radio" name="permissionType" value="none" checked />
      <span>Keine Abteilungen (Standard - Sicher)</span>
    </label>

    <label class="radio-label">
      <input type="radio" name="permissionType" value="specific" />
      <span>Spezifische Abteilungen auswählen</span>
    </label>

    <label class="radio-label">
      <input type="radio" name="permissionType" value="groups" />
      <span>Abteilungsgruppen auswählen</span>
    </label>

    <label class="radio-label">
      <input type="radio" name="permissionType" value="all" />
      <span>Alle Abteilungen (Vollzugriff)</span>
    </label>
  </div>

  <div id="departmentSelectContainer" style="display:none;">
    <select id="departmentSelect" multiple class="form-control">
      <!-- Dynamisch befüllt -->
    </select>
    <small class="form-text">Halten Sie Strg/Cmd gedrückt für Mehrfachauswahl</small>
  </div>

  <div id="groupSelectContainer" style="display:none;">
    <div class="group-tree-view">
      <!-- Hierarchische Darstellung der Gruppen -->
    </div>
    <small class="form-text"
      >Wählen Sie Gruppen aus. Alle untergeordneten Abteilungen werden automatisch eingeschlossen.</small
    >
  </div>
</div>
```

#### JavaScript-Erweiterung

```javascript
// In signup.js
function handleRoleChange() {
  const role = document.querySelector('role').value;
  const permissionsSection = document.querySelector('departmentPermissionsSection');

  if (role === 'admin' && currentUser.role === 'root') {
    permissionsSection.style.display = 'block';
    loadAvailableDepartments();
  } else {
    permissionsSection.style.display = 'none';
  }
}

function handlePermissionTypeChange() {
  const type = document.querySelector('input[name="permissionType"]:checked').value;
  const departmentContainer = document.querySelector('departmentSelectContainer');
  const groupContainer = document.querySelector('groupSelectContainer');

  departmentContainer.style.display = type === 'specific' ? 'block' : 'none';
  groupContainer.style.display = type === 'groups' ? 'block' : 'none';

  if (type === 'groups') {
    loadDepartmentGroups();
  }
}

async function loadDepartmentGroups() {
  try {
    const response = await fetch('/api/department-groups/hierarchy');
    const groups = await response.json();
    renderGroupTree(groups);
  } catch (error) {
    console.error('Fehler beim Laden der Gruppen:', error);
  }
}

function renderGroupTree(groups, level = 0) {
  // Rekursive Darstellung der Gruppen-Hierarchie
  // mit Checkboxen und visueller Einrückung
}
```

### Phase 4: Frontend - Manage Admins

#### Tabellen-Erweiterung

```html
<!-- In manage-admins.html -->
<table class="admin-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
      <th>Abteilungen</th>
      <!-- NEU -->
      <th>Aktionen</th>
    </tr>
  </thead>
  <tbody id="adminTableBody">
    <!-- Dynamisch befüllt -->
  </tbody>
</table>
```

#### Permission-Modal

```html
<!-- Modal für Berechtigungen -->
<div id="permissionModal" class="modal">
  <div class="modal-content">
    <h3>Abteilungsberechtigungen bearbeiten</h3>

    <div class="admin-info">
      <p><strong>Admin:</strong> <span id="adminName"></span></p>
      <p><strong>Email:</strong> <span id="adminEmail"></span></p>
    </div>

    <div class="permission-options">
      <button on click="selectAllDepartments()">Alle auswählen</button>
      <button on click="selectNoDepartments()">Keine auswählen</button>
    </div>

    <div class="department-list">
      <!-- Checkboxen für jede Abteilung -->
    </div>

    <div class="modal-actions">
      <button on click="savePermissions()" class="btn-primary">Speichern</button>
      <button on click="closeModal()" class="btn-cancel">Abbrechen</button>
    </div>
  </div>
</div>
```

### Phase 5: Frontend - Sidebar Badge

#### HTML-Struktur

```html
<!-- In der Sidebar User Info -->
<div class="user-info-card">
  <div class="user-details">
    <span class="user-name">Max Mustermann</span>
    <span class="user-role">Admin</span>
  </div>

  <!-- NEU: Department Badge -->
  <div class="user-departments-badge" id="departmentBadge">
    <i class="fas fa-building"></i>
    <span class="badge loading">Lade...</span>
  </div>
</div>
```

#### CSS-Styling

```css
.user-departments-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.user-departments-badge .badge {
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 12px;
  font-size: 0.8rem;
}

.badge.badge-warning {
  border-color: rgba(255, 193, 7, 0.3);
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.badge.badge-info {
  border-color: rgba(0, 123, 255, 0.3);
  background: rgba(0, 123, 255, 0.2);
  color: #007bff;
}

.badge.badge-success {
  border-color: rgba(40, 167, 69, 0.3);
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
}
```

#### JavaScript-Logik

```javascript
// In common.js oder sidebar.js
async function loadDepartmentBadge() {
  const user = getCurrentUser();
  if (user.role !== 'admin') return;

  try {
    const response = await fetch('/api/admin-permissions/my-departments');
    const data = await response.json();

    const badge = document.querySelector('departmentBadge');
    const badgeSpan = badge.querySelector('.badge');

    if (data.hasAllAccess) {
      badgeSpan.className = 'badge badge-success';
      badgeSpan.textContent = 'Alle Abteilungen';
    } else if (data.departments.length === 0) {
      badgeSpan.className = 'badge badge-warning';
      badgeSpan.textContent = 'Keine Abteilungen';
    } else {
      badgeSpan.className = 'badge badge-info';
      badgeSpan.textContent = `${data.departments.length} Abteilungen`;
      badgeSpan.title = data.departments.map((d) => d.name).join(', ');
    }
  } catch (error) {
    console.error('Fehler beim Laden der Abteilungen:', error);
  }
}
```

### Phase 6: Abteilungsgruppen-Verwaltung UI

#### Gruppen-Verwaltungsseite (Nur für Root)

```html
<!-- Neue Seite: manage-department-groups.html -->
<div class="page-container">
  <h1>Abteilungsgruppen verwalten</h1>

  <button on click="showCreateGroupModal()" class="btn-primary">
    <i class="fas fa-plus"></i> Neue Gruppe erstellen
  </button>

  <div class="group-management-grid">
    <div class="group-tree-panel">
      <h3>Gruppenstruktur</h3>
      <div id="groupTree">
        <!-- Hierarchische Darstellung -->
      </div>
    </div>

    <div class="group-details-panel">
      <h3>Gruppendetails</h3>
      <div id="groupDetails">
        <!-- Details der ausgewählten Gruppe -->
      </div>
    </div>
  </div>
</div>
```

#### Gruppen-Erstellungs-Modal

```html
<div id="createGroupModal" class="modal">
  <div class="modal-content">
    <h3>Neue Abteilungsgruppe erstellen</h3>

    <form id="createGroupForm">
      <div class="form-group">
        <label>Gruppenname *</label>
        <input type="text" id="groupName" required />
      </div>

      <div class="form-group">
        <label>Beschreibung</label>
        <textarea id="groupDescription" rows="3"></textarea>
      </div>

      <div class="form-group">
        <label>Übergeordnete Gruppe (optional)</label>
        <select id="parentGroup">
          <option value="">Keine (Hauptgruppe)</option>
          <!-- Dynamisch befüllt -->
        </select>
      </div>

      <div class="form-group">
        <label>Abteilungen zuordnen</label>
        <div class="department-checklist">
          <!-- Checkbox-Liste aller Abteilungen -->
        </div>
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn-primary">Erstellen</button>
        <button type="button" on click="closeModal()" class="btn-cancel">Abbrechen</button>
      </div>
    </form>
  </div>
</div>
```

### Phase 7: Zusätzliche Features

#### Berechtigungs-Templates

```javascript
const permissionTemplates = {
  production: {
    name: 'Nur Produktion',
    departments: ['Produktion', 'Fertigung', 'Qualitätskontrolle'],
    suggestedGroups: [
      {
        name: 'Produktion',
        subgroups: [
          { name: 'Gelbe Dosen', departments: ['Gelbe Dosen - Früh', 'Gelbe Dosen - Spät'] },
          { name: 'Rote Dosen', departments: ['Rote Dosen - Früh', 'Rote Dosen - Spät'] },
        ],
      },
    ],
  },
  administration: {
    name: 'Nur Verwaltung',
    departments: ['HR', 'Buchhaltung', 'IT'],
  },
  management: {
    name: 'Management',
    departments: ['Geschäftsführung', 'Vertrieb', 'Marketing'],
  },
};
```

#### Batch-Operations

```javascript
// Mehrere Admins gleichzeitig bearbeiten
async function bulkAssignDepartments(adminIds, departmentIds) {
  const response = await fetch('/api/admin-permissions/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminIds,
      departmentIds,
      operation: 'assign', // oder 'remove'
    }),
  });
  return response.json();
}
```

### Phase 8: Testing & Sicherheit

#### Test-Szenarien

1. **Neue Admin-Erstellung**:
   - [ ] Default: Keine Abteilungen
   - [ ] Spezifische Auswahl funktioniert
   - [ ] Gruppen-Auswahl funktioniert
   - [ ] Alle Abteilungen funktioniert

2. **Berechtigungen bearbeiten**:
   - [ ] Hinzufügen von Abteilungen
   - [ ] Hinzufügen von Gruppen
   - [ ] Entfernen von Abteilungen/Gruppen
   - [ ] Bulk-Operations
   - [ ] Vererbung bei Gruppen funktioniert

3. **Zugriffskontrolle**:
   - [ ] Admin ohne Berechtigung kann keine Daten sehen
   - [ ] Admin mit Berechtigung sieht nur seine Abteilungen
   - [ ] Admin mit Gruppen-Berechtigung sieht alle untergeordneten Abteilungen
   - [ ] Root sieht alles

4. **Gruppen-Verwaltung**:
   - [ ] Gruppen erstellen/bearbeiten/löschen
   - [ ] Hierarchische Strukturen funktionieren
   - [ ] Abteilungen zu Gruppen hinzufügen/entfernen
   - [ ] Zirkuläre Abhängigkeiten werden verhindert

5. **Edge Cases**:
   - [ ] Gelöschte Abteilungen
   - [ ] Gelöschte Gruppen
   - [ ] Deaktivierte Admins
   - [ ] Performance mit 50+ Abteilungen
   - [ ] Performance mit verschachtelten Gruppen

#### Security-Checks

- [ ] SQL-Injection Prevention
- [ ] XSS-Schutz
- [ ] CSRF-Token Validierung
- [ ] Rate Limiting für API-Calls
- [ ] Audit-Logging funktioniert

### Phase 9: Migration & Rollout

#### Daten-Migration

```sql
-- Migration für bestehende Admins
-- Option 1: Alle bekommen erstmal KEINE Berechtigung (sicher)
-- Option 2: Alle bekommen ALLE Berechtigungen (rückwärtskompatibel)

-- Empfehlung: Option 1 mit Benachrichtigung an Root
```

#### Rollout-Strategie

1. **Development-Test** (1 Tag)
2. **Staging-Deployment** (1 Tag)
3. **Production-Rollout** (1 Tag)
4. **Monitoring & Bugfixes** (fortlaufend)

## ⚠️ Wichtige Entscheidungen

- **Default**: Neue Admins bekommen standardmäßig **KEINE** Abteilungen (Security by Default)
- **Gruppen-Vererbung**: Berechtigung auf Gruppe = automatisch Zugriff auf alle untergeordneten Abteilungen
- **Hierarchie-Tiefe**: Maximal 3 Ebenen für Gruppen (Performance & Übersichtlichkeit)
- **Notification**: Admin wird per E-Mail über Berechtigungsänderungen informiert
- **Audit-Log**: Alle Änderungen werden in `admin_logs` gespeichert
- **Bestehende Admins**: Müssen vom Root explizit Berechtigungen erhalten
- **Rückwärtskompatibilität**: Wird durch explizite Zuweisung sichergestellt
- **Gruppen-Löschung**: Nur möglich wenn keine aktiven Admin-Berechtigungen existieren

## 📊 Erfolgs-Metriken

- [ ] Alle Tests bestanden
- [ ] Performance: API-Calls < 200ms
- [ ] Keine kritischen Security-Issues
- [ ] Dokumentation aktualisiert
- [ ] Root-User Training durchgeführt

## 🔗 Verwandte Dokumente

- [abteilung_Zuweisung_root.md](./abteilung_Zuweisung_root.md) - Ursprüngliches Konzept
- [DESIGN-STANDARDS.md](./DESIGN-STANDARDS.md) - UI/UX Guidelines
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) - Code Standards
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - Migration Best Practices
