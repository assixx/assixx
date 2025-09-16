# 🚨 BREAKING CHANGE: onclick Removed from DOMPurify Config

**Date:** December 2024
**Impact:** HIGH - 21 TypeScript files affected
**Status:** Config changed, migration needed

## What Changed

### dom-utils.ts (Line 310)

```typescript
// BEFORE:
ALLOWED_ATTR: [
  'onclick',  // ← This was allowing onclick to work
  ...
]

// AFTER:
ALLOWED_ATTR: [
  // 'onclick', // REMOVED for security - use Event Delegation instead!
  ...
]
```

## 🔴 Files That Will BREAK (21 files)

All files using `setHTML()` with onclick handlers will stop working:

### Critical Files (High Traffic)

- `survey-admin.ts` - Survey management buttons
- `admin-dashboard.ts` - Dashboard action buttons
- `employee-dashboard.ts` - Employee actions
- `manage-employees.ts` - Employee management
- `manage-teams.ts` - Team management

### Full List

```
employee-dashboard.ts
unified-navigation.ts
survey-admin.ts
manage-areas.ts
root-dashboard.ts
shifts.ts
calendar.ts
blackboard.ts
kontischicht.ts
manage-root-users.ts
manage-machines.ts
survey-results.ts
manage-employees.ts
manage-department-groups.ts
manage-admins.ts
logs.ts
kvp-detail.ts
kvp.ts
session-manager.ts
manage-teams.ts
manage-departments.ts
```

## 🔧 How to Fix Each File

### Example: survey-admin.ts

**BEFORE (BROKEN NOW):**

```typescript
setHTML(element, `
  <button onclick="surveyAdmin.editSurvey(${id})">Edit</button>
`);
```

**AFTER (WORKING):**

```typescript
// Step 1: Remove onclick, add data attributes
setHTML(element, `
  <button data-action="edit-survey" data-id="${id}">Edit</button>
`);

// Step 2: Add event delegation (once per file)
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  if (target.dataset.action === 'edit-survey') {
    const id = target.dataset.id;
    surveyAdmin.editSurvey(parseInt(id));
  }
});
```

## 📋 Migration Checklist

### Immediate Actions Required

- [ ] survey-admin.ts - Fix all survey action buttons
- [ ] admin-dashboard.ts - Fix dashboard buttons
- [ ] employee-dashboard.ts - Fix employee actions
- [ ] manage-employees.ts - Fix management buttons
- [ ] manage-teams.ts - Fix team buttons

### Pattern to Search and Replace

**Search for:**

```typescript
onclick="
```

**Replace with Event Delegation pattern:**

1. Add `data-action` and `data-*` attributes
2. Remove `onclick` completely
3. Add event listener with delegation

## ⚠️ Testing Required

After migration, test these critical flows:

1. Survey creation/editing in survey-admin
2. Dashboard actions in admin-dashboard
3. Employee management functions
4. Team management operations
5. Navigation menu items

## 🎯 Why This Change?

1. **Security:** onclick attributes are XSS vectors
2. **Consistency:** One pattern across the codebase
3. **Best Practice:** Event delegation is the modern standard
4. **Maintenance:** Easier to debug and maintain

## 🚀 Quick Fix Script

For files with simple onclick patterns, use this regex:

**Find:**

```regex
onclick="(\w+)\.(\w+)\(([^)]*)\)"
```

**Replace:**

```
data-action="$2" data-params="$3"
```

Then add event delegation handler.

## 📚 Resources

- [Event Delegation Guide](/docs/DOMPURIFY-ONCLICK-FIX.md)
- [Gold Standard](/docs/DOMPURIFY-GOLDSTANDARD.md)
- [TypeScript Standards](/docs/TYPESCRIPT-STANDARDS.md)

## ⏰ Timeline

- **Phase 1:** ✅ Config changed (DONE)
- **Phase 2:** 🚧 Fix critical files (TODO)
- **Phase 3:** 📝 Fix remaining files (TODO)
- **Phase 4:** ✅ Testing & Verification (TODO)

---

**IMPORTANT:** All onclick handlers in TypeScript files using setHTML() are now BROKEN until migrated to Event Delegation!
