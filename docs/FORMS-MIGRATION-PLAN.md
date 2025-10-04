# Bootstrap Forms → Design System Migration Plan

> **Ziel:** Alle Bootstrap Form-Klassen durch Design System Komponenten ersetzen
> **Philosophie:** KISS - Kategorie für Kategorie, File für File, Step by Step
> **Status:** IN PROGRESS - 5/25 Files Complete (20%)

## ✅ FORTSCHRITT

**Abgeschlossen (5 Files):**
1. ✅ **login.html** (6 Vorkommen) - 2 Fields migrated
2. ✅ **signup.html** (32 Vorkommen) - 9 Fields + Custom Dropdowns (UX-Feature, nicht Bootstrap)
3. ✅ **index.html** (20 Vorkommen) - 7 Fields migrated
4. ✅ **documents-search.html** (1 Vorkommen) - Search Input with Icon + Sort Select migrated
   - Replaced custom dropdown (80 lines CSS) with native select
   - Updated JavaScript event listener in `base.ts`
5. ✅ **documents-company.html** (1 Vorkommen) - Sort Select migrated
   - Uses shared `DocumentBase` class → automatically works

**Neue Komponenten erstellt:**
- ✅ **Search Input with Icon** - Storybook Story + CSS Pattern
  - `.form-field__input-wrapper`
  - `.form-field__icon`
  - `.form-field__control--with-icon`
- ✅ **Toggle Button Group** - NEW Design System Primitive (eigene Kategorie!)
  - `/design-system/primitives/toggles/`
  - `.toggle-group`, `.toggle-group__btn`, `.toggle-group__btn--active`
  - Storybook: `Design System/Toggles`
  - Use Case: View modes, filters, segmented controls
- ✅ **Custom Dropdown** - NEW Design System Primitive (eigene Kategorie!)
  - `/design-system/primitives/dropdowns/`
  - `.dropdown__trigger`, `.dropdown__menu`, `.dropdown__option`
  - Storybook: `Design System/Dropdowns`
  - Use Case: Plans (pricing), countries (flags), icons
  - Background heller als Legacy
  - 5px Abstand (nicht 4px!)

**Gesamt:** ~62 Vorkommen ersetzt von 457 (14%)

**Nächste Files:**
- account-settings.html (3)
- logs.html (3)
- root-profile.html (18)

---

---

## 🎯 Ziel

**Von:** Bootstrap Form Classes (Compat Layer)
**Zu:** Design System Komponenten mit CSS Variables (wie Buttons)

**Warum?**
- Konsistentes Design System
- Token-basiert (CSS Variables)
- Tailwind v4 Integration
- Weniger CSS (Bootstrap Compat weg)
- Storybook-dokumentiert

---

## 📊 Aktuelle Situation

**Bootstrap Forms gefunden:**
- **457 Vorkommen** in **25 HTML-Dateien**
- Compat Layer: `tailwind/compat/bootstrap-forms.css`

**Design System Status:**
- ✅ Input, Textarea, Select
- ✅ Validation States (error, success, warning)
- ✅ Helper Text
- ✅ Required Indicator
- ✅ Inline Variant
- ❌ **Checkbox/Radio** (FEHLT - BLOCKER)
- ❌ **Input Groups** (Optional - kann mit Tailwind gemacht werden)

---

## 🔄 Legacy → Neu Mapping

### Kategorie 1: Text Input

**VORHER (Bootstrap):**
```html
<div class="form-group">
  <label class="form-label">Vorname *</label>
  <input type="text" class="form-control" name="firstName" />
  <small class="form-text">Wird auf Dokumenten angezeigt</small>
</div>
```

**NACHHER (Design System):**
```html
<div class="form-field">
  <label class="form-field__label form-field__label--required" for="firstName">Vorname</label>
  <input type="text" class="form-field__control" id="firstName" name="firstName" />
  <p class="form-field__message">Wird auf Dokumenten angezeigt</p>
</div>
```

**Ersetzungen:**
- `form-group` → `form-field`
- `form-label` → `form-field__label`
- `*` im Label → `form-field__label--required` Modifier
- `form-control` → `form-field__control`
- `form-text` → `form-field__message`

---

### Kategorie 2: Textarea

**VORHER:**
```html
<div class="form-group">
  <label class="form-label">Notizen</label>
  <textarea class="form-control" name="notes"></textarea>
</div>
```

**NACHHER:**
```html
<div class="form-field">
  <label class="form-field__label" for="notes">Notizen</label>
  <textarea class="form-field__control form-field__control--textarea" id="notes" name="notes"></textarea>
</div>
```

**Ersetzungen:**
- Gleich wie Input
- Plus: `form-field__control--textarea` Modifier (für min-height)

---

### Kategorie 3: Select/Dropdown

**VORHER:**
```html
<div class="form-group">
  <label class="form-label">Abteilung</label>
  <select class="form-select" name="department">
    <option>Produktion</option>
  </select>
</div>
```

**NACHHER:**
```html
<div class="form-field">
  <label class="form-field__label" for="department">Abteilung</label>
  <select class="form-field__control form-field__control--select" id="department" name="department">
    <option>Produktion</option>
  </select>
</div>
```

**Ersetzungen:**
- `form-select` → `form-field__control form-field__control--select`

---

### Kategorie 4: Validation States

**VORHER:**
```html
<input class="form-control is-invalid" />
<div class="invalid-feedback">Fehler!</div>
```

**NACHHER:**
```html
<input class="form-field__control is-error" />
<p class="form-field__message form-field__message--error">Fehler!</p>
```

**Ersetzungen:**
- `is-invalid` → `is-error`
- `invalid-feedback` → `form-field__message form-field__message--error`
- Analog: `is-valid` → `is-success` + `form-field__message--success`

---

### Kategorie 5: Disabled/Readonly

**VORHER:**
```html
<input class="form-control" disabled />
```

**NACHHER:**
```html
<input class="form-field__control" disabled />
```

**Ersetzungen:**
- Keine! `disabled` Attribut bleibt gleich
- Styling über Design System automatisch

---

### Kategorie 6: Inline Forms

**VORHER:**
```html
<!-- Keine native Bootstrap Lösung -->
<div class="d-flex gap-2">
  <label>Filter</label>
  <select class="form-select">...</select>
</div>
```

**NACHHER:**
```html
<div class="form-field form-field--inline">
  <label class="form-field__label" for="filter">Filter</label>
  <select class="form-field__control form-field__control--select" id="filter">...</select>
</div>
```

**Ersetzungen:**
- Custom Layout → `form-field--inline` Modifier

---

### Kategorie 7: Checkboxes/Radio ⚠️ BLOCKER

**VORHER:**
```html
<div class="form-check">
  <input class="form-check-input" type="checkbox" id="isActive" />
  <label class="form-check-label" for="isActive">Aktiv</label>
</div>
```

**NACHHER:**
```html
<!-- TODO: Komponente muss erst entwickelt werden -->
<div class="form-field form-field--checkbox">
  <input class="form-field__checkbox" type="checkbox" id="isActive" />
  <label class="form-field__label" for="isActive">Aktiv</label>
</div>
```

**Status:** ❌ **Komponente fehlt - MUSS ZUERST ENTWICKELT WERDEN**

---

### Kategorie 8: Input Groups

**VORHER:**
```html
<div class="input-group">
  <input type="text" class="form-control" />
  <button class="btn">Suchen</button>
</div>
```

**NACHHER (Tailwind-basiert):**
```html
<div class="flex gap-2">
  <input type="text" class="form-field__control flex-1" />
  <button class="btn btn-primary">Suchen</button>
</div>
```

**Ersetzungen:**
- `input-group` → Tailwind `flex gap-2`
- Kein Design System Primitive nötig

---

## 📁 Files - Migration Reihenfolge

### Gruppe A: Simple Forms (starten hier)
1. `login.html` - 6 Vorkommen
2. `account-settings.html` - 3 Vorkommen
3. `logs.html` - 3 Vorkommen
4. `root-profile.html` - 18 Vorkommen
5. `admin-profile.html` - 24 Vorkommen

### Gruppe B: Medium Complexity
6. `calendar.html` - 6 Vorkommen
7. `chat.html` - 12 Vorkommen
8. `document-upload.html` - 15 Vorkommen
9. `blackboard.html` - 41 Vorkommen
10. `kvp.html` - 15 Vorkommen
11. `shifts.html` - 10 Vorkommen

### Gruppe C: Complex Forms
12. `manage-departments.html` - 15 Vorkommen
13. `manage-department-groups.html` - 11 Vorkommen
14. `manage-areas.html` - 21 Vorkommen
15. `manage-teams.html` - 21 Vorkommen
16. `feature-management.html` - 13 Vorkommen

### Gruppe D: Critical Forms (zuletzt, mit Testing)
17. `signup.html` - 32 Vorkommen - **KRITISCH**
18. `manage-employees.html` - 51 Vorkommen - **KRITISCH**
19. `manage-admins.html` - 33 Vorkommen
20. `manage-root-users.html` - 31 Vorkommen
21. `manage-machines.html` - 30 Vorkommen
22. `survey-admin.html` - 22 Vorkommen

### Gruppe E: Landing Pages
23. `index.html` - 20 Vorkommen
24. `root-dashboard.html` - 3 Vorkommen
25. `documents.html` - 1 Vorkommen

---

## 🔧 Step-by-Step Prozess (Pro File)

### Step 1: Öffne File in Editor
```bash
code frontend/src/pages/login.html
```

### Step 2: Identifiziere alle Bootstrap Form-Klassen
**Suche nach:**
- `form-group`
- `form-label`
- `form-control`
- `form-select`
- `form-text`
- `form-check` (⚠️ Blocker)
- `input-group`
- `is-invalid` / `invalid-feedback`

### Step 3: Ersetze Kategorie für Kategorie

#### 3.1 Text Inputs
- `form-group` → `form-field`
- `form-label` → `form-field__label`
- Wenn `*` im Label → Füge `form-field__label--required` hinzu
- `form-control` → `form-field__control`
- Füge `id` zum Input + `for` zum Label hinzu

#### 3.2 Textareas
- Wie Text Input
- Plus: `form-field__control--textarea` zum textarea

#### 3.3 Selects
- Wie Text Input
- `form-select` → `form-field__control form-field__control--select`

#### 3.4 Helper Texts
- `form-text` → `form-field__message`
- `small` → `p`

#### 3.5 Validation
- `is-invalid` → `is-error`
- `invalid-feedback` → `form-field__message form-field__message--error`

#### 3.6 Checkboxes/Radio
- **SKIP - Noch nicht möglich**
- Markiere mit `<!-- TODO: Checkbox migration pending -->`

#### 3.7 Input Groups
- `input-group` → `flex gap-2`
- Input: `form-field__control flex-1`

### Step 4: Test im Browser
```bash
# Frontend neu bauen
docker exec assixx-backend pnpm run build

# Browser öffnen
http://localhost:3000/[page]

# Hard Refresh
Ctrl + Shift + R
```

### Step 5: Visuelle Prüfung
- [ ] Alle Felder sichtbar
- [ ] Spacing korrekt
- [ ] Focus States funktionieren
- [ ] Validation States (wenn vorhanden)
- [ ] Required-Sternchen bei Pflichtfeldern
- [ ] Responsive (Mobile checken)

### Step 6: Funktionstest
- [ ] Tab-Navigation
- [ ] Form Submit
- [ ] Validation Messages
- [ ] Error States

### Step 7: Commit
```bash
git add frontend/src/pages/[file].html
git commit -m "migrate: [file] forms to Design System

- Replace Bootstrap form classes with Design System primitives
- Update validation states to new naming
- Add proper id/for attributes"
```

### Step 8: Nächstes File
→ Zurück zu Step 1

---

## ⚠️ BLOCKER - MUSS ZUERST ERLEDIGT WERDEN

### Checkbox/Radio Komponenten entwickeln

**1. CSS erstellen:**
```bash
touch frontend/src/design-system/primitives/forms/form.checkbox.css
```

**2. Klassen definieren:**
```css
/* form.checkbox.css */
.form-field--checkbox { }
.form-field__checkbox { }
.form-field--radio { }
.form-field__radio { }
```

**3. In Design System einbinden:**
```css
/* frontend/src/design-system/primitives/forms/index.css */
@import "./form.checkbox.css";
```

**4. Storybook Story erweitern:**
```javascript
// stories/FormFields.stories.js
export const CheckboxesAndRadios = { ... }
```

**5. Testen in Storybook:**
```bash
pnpm run storybook
# http://localhost:6006
```

---

## ✅ Checkliste - Komplette Migration

### Phase 1: Vorbereitung
- [ ] Checkbox/Radio Komponenten entwickelt
- [ ] Checkbox/Radio in Storybook dokumentiert
- [ ] Checkbox/Radio getestet

### Phase 2: Gruppe A Migration (Simple)
- [ ] login.html
- [ ] account-settings.html
- [ ] logs.html
- [ ] root-profile.html
- [ ] admin-profile.html

### Phase 3: Gruppe B Migration (Medium)
- [ ] calendar.html
- [ ] chat.html
- [ ] document-upload.html
- [ ] blackboard.html
- [ ] kvp.html
- [ ] shifts.html

### Phase 4: Gruppe C Migration (Complex)
- [ ] manage-departments.html
- [ ] manage-department-groups.html
- [ ] manage-areas.html
- [ ] manage-teams.html
- [ ] feature-management.html

### Phase 5: Gruppe D Migration (Critical)
- [ ] signup.html ⚠️
- [ ] manage-employees.html ⚠️
- [ ] manage-admins.html
- [ ] manage-root-users.html
- [ ] manage-machines.html
- [ ] survey-admin.html

### Phase 6: Gruppe E Migration (Landing)
- [ ] index.html
- [ ] root-dashboard.html
- [ ] documents.html

### Phase 7: Cleanup
- [ ] Bootstrap Compat Layer entfernen
- [ ] `bootstrap-forms.css` löschen
- [ ] Bundle Size prüfen
- [ ] Final Visual Review

---

## 🎓 Referenzen

**Design System:**
- Storybook: `http://localhost:6006/?path=/docs/design-system-form-fields--docs`
- README: `frontend/src/design-system/primitives/forms/README.md`
- CSS: `frontend/src/design-system/primitives/forms/form.base.css`
- Tokens: `frontend/src/design-system/tokens/forms.css`

**Compat Layer (wird entfernt):**
- `frontend/src/styles/tailwind/compat/bootstrap-forms.css`

**Buttons (als Referenz):**
- Erfolgreich migriert - selbes Pattern verwenden
- `frontend/src/design-system/primitives/buttons/`

---

## 📝 Notes

- Früh in Dev → können experimentieren
- KISS - nicht über-engineeren
- Step by Step - nicht alles auf einmal
- Bei Problemen: Design System anpassen, nicht umgekehrt
- Jedes File einzeln committen für einfacheres Rollback
- Storybook ist Single Source of Truth für Komponenten

---

**Status:** Ready to Start
**Next Action:** Checkbox/Radio Komponenten entwickeln
**Updated:** 2025-10-04
