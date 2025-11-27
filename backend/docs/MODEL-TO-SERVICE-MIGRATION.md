# Model to Service Layer Migration Plan 2025

## 🎯 Goal

Eliminate legacy `/models/` directory and migrate ALL business logic to modern service-layer architecture following the `areas` pattern.

## ⚡ Quick Summary

- **Problem:** 29 legacy model files with duplicated logic across services
- **Solution:** Pure service-layer architecture (like `areas`)
- **Impact:** 50+ files need updating, 0 database changes required
- **Timeline:** 3-week migration plan

## 🏗️ Architecture Pattern

### ❌ OLD (Delete)

```
/models/[entity].ts → Legacy DB logic
/routes/v2/[entity]/service.ts → Imports & uses model
```

### ✅ NEW (Target)

```
/routes/v2/[entity]/
  ├── index.ts
  ├── [entity].controller.ts
  ├── [entity].service.ts      → ALL logic here
  ├── [entity].validation.zod.ts
  └── types.ts                  → ALL types here
```

## 📋 COMPLETE MIGRATION CHECKLIST

### Phase 1: Critical Dependencies (Week 1)

#### 1.1 RootLog Migration

**Priority: CRITICAL** (Used by 25+ files)

**Files to Delete:**

- [ ] `/backend/src/models/rootLog.ts`

**Files to Update:**

- [ ] Create `/backend/src/routes/v2/root-logs/` directory structure
- [ ] `/backend/src/routes/v2/admin-permissions/service.ts` (line 7)
- [ ] `/backend/src/routes/v2/settings/settings.service.ts` (line 7)
- [ ] `/backend/src/routes/v2/teams/teams.controller.ts` (line 7)
- [ ] `/backend/src/routes/v2/users/users.controller.ts` (line 9)
- [ ] `/backend/src/routes/v2/features/features.service.ts` (line 2)
- [ ] `/backend/src/routes/v2/logs/logs.controller.ts` (line 3)
- [ ] `/backend/src/routes/v2/machines/machines.service.ts` (line 2)
- [ ] `/backend/src/routes/v2/role-switch/role-switch.service.ts` (line 8)
- [ ] `/backend/src/routes/v2/auth/auth.controller.ts` (line 10)
- [ ] `/backend/src/routes/v2/blackboard/blackboard.controller.ts` (line 7)
- [ ] `/backend/src/routes/v2/documents/documents.controller.ts` (line 15)
- [ ] `/backend/src/routes/v2/department-groups/service.ts` (line 7)
- [ ] `/backend/src/routes/v2/signup/controller.ts` (line 9)
- [ ] `/backend/src/routes/v2/shifts/shifts.service.ts` (line 7)
- [ ] `/backend/src/routes/v2/departments/departments.controller.ts` (line 3)
- [ ] `/backend/src/routes/v2/kvp/kvp.controller.ts` (line 11)
- [ ] `/backend/src/routes/v2/surveys/surveys.service.ts` (line 5)
- [ ] `/backend/src/routes/v2/notifications/notifications.service.ts` (line 7)
- [ ] `/backend/src/routes/v2/plans/plans.service.ts` (line 4)
- [ ] `/backend/src/routes/v2/areas/areas.controller.ts` (line 7)
- [ ] `/backend/src/routes/v2/chat/chat.controller.ts` (line 10)
- [ ] `/backend/src/routes/v2/calendar/calendar.controller.ts` (line 13)
- [ ] `/backend/src/routes/v2/root/root.service.ts` (line 9)
- [ ] `/backend/src/services/admin.service.ts` - Uses rootLog.create() and rootLog.getByUserId()

#### 1.2 User Model Migration

**Priority: CRITICAL** (Complex with subdirectories)

**Files to Delete:**

- [ ] `/backend/src/models/user/index.ts`
- [ ] `/backend/src/models/user/user.crud.ts`
- [ ] `/backend/src/models/user/user.types.ts`
- [ ] `/backend/src/models/user/user.profile.ts`
- [ ] `/backend/src/models/user/user.stats.ts`
- [ ] `/backend/src/models/user/user.availability.ts`
- [ ] `/backend/src/models/user/user.utils.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/users/users.service.ts` (line 9)
- [ ] `/backend/src/routes/v2/teams/teams.service.ts` (line 13)
- [ ] `/backend/src/routes/v2/logs/logs.controller.ts` (line 3)
- [ ] `/backend/src/routes/v2/role-switch/role-switch.service.ts` (line 9)
- [ ] `/backend/src/routes/v2/auth/auth.controller.ts` (line 11)
- [ ] `/backend/src/routes/v2/documents/documents.service.ts` (line 16)
- [ ] `/backend/src/routes/v2/root/root.service.ts` (line 11)
- [ ] `/backend/src/services/user.service.ts`
- [ ] `/backend/src/services/admin.service.ts`
- [ ] `/backend/src/services/employee.service.ts`
- [ ] `/backend/src/utils/emailService.ts`

### Phase 2: Core Business Entities (Week 2)

#### 2.1 Department Model Migration

**Priority: HIGH**

**Files to Delete:**

- [ ] `/backend/src/models/department.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/departments/departments.service.ts` (line 5)
  - Replace ALL `Department.*` method calls with direct SQL
- [ ] `/backend/src/routes/v2/teams/teams.service.ts` (line 8)
- [ ] `/backend/src/routes/v2/documents/documents.service.ts` (line 10)
- [ ] `/backend/src/services/department.service.ts` (legacy service)

**Tests to Update:**

- [ ] `/backend/src/routes/v2/departments/__tests__/departments-v2.test.ts`
- [ ] `/backend/src/routes/__tests__/departments.test.ts`

#### 2.2 Team Model Migration

**Priority: HIGH**

**Files to Delete:**

- [ ] `/backend/src/models/team.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/teams/teams.service.ts` (lines 10-11)
  - Replace ALL `Team.*` method calls with direct SQL
- [ ] `/backend/src/routes/v2/documents/documents.service.ts` (line 14)
- [ ] `/backend/src/services/team.service.ts` (legacy service)

**Tests to Update:**

- [ ] `/backend/src/routes/v2/teams/__tests__/teams-v2.test.ts`

#### 2.3 Document Model Migration

**Priority: MEDIUM**

**Files to Delete:**

- [ ] `/backend/src/models/document.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/documents/documents.service.ts` (line 12)
  - Replace ALL `Document.*` method calls with direct SQL

**Tests to Update:**

- [ ] `/backend/src/routes/v2/documents/__tests__/documents-v2.test.ts`
- [ ] `/backend/src/routes/__tests__/documents.test.ts`

### Phase 3: Feature Models (Week 2-3)

#### 3.1 Blackboard Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/blackboard.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/blackboard/blackboard.service.ts` (line 10)
- [ ] `/backend/src/services/blackboard.service.ts`

**Tests to Update:**

- [ ] `/backend/src/__tests__/blackboard.integration.test.ts`
- [ ] `/backend/src/models/__tests__/blackboard.test.ts`
- [ ] `/backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts`

#### 3.2 Calendar Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/calendar.ts`
- [ ] `/backend/src/models/calendar/calendar.attendees.ts`
- [ ] `/backend/src/models/calendar/calendar.crud.ts`
- [ ] `/backend/src/models/calendar/calendar.recurring.ts`
- [ ] `/backend/src/models/calendar/calendar.types.ts`
- [ ] `/backend/src/models/calendar/calendar.utils.ts`
- [ ] `/backend/src/models/calendar/index.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/calendar/calendar.service.ts` (lines 5, 12)
- [ ] `/backend/src/routes/v2/calendar/calendar.controller.ts` (lines 11-12)
- [ ] `/backend/src/services/calendar.service.ts`

#### 3.3 KVP Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/kvp.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/kvp/kvp.service.ts` (line 5)
- [ ] `/backend/src/services/kvp.service.ts`

#### 3.4 Survey Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/survey.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/surveys/surveys.service.ts` (line 6)
- [ ] `/backend/src/services/survey.service.ts`

#### 3.5 Machine Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/machine.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/machines/machines.service.ts` (line 1)

#### 3.6 Shift Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/shift.ts`
- [ ] `/backend/src/models/shift-core.ts`
- [ ] `/backend/src/models/shift-types.ts`
- [ ] `/backend/src/models/shift-v2.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/shifts/shifts.service.ts` (line 8)
- [ ] `/backend/src/services/shift.service.ts`

### Phase 4: System Models (Week 3)

#### 4.1 Tenant Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/tenant.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/signup/service.ts` (line 8)
- [ ] `/backend/src/routes/v2/root/root.service.ts` (line 10)
- [ ] `/backend/src/services/tenant.service.ts` (line 10)
- [ ] `/backend/src/services/tenantDeletion.service.ts`
- [ ] `/backend/src/middleware/tenant.ts` (line 7) - CRITICAL: Middleware dependency!

#### 4.2 Plan Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/plan.ts`

**Files to Update:**

- [ ] `/backend/src/routes/v2/plans/plans.service.ts` (line 2)

#### 4.3 Feature Model Migration

**Files to Delete:**

- [ ] `/backend/src/models/feature.ts`

**Files to Update:**

- [ ] `/backend/src/services/feature.service.ts`
- [ ] `/backend/src/middleware/features.ts`

### Phase 5: Cleanup (Week 3)

#### Legacy Services Cleanup

**Files to Update/Delete:**

- [ ] `/backend/src/services/admin.service.ts`
- [ ] `/backend/src/services/blackboard.service.ts`
- [ ] `/backend/src/services/calendar.service.ts`
- [ ] `/backend/src/services/department.service.ts`
- [ ] `/backend/src/services/employee.service.ts`
- [ ] `/backend/src/services/feature.service.ts`
- [ ] `/backend/src/services/kvp.service.ts`
- [ ] `/backend/src/services/shift.service.ts`
- [ ] `/backend/src/services/survey.service.ts`
- [ ] `/backend/src/services/team.service.ts`
- [ ] `/backend/src/services/tenant.service.ts`
- [ ] `/backend/src/services/tenantDeletion.service.ts`
- [ ] `/backend/src/services/user.service.ts`

#### Final Steps

- [ ] Delete entire `/backend/src/models/` directory
- [ ] Update all import paths in tests
- [ ] Run full test suite: `docker exec assixx-backend pnpm test`
- [ ] Run type check: `docker exec assixx-backend pnpm run type-check`
- [ ] Run linting: `docker exec assixx-backend pnpm run lint`
- [ ] Update documentation

## 📊 Database Changes

**Required:** NONE ✅ (VERIFIED 2025-11-24)

**Database Analysis Complete:**

- ✅ 120+ tables checked - all use standard naming (departments, teams, users, etc.)
- ✅ 50+ Foreign Keys checked - all reference TABLE names, not model files
- ✅ 5 Views checked - all use direct SQL JOINs
- ✅ 6 Triggers checked - all operate at table level
- ✅ 1 Stored Procedure - uses direct SQL

**Conclusion:** Database is 100% independent from model layer!

- All tables remain unchanged
- Only the access pattern changes (direct SQL vs model methods)
- SQL queries remain IDENTICAL

## 🧪 Testing Strategy

1. **Before Migration:** Capture current behavior with integration tests
2. **During Migration:** Run tests after each entity migration
3. **After Migration:** Full regression test suite

## 🚀 Migration Commands

```bash
# For each entity migration:
1. Copy model logic to service
2. Replace model imports with direct SQL
3. Test: docker exec assixx-backend pnpm test -- [entity]
4. Delete model file
5. Commit: "Migrate [entity] from model to service layer"

# Final validation:
docker exec assixx-backend pnpm run type-check
docker exec assixx-backend pnpm run lint:fix
docker exec assixx-backend pnpm test
```

## ⚠️ ULTRA-CRITICAL NOTES (VERIFIED 2025-11-24)

1. **RootLog is EVERYWHERE** - 25+ files use it, MUST be migrated FIRST!
   - Used as object with methods: `rootLog.create()`, `rootLog.getByUserId()`
   - `/services/admin.service.ts` also imports it (not just v2 routes!)

2. **Middleware Dependencies** - CRITICAL PATH!
   - `/middleware/features.ts` imports `featureModel` (line 3)
   - `/middleware/tenant.ts` imports `tenantModel` (line 7)
   - These run on EVERY request - migration failure = total system failure!

3. **User Model Complexity** - 7 sub-modules, used by 11+ files
   - Has complex types: `DbUser`, `UserCreateData`, `UserFilter`
   - Used by both v2 routes AND legacy services

4. **Department/Team Cross-Dependencies**
   - teams.service imports Department model (line 8)
   - documents.service imports BOTH Department AND Team models
   - Must migrate together to avoid breaking dependencies

5. **Legacy Services** - 13 files in `/services/` also import models
   - These are NOT in v2 routes but still active!
   - Must be migrated or deleted carefully

6. **NO Database Changes** - Pure refactoring
   - All SQL queries remain identical
   - Only the code organization changes

## 📈 Success Metrics

- [ ] 0 files in `/models/` directory
- [ ] 0 imports from `/models/` in codebase
- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] 100% service-layer architecture

---

**Created:** 2025-11-24
**Status:** READY TO EXECUTE
