# 📋 Shifts Module Refactoring Plan

## 🎯 Objective

Refactor the monolithic `shifts.ts` (6581 lines) into a modular structure with files under 400 lines each, following ESLint rules and TypeScript best practices.

## 📊 Progress Update

### ✅ Phase 2, 3, 4 & ShiftGrid Complete! (2025-09-24)

**What was accomplished:**

1. ✅ Created DragDropManager.ts in shifts/components/ (428 lines)
2. ✅ Created FavoritesService.ts in shifts/services/ (582 lines)
3. ✅ Created ContextSelector.ts in shifts/components/ (730 lines - needs splitting)
4. ✅ Created ShiftGrid.ts in shifts/components/ (406 lines)
5. ✅ Extracted all drag-drop functionality
6. ✅ Extracted all favorites functionality (~500 lines removed)
7. ✅ Extracted all context selection functionality (~400 lines removed)
8. ✅ Extracted shift grid rendering functionality (~500 lines removed)
9. ✅ TypeScript compilation successful (no errors)

**Current structure:**

```
shifts/
├── REFACTORING-PLAN.md
├── index.ts              # Re-exports
├── constants.ts          # DOM constants
├── types.ts              # Type definitions
├── interfaces.ts         # Local interfaces
├── validation.ts         # Validation logic
├── components/
│   ├── DragDropManager.ts # ✅ Drag & drop logic (428 lines)
│   ├── ContextSelector.ts # ✅ Context/hierarchy selection (730 lines - TOO LARGE!)
│   └── ShiftGrid.ts       # ✅ Shift grid rendering (406 lines)
├── services/
│   └── FavoritesService.ts # ✅ Favorites management (582 lines)
├── modals/              # (ready for next modules)
└── utils/               # (ready for next modules)
```

**Impact:**

- shifts.ts: 6581 → ~4069 lines (2512 lines removed - 38% reduction!)
- Better separation of concerns
- Improved testability and maintainability
- TypeScript compilation passes with no errors

**Issues to Address:**

- ContextSelector.ts exceeds 400 line limit (730 lines) - needs further splitting
- shifts.ts still exceeds 400 line limit (4069 lines) - needs more extraction
- Consider splitting into ContextSelector + ContextPopulator classes

## 📊 Original State

```
frontend/src/scripts/
├── shifts.ts                 # 6581 lines (MAIN FILE - TOO LARGE!)
├── shifts.constants.ts       # 2285 bytes (already modular)
├── shifts.types.ts           # 5058 bytes (already modular)
├── shifts.interfaces.ts      # 47 lines (newly created)
├── shifts.validation.ts      # 156 lines (newly created)
└── shifts-in-calendar.ts     # 7447 bytes (separate feature)
```

## 🏗️ Target Structure

```
frontend/src/scripts/shifts/
├── index.ts                         # ~50 lines
├── ShiftPlanningSystem.ts           # ~300 lines (main orchestrator)
├── constants.ts                     # existing
├── types.ts                         # existing
├── interfaces.ts                    # existing
├── validation.ts                    # existing
│
├── components/
│   ├── DragDropManager.ts           # ~400 lines
│   ├── ShiftGrid.ts                 # ~500 lines
│   ├── EmployeeList.ts              # ~300 lines
│   └── ContextSelector.ts           # ~400 lines
│
├── services/
│   ├── ShiftService.ts              # ~400 lines
│   ├── FavoritesService.ts          # ~500 lines
│   ├── RotationService.ts           # ~1000 lines
│   └── ContextService.ts            # ~600 lines
│
├── modals/
│   ├── RotationModal.ts             # ~800 lines
│   ├── ShiftDetailsModal.ts         # ~200 lines
│   └── SaveLoadModal.ts             # ~300 lines
│
└── utils/
    ├── dateHelpers.ts               # ~150 lines
    ├── shiftHelpers.ts              # ~200 lines
    └── domHelpers.ts                # ~100 lines
```

## 📝 Method Distribution Plan

### 1. DragDropManager.ts (~400 lines)

**Methods to extract:**

```typescript
-setupDragAndDrop() -
  setupDragStartHandler() -
  setupDragEndHandler() -
  setupDragOverHandler() -
  setupDragLeaveHandler() -
  setupDropHandlers() -
  handleDropOnShiftCell() -
  handleDropInCapturePhase() -
  setupDragDetection() -
  setupDragAttemptListeners() -
  handleShiftAssignment() -
  isDragging(property);
```

**Dependencies:**

- ShiftService (for assignment)
- DOM utils
- Alert utils

### 2. FavoritesService.ts (~500 lines)

**Methods to extract:**

```typescript
-loadFavorites() -
  refreshFavorites() -
  addToFavorites() -
  removeFavorite() -
  createFavoriteAPI() -
  checkDuplicateFavoriteByTeam() -
  loadFavorite() -
  renderFavorites() -
  ensureFavoritesContainer() -
  createFavoriteButton() -
  handleFavoriteClick() -
  isCombinationFavorited() -
  updateAddFavoriteButton() -
  setAreaContext() -
  setDepartmentContext() -
  setMachineContext() -
  setTeamContext();
```

**Dependencies:**

- API client
- Context service
- DOM utils

### 3. ContextSelector.ts (~400 lines)

**Methods to extract:**

```typescript
-loadAreas() -
  loadDepartments() -
  loadMachines() -
  loadTeams() -
  populateAreaSelect() -
  populateDepartmentSelect() -
  populateMachineSelect() -
  populateTeamSelect() -
  onAreaSelected() -
  onDepartmentSelected() -
  onMachineSelected() -
  onTeamSelected() -
  handleAreaSelection() -
  handleDepartmentSelection() -
  handleMachineSelection() -
  handleTeamSelection() -
  restoreAreaSelection() -
  restoreDepartmentSelection() -
  restoreMachineSelection() -
  restoreTeamSelection();
```

**Dependencies:**

- API client
- Validation service
- DOM utils

### 4. ShiftGrid.ts (~500 lines)

**Methods to extract:**

```typescript
-renderShiftTable() -
  generateShiftTable() -
  createShiftCell() -
  updateShiftCell() -
  renderShiftCell() -
  getShiftCellContent() -
  showShiftDetailsModal() -
  buildShiftDetailsTable() -
  clearShiftCell() -
  updateWeekDisplay() -
  getWeekDates() -
  formatDateForDisplay();
```

**Dependencies:**

- Date helpers
- DOM utils
- Shift service

### 5. EmployeeList.ts (~300 lines)

**Methods to extract:**

```typescript
-loadTeamMembers() -
  renderEmployees() -
  selectEmployee() -
  updateEmployeeAvailability() -
  filterUsersByTeam() -
  filterUsersByDepartment() -
  getEmployeeDisplayName() -
  handleEmployeeAvailability() -
  findEmployee();
```

**Dependencies:**

- API client
- Context service
- DOM utils

### 6. RotationService.ts (~1000 lines)

**Methods to extract:**

```typescript
-openRotationModal() -
  setupRotationModal() -
  renderRotationModal() -
  saveRotationPattern() -
  loadRotationPatterns() -
  applyRotationPattern() -
  generateRotationSchedule() -
  validateRotationInput() -
  validateRotationFormValues() -
  collectEmployeesFromZones() -
  distributeEmployeesAcrossWeeks() -
  buildRotationPayload() -
  handleRotationSave() -
  updateRotationDisplay();
```

**Dependencies:**

- API client
- Validation
- Date helpers
- Modal utils

### 7. ShiftService.ts (~400 lines)

**Methods to extract:**

```typescript
-assignUserToShift() -
  assignShiftV1() -
  assignShiftV2() -
  removeShift() -
  saveSchedule() -
  loadSchedule() -
  resetSchedule() -
  buildShiftPayload() -
  convertShiftTypeForAPI() -
  getShiftStartTime() -
  getShiftEndTime() -
  updateShiftCell() -
  handleShiftAssignmentSuccess();
```

**Dependencies:**

- API client
- Validation
- Context service

### 8. Main ShiftPlanningSystem.ts (~300 lines)

**Will contain:**

```typescript
- constructor()
- init()
- Core properties
- Service orchestration
- Event listener setup
- Main state management
```

## 🔄 Refactoring Steps

### Phase 1: Setup (Steps 1-3)

1. **Create folder structure**

   ```bash
   mkdir -p shifts/{components,services,modals,utils}
   ```

2. **Move existing files**

   ```bash
   mv shifts.constants.ts shifts/constants.ts
   mv shifts.types.ts shifts/types.ts
   mv shifts.interfaces.ts shifts/interfaces.ts
   mv shifts.validation.ts shifts/validation.ts
   ```

3. **Create index.ts for re-exports**

### Phase 2: Extract Components (Steps 4-7)

4. **Extract DragDropManager** (~30 min)
   - Create `components/DragDropManager.ts`
   - Move drag & drop methods
   - Create class structure
   - Update imports

5. **Extract FavoritesService** (~30 min)
   - Create `services/FavoritesService.ts`
   - Move favorites methods
   - Handle dependencies
   - Update imports

6. **Extract ContextSelector** (~30 min)
   - Create `components/ContextSelector.ts`
   - Move context/hierarchy methods
   - Update imports

7. **Extract ShiftGrid** (~30 min)
   - Create `components/ShiftGrid.ts`
   - Move grid rendering methods
   - Update imports

### Phase 3: Extract Services (Steps 8-10)

8. **Extract EmployeeList** (~20 min)
   - Create `components/EmployeeList.ts`
   - Move employee methods
   - Update imports

9. **Extract ShiftService** (~30 min)
   - Create `services/ShiftService.ts`
   - Move shift assignment methods
   - Update imports

10. **Extract RotationService** (~45 min)
    - Create `services/RotationService.ts`
    - Move rotation methods
    - Update imports

### Phase 4: Extract Utils & Modals (Steps 11-13)

11. **Extract Date & Shift Helpers** (~20 min)
    - Create `utils/dateHelpers.ts`
    - Create `utils/shiftHelpers.ts`
    - Move utility functions

12. **Extract Modals** (~30 min)
    - Create modal files
    - Move modal methods
    - Update imports

13. **Refactor Main Class** (~30 min)
    - Update ShiftPlanningSystem.ts
    - Wire up all services
    - Test integration

### Phase 5: Testing & Cleanup (Steps 14-15)

14. **Test all functionality**
    - Drag & drop
    - Context selection
    - Shift assignment
    - Favorites
    - Rotation

15. **Clean up and optimize**
    - Remove old shifts.ts
    - Update imports in other files
    - Run linter & type check

## ⚠️ Critical Dependencies

### Import Order (to avoid circular dependencies)

1. types & interfaces
2. constants
3. utils
4. services
5. components
6. main class

### Shared State Management

- Pass state through constructor/methods
- Use event emitters for communication
- Avoid direct cross-component calls

## 🚨 Risks & Mitigations

| Risk                  | Impact | Mitigation                        |
| --------------------- | ------ | --------------------------------- |
| Breaking drag & drop  | High   | Test after each extraction        |
| Circular dependencies | High   | Follow import order strictly      |
| Lost functionality    | High   | Keep original file until tested   |
| Type errors           | Medium | Run type-check after each step    |
| Import path issues    | Low    | Use relative imports consistently |

## ✅ Success Criteria

- [ ] All files under 400 lines (excluding comments/blanks)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] All functionality working
- [ ] Tests passing (if any)
- [ ] Code is more maintainable

## 📈 Expected Outcome

- **Before:** 1 file with 6581 lines
- **After:** ~20 files with avg 200-300 lines each
- **Benefits:**
  - Easier testing
  - Better code organization
  - Parallel development possible
  - Faster build times
  - Improved maintainability

## 🚀 Start Signal

Ready to begin with **Phase 1, Step 1**: Creating folder structure

---

_Last updated: 2024-09-24_
_Estimated time: 4-5 hours_
_Priority: High (blocking ESLint compliance)_
