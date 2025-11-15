# 📤 DOCUMENT UPLOAD MODAL - IMPLEMENTATION PLAN

**Status:** Implementation Ready
**Date:** 2025-01-12
**Version:** 1.0

---

## 🎯 CORE PRINCIPLE

**"Sichtbarkeit ist automatisch durch Kategorie-Auswahl bestimmt!"**

User wählt Kategorie → Sichtbarkeit wird automatisch gesetzt → Keine manuellen Sichtbarkeits-Optionen nötig!

---

## 📋 UPLOAD FLOW (Step-by-Step)

### Step 1: **File Upload** (Drag & Drop oder Click)
- **Erlaubte Formate:** PDF, JPG, PNG, DOCX, XLSX
- **Max Größe:** 5 MB
- **Preview:** Dateiname + Größe anzeigen

### Step 2: **Kategorie Auswahl** (Dropdown mit Icons)

| Kategorie | Sichtbarkeit | Icon | Access Scope |
|-----------|--------------|------|--------------|
| **Firma** | Alle mit tenant_id | 🏢 fa-briefcase | `company` |
| **Abteilung** | Alle mit department_id | 🏛️ fa-building | `department` |
| **Team** | Alle mit team_id | 👥 fa-users | `team` |
| **Persönlich** | Nur user_id (privat) | 👤 fa-user | `personal` |
| **Gehaltsabrechnung** | Nur user_id + Periode | 💰 fa-money-bill | `payroll` |

### Step 3: **Dokumentname** (Auto-Fill mit Edit-Option)
- Automatisch vom Upload erkannt (`file.name`)
- User kann vor Speichern ändern
- Wird als `original_name` gespeichert

### Step 4: **Beschreibung** (Optional)
- Mehrzeiliges Textfeld
- Optional, kann leer sein
- Wird als `description` gespeichert

### Step 5: **Tags** (Optional)
- Multi-Select oder Freitext
- Optional
- Wird als JSON Array gespeichert: `["urgent", "tax-2025"]`

### Step 6: **Speichern**
- Validation durchführen
- FormData bauen mit automatischer Sichtbarkeit
- Upload via API POST `/api/v2/documents`

---

## 🔑 AUTOMATIC VISIBILITY MAPPING

```typescript
const CATEGORY_MAPPINGS = {
  'company': {
    accessScope: 'company',
    requiresField: null,
    autoPopulate: { category: 'company-document' }
  },
  'department': {
    accessScope: 'department',
    requiresField: 'department_id',
    autoPopulate: {
      category: 'department-document',
      targetDepartmentId: user.department_id
    }
  },
  'team': {
    accessScope: 'team',
    requiresField: 'team_id',
    autoPopulate: {
      category: 'team-document',
      targetTeamId: user.team_id
    }
  },
  'personal': {
    accessScope: 'personal',
    requiresField: null,
    autoPopulate: {
      category: 'personal-document',
      ownerUserId: user.id
    }
  },
  'payroll': {
    accessScope: 'payroll',
    requiresField: null,
    requiresExtraFields: ['salary_year', 'salary_month'],
    autoPopulate: {
      category: 'payroll',
      ownerUserId: user.id
    }
  }
};
```

---

## 🗄️ DATABASE FIELDS MAPPING

### FormData → Database Mapping:

| Form Input | Database Column | Example |
|------------|----------------|---------|
| `file` | `file_content` / `file_path` | (binary/path) |
| `category` | `access_scope` | `'team'` |
| (auto) | `owner_user_id` | `5` (user.id) |
| (auto) | `target_team_id` | `3` (user.team_id) |
| (auto) | `target_department_id` | `2` (user.department_id) |
| `documentName` | `original_name` | `'Vertrag_2025.pdf'` |
| `description` | `description` | `'Wichtiger Vertrag...'` |
| `tags` | `tags` | `'["urgent","contract"]'` |
| (auto) | `tenant_id` | `1` (from auth) |
| (auto) | `created_by` | `5` (user.id) |
| (payroll only) | `salary_year` | `2025` |
| (payroll only) | `salary_month` | `1` (Jan) |

---

## 🔐 SECURITY & VALIDATION

### Client-Side Validation:
```typescript
function validateUpload(category: string, user: User): boolean {
  const mapping = CATEGORY_MAPPINGS[category];

  // Check if user has required field
  if (mapping.requiresField && !user[mapping.requiresField]) {
    showError(`Sie müssen ${getFieldName(mapping.requiresField)} haben!`);
    return false;
  }

  // Check file size
  if (file.size > 5 * 1024 * 1024) {
    showError('Datei zu groß! Max 5 MB');
    return false;
  }

  // Check file type
  const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(ext)) {
    showError('Dateityp nicht erlaubt!');
    return false;
  }

  return true;
}
```

### Server-Side Validation (Backend):
- Zod Schema prüft alle Felder
- `accessScope` muss valid ENUM sein
- Foreign Keys prüfen automatisch Existenz (tenant, user, team, dept)
- Multi-Tenant Isolation via `tenant_id`

---

## 📤 FORMDATA BUILD LOGIC

```typescript
async function buildFormData(
  file: File,
  category: string,
  documentName: string,
  description: string,
  tags: string[]
): Promise<FormData> {
  const user = await getCurrentUser();
  const mapping = CATEGORY_MAPPINGS[category];

  // Validate
  if (!validateUpload(category, user)) {
    throw new Error('Validation failed');
  }

  const fd = new FormData();

  // File
  fd.append('document', file);

  // Access Scope (automatic!)
  fd.append('accessScope', mapping.accessScope);

  // Auto-populate fields based on category
  Object.entries(mapping.autoPopulate).forEach(([key, value]) => {
    if (typeof value === 'function') {
      fd.append(key, value(user).toString());
    } else {
      fd.append(key, value.toString());
    }
  });

  // User inputs
  fd.append('originalName', documentName);
  if (description) fd.append('description', description);
  if (tags.length > 0) fd.append('tags', JSON.stringify(tags));

  // Payroll extra fields
  if (category === 'payroll') {
    const year = (document.getElementById('salary-year') as HTMLSelectElement).value;
    const month = (document.getElementById('salary-month') as HTMLSelectElement).value;
    fd.append('salaryYear', year);
    fd.append('salaryMonth', month);
  }

  return fd;
}
```

---

## 🎨 UI STRUCTURE (HTML)

```html
<div class="upload-modal">
  <!-- Step 1: File Upload -->
  <div class="file-drop-area" id="drop-area">
    <i class="fas fa-cloud-upload-alt"></i>
    <p>Datei hierher ziehen oder klicken</p>
    <p class="text-sm">PDF, JPG, PNG, DOCX, XLSX (max 5 MB)</p>
    <input type="file" id="file-input" hidden />
  </div>

  <!-- Step 2: Category Selection -->
  <div class="form-group">
    <label>Kategorie *</label>
    <select id="category-select" required>
      <option value="">-- Auswählen --</option>
      <option value="company">🏢 Firma (alle sehen)</option>
      <option value="department">🏛️ Abteilung (nur meine Abteilung)</option>
      <option value="team">👥 Team (nur mein Team)</option>
      <option value="personal">👤 Persönlich (nur ich)</option>
      <option value="payroll">💰 Gehaltsabrechnung (nur ich)</option>
    </select>
  </div>

  <!-- Payroll Extra Fields (hidden by default) -->
  <div id="payroll-fields" class="hidden">
    <div class="grid grid-cols-2 gap-4">
      <div class="form-group">
        <label>Jahr *</label>
        <select id="salary-year">
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
      </div>
      <div class="form-group">
        <label>Monat *</label>
        <select id="salary-month">
          <option value="1">Januar</option>
          <option value="2">Februar</option>
          <!-- ... -->
        </select>
      </div>
    </div>
  </div>

  <!-- Step 3: Document Name -->
  <div class="form-group">
    <label>Dokumentname *</label>
    <input type="text" id="document-name" required />
  </div>

  <!-- Step 4: Description -->
  <div class="form-group">
    <label>Beschreibung (optional)</label>
    <textarea id="description" rows="3"></textarea>
  </div>

  <!-- Step 5: Tags -->
  <div class="form-group">
    <label>Tags (optional)</label>
    <input type="text" id="tags" placeholder="urgent, contract, ..." />
  </div>

  <!-- Footer -->
  <div class="modal-footer">
    <button class="btn btn-cancel" id="cancel-btn">Abbrechen</button>
    <button class="btn btn-primary" id="upload-btn">
      <i class="fas fa-upload"></i> Hochladen
    </button>
  </div>
</div>
```

---

## ✅ IMPLEMENTATION CHECKLIST

- [ ] Remove old visibility radio buttons from HTML
- [ ] Update category dropdown with 5 options (company, department, team, personal, payroll)
- [ ] Add payroll extra fields (year/month selectors, hidden by default)
- [ ] Implement CATEGORY_MAPPINGS object
- [ ] Implement validateUpload() function
- [ ] Implement buildFormData() with automatic mapping
- [ ] Show/hide payroll fields on category change
- [ ] Disable team/department options if user has no team/dept
- [ ] Test all 5 upload scenarios
- [ ] Verify DB fields are correctly populated

---

## 📊 TESTING SCENARIOS

### Scenario 1: Upload Company Doc
- Category: "Firma"
- Expected DB: `access_scope='company'`, all target fields NULL
- Who can see: All users with same `tenant_id`

### Scenario 2: Upload Team Doc
- Category: "Team"
- Expected DB: `access_scope='team'`, `target_team_id=user.team_id`
- Who can see: All users with same `team_id`

### Scenario 3: Upload Personal Doc
- Category: "Persönlich"
- Expected DB: `access_scope='personal'`, `owner_user_id=user.id`
- Who can see: Only `owner_user_id=user.id`

### Scenario 4: Upload Payroll Doc
- Category: "Gehaltsabrechnung"
- Extra fields: Year=2025, Month=1
- Expected DB: `access_scope='payroll'`, `owner_user_id=user.id`, `salary_year=2025`, `salary_month=1`
- Who can see: Only `owner_user_id=user.id` AND admins

---

**END OF PLAN** ✅
