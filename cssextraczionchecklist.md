# CSS Extraction Checklist

## 📊 Summary

Daraufachten ob schon eine css datei für file existiert bevor du eine neue erstellst.!
Kein sed benutzen!

<link rel="stylesheet" href= verwenden und keine @imports
vergiss auhc nciht dass extrahiert css auf html datein nach der extraktion zu entfernen

SEI EXTRREM VORSICHITG BEI DER EXTRAKTION UND ENTFERNEN VON ALTENM STYLES IN HTML!!!!!!! SONST BROKE DESIGN!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

- **Total HTML files:** 43
- **Files with CSS extracted:** 43 (100%)
- **Files still needing extraction:** 0
- **Files remaining:** NONE - ALL COMPLETED! ✅

## 🎯 Priority Levels

- 🔴 **HIGH:** Files with 2+ style blocks or 10+ inline styles
- 🟡 **MEDIUM:** Files with 1 style block and 5-10 inline styles
- 🟢 **LOW:** Files with 1 style block and <5 inline styles

## 📋 Files Requiring CSS Extraction

### 🔴 HIGH Priority (Multiple style blocks or many inline styles)

- [x] **blackboard.html** - 2 style blocks, 21 inline styles | ✅ DONE blackboard.css
- [x] **calendar.html** - 2 style blocks, 6 inline styles | ✅ DONE calendar.css
- [x] **feature-management.html** - 2 style blocks | ✅ DONE feature-management.css
- [x] **kvp-detail.html** - 2 style blocks, 6 inline styles | ✅ DONE kvp-detail.css
- [x] **shifts.html** - 2 style blocks, 9 inline styles | ✅ DONE shifts.css
- [x] **signup.html** - 2 style blocks | ✅ DONE signup.css

### 🟡 MEDIUM Priority (Standard pages with embedded styles)

#### Admin/Management Pages

- [x] **admin-dashboard.html** - 1 style block | ✅ DONE admin-dashboard.css
- [x] **admin-profile.html** - 1 style block | ✅ DONE admin-profile.css
- [x] **manage-admins.html** - 1 style block | ✅ DONE manage-admins.css
- [x] **manage-areas.html** - 1 style block | ✅ DONE manage-areas.css
- [x] **manage-departments.html** - 1 style block | ✅ DONE manage-departments.css
- [x] **manage-department-groups.html** - 1 style block | ✅ DONE manage-department-groups.css
- [x] **manage-employees.html** - 1 style block | ✅ DONE manage-employees.css
- [x] **manage-machines.html** - 1 style block | ✅ DONE manage-machines.css
- [x] **manage-root-users.html** - 1 style block | ✅ DONE manage-root-users.css
- [x] **manage-teams.html** - 1 style block | ✅ DONE manage-teams.css

#### Document Pages

- [x] **documents.html** - 1 style block | ✅ DONE documents.css (appended to existing)
- [x] **documents-company.html** - 1 style block | ✅ DONE documents-company.css
- [x] **documents-department.html** - 1 style block | ✅ DONE documents-department.css
- [x] **documents-payroll.html** - 1 style block | ✅ DONE documents-payroll.css
- [x] **documents-personal.html** - 1 style block | ✅ DONE documents-personal.css
- [x] **documents-search.html** - 1 style block | ✅ DONE documents-search.css
- [x] **documents-team.html** - 1 style block | ✅ DONE documents-team.css
- [x] **document-upload.html** - 1 style block | ✅ DONE document-upload.css

#### Survey Pages

- [x] **survey-admin.html** - 1 style block | ✅ DONE survey-admin.css (758 lines!)
- [x] **survey-details.html** - 1 style block | ✅ DONE survey-details.css
- [x] **survey-employee.html** - 1 style block | ✅ DONE survey-employee.css (676 lines!)
- [x] **survey-results.html** - 1 style block | ✅ DONE survey-results.css

#### Root/System Pages

- [x] **root-dashboard.html** - 1 style block | ✅ DONE root-dashboard.css
- [x] **root-profile.html** - 1 style block | ✅ DONE root-profile.css
- [x] **root-features.html** - No style block found | ✅ CLEAN

#### Other Pages

- [x] **account-settings.html** - 1 style block | ✅ DONE account-settings.css
- [x] **chat.html** - 1 style block | ✅ DONE chat.css
- [x] **employee-dashboard.html** - 1 style block | ✅ DONE employee-dashboard.css
- [x] **hilfe.html** - 1 style block | ✅ DONE hilfe.css
- [x] **index.html** - 1 style block | ✅ DONE index.css
- [x] **kvp.html** - 1 style block | ✅ DONE kvp.css
- [x] **login.html** - 1 style block | ✅ DONE login.css
- [x] **logs.html** - 1 style block | ✅ DONE logs.css
- [x] **rate-limit.html** - 1 style block | ✅ DONE rate-limit.css
- [x] **tenant-deletion-status.html** - 1 style block | ✅ DONE tenant-deletion-status.css (already existed, fixed imports)

last one: Biggest and KRTISCHSTE unified-navigation.ts

### ✅ CLEAN (No embedded styles found)

- **storage-upgrade.html** (check if using external CSS only)
- **navigation.html** (component file)

## 🛠️ Extraction Strategy

### Phase 1: Create CSS Files

For each HTML file, create corresponding CSS file:

- `blackboard.html` → `blackboard-inline.css`
- `calendar.html` → `calendar-inline.css`
- etc.

### Phase 2: Extract Styles

1. Move all `<style>` content to new CSS file
2. Replace with `<link rel="stylesheet" href="/styles/[filename]-inline.css">`
3. Convert inline styles to classes where possible

### Phase 3: Consolidate

1. Identify common patterns across files
2. Move common styles to shared CSS files:
   - `admin-common.css` (for all admin pages)
   - `documents-common.css` (for all document pages)
   - `survey-common.css` (for all survey pages)
3. Remove duplicates

### Phase 4: Optimization

1. Merge similar selectors
2. Use CSS variables for repeated values
3. Minify for production

## 📝 Notes

### Common Inline Styles Found

- `style="display: none"` → `.hidden` class
- `style="width: X%"` → Progress bars, should use classes
- `style="color: X"` → Status indicators, use semantic classes
- `style="margin/padding: X"` → Spacing utilities needed

### Suggested Utility Classes

```css
/* Visibility */
.hidden {
  display: none !important;
}
.invisible {
  visibility: hidden;
}

/* Spacing */
.mt-1 {
  margin-top: 0.5rem;
}
.mb-2 {
  margin-bottom: 1rem;
}
.p-3 {
  padding: 1.5rem;
}

/* Width */
.w-25 {
  width: 25%;
}
.w-50 {
  width: 50%;
}
.w-75 {
  width: 75%;
}
.w-100 {
  width: 100%;
}

/* Text */
.text-danger {
  color: var(--danger-color);
}
.text-success {
  color: var(--success-color);
}
.text-muted {
  color: var(--text-muted);
}
```

## 🎯 Goal

- Zero inline CSS in HTML files
- Modular, maintainable CSS architecture
- Better performance through caching
- Easier theming and customization

---

_Generated: 2025-09-17_
_Status: Ready for extraction_
