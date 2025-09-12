# DOMPurify / dom-utils Migration Checklist & TODO

## 📊 Current Status (December 2024)

**Phase 1:** ✅ COMPLETED - onclick removed from dom-utils.ts config
**Phase 2:** ⏳ IN PROGRESS - Fixing TypeScript files (30% done)
**Phase 3:** ⏳ IN PROGRESS - Migrating HTML files (32% done)
**Next:** Continue fixing remaining TypeScript and HTML files

## 🎯 Migration Overview

### Goals

1. **Unify** on dom-utils.ts (no direct DOMPurify)
2. **Remove** all onclick/onchange inline handlers
3. **Implement** Event Delegation everywhere
4. **Achieve** 100% XSS-safe codebase

### Current State

- **TypeScript Files:** 4 of 21 completed (survey-admin, unified-navigation, kvp-detail, kvp)
- **HTML Files:** 6 of 19 completed (admin/employee/root dashboards + features/profile)
- **Onclick Handlers:** 25 of 82 fixed (30%)
- **Migration Method:** Event Delegation pattern implemented

## 📋 Phase 2: Fix Critical TypeScript Files (HIGH PRIORITY)

### 🔴 CRITICAL - Completed (23 onclick handlers fixed)

- [x] **survey-admin.ts** (18 onclick) ✅ COMPLETED
  - [x] Edit survey buttons
  - [x] Delete survey buttons
  - [x] View results buttons
  - [x] Template selection
  - [x] Question type dropdowns
  - [x] Add/remove question buttons

- [ ] **calendar.ts** (12 onclick)
  - [ ] Event click handlers
  - [ ] Date navigation
  - [ ] Create event buttons
  - [ ] Event actions

- [ ] **blackboard.ts** (10 onclick)
  - [ ] Edit entry buttons
  - [ ] Delete entry buttons
  - [ ] Attachment handlers
  - [ ] Modal controls

- [x] **unified-navigation.ts** (5 onclick) ✅ COMPLETED
  - [x] Menu toggles
  - [x] Role switch
  - [x] Dropdown handlers

### 🟡 HIGH - Still to fix (39 onclick handlers remaining)

- [ ] **manage-department-groups.ts** (4 onclick)
- [ ] **logs.ts** (4 onclick)
- [ ] **manage-admins.ts** (3 onclick)
- [ ] **manage-teams.ts** (3 onclick)
- [ ] **manage-machines.ts** (3 onclick)

### 🟢 MEDIUM - Still to fix (18 onclick handlers remaining)

- [ ] **manage-departments.ts** (3 onclick)
- [ ] **manage-root-users.ts** (3 onclick)
- [ ] **manage-areas.ts** (2 onclick)
- [ ] **survey-results.ts** (2 onclick)
- [ ] **manage-employees.ts** (2 onclick)
- [ ] **session-manager.ts** (2 onclick)
- [ ] **root-dashboard.ts** (1 onclick)
- [ ] **shifts.ts** (1 onclick)
- [ ] **kontischicht.ts** (1 onclick)
- [ ] **employee-dashboard.ts** (1 onclick)
- [x] **kvp-detail.ts** (1 onclick) ✅ COMPLETED - Bereits migriert
- [x] **kvp.ts** (1 onclick) ✅ COMPLETED - Bereits migriert

## 📋 Phase 3: Migrate HTML Files from DOMPurify

### ✅ Completed HTML Files (6 of 19)

- [x] **admin-dashboard.html** ✅ COMPLETED
- [x] **employee-dashboard.html** ✅ COMPLETED
- [x] **root-features.html** ✅ COMPLETED
- [x] **root-profile.html** ✅ COMPLETED
- [x] **survey-employee.html** ✅ COMPLETED (with Event Delegation)
- [x] **root-dashboard.html** ✅ CLEAN (no DOMPurify/onclick)

### 🔴 Still to migrate (13 files)

- [ ] archived-employees.html
- [ ] design-standards.html
- [ ] document-upload.html
- [ ] employee-documents.html
- [ ] employee-profile.html
- [ ] feature-management.html
- [ ] kvp.html
- [ ] login.html
- [ ] manage-employees.html
- [ ] salary-documents.html
- [ ] survey-details.html
- [ ] tenant-deletion-status.html
- [ ] signup.html

### Migration Strategy

1. Import dom-utils instead of using DOMPurify directly
2. Replace all onclick/onchange with data attributes
3. Implement Event Delegation

## 📋 Phase 4: Code Quality & Testing

### Code Review Checklist

- [ ] No `onclick` attributes in HTML strings
- [ ] No `onchange` attributes in HTML strings
- [ ] All dynamic HTML uses `setHTML()` from dom-utils
- [ ] Event Delegation implemented for all interactions
- [ ] Data attributes used for parameters
- [ ] No direct `DOMPurify.sanitize()` calls

### Testing Checklist

- [ ] Survey creation/editing works
- [ ] Calendar events clickable
- [ ] Blackboard entries editable
- [ ] Navigation menu functional
- [ ] All dashboards interactive
- [ ] Employee management works
- [ ] Department/Team management works
- [ ] No console errors

## 🔧 Migration Pattern Reference

### Before (BROKEN)

```typescript
setHTML(element, `
  <button onclick="doSomething(${id})">Click</button>
`);
```

### After (WORKING)

```typescript
// HTML with data attributes
setHTML(element, `
  <button data-action="something" data-id="${id}">Click</button>
`);

// Event Delegation (once per file)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  switch (btn.dataset.action) {
    case 'something':
      doSomething(btn.dataset.id);
      break;
  }
});
```

## 📊 Progress Tracking

### Overall Progress

- Phase 1: ✅ Config changed (100%)
- Phase 2: ⏳ TypeScript fixes (25/82 onclick fixed - 30%)
- Phase 3: ⏳ HTML migration (6/19 files migrated - 32%)
- Phase 4: ⏳ Testing (15%)

### Metrics

- **Total onclick to fix:** 82
- **Fixed:** 25 handlers
- **Remaining:** 57 handlers
- **TypeScript files completed:** 4/21 (19%)
- **HTML files completed:** 6/19 (32%)
- **Critical dashboards:** ✅ All migrated (admin, employee, root)

## 🚀 Quick Wins

### Files with only 1 onclick (easy fixes)

1. root-dashboard.ts
2. shifts.ts
3. kontischicht.ts
4. employee-dashboard.ts
5. kvp-detail.ts
6. kvp.ts

Start with these for quick progress!

## 📅 Estimated Timeline

| Phase | Effort | Timeline |
|-------|--------|----------|
| Phase 2 - Critical files | 8-10 hours | 1-2 days |
| Phase 2 - All TypeScript | 16-20 hours | 3-4 days |
| Phase 3 - HTML files | 10-15 hours | 2-3 days |
| Phase 4 - Testing | 4-6 hours | 1 day |
| **TOTAL** | **38-51 hours** | **7-10 days** |

## 🎯 Success Criteria

- [ ] Zero onclick attributes in codebase (30% done)
- [ ] All interactions use Event Delegation (30% done)
- [ ] Consistent use of dom-utils.ts (32% done)
- [ ] No direct DOMPurify usage (32% done)
- [ ] All features working (Testing needed)
- [ ] No XSS vulnerabilities (Improved)

## 📚 Resources

- [Gold Standard Guide](/docs/DOMPURIFY-GOLDSTANDARD.md)
- [onclick Fix Guide](/docs/DOMPURIFY-ONCLICK-FIX.md)
- [Breaking Change Doc](/docs/BREAKING-CHANGE-ONCLICK-REMOVAL.md)
- [TypeScript Standards](/docs/TYPESCRIPT-STANDARDS.md)

## ⚠️ Important Notes

1. **DO NOT** re-enable onclick in config (security risk!)
2. **ALWAYS** use Event Delegation for new features
3. **TEST** thoroughly after each file migration
4. **DOCUMENT** any special cases or exceptions

---

**Remember:** This migration makes the codebase more secure, maintainable, and follows modern best practices. The temporary pain is worth the long-term gain!
