# Design System Migration - Complete Replacement Strategy

Branch: `lint/refactoring`
Status: In Progress

## 🎯 MIGRATION GOALS - NO EXCEPTIONS

### ✅ END GOAL (Zero Legacy)

1. **100% Tailwind CSS** - NO Bootstrap classes anywhere
2. **Pure HTML** - NO inline styles (style="...")
3. **TypeScript Modules Only** - NO inline JavaScript/vanilla JS
4. **Design System Components** - NO custom/legacy components

### ❌ WHAT MUST BE ELIMINATED

- Bootstrap CSS (bootstrap.min.css)
- Bootstrap JavaScript (bootstrap.bundle.min.js)
- Bootstrap compatibility layers (all compat/*.css files)
- ALL inline `<script>` tags with vanilla JS
- ALL inline style="" attributes
- ALL non-Tailwind CSS classes

### ✅ WHAT WE'RE MIGRATING TO

- **Tailwind CSS** for ALL styling
- **Design System components** from Storybook
- **TypeScript modules** for ALL JavaScript
- **Clean HTML** with only class attributes

## Current Architecture Analysis

### What We Have Built

**Design System Components: 29**

- buttons (6 variants)
- forms (input, textarea, select, with states)
- toggles (button groups, ON/OFF switches)
- dropdowns (custom JS-driven)
- cards (base, stat, accent)
- containers (page wrappers)
- modals (4 sizes)
- choice-cards (radio/checkbox styled)
- badges (status indicators)
- navigation (breadcrumb, pagination, tabs, stepper, accordion)
- data-display (tables, empty-state, data-list)
- feedback (alerts, progress, spinner, skeleton, toast)
- pickers (date, time, date-range)
- file-upload (drag and drop)
- avatar (WhatsApp-style initials)
- search-input (with icons, clear button)
- empty-states
- tooltip
- collapse

**Design Tokens:**

- colors.css (semantic color system)
- shadows.css (glassmorphism shadows)
- gradients.css (reusable gradients)
- animations.css (transitions, durations, easing)

**Tooling:**

- Storybook running on :6006 (interactive documentation)
- Tailwind v4 with @theme tokens
- PostCSS with custom plugins
- Vite build system

### What Needs Removal

**Bootstrap Dependencies (768 lines):**

- `/styles/lib/bootstrap.min.css` (full Bootstrap CSS)
- `/scripts/lib/bootstrap.bundle.min.js` (Bootstrap JavaScript)
- `/styles/tailwind/compat/bootstrap-buttons.css` (175 lines)
- `/styles/tailwind/compat/bootstrap-forms.css` (189 lines)
- `/styles/tailwind/compat/bootstrap-modals.css` (186 lines)
- `/styles/tailwind/compat/bootstrap-tables.css` (218 lines)

**Legacy Patterns:**

- Inline styles in HTML (alerts, messages)
- Custom JavaScript for components that should use Design System
- Class names that don't follow Design System conventions

## CRITICAL: JavaScript Migration Strategy

**Decision: Inline JS → TypeScript Modules**

All inline JavaScript in HTML files will be migrated to TypeScript modules. No shortcuts.

**Why:**

- Best Practice 2025 (Microsoft, Google, Meta all use TypeScript)
- Type Safety (catch bugs early)
- React-ready (business logic already separated)
- Testable, reusable, maintainable
- Consistent with existing project structure (scripts/ already uses .ts)

**Important: TypeScript ≠ React**

- TypeScript = JavaScript with types (migration happens NOW)
- React = UI Framework (separate project, comes LATER)

**Per Page Migration (4 Steps):**

1. **STORYBOOK: Copy Design System component HTML**
   - Open <http://localhost:6006>
   - Find the component you need (e.g., Buttons, Forms, Modals)
   - Click "Show code" button in the story
   - Copy the HTML structure exactly
   - Use this as your template (don't reinvent!)
2. HTML: Replace Bootstrap components with copied Design System HTML
3. CSS: Inline styles → Design System/Tailwind utilities
4. JavaScript: Inline `<script>` → TypeScript module

**Example (signup.html):**

Before:

```html
<script>
  let currentCountryCode = '+49';
  function validateEmail(email) { return /.../.test(email); }
  // 400+ lines inline...
</script>
```

After:

```html
<script type="module">
  import { SignupFormController } from '/scripts/auth/signup-form.js';
  new SignupFormController().init();
</script>
```

```typescript
// frontend/src/scripts/auth/signup-form.ts
export class SignupFormController {
  private countryCode: string = '+49';

  validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  init(): void {
    this.setupEventListeners();
  }
}
```

## HTML Files Inventory

**Total: 42 pages** (src/pages/)

### Authentication

- [x] signup.html ✅ (2025-01-14)
- [x] login.html ✅ (2025-01-14)

### Dashboards

- [x] root-dashboard.html ✅ (2025-01-14) - Fully migrated with Storybook components (Card + HoverTable)
- [x] admin-dashboard.html ✅ (2025-01-17) - 100% Design System compliant (card-accent, card-stat, btn-modal, TypeScript modules)
- [x] employee-dashboard.html ✅ (2025-01-17) - 100% Design System compliant (card, card-stat, card-accent, TypeScript modules, no inline styles/JS)

### Management Pages

- [x] manage-admins.html ✅ (2025-01-18) - 100% Design System compliant (ds-modal, choice-card, empty-state, avatar, striped tables, button icons, TypeScript modules, no inline styles/JS, no Bootstrap)
- [x] manage-root-users.html ✅ (2025-01-18) - 100% Design System compliant (split to data/forms/index layers, avatar, striped tables, toggle-group, search-input, TypeScript modules, no inline styles/JS, no Bootstrap)
- [x] manage-employees.html ✅ (2025-01-20) - 100% Design System compliant (905→374 lines -59%, ds-modal, form-field, toggle-group, search-input, avatar, striped tables, btn-float, TypeScript modules, removed 385 lines legacy CSS, no inline styles/JS, no Bootstrap)
- [x] manage-departments.html ✅ (2025-01-23) - 100% Design System compliant (ds-modal, form-field, toggle-group, search-input, badge with tooltip, striped tables, btn-float, TypeScript modules split to api/forms/ui/types layers, global modal scroll-reset component, no inline styles/JS, no Bootstrap)
- [x] manage-department-groups.html ✅ (2025-01-15) - 100% Design System compliant (ds-modal, form-field, search-input, dropdown, empty-state, btn-float, TypeScript modules split to api/forms/ui/types/index layers, hierarchical group tree, no inline styles/JS, no Bootstrap)
- [x] manage-teams.html ✅ (2025-01-28) - 100% Design System compliant (ds-modal, form-field, toggle-group, search-input, dropdown, confirm-modal, empty-state, badge, btn-float, TypeScript modules split to data/forms/ui/types/index layers, multi-select dropdowns with checkboxes, no inline styles/JS, no Bootstrap)
- [x] manage-areas.html ✅ (2025-01-29) - 100% Design System compliant (ds-modal, form-field, toggle-group, search-input, dropdown, confirm-modal, empty-state, badge, btn-float, TypeScript modules split to api/forms/ui/types/index layers, two-stage force-delete with dependency warnings, status filter fix in backend controller, no inline pstyles/JS, no Bootstrap)
- [x] manage-machines.html ✅ (2025-11-02) - 100% Design System compliant (ds-modal, form-field, toggle-group, search-input, dropdown, confirm-modal, empty-state, badge, btn-float, TypeScript modules split to data/forms/ui/types/index layers, machine type & status dropdowns with badges, department/area assignment, no inline styles/JS, no Bootstrap)

### Documents

- [x] documents-explorer.html ✅ (2025-11-13) - 100% Design System compliant (NUCLEAR REFACTORING: deleted 1,227 lines legacy CSS, created minimal 195-line CSS, fixed all inline styles, TypeScript modules, NO Bootstrap, NO inline JS)


### Features and unified-navigation !!!! CRITICAL and biggest

- [x] calendar.html ✅ (2025-11-23) - 100% Design System compliant (toggle-group for filters, ds-modal, form-field, dropdown, confirm-modal for delete events, TypeScript modules split to api/filters/modals/state/types/ui/index layers, FullCalendar integration with Design System theming, Schichten toggle button independent from organization filters, fixed field mapping startTime/endTime from API v2, no inline styles/JS, no Bootstrap)
- [ ] blackboard.html
- [ ] chat.html
- [ ] shifts.html
- [ ] logs.html
- [ ] unified-navigation.ts und css !
last one
- [ ] tenant-deletion-status.html - last one
- [x] kvp.html ✅ (2025-11-13) - 100% Design System compliant (search-input, toggle-group, btn-float, alert, card-stat, modal, form-field, dropdown, empty-state, TypeScript modules split to api/data/forms/ui/types/index layers, custom photo upload kept for domain-specific requirements, kvp.css reduced 487→358 lines -27%, no inline styles/JS, no Bootstrap)
- [x] kvp-detail.html ✅ (2025-11-15) - 100% Design System compliant (ds-modal, form-field, dropdown, choice-card, data-list, badge, btn-cancel, TypeScript modules split to actions/data-loader/index/permissions/renderer/share-modal/ui layers, lightbox photo gallery, comments section with avatar, kvp-detail.css 399 lines domain-specific only, fixed Bootstrap btn-secondary→btn-cancel and btn-light→btn-cancel, no inline styles/JS, no Bootstrap)


### Surveys

- [x] survey-admin.html ✅ (2025-11-16) - 100% Design System compliant (ds-modal, form-field, dropdown, btn-float, empty-state, badges, cards, TypeScript modules split to index/ui/types layers, question builder with dynamic form fields, Tailwind grid layouts, survey-admin.css reduced 749→274 lines -63%, eliminated ALL redundant styles: survey cards→.card, status badges→.badge variants, grids→Tailwind utilities, no inline styles/JS, no Bootstrap)
- [x] survey-employee. ✅ (2025-11-16) - 100% Design System compliant
- [x] survey-results.html ✅ (2025-11-18) - 100% Design System compliant (accordion accordion--compact for individual responses, card, card-stat, progress progress--lg, badge badge--success/warning, empty-state, spinner, TypeScript modules split to data/ui/types/index layers, survey-results.css reduced 488→206 lines -58%, eliminated ALL redundant CSS: custom cards→.card, progress bars→.progress, badges→.badge, eliminated all API v1 fallbacks, fixed camelCase consistency with dbToApi() transformation, null safety for answerOptions, option texts displayed instead of IDs, no inline styles/JS, no Bootstrap)

### Admin/Root

- [x] root-features.html ✅ (2025-11-19) - 100% Design System compliant (feature-card from choice-card.feature.css with .feature-status badges, .features-grid responsive layout, plan-card from choice-card.plan.css with radio selection and ::before "Empfohlen" badge, toggle-group for filters, TypeScript modules split to types/data/ui/index layers, fixed feature codes to match database (employees, documents), fixed tenant_id initialization with dual format support, fixed plan selection radio reset on cancel/error, fixed addon save route POST→PUT with camelCase body format, root-features.css reduced 617→232 lines -62%, eliminated ALL redundant CSS: feature/plan cards→Design System components, buttons→.btn variants, grids→.features-grid/Tailwind, no inline styles/JS, no Bootstrap)
- [x] root-profile.html ✅ (2025-11-20) - 100% Design System compliant (form-field, form-field__label, form-field__control for all forms, profile-card glassmorphism cards, approval-section for deletion approvals with cooling-off warnings, TypeScript modules split to 5-layer architecture: types/data/ui/forms/index, 629 lines inline JavaScript→TypeScript modules (913 lines structured), HTML reduced 783→153 lines -80%, root-profile.css reduced 740→253 lines -66%, eliminated ALL inline scripts: profile/password forms→forms.ts, API calls→data.ts, DOM manipulation→ui.ts, event orchestration→index.ts RootProfileManager class, eliminated ALL redundant CSS: .form-control→.form-field__control, .btn-* overrides→Design System, .alert-*→Design System via notificationService, .modal-*→removed (unused), custom styles→Design System variables (--spacing-*, --color-*, --radius-*), fixed form field names firstName/lastName to match API v2, fixed alert consistency: custom showMessage→showSuccessAlert/showErrorAlert from alerts.ts (notificationService toasts), kept showSuccessOverlay for special animations, removed #message-container (unused with toast notifications), type-safe profile picture upload/removal, deletion approval workflow with data-action attributes, no inline styles/JS, no Bootstrap)
- [x] admin-profile.html ✅ (2025-11-20) - 100% Design System compliant
- [x] employee-profile.html ✅ (2025-11-20) - 100% Design System compliant
- [x] account-settings.html ✅ (2025-11-20) - 100% Design System compliant (FIXED: Inconsistent structure→Standard .card with .card__header/.card__body pattern matching manage-root/manage-admins, ds-modal with ds-modal--md size, ds-modal__header--danger/primary variants, .card--danger-border modifier for danger zone visual indicator, alert--danger for warnings, form-field__control for inputs/textarea, @container on main element, subtitle with text-[var(--color-text-secondary)] mt-2, icon spacing mr-2, CRITICAL MODAL BUG FIX: modal.classList.add('active')→modal.classList.add('modal-overlay--active') [Design System uses BEM modifier .modal-overlay--active with double dash, NOT chained class .modal-overlay.active - modal.base.css sets visibility:hidden/opacity:0% which overrides display:flex], removed custom .modal-overlay.active CSS (redundant with Design System), TypeScript modules split to 4-layer architecture: types/api/ui/index, 195 lines inline JavaScript→TypeScript modules (265 lines structured), HTML reduced 422→242 lines -43%, account-settings.css reduced 244→57 lines -77%, eliminated .settings-container custom wrapper, eliminated ALL inline scripts: modal handlers→ui.ts, API calls→api.ts, event delegation→index.ts AccountSettingsController class, eliminated ALL redundant CSS: modal styles→.ds-modal, button styles→.btn variants, form controls→.form-field__control, .settings-container→removed, kept ONLY domain-specific styles (deletion-status-icon animation, deletion-info box, card--danger-border variant), two-person-principle validation for tenant deletion, root user count check before delete, deletion queue status modal with 30-day grace period, keyboard shortcuts (Escape to close), data-action event delegation pattern, no inline styles/JS, no Bootstrap)

### Other

- [x] index.html (landing page) - **COMPLETED 2025-11-21** - Full migration: 712→472 lines (-34%), 5 TypeScript modules, CSS cleanup (-158 lines)
- [x] storage-upgrade.html - **COMPLETED 2025-11-21** - Full migration: 420→178 lines (-58%), 1 TypeScript module (256 lines inline JS extracted), 4 inline styles → CSS classes, alert() → toasts, btn-cancel → btn-secondary
- [x] rate-limit.html - **COMPLETED 2025-11-21** - Full migration: 100→38 lines (-62%), 1 TypeScript module (73 lines inline JS → 133 lines structured), Design System `.card` + Tailwind utilities, CSS: 119→48 lines (-60%), only domain-specific animations kept (fade-in-up, pulse), countdown timer with auto-redirect



## Migration Strategy

### Phase 1: Authentication Pages (Priority High)

**Files:** signup.html, login.html

**Current State:**

- Forms already use Design System (form-field__control)
- Custom dropdowns (plan-select, country-select) use vanilla JS
- Buttons use .btn btn-primary (could be Bootstrap or Design System)
- Alerts use inline styles

**Migration Tasks:**

1. HTML: Replace inline styled alerts with Design System alert component
2. HTML: Verify button classes use Design System (not Bootstrap compat)
3. HTML: Update form markup to Design System form-field components
4. CSS: Remove inline styles, use Design System/Tailwind utilities
5. TypeScript: Extract all inline JS (400+ lines) to TypeScript modules
   - Number of files depends on complexity (not fixed rule)
   - signup.html example: 2-3 files (form controller, validators, API)
   - Separation of Concerns: Form logic, validation, API calls
6. Test form submission, validation, error states

**TypeScript Files to Create (Example for signup.html):**

- frontend/src/scripts/auth/signup-form.ts (main controller)
- frontend/src/scripts/auth/signup-validators.ts (validation logic)
- frontend/src/scripts/auth/signup-api.ts (API calls)

Note: File count varies per page based on inline JS complexity.

**Acceptance Criteria (STRICT):**

✅ **MUST HAVE:**

- NO Bootstrap classes (.btn, .modal, .form-control, etc.)
- NO Bootstrap JavaScript dependencies
- NO inline styles (style="...")
- NO inline JavaScript (< script > with code)
- ONLY Tailwind classes for styling
- ONLY TypeScript modules (*.ts files)
- ONLY Design System components from Storybook
- ALL functions have proper TypeScript types (no `any`)

✅ **FUNCTIONAL:**

- Forms submit correctly
- Validation shows Design System error states
- TypeScript compiles without errors
- No console errors in browser

### Phase 2: Dashboard Pages (Priority High)

**Files:** root-dashboard.html, admin-dashboard.html, employee-dashboard.html

**Current State:**

- Complex layouts with sidebars, navigation
- Cards for statistics
- Tables for data display
- Modals for actions

**Migration Tasks:**

1. Replace Bootstrap cards with Design System card components
2. Replace Bootstrap tables with Design System data-table
3. Replace Bootstrap modals with Design System modal
4. Update navigation components to Design System
5. Refactor layout to use Tailwind utilities
6. Update TypeScript to target Design System selectors

**TypeScript Files to Update:**

- scripts/dashboard/*.ts
- scripts/admin/*.ts

**Acceptance Criteria:**

- Dashboard layout responsive
- All components use Design System
- Navigation functions correctly
- Modals open/close properly

### Phase 3: Management Pages (Priority Medium)

**Files:** manage-*.html (8 files)

**Common Patterns:**

- Data tables with actions
- Forms for create/edit
- Delete confirmations (modals)
- Search/filter functionality

**Migration Tasks:**

1. Replace Bootstrap tables with Design System data-table
2. Replace forms with Design System form components
3. Replace modals with Design System modal
4. Add Design System search-input component
5. Update TypeScript for new selectors

**TypeScript Files to Update:**

- scripts/manage/*.ts

**Acceptance Criteria:**

- CRUD operations work
- Tables sortable/filterable
- Forms validate correctly
- Modals confirm actions

### Phase 4: Document Pages (Priority Medium)

**Files:** documents*.html (8 files)

**Common Patterns:**

- File upload (drag and drop)
- Document lists
- Category filters
- Search functionality

**Migration Tasks:**

1. Implement Design System file-upload component
2. Replace document lists with Design System data-list
3. Add Design System search-input
4. Replace filter dropdowns with Design System dropdowns
5. Update TypeScript for file handling

**TypeScript Files to Update:**

- scripts/documents/*.ts

**Acceptance Criteria:**

- File upload works (drag and drop)
- Document preview functions
- Filters work correctly
- Search returns results

### Phase 5: Feature Pages (Priority Medium)

**Files:** blackboard.html, calendar.html, chat.html, shifts.html, kvp*.html, logs.html

**Complex Components:**

- Calendar (FullCalendar library)
- Chat (real-time WebSocket)
- Shifts (drag and drop)
- Rich text editor (blackboard)

**Migration Tasks:**

1. Integrate third-party libraries with Design System styles
2. Replace custom components with Design System equivalents
3. Update chat UI to Design System
4. Ensure libraries don't conflict with Tailwind

**TypeScript Files to Update:**

- scripts/calendar/*.ts
- scripts/chat/*.ts
- scripts/shifts/*.ts
- scripts/blackboard/*.ts

**Acceptance Criteria:**

- Calendar displays events
- Chat sends/receives messages
- Shifts can be scheduled
- All UI uses Design System

### Phase 6: Survey Pages (Priority Low)

**Files:** survey-*.html (4 files)

**Migration Tasks:**

1. Replace form components
2. Update result visualizations
3. Ensure survey logic intact

### Phase 7: Profile & Settings (Priority Low)

**Files:** *-profile.html, account-settings.html

**Migration Tasks:**

1. Replace form components
2. Update avatar components
3. Implement Design System toggle switches

### Phase 8: Other Pages (Priority Low)

**Files:** index.html, hilfe.html, storage-upgrade.html, etc.

**Migration Tasks:**

1. Update landing page with Design System
2. Migrate utility pages

### Phase 9: Bootstrap Removal

**After all pages migrated:**

1. Remove Bootstrap JavaScript
   - Delete `/scripts/lib/bootstrap.bundle.min.js`
   - Remove script tag from HTML

2. Remove Bootstrap CSS
   - Delete `/styles/lib/bootstrap.min.css`
   - Remove link tag from HTML

3. Remove Bootstrap Compatibility Layer
   - Delete `/styles/tailwind/compat/bootstrap-buttons.css`
   - Delete `/styles/tailwind/compat/bootstrap-forms.css`
   - Delete `/styles/tailwind/compat/bootstrap-modals.css`
   - Delete `/styles/tailwind/compat/bootstrap-tables.css`
   - Remove imports from `/styles/tailwind.css`

4. Clean up unused CSS classes
   - Search and remove `.form-control`, `.btn`, `.modal`, etc. if not from Design System

5. Verify build output
   - Check bundle size reduction
   - Test all pages in production build

## Component Mapping

### Bootstrap to Design System

| Bootstrap Class | Design System Replacement |
|----------------|---------------------------|
| .btn | .btn (Design System) |
| .btn-primary | .btn-primary (Design System) |
| .btn-cancel | .btn-cancel (Design System) |
| .btn-danger | .btn-danger (Design System) |
| .form-control | .form-field__control |
| .form-label | .form-field__label |
| .form-group | .form-field |
| .modal | .modal (Design System) |
| .modal-dialog | .modal__dialog |
| .modal-content | .modal__content |
| .modal-header | .modal__header |
| .modal-body | .modal__body |
| .modal-footer | .modal__footer |
| .card | .card (Design System) |
| .card-body | .card__body |
| .card-header | .card__header |
| .table | .data-table |
| .table-striped | .data-table--striped |
| .alert | .alert (Design System) |
| .alert-success | .alert--success |
| .badge | .badge (Design System) |
| .dropdown | .dropdown (Design System) |

### JavaScript API Changes

**Bootstrap:**

```javascript
const modal = new bootstrap.Modal('#myModal');
modal.show();
```

**Design System:**

```javascript
const modal = document.querySelector('#myModal');
modal.classList.add('modal--active');
// Or use initModal() helper from Design System
```

## Testing Checklist per Page

Before marking a page as complete:

### 🔴 MIGRATION COMPLETENESS (MUST BE 100%)

- [ ] **NO Bootstrap classes** found in HTML (search for: .btn, .modal, .form-control, .card, .table)
- [ ] **NO inline styles** (search for: style=")
- [ ] **NO inline JavaScript** (no < script > tags with code, only module imports allowed)
- [ ] **ALL styles use Tailwind** (bg-*, text-*, flex, grid, etc.)
- [ ] **ALL JavaScript in TypeScript files** (*.ts in scripts/ folder)
- [ ] **ALL components from Storybook** (verified against <http://localhost:6006>)

### 🟢 FUNCTIONALITY

- [ ] Visual regression check (looks correct)
- [ ] Forms submit correctly
- [ ] Validation shows Design System error states
- [ ] Modals open/close properly
- [ ] Tables display data correctly
- [ ] Responsive on mobile/tablet
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] Page loads in < 3 seconds

## Performance Targets

**Before Migration:**

- Bundle size: ~500KB (with Bootstrap)
- Initial load: ~2s

**After Migration:**

- Bundle size: ~200KB (Tailwind + Design System)
- Initial load: ~1s
- Reduction: ~60%

## Risk Mitigation

### High Risk Areas

1. Calendar component (FullCalendar dependency)
2. Chat real-time functionality
3. File upload with drag and drop
4. Complex forms with multi-step validation

### Rollback Plan

1. Git provides instant rollback
2. Keep Bootstrap compat layer until Phase 9
3. Test each page independently
4. User acceptance testing before Phase 9

## Next Steps

1. User decides starting file (recommendation: signup.html)
2. Per page migration (4 steps):
   - Step 0: **STORYBOOK** - Copy component HTML from <http://localhost:6006>
   - Step 1: HTML (Bootstrap → Design System using Storybook templates)
   - Step 2: CSS (Inline → Design System/Tailwind)
   - Step 3: TypeScript (Inline JS → TypeScript modules)
3. User tests after each step
4. Git commit after page complete
5. Move to next page when current page passes all tests

## Commands Reference

**Start Storybook (for reference):**

```bash
pnpm run storybook
# Open http://localhost:6006
```

**Build Frontend:**

```bash
docker exec assixx-backend pnpm run build
```

**Type Check:**

```bash
docker exec assixx-backend pnpm run type-check
```

**Test Single Page:**

```bash
# Open in browser: http://localhost:3000/signup
# Check console for errors
# Test all interactions
```

**Git Workflow:**

```bash
# After successful page migration
git add frontend/src/pages/signup.html
git add frontend/src/scripts/auth/*.ts  # if modified
git commit -m "Migrate signup.html to Design System

- Replace inline alerts with Design System alert component
- Remove Bootstrap button classes
- Extract validation JS to TypeScript module
- Test: Form submission, validation, error states"
```

## Notes

- No time pressure, focus on quality
- Test each component thoroughly before moving on
- User decides which component to replace next
- Bootstrap stays active until all pages migrated
- JavaScript changes are part of migration (not separate)
- Design System is production-ready and fully documented
