# 🎯 KVP-System Erweiterungsplan

## 📋 Übersicht

Dieser Plan beschreibt die Erweiterung des KVP-Systems um department-basierte Sichtbarkeit und erweiterte Admin-Verwaltung.

## 📚 VORBEREITUNG - PFLICHTLEKTÜRE VOR BEGINN

### ⚠️ WICHTIG: Diese Dokumente MÜSSEN vor der Implementierung gelesen werden

1. **DATABASE-MIGRATION-GUIDE.MD**
   - Verstehen der Migrationsstrategie
   - Backup-Prozeduren
   - Rollback-Mechanismen
2. **DESIGN-STANDARDS.MD**
   - Glassmorphismus-Standards
   - UI/UX Komponenten
   - Farbpalette und CSS-Variablen
3. **TYPESCRIPT-STANDARDS.MD**
   - Type-Safety Anforderungen
   - Coding Standards
   - Error Handling Patterns
4. **NAVIGATION-CONTAINER.MD**
   - Navigation Integration
   - Role-basierte Menüs
   - Sidebar-Verhalten

5. Beachte bite genau das design!!

### 🔍 Nach DATABASE-MIGRATION-GUIDE.MD

```bash
# Direkte MySQL Prüfung (SQL-Dateien können veraltet sein!)
mysql -u root -p

# In MySQL:
USE main;

# Aktuelle Struktur prüfen:
DESCRIBE kvp_suggestions;
DESCRIBE users;
DESCRIBE departments;
DESCRIBE admin_department_permissions;
DESCRIBE admin_group_permissions;
DESCRIBE department_groups;

# Constraints prüfen:
SHOW CREATE TABLE kvp_suggestions;

# Daten-Integrität prüfen:
SELECT COUNT(*) FROM kvp_suggestions WHERE department_id IS NULL;
```

### ✅ Checkliste vor Start

- [ ] DATABASE-MIGRATION-GUIDE.MD gelesen
- [ ] MySQL Datenbank direkt geprüft (nicht SQL-Dateien!)
- [ ] DESIGN-STANDARDS.MD gelesen
- [ ] TYPESCRIPT-STANDARDS.MD gelesen
- [ ] NAVIGATION-CONTAINER.MD gelesen
- [ ] Backup der Datenbank erstellt
- [ ] Test-Umgebung vorbereitet

**⛔ KEINE IMPLEMENTIERUNG OHNE ABGESCHLOSSENE CHECKLISTE!**

## 🏗️ Aktuelle Situation

### Bestehende Strukturen

- ✅ `departments` Tabelle mit hierarchischer Struktur
- ✅ `users` Tabelle mit `department_id`
- ✅ `kvp_suggestions` mit `department_id`
- ✅ `admin_department_permissions` für granulare Rechte
- ✅ `department_groups` für Bereichsleiter-Struktur

### Fehlende Komponenten

- ❌ `visibility_scope` in `kvp_suggestions`
- ❌ Department-basierte Filterung im Frontend
- ❌ "Teilen" Funktion für Admins
- ❌ Getrennte Ansichten für Admins/Employees
- ❌ Archiv-Verwaltung

## 🎭 Rollen-Hierarchie

```
ROOT (tenant_id: 8)
│
├── ADMIN (mit mehreren Departments) - "Bereichsleiter"
│   ├── Verwaltet mehrere Departments via admin_group_permissions
│   ├── Sieht alle KVPs seiner zugewiesenen Departments
│   └── Kann KVPs firmenweit teilen
│
├── ADMIN (mit einem Department) - "Abteilungsleiter"
│   ├── Verwaltet ein Department via admin_department_permissions
│   ├── Sieht nur KVPs seiner Abteilung
│   └── Kann KVPs firmenweit teilen
│
└── EMPLOYEE (Mitarbeiter)
    ├── Gehört zu einem Department
    ├── Kann KVPs einreichen (nach Submit nicht mehr editierbar!)
    └── Sieht: eigene + Abteilung + firmenweit geteilte KVPs

```

**Hinweis:** Es gibt keine offizielle "Superadmin" Rolle - die Berechtigung ergibt sich aus der Anzahl verwalteter Departments!

## 📊 Datenbank-Anpassungen

### ✅ MINIMALE Schema-Änderungen (Best Practice)

Wir nutzen das **bestehende** `org_level` und `org_id` System:

```sql
-- 1. Status bereinigen: 'pending' zu 'in_review' migrieren
UPDATE kvp_suggestions
SET status = 'in_review'
WHERE status = 'pending';

-- 2. ENUM anpassen - 'pending' entfernen
ALTER TABLE kvp_suggestions
MODIFY COLUMN status ENUM('new','in_review','approved','implemented','rejected','archived') DEFAULT 'new';

-- 3. Neue Spalten für Teilen-Funktion
ALTER TABLE kvp_suggestions
ADD COLUMN shared_by INT DEFAULT NULL,
ADD COLUMN shared_at TIMESTAMP NULL,
ADD INDEX idx_shared_by (shared_by),
ADD FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Department ID Integrität sicherstellen
UPDATE kvp_suggestions
SET department_id = (SELECT department_id FROM users WHERE id = submitted_by)
WHERE department_id IS NULL;
```

### 📝 Logik für Sichtbarkeit

- `org_level = 'department'` + `org_id = [department_id]` → Abteilungs-KVP
- `org_level = 'company'` + `org_id = [tenant_id]` → Firmenweit geteilt
- `org_level = 'team'` + `org_id = [team_id]` → Team-Level (zukünftig)

### 🔒 Status-basierte Editierbarkeit

```sql
-- Keine neue Spalte nötig!
-- Editierbar wenn: status = 'new' UND submitted_by = current_user
-- Logik im Backend implementieren
```

## 🔧 Backend API-Anpassungen

### 1. KVP Controller Erweiterungen

```typescript
// backend/controllers/kvp.controller.ts

// Neue Methode: getVisibleSuggestions
async getVisibleSuggestions(req: Request, res: Response) {
  const userId = req.user.id;
  const role = req.user.role;
  const tenantId = req.user.tenant_id;

  let query = `
    SELECT DISTINCT s.*,
           u.first_name as submitted_by_name,
           u.last_name as submitted_by_lastname,
           d.name as department_name,
           cat.name as category_name,
           cat.icon as category_icon
    FROM kvp_suggestions s
    LEFT JOIN users u ON s.submitter_id = u.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN kvp_categories cat ON s.category_id = cat.id
    WHERE s.tenant_id = ?
  `;

  const params = [tenantId];

  if (role === 'employee') {
    // Employees: Eigene + Department + Company-wide
    const userDept = await getUserDepartment(userId);
    query += ` AND (
      s.submitter_id = ? OR
      (s.department_id = ? AND s.visibility_scope = 'department') OR
      s.visibility_scope = 'company'
    )`;
    params.push(userId, userDept);

  } else if (role === 'admin') {
    // Admins: Alle aus verwalteten Departments + Company-wide
    const managedDepts = await getAdminDepartments(userId);
    const deptList = managedDepts.map(d => d.id).join(',');

    query += ` AND (
      s.department_id IN (${deptList}) OR
      s.visibility_scope = 'company'
    )`;
  }
  // Root sieht alles (keine zusätzliche WHERE-Klausel)

  // Archivierte standardmäßig ausblenden
  if (!req.query.include_archived) {
    query += ` AND s.status != 'archived'`;
  }

  // Execute query...
}

// Neue Methode: shareSuggestion
async shareSuggestion(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user.id;

  // Prüfen ob User Admin ist und Zugriff hat
  const hasAccess = await checkAdminAccessToSuggestion(userId, id);
  if (!hasAccess) {
    return res.status(403).json({ success: false, message: 'Keine Berechtigung' });
  }

  // Update visibility - department_id BLEIBT für Historie!
  await db.query(`
    UPDATE kvp_suggestions
    SET org_level = 'company',
        org_id = ?,
        shared_by = ?,
        shared_at = NOW()
    WHERE id = ?
  `, [req.user.tenant_id, userId, id]);

  // Log action
  await logAdminAction(userId, 'kvp_share', id);

  res.json({ success: true });
}

// Neue Methode: unshareSuggestion (Teilen rückgängig)
async unshareSuggestion(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user.id;

  // Nur der ursprüngliche Teiler oder Root kann rückgängig machen
  const suggestion = await db.query(`
    SELECT department_id, shared_by
    FROM kvp_suggestions
    WHERE id = ? AND org_level = 'company'
  `, [id]);

  if (!suggestion || (suggestion.shared_by !== userId && req.user.role !== 'root')) {
    return res.status(403).json({ success: false, message: 'Keine Berechtigung' });
  }

  // Zurück zur Abteilung
  await db.query(`
    UPDATE kvp_suggestions
    SET org_level = 'department',
        org_id = department_id,
        shared_by = NULL,
        shared_at = NULL
    WHERE id = ?
  `, [id]);

  res.json({ success: true });
}
```

### 2. Permission Service Erweiterungen

```typescript
// backend/services/kvpPermission.service.ts

export async function getAdminDepartments(adminId: number): Promise<number[]> {
  // Direkte Department-Permissions
  const directPerms = await db.query(
    `
    SELECT department_id 
    FROM admin_department_permissions 
    WHERE admin_user_id = ? AND can_read = TRUE
  `,
    [adminId],
  );

  // Group-basierte Permissions
  const groupPerms = await db.query(
    `
    SELECT dgm.department_id
    FROM admin_group_permissions agp
    JOIN department_group_members dgm ON agp.group_id = dgm.group_id
    WHERE agp.admin_user_id = ? AND agp.can_read = TRUE
  `,
    [adminId],
  );

  // Kombiniere und dedupliziere
  const allDepts = [...directPerms, ...groupPerms];
  return [...new Set(allDepts.map((d) => d.department_id))];
}

export async function canAdminEditKVP(adminId: number, suggestionId: number): Promise<boolean> {
  const suggestion = await db.query(
    `
    SELECT department_id, visibility_scope 
    FROM kvp_suggestions 
    WHERE id = ?
  `,
    [suggestionId],
  );

  if (!suggestion) return false;

  // Company-wide KVPs können nur vom ursprünglichen Admin bearbeitet werden
  if (suggestion.visibility_scope === "company") {
    const isOriginalAdmin = await db.query(
      `
      SELECT 1 FROM kvp_suggestions 
      WHERE id = ? AND shared_by = ?
    `,
      [suggestionId, adminId],
    );
    return !!isOriginalAdmin;
  }

  // Department KVPs
  const adminDepts = await getAdminDepartments(adminId);
  return adminDepts.includes(suggestion.department_id);
}
```

## 🎨 Frontend Anpassungen

### 1. UI-Layout nach Rolle

```javascript
// kvp.html - Dynamisches Grid Layout

// Eine gemeinsame Ansicht mit role-basierten Features
const kvpLayout = {
  // Filter-Bar für alle sichtbar
  filters: {
    mine: { show: true, label: "Meine" },
    department: { show: true, label: "Abteilung" },
    company: { show: true, label: "Firmenweit" },
    archived: { show: isAdmin, label: "Archiv" },
    manage: { show: isAdmin, label: "Verwalten" },
  },

  // Aktionen basierend auf Rolle
  actions: {
    createNew: { show: isEmployee || (isAdmin && hasRoleSwitched) },
    changeStatus: { show: isAdmin },
    share: { show: isAdmin },
    viewStatistics: { show: isAdmin },
  },

  // Info-Box für Admins
  infoBox:
    isAdmin && !hasRoleSwitched ? "💡 Tipp: Wechseln Sie zur Employee-Ansicht um selbst Vorschläge einzureichen" : null,
};
```

### 2. Filter-Anpassungen

```javascript
// Erweiterte Filter für Admins
const adminFilters = {
  status: [
    { value: "active", label: "Alle aktiven" }, // Alles außer archived
    { value: "new", label: "Neu" },
    { value: "in_review", label: "In Prüfung" },
    { value: "approved", label: "Genehmigt" },
    { value: "implemented", label: "Umgesetzt" },
    { value: "rejected", label: "Abgelehnt" },
    { value: "archived", label: "Archiviert", special: true },
  ],

  visibility: [
    { value: "all", label: "Alle" },
    { value: "department", label: "Abteilung" },
    { value: "company", label: "Firmenweit" },
  ],

  department: [], // Dynamisch laden basierend auf Admin-Rechte
};

// Archivierte in separater Card anzeigen
if (statusFilter === "archived") {
  showInCard("archivedSuggestionsCard");
} else {
  showInCard("allSuggestionsCard");
}
```

### 3. Teilen-Funktion UI

```html
<!-- In der Suggestion-Detail Ansicht -->
<div class="suggestion-actions" v-if="isAdmin && suggestion.visibility_scope === 'department'">
  <button class="btn btn-primary share-btn" @click="shareSuggestion(suggestion.id)">
    <i class="fas fa-share-alt"></i> Firmenweit teilen
  </button>
  <span class="info-text"> Macht diesen Vorschlag für alle Abteilungen sichtbar </span>
</div>

<!-- Status Badge -->
<span class="visibility-badge" :class="suggestion.visibility_scope">
  <i :class="getVisibilityIcon(suggestion.visibility_scope)"></i>
  {{ getVisibilityText(suggestion.visibility_scope) }}
</span>
```

### 4. Filter-System statt Submenu (Best Practice)

**Eine KVP-Hauptseite mit intelligentem Filter-System:**

```html
<!-- Filter-Bar oben auf der Seite -->
<div class="kvp-filter-bar">
  <!-- Für Employees -->
  <button class="filter-btn" data-filter="mine"><i class="fas fa-user"></i> Meine <span class="badge">5</span></button>
  <button class="filter-btn" data-filter="department">
    <i class="fas fa-building"></i> Abteilung <span class="badge">23</span>
  </button>
  <button class="filter-btn" data-filter="company">
    <i class="fas fa-globe"></i> Firmenweit <span class="badge">12</span>
  </button>

  <!-- Zusätzlich für Admins -->
  <button class="filter-btn admin-only" data-filter="manage"><i class="fas fa-tasks"></i> Verwalten</button>
  <button class="filter-btn admin-only" data-filter="archived">
    <i class="fas fa-archive"></i> Archiv <span class="badge">45</span>
  </button>
</div>

<!-- Status & Kategorie Filter -->
<div class="secondary-filters">
  <select id="statusFilter">
    <option value="">Alle Status</option>
    <option value="new">Neu</option>
    <option value="in_review">In Bearbeitung</option>
    <!-- etc -->
  </select>

  <select id="categoryFilter">
    <option value="">Alle Kategorien</option>
    <!-- Dynamisch geladen -->
  </select>
</div>
```

**Separate Seiten nur für:**

- `/kvp` - Hauptseite mit Filtern
- `/kvp-statistics` - Statistiken (Admin only)

**Vorteile:**

- Keine tiefen Menü-Verschachtelungen
- Schneller Wechsel zwischen Ansichten
- Übersichtliche URL-Struktur
- Mobile-friendly

## 🔒 Sicherheits-Checks

### 1. Employee Restrictions

```javascript
// Nach Submit keine Bearbeitung mehr
if (suggestion.status !== "draft" && suggestion.submitter_id === currentUser.id) {
  disableAllFormFields();
  showMessage("Eingereichte Vorschläge können nicht mehr bearbeitet werden");
}

// Nur eigene Drafts löschen
if (suggestion.status === "draft" && suggestion.submitter_id === currentUser.id) {
  showDeleteButton();
}
```

### 2. Admin Restrictions

```javascript
// Nur Vorschläge aus eigenen Departments bearbeiten
const canEdit = await checkAdminDepartmentAccess(adminId, suggestion.department_id);

// Geteilte Vorschläge nur vom ursprünglichen Admin
if (suggestion.visibility_scope === "company" && suggestion.shared_by !== adminId) {
  disableStatusChange();
  showMessage("Nur der teilende Admin kann diesen Vorschlag bearbeiten");
}
```

## 📊 Migrationsplan

### Phase 1: Datenbank (1 Tag)

1. Backup erstellen
2. Schema-Änderungen durchführen
3. Bestehende Daten migrieren (alle auf 'department' setzen)

### Phase 2: Backend (2-3 Tage)

1. Permission Service erweitern
2. KVP Controller anpassen
3. Neue API-Endpoints erstellen
4. Tests schreiben

### Phase 3: Frontend (3-4 Tage)

1. Role-basierte UI implementieren
2. Filter und Tabs einbauen
3. Teilen-Funktion hinzufügen
4. Archiv-Verwaltung

### Phase 4: Testing (2 Tage)

1. Unit Tests
2. Integration Tests
3. Manuelle Tests mit verschiedenen Rollen
4. Bug Fixes

## 🎯 Erwartete Ergebnisse

1. **Klare Trennung** zwischen Admin- und Employee-Funktionen
2. **Department-Isolation** mit Option zum Teilen
3. **Bessere Übersicht** durch Tabs und Filter
4. **Sicherheit**: Employees können nach Submit nicht mehr ändern
5. **Flexibilität**: Superadmins verwalten mehrere Abteilungen

## ⚠️ Wichtige Hinweise

1. **Keine globale Sichtbarkeit** für Employees auf alle KVPs
2. **Archivierte** werden standardmäßig ausgeblendet
3. **Role-Switch** ermöglicht Admins eigene Vorschläge
4. **Audit-Trail** für alle Admin-Aktionen
5. **Performance**: Indizes auf org_level, org_id und department_id
6. **Department-Löschung**:
   - Bei `CASCADE`: KVPs werden gelöscht
   - Besser: Departments nur deaktivieren (`status = 'inactive'`)
   - KVPs bleiben erhalten, sind aber nicht mehr sichtbar
7. **Teilen rückgängig machen**: Nur ursprünglicher Admin oder Root
8. **department_id bleibt immer erhalten** für Historie

## 🚀 Nächste Schritte

1. Review dieses Plans
2. Bestätigung der Anforderungen
3. Backup der Datenbank
4. Start mit Phase 1

---

**Erstellt am:** 20.12.2024  
**Letzte Aktualisierung:** 21.06.2025  
**Version:** 2.0  
**Status:** ✅ ERFOLGREICH IMPLEMENTIERT

---

## 🎉 IMPLEMENTIERUNGSSTATUS

### ✅ Erfolgreich umgesetzt

- Database Migration (004-kvp-department-visibility.sql)
- Backend Services (kvpPermission.service.ts, kvp.controller.ts)
- Frontend Pages (kvp-new.html, kvp-detail.html)
- Department-basierte Sichtbarkeit
- Admin Share/Unshare Funktionalität
- Role-basierte UI Anpassungen
- Custom Dropdowns gemäß Design Standards
- Filter System für verschiedene Ansichten

### 📝 Aufgetretene Probleme und Lösungen

#### 1. MySQL Execute Bug (KRITISCH)

**Problem:** `Error: Incorrect arguments to mysqld_stmt_execute`

- MySQL 8.0.22+ Bug mit Prepared Statements
- Betraf alle `pool.execute()` Aufrufe

**Lösung:**

- Alle `execute()` durch `query()` ersetzt
- Dokumentiert in MYSQL-EXECUTE-BUG.md
- GitHub Issue: <https://github.com/sidorares/node-mysql2/issues/1239>

#### 2. TypeScript Compilation Errors

**Problem:** Fehlende .js Extensions in Imports

- TypeScript ES Module Resolution

**Lösung:**

- Alle Imports mit .js Extension versehen
- CommonJS compatibility beibehalten

#### 3. Character Encoding Issues

**Problem:** Deutsche Umlaute und Emojis falsch dargestellt

**Lösung:**

```typescript
const connection = await pool.getConnection();
await connection.query("SET NAMES utf8mb4");
// queries...
connection.release();
```

#### 4. Header Display Problems

**Problem:** Header auf KVP-Seiten nicht korrekt dargestellt

- Role-Switch Button falsch positioniert
- Profilbild überdimensional

**Lösung:**

- CSS mit `@import` statt `<link>` laden
- Script-Reihenfolge: unified-navigation.ts als LETZTES
- user-info-update.css hinzugefügt
- Dokumentiert in HEADER-PROBLEM.md

#### 5. Native Select vs Custom Dropdowns

**Problem:** Native HTML `<select>` verwendet statt Custom Dropdowns

**Lösung:**

- Custom Dropdown Pattern implementiert
- JavaScript Funktionen für Toggle/Select
- Event Listener auf hidden inputs umgestellt

### 🔧 Technische Implementierungsdetails

#### Database Changes

```sql
-- Neue Spalten für Sharing
ALTER TABLE kvp_suggestions
ADD COLUMN shared_by INT DEFAULT NULL,
ADD COLUMN shared_at TIMESTAMP NULL;

-- Status Migration
UPDATE kvp_suggestions SET status = 'in_review' WHERE status = 'pending';
```

#### Permission Logic

- Employees: Eigene + Abteilung + Firmenweit geteilte
- Admins: Alle aus verwalteten Departments + Firmenweit
- Root: Alles

#### Frontend Architecture

- Single Page mit Filter System (keine Submenus)
- Role-basierte UI Elements
- Glassmorphismus Design durchgehend

### 📊 Performance Optimierungen

- Indices auf department_id, org_level, org_id
- Connection Pooling für DB Queries
- Lazy Loading für Suggestions

### 🔒 Security Features

- Employees können nach Submit nicht mehr editieren
- Admins können nur eigene Departments verwalten
- Audit Trail für alle Admin-Aktionen
- CSRF Protection auf allen Endpoints

### 📱 Responsive Design

- Mobile-First Approach
- Grid Layout für Filter
- Touch-friendly Dropdowns

---

## 🎯 Zusammenfassung

Das KVP-System wurde erfolgreich implementiert mit:

- ✅ Department-basierter Sichtbarkeit
- ✅ Admin Share/Unshare Funktionalität
- ✅ Role-basierte Berechtigungen
- ✅ Glassmorphismus Design Standards
- ✅ Custom Dropdown Components
- ✅ Responsive Filter System

Alle kritischen Bugs wurden behoben und dokumentiert. Das System ist produktionsbereit.
