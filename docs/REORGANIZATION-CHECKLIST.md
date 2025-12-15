# Frontend Scripts Reorganization Checklist

## Phase 1: Core Module Groups (Priorität: HOCH)

### 1. `/blackboard/` - Schwarzes Brett System ✅

- [x] blackboard.ts → blackboard/index.ts
- [x] blackboard-core.ts → blackboard/core.ts
- [x] blackboard-types.ts → blackboard/types.ts
- [x] blackboard-ui-helpers.ts → blackboard/ui-helpers.ts
- [x] blackboard-widget.js → blackboard/widget.js
- [x] update-blackboard-modal.js → blackboard/modal.js

### 2. `/documents/` - Dokumenten Management ✅

- [x] documents.ts → documents/index.ts
- [x] document-base.ts → documents/base.ts
- [x] documents-company.ts → documents/company.ts
- [x] documents-department.ts → documents/department.ts
- [x] documents-payroll.ts → documents/payroll.ts
- [x] documents-personal.ts → documents/personal.ts
- [x] documents-search.ts → documents/search.ts
- [x] documents-team.ts → documents/team.ts
- [x] upload-document.ts → documents/upload.ts

### 3. `/shifts/` - Schichtplanung ✅

- [x] shifts.ts → shifts/index.ts
- [x] shifts-in-calendar.ts → shifts/calendar-integration.ts
- [x] kontischicht.ts → shifts/kontischicht.ts
- [x] kontischicht-types.ts → shifts/kontischicht-types.ts

## Phase 2: Admin & Management (Priorität: MITTEL)

### 4. `/admin/` - Admin Features ✅

- [x] admin-dashboard.ts → admin/dashboard/index.ts
- [x] admin-dashboard.services.ts → admin/dashboard/services.ts
- [x] admin-dashboard.types.ts → admin/dashboard/types.ts
- [x] admin-dashboard.ui.ts → admin/dashboard/ui.ts
- [x] admin-areas.ts → admin/areas.ts
- [x] admin-profile.ts → admin/profile.ts

### 5. `/manage/` - Management Tools ✅

- [x] manage-admins.ts → manage/admins/index.ts
- [x] manage-admins-data.ts → manage/admins/data.ts
- [x] manage-admins-forms.ts → manage/admins/forms.ts
- [x] manage-employees.ts → manage/employees/index.ts
- [x] manage-employees-types.ts → manage/employees/types.ts
- [x] manage-employees-ui.ts → manage/employees/ui.ts
- [x] manage-teams.ts → manage/teams/index.ts
- [x] manage-teams-types.ts → manage/teams/types.ts
- [x] manage-teams-ui.ts → manage/teams/ui.ts
- [x] manage-departments.ts → manage/departments.ts
- [x] manage-department-groups.ts → manage/department-groups.ts
- [x] manage-areas.ts → manage/areas.ts
- [x] manage-machines.ts → manage/machines.ts
- [x] manage-root-users.ts → manage/root-users.ts

### 6. `/survey/` - Umfragen System ✅

- [x] survey-admin.ts → survey/admin/index.ts
- [x] survey-admin-types.ts → survey/admin/types.ts
- [x] survey-admin-ui.ts → survey/admin/ui.ts
- [x] survey-results.ts → survey/results.ts

## Phase 3: Dashboard & Auth (Priorität: NIEDRIG)

### 7. `/dashboard/` - Dashboard Module ✅

- [x] dashboard-scripts.ts → dashboard/common.ts
- [x] employee-dashboard.ts → dashboard/employee.ts
- [x] root-dashboard.ts → dashboard/root.ts

### 8. `/auth/` - Authentifizierung ✅

- [x] auth.ts → auth/index.ts
- [x] pageProtection.ts → auth/page-protection.ts
- [x] role-switch.ts → auth/role-switch.ts

## Phase 4: Standalone Module (Priorität: NIEDRIG) ✅

### 9. Einzelne Module ✅

- [x] calendar.ts → calendar/index.ts
- [x] chat.ts → chat/index.ts
- [x] logs.ts → logs/index.ts
- [x] confirm-once.ts → utils/confirm-once.ts
- [x] header-user-info.ts → components/header-user-info.ts
- [x] show-section.ts → utils/show-section.ts

## Ausführungsplan

1. **Git-Branch erstellen**: `refactor/frontend-scripts-organization`
2. **Ordner erstellen** (einer nach dem anderen)
3. **Dateien verschieben** (mit Git mv)
4. **Imports aktualisieren** (in allen betroffenen Dateien)
5. **HTML-Referenzen anpassen** (script tags)
6. **Build testen** nach jeder Phase
7. **Commit** nach jeder erfolgreichen Phase

## Wichtige Regeln

- ✅ Immer `git mv` verwenden (nicht normale mv)
- ✅ Nach jedem Modul: Build testen
- ✅ Imports in HTML-Dateien nicht vergessen
- ✅ TypeScript paths in tsconfig.json später anpassen
- ✅ Keine Breaking Changes einführen
