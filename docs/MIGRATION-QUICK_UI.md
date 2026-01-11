# Migration Quick Reference

Branch: lint/refactoring

## 🚨 ABSOLUTE MIGRATION GOALS 🚨

### ❌ ELIMINATE (100% REMOVAL)

- Bootstrap CSS & JavaScript
- Inline styles (style="...")
- Inline JavaScript (vanilla JS in < script >)
- Legacy components

### ✅ REPLACE WITH

- **Tailwind CSS** - ALL styling through Tailwind classes
- **Pure HTML** - NO inline styles
- **TypeScript Modules** - ALL JavaScript in .ts files
- **Design System** - Components from Storybook

## Per Page Checklist

### Step 0: STORYBOOK (WICHTIG!)

- [ ] Open <http://localhost:6006>
- [ ] Find the component you need (Forms, Buttons, Modals, etc.)
- [ ] Click "Show code" to see HTML structure
- [ ] Copy the HTML exactly as shown
- [ ] **DON'T GUESS** - Use the exact structure from Storybook!

### Step 1: HTML

- [ ] Replace Bootstrap components with copied Storybook HTML
- [ ] Remove Bootstrap classes (.btn, .form-control, .modal, etc.)
- [ ] Use Design System classes from Storybook examples

### Step 2: CSS

- [ ] Remove inline styles
- [ ] Use Design System utilities or Tailwind classes
- [ ] Verify styles match Storybook examples

### Step 3: TypeScript

- [ ] Extract inline `<script>` to TypeScript module(s)
- [ ] Create .ts files in appropriate scripts/ subdirectory
- [ ] Import module in HTML: `<script type="module">`
- [ ] Add proper types (no any, strict mode)
- [ ] Compile: `docker exec assixx-backend pnpm run type-check`

### Testing

- [ ] Visual check (looks correct?)
- [ ] Functionality check (works correctly?)
- [ ] Console check (no errors?)
- [ ] Type check passes
- [ ] Test on mobile/tablet

### Git Commit

```bash
git add frontend/src/pages/[filename].html
git add frontend/src/scripts/[module].ts
git commit -m "Migrate [filename] to Design System + TypeScript"
```

## STORYBOOK WORKFLOW EXAMPLE

**Want to add a modal?**

1. Go to <http://localhost:6006>
2. Navigate to "Feedback / Modals"
3. Find "Confirmation Modal" story
4. Click "Show code"
5. Copy this HTML:

```html
<div class="ds-modal ds-modal--sm">
  <div class="ds-modal__header">
    <h2 class="ds-modal__title">...</h2>
  </div>
  <div class="ds-modal__body">...</div>
  <div class="ds-modal__footer">...</div>
</div>
```

6. Paste into your HTML file
7. Modify content only, keep structure!

## Completed Migrations

### ✅ Fully Migrated Pages (2025-01-14)

- login.html - All inline JS extracted to login-pre-check.ts
- signup.html - All inline JS extracted to TypeScript modules
- root-dashboard.html - Complete migration with Storybook components:
  - ✅ Card component from Storybook (replaced custom logs-widget)
  - ✅ HoverTable from DataDisplay story
  - ✅ All inline JS extracted to root-init.ts
  - ✅ 100% Design System components

## Bootstrap Removal ✅ COMPLETE (2025-12-15)

Phase 9 executed: Deleted Bootstrap CSS/JS + Compat layer (7 files, ~768 lines)

**Removed:**

- `bootstrap.min.css`
- `bootstrap.bundle.min.js`
- `bootstrap-override.css`
- `compat/bootstrap-buttons.css`
- `compat/bootstrap-forms.css`
- `compat/bootstrap-modals.css`
- `compat/bootstrap-tables.css`
