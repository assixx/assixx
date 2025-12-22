# SvelteKit Refactoring Checklist

> **Ziel:** Alle Seiten auf das `_lib/` Pattern umstellen (siehe SVELTEKIT-MIGRATION-PLAN.md Sektion 0.6)
>
> **Erstellt:** 2025-12-21 | **Branch:** feature/nestjs-migration

landingpage not needed to refactor
---

## Refactoring-Status nach Priorität

| # | Seite | Route | Zeilen | Priorität | Status |
|---|-------|-------|--------|-----------|--------|
| ✅ | **Chat** | `/chat` | 2047→1565 | DONE | ✅ Refactored |
| ✅ | **Manage Admins** | `/manage-admins` | 1661→1246 | DONE | ✅ Refactored |
| ✅ | **Manage Employees** | `/manage-employees` | 1581→1273 | DONE | ✅ Refactored |
| ✅ | **Manage Teams** | `/manage-teams` | 1409→1073 | DONE | ✅ Refactored |
| ✅ | **Manage Root** | `/manage-root` | 1381→1038 | DONE | ✅ Refactored |
| ✅ | **Manage Areas** | `/manage-areas` | 1254→986 | DONE | ✅ Refactored |
| ✅ | **Manage Departments** | `/manage-departments` | 1248→965 | DONE | ✅ Refactored |
| ✅ | **Blackboard** | `/blackboard` | 1226→630 | DONE | ✅ Refactored |
| ✅ | **Blackboard Detail** | `/blackboard/[uuid]` | 860→429 | DONE | ✅ Refactored |
| ✅ | **Logs** | `/logs` | 963→570 | DONE | ✅ Refactored |
| ✅ | **Features** | `/features` | 896→554 | DONE | ✅ Refactored |
| ✅ | **Tenant Deletion Status** | `/tenant-deletion-status` | 848→540 | DONE | ✅ Refactored |
| ✅ | **Admin Dashboard** | `/admin-dashboard` | 829→423 | DONE | ✅ Refactored |
| ✅ | **Root Profile** | `/root-profile` | 820→538 | DONE | ✅ Refactored |
| ✅ | **Signup** | `/signup` | 629→535 | DONE | ✅ Refactored |
| - | Landing Page | `/` | 536 | ✅ OK | Kein Refactoring nötig (kein TS) |
| ✅ | **Account Settings** | `/account-settings` | 529→382 | DONE | ✅ Refactored |
| ✅ | **Root Dashboard** | `/root-dashboard` | 450→303 | DONE | ✅ Refactored |
| - | Tenant Deletion Approve | `/tenant-deletion-approve` | 332 | ✅ OK | Kein Refactoring nötig |
| - | Login | `/login` | 296 | ✅ OK | Kein Refactoring nötig |

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| 🔴 CRITICAL | > 1200 Zeilen - SOFORT refactoren |
| 🔴 HIGH | 700-1200 Zeilen - Bald refactoren |
| ⚠️ MEDIUM | 300-700 Zeilen - Bei Gelegenheit |
| ✅ OK | < 300 Zeilen - Kein Refactoring nötig |
| ⏳ Pending | Noch nicht begonnen |
| 🔄 In Progress | Wird gerade bearbeitet |
| ✅ Refactored | Fertig |

---

## Zielstruktur pro Seite

```
frontend-svelte/src/routes/(app)/[page-name]/
├── +page.svelte              # Max ~300 Zeilen: Template + State + Handlers
└── _lib/
    ├── types.ts              # TypeScript Interfaces
    ├── constants.ts          # Labels, Options, Config
    ├── api.ts                # API Calls (fetch functions)
    ├── filters.ts            # Filter/Sort Logik (pure functions)
    ├── utils.ts              # Helper Functions
    └── [optional] state.svelte.ts  # Exportierter $state (Objekt-Pattern)
```

---

## Checkliste pro Seite

### Vor dem Refactoring

- [ ] Seite vollständig lesen und verstehen
- [ ] Identifizieren: Types, Constants, API Calls, Filters, Utils
- [ ] `_lib/` Ordner erstellen

### Dateien erstellen

- [ ] `_lib/types.ts` - Alle Interfaces/Types extrahieren
- [ ] `_lib/constants.ts` - Alle Konstanten (Arrays, Labels, Config)
- [ ] `_lib/api.ts` - Alle API Calls isolieren
- [ ] `_lib/filters.ts` - Filter/Sort Funktionen (wenn vorhanden)
- [ ] `_lib/utils.ts` - Helper Funktionen (formatDate, etc.)

### +page.svelte refactoren

- [ ] `<script lang="ts">` verwenden
- [ ] Imports aus `_lib/` Module
- [ ] State mit `$state()` und `$derived()` (Runes)
- [ ] Event Handlers mit TypeScript Typen
- [ ] Template bleibt unverändert

### Nach dem Refactoring

- [ ] Zeilen zählen: `wc -l +page.svelte _lib/*.ts`
- [ ] TypeScript Check: `pnpm run type-check`
- [ ] Manuell testen im Browser
- [ ] Status in dieser Datei updaten

---

## Fortschritts-Log

### 2025-12-21: Chat Refactored

**Vorher:** 2047 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 1565 |
| _lib/types.ts | 295 |
| _lib/constants.ts | 181 |
| _lib/api.ts | 227 |
| _lib/utils.ts | 378 |
| _lib/websocket.ts | 323 |
| **Total** | 2969 |

**Extrahiert:**
- Types: `ChatUser`, `Conversation`, `Message`, `ScheduledMessage`, `FilePreviewItem`, `Attachment`, WebSocket types
- Constants: `WEBSOCKET_CONFIG`, `SCHEDULE_CONSTRAINTS`, `MESSAGES`, `WS_MESSAGE_TYPES`, `API_ENDPOINTS`
- API: `loadConversations()`, `loadMessages()`, `searchUsers()`, `createConversation()`, `uploadAttachment()`
- Utils: `formatFileSize()`, `linkify()`, `formatMessageTime()`, `getConversationDisplayName()`, etc.
- WebSocket: `buildWebSocketUrl()`, `transformRawMessage()`, state update helpers, message builders

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- WebSocket-Logik in separater Datei für bessere Wartbarkeit
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung

---

### 2025-12-21: Signup Refactored

**Vorher:** 629 Zeilen (alles in einer Datei)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 535 |
| _lib/types.ts | 95 |
| _lib/constants.ts | 96 |
| _lib/validators.ts | 176 |
| _lib/api.ts | 64 |
| **Total** | 966 |

**Extrahiert:**
- Types: `Country`, `Plan`, `RegisterPayload`, `FormErrors`
- Constants: `COUNTRIES`, `PLANS`, `ERROR_MESSAGES`, `HELP_MESSAGE`
- Validators: `isSubdomainValid()`, `isEmailValid()`, `passwordsMatch()`, etc.
- API: `registerUser()`, `createRegisterPayload()`

---

### 2025-12-21: Manage Admins Refactored

**Vorher:** 1661 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 1246 |
| _lib/types.ts | 122 |
| _lib/constants.ts | 209 |
| _lib/api.ts | 190 |
| _lib/filters.ts | 109 |
| _lib/utils.ts | 318 |
| **Total** | 2194 |

**Extrahiert:**
- Types: `Admin`, `Area`, `Department`, `BadgeInfo`, `StatusFilter`, `FormIsActiveStatus`, `AdminFormData`, `AdminPermissions`
- Constants: `POSITION_OPTIONS`, `STATUS_BADGE_CLASSES`, `STATUS_LABELS`, `MESSAGES`, `FORM_DEFAULTS`
- API: `loadAdmins()`, `loadAreas()`, `loadDepartments()`, `saveAdminWithPermissions()`, `deleteAdmin()`
- Filters: `filterByStatus()`, `filterBySearch()`, `applyAllFilters()`, `filterAvailableDepartments()`
- Utils: `getStatusBadgeClass()`, `getPositionDisplay()`, `getAreasBadge()`, `getDepartmentsBadge()`, `getTeamsBadge()`, `highlightMatch()`, `calculatePasswordStrength()`, `buildAdminFormData()`, `populateFormFromAdmin()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Pure functions in filters.ts für bessere Testbarkeit
- Form-Logik in utils.ts für Wiederverwendbarkeit

---

### 2025-12-21: Manage Employees Refactored

**Vorher:** 1581 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 1273 |
| _lib/types.ts | 135 |
| _lib/constants.ts | 165 |
| _lib/api.ts | 219 |
| _lib/filters.ts | 69 |
| _lib/utils.ts | 291 |
| **Total** | 2152 |

**Extrahiert:**
- Types: `Employee`, `Team`, `StatusFilter`, `IsActiveStatus`, `FormIsActiveStatus`, `AvailabilityStatus`, `BadgeInfo`, `EmployeeFormData`, `EmployeePayload`, `PasswordStrengthResult`
- Constants: `POSITION_OPTIONS`, `AVAILABILITY_OPTIONS`, `STATUS_BADGE_CLASSES`, `STATUS_LABELS`, `AVAILABILITY_BADGE_CLASSES`, `AVAILABILITY_LABELS`, `MESSAGES`, `API_ENDPOINTS`, `FORM_DEFAULTS`
- API: `loadEmployees()`, `loadTeams()`, `saveEmployee()`, `deleteEmployee()`, `assignTeamMember()`, `buildEmployeePayload()`
- Filters: `filterByStatus()`, `filterBySearch()`, `applyAllFilters()`
- Utils: `getStatusBadgeClass()`, `getStatusLabel()`, `getAvatarColor()`, `getTeamsBadge()`, `getAvailabilityBadge()`, `getAvailabilityLabel()`, `highlightMatch()`, `calculatePasswordStrength()`, `populateFormFromEmployee()`, `getDefaultFormValues()`, `validateEmailMatch()`, `validatePasswordMatch()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Pure functions in filters.ts für bessere Testbarkeit
- Availability-Logik vollständig typisiert
- Form-Helpers für populate/reset Operationen

---

### 2025-12-21: Manage Teams Refactored

**Vorher:** 1409 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 1073 |
| _lib/types.ts | 127 |
| _lib/constants.ts | 109 |
| _lib/api.ts | 291 |
| _lib/filters.ts | 63 |
| _lib/utils.ts | 205 |
| **Total** | 1868 |

**Extrahiert:**
- Types: `Team`, `TeamMember`, `Machine`, `Department`, `Admin`, `TeamDetails`, `StatusFilter`, `IsActiveStatus`, `FormIsActiveStatus`, `TeamPayload`, `DeleteTeamResult`, `ApiErrorWithDetails`
- Constants: `STATUS_BADGE_CLASSES`, `STATUS_LABELS`, `MESSAGES`, `API_ENDPOINTS`, `FORM_DEFAULTS`
- API: `loadTeams()`, `loadDepartments()`, `loadAdmins()`, `loadEmployees()`, `loadMachines()`, `getTeamDetails()`, `saveTeam()`, `addTeamMember()`, `removeTeamMember()`, `addTeamMachine()`, `removeTeamMachine()`, `updateTeamRelations()`, `deleteTeam()`, `forceDeleteTeam()`, `buildTeamPayload()`
- Filters: `filterByStatus()`, `filterBySearch()`, `applyAllFilters()`
- Utils: `getStatusBadgeClass()`, `getStatusLabel()`, `formatDate()`, `highlightMatch()`, `getMembersDisplayText()`, `getMachinesDisplayText()`, `getDepartmentDisplayText()`, `getLeaderDisplayText()`, `populateFormFromTeam()`, `getDefaultFormValues()`, `toggleIdInArray()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Multi-Select Dropdown Helpers für Members/Machines
- Team Relations API (members/machines hinzufügen/entfernen)
- Force-Delete Pattern für Teams mit Mitgliedern

---

### 2025-12-21: Manage Root Refactored

**Vorher:** 1381 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 1038 |
| _lib/types.ts | 87 |
| _lib/constants.ts | 162 |
| _lib/api.ts | 179 |
| _lib/filters.ts | 69 |
| _lib/utils.ts | 182 |
| **Total** | 1717 |

**Extrahiert:**
- Types: `RootUser`, `RootUserPayload`, `StatusFilter`, `IsActiveStatus`, `FormIsActiveStatus`, `PasswordStrengthResult`, `RootUsersApiResponse`
- Constants: `POSITION_OPTIONS`, `STATUS_BADGE_CLASSES`, `STATUS_LABELS`, `MESSAGES`, `PASSWORD_STRENGTH_LABELS`, `PASSWORD_CRACK_TIMES`, `API_ENDPOINTS`, `FORM_DEFAULTS`
- API: `loadRootUsers()`, `saveRootUser()`, `deleteRootUser()`, `buildRootUserPayload()`, `checkSession()`, `getCurrentUserId()`, `handleSessionExpired()`
- Filters: `filterByStatus()`, `filterBySearch()`, `applyAllFilters()`
- Utils: `getStatusBadgeClass()`, `getStatusLabel()`, `formatDate()`, `getAvatarColor()`, `highlightMatch()`, `calculatePasswordStrength()`, `populateFormFromUser()`, `getDefaultFormValues()`, `validateEmailMatch()`, `validatePasswordMatch()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Session-Management in api.ts isoliert
- Passwort-Stärke-Berechnung mit Labels und Crackzeiten
- Form-Helpers für populate/reset Operationen

---

### 2025-12-21: Manage Areas Refactored

**Vorher:** 1254 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 986 |
| _lib/types.ts | 112 |
| _lib/constants.ts | 178 |
| _lib/api.ts | 251 |
| _lib/filters.ts | 69 |
| _lib/utils.ts | 159 |
| **Total** | 1755 |

**Extrahiert:**
- Types: `Area`, `AdminUser`, `Department`, `StatusFilter`, `IsActiveStatus`, `FormIsActiveStatus`, `AreaType`, `AreaPayload`, `TypeOption`, `AreasApiResponse`, `DepartmentsApiResponse`, `DeleteAreaResult`
- Constants: `TYPE_LABELS`, `TYPE_OPTIONS`, `STATUS_BADGE_CLASSES`, `STATUS_LABELS`, `MESSAGES`, `API_ENDPOINTS`, `FORM_DEFAULTS`
- API: `loadAreas()`, `loadAreaLeads()`, `loadDepartments()`, `saveArea()`, `deleteArea()`, `forceDeleteArea()`, `buildAreaPayload()`, `handleSessionExpired()`
- Filters: `filterByStatus()`, `filterBySearch()`, `applyAllFilters()`
- Utils: `getStatusBadgeClass()`, `getStatusLabel()`, `getTypeLabel()`, `escapeHtml()`, `highlightMatch()`, `getAreaLeadDisplayName()`, `getDepartmentIdsForArea()`, `getDepartmentCountText()`, `populateFormFromArea()`, `getDefaultFormValues()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Area-Type-Handling mit typisiertem Dropdown
- Force-Delete Pattern für Areas mit Abhängigkeiten
- Form-Helpers für populate/reset Operationen

---

### 2025-12-21: Manage Departments Refactored

**Vorher:** 1248 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 965 |
| _lib/types.ts | 123 |
| _lib/constants.ts | 157 |
| _lib/api.ts | 287 |
| _lib/filters.ts | 63 |
| _lib/utils.ts | 140 |
| **Total** | 1735 |

**Extrahiert:**
- Types: `Department`, `Area`, `AdminUser`, `StatusFilter`, `IsActiveStatus`, `FormIsActiveStatus`, `DepartmentPayload`, `DependencyDetails`, `DeleteDepartmentResult`
- Constants: `STATUS_BADGE_CLASSES`, `STATUS_LABELS`, `DEPENDENCY_LABELS`, `MESSAGES`, `API_ENDPOINTS`, `FORM_DEFAULTS`
- API: `loadDepartments()`, `loadAreas()`, `loadDepartmentLeads()`, `saveDepartment()`, `deleteDepartment()`, `forceDeleteDepartment()`, `buildDependencyMessage()`, `buildDepartmentPayload()`, `checkSession()`, `handleSessionExpired()`
- Filters: `filterByStatus()`, `filterBySearch()`, `applyAllFilters()`
- Utils: `getStatusBadgeClass()`, `getStatusLabel()`, `getAreaDisplay()`, `getLeadDisplay()`, `getTeamCountText()`, `highlightMatch()`, `getSelectedAreaName()`, `getSelectedLeadName()`, `populateFormFromDepartment()`, `getDefaultFormValues()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Force-Delete Pattern für Departments mit Abhängigkeiten (teams, users, machines, shifts, etc.)
- Dropdown-Helpers für Area- und Lead-Auswahl
- Form-Helpers für populate/reset Operationen

---

### 2025-12-21: Logs Refactored

**Vorher:** 963 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 570 |
| _lib/types.ts | 83 |
| _lib/constants.ts | 141 |
| _lib/api.ts | 134 |
| _lib/utils.ts | 186 |
| **Total** | 1114 |

**Extrahiert:**
- Types: `LogEntry`, `PaginationInfo`, `Filters`, `DropdownOption`, `PaginationPageItem`, `LogsApiResponse`, `DeleteLogsBody`
- Constants: `LOGS_PER_PAGE`, `ACTION_OPTIONS`, `ENTITY_OPTIONS`, `TIMERANGE_OPTIONS`, `ACTION_LABELS`, `ROLE_LABELS`, `ROLE_BADGE_CLASSES`, `TIMERANGE_DAYS_MAP`, `MESSAGES`
- API: `fetchLogs()`, `deleteLogs()`
- Utils: `shouldIncludeFilter()`, `calculateStartDate()`, `getActionLabel()`, `getRoleLabel()`, `getRoleBadgeClass()`, `formatDate()`, `getDisplayName()`, `getDropdownDisplayText()`, `getVisiblePages()`, `hasActiveFilters()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- 41% Reduktion der +page.svelte Zeilen (963 → 570)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Pagination-Logik in utils.ts für Wiederverwendbarkeit
- Filter-Logik sauber getrennt in API und Utils
- Delete Modal bereits a11y-konform (tabindex, Escape-Handler)

---

### 2025-12-21: Blackboard Refactored

**Vorher:** 1226 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 630 |
| _lib/types.ts | 160 |
| _lib/constants.ts | 152 |
| _lib/api.ts | 275 |
| _lib/utils.ts | 237 |
| **Total** | 1454 |

**Extrahiert:**
- Types: `OrgLevel`, `EntryStatus`, `Priority`, `EntryColor`, `BlackboardEntry`, `Department`, `Team`, `Area`, `FormMode`, `EntryPayload`, `EntriesApiResponse`, `OrganizationsApiResponse`
- Constants: `ZOOM_CONFIG`, `ENTRIES_PER_PAGE`, `PRIORITY_LABELS`, `PRIORITY_CLASSES`, `COLOR_OPTIONS`, `SORT_OPTIONS`, `MESSAGES`
- API: `fetchEntries()`, `fetchOrganizations()`, `createEntry()`, `updateEntry()`, `deleteEntry()`, `confirmEntry()`, `uploadAttachments()`
- Utils: `formatDateShort()`, `formatFileSize()`, `truncateText()`, `getPriorityLabel()`, `getPriorityClass()`, `getOrgLevelLabel()`, `getStatusBadgeClass()`, `getColorClass()`, `getFileIconClass()`, `canUserEdit()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- 49% Reduktion der +page.svelte Zeilen (1226 → 630)
- Alle UI-Strings in `MESSAGES` Konstante für i18n-Vorbereitung
- Vollständige a11y-Konformität (ARIA roles, tabindex, keyboard events)
- XSS-Schutz via DOMPurify (`sanitizeWithLineBreaks`)

---

### 2025-12-21: Blackboard Detail Refactored

**Vorher:** 860 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 429 |
| _lib/types.ts | 111 |
| _lib/api.ts | 187 |
| _lib/utils.ts | 154 |
| **Total** | 881 |

**Extrahiert:**
- Types: `DetailEntry`, `Comment`, `Attachment`, `PreviewAttachment`, `CurrentUser`, `FullEntryResponse`, `MeResponse`
- API: `fetchFullEntry()`, `loadCurrentUser()`, `confirmEntry()`, `unconfirmEntry()`, `addComment()`, `archiveEntry()`, `buildDownloadUrl()`
- Utils: `formatDate()`, `formatDateTime()`, `getPriorityText()`, `getPriorityBadgeClass()`, `getOrgLevelText()`, `getVisibilityBadgeClass()`, `getFileIcon()`, `getPreviewFileType()`, `getAvatarColor()`, `filterPhotos()`, `filterOtherFiles()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit)
- 50% Reduktion der +page.svelte Zeilen (860 → 429)
- Re-Export Pattern: Detail utils importiert shared functions von parent `_lib/`
- Vollständige a11y-Konformität (Modal focus trap, keyboard events, aria-labels)
- XSS-Schutz via DOMPurify (`sanitizeWithLineBreaks`)
- Preview Modal für PDF/Bilder mit File-Download

---

### 2025-12-21: Features Refactored

**Vorher:** 896 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 554 |
| _lib/types.ts | 72 |
| _lib/constants.ts | 94 |
| _lib/api.ts | 206 |
| _lib/utils.ts | 144 |
| **Total** | 1070 |

**Extrahiert:**
- Types: `Feature`, `FeatureCategory`, `Plan`, `TenantAddons`, `FeatureFilter`, `AddonType`, `JwtPayload`, `ApiResponse`, `AddonInfo`, `TenantFeature`
- Constants: `PLAN_ORDER`, `FEATURE_CATEGORIES`, `ADDON_PRICING`, `DEFAULT_TENANT_NAME`
- API: `loadPlans()`, `loadCurrentPlan()`, `loadTenantFeatures()`, `applyTenantFeaturesToCategories()`, `changePlan()`, `toggleFeature()`, `saveAddons()`
- Utils: `parseJwt()`, `canActivateFeature()`, `isFeatureIncludedInPlan()`, `getPlanBadge()`, `getFeatureStatusText()`, `getFeatureStatusClass()`, `getFeatureCardClasses()`, `calculateTotalCost()`, `countActiveFeatures()`, `cloneFeatureCategories()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit in `_lib/`)
- 38% Reduktion der +page.svelte Zeilen (896 → 554)
- 60% Reduktion der Script-Logik (565 → 225 Zeilen)
- Alle Konstanten (Feature Categories, Addon Pricing) in constants.ts
- Pure utility functions für Plan/Feature-Logik
- API-Calls vollständig isoliert mit Fehlerbehandlung

---

### 2025-12-21: Tenant Deletion Status Refactored

**Vorher:** 848 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 540 |
| _lib/types.ts | 67 |
| _lib/constants.ts | 58 |
| _lib/api.ts | 98 |
| _lib/utils.ts | 171 |
| **Total** | 934 |

**Extrahiert:**
- Types: `DeletionStatus`, `DeletionStatusItem`, `TimelineItem`, `ConfirmModalType`, `ToastType`, `JwtPayload`, `ApiError`, `ApiResponse`
- Constants: `STATUS_TEXT_MAP`, `STATUS_BADGE_CLASS`, `REFRESH_INTERVAL_MS`, `TIMELINE_ICONS`, `MESSAGES`
- API: `loadDeletionStatus()`, `rejectDeletion()`, `cancelDeletion()`, `emergencyStop()`, `parseJwtToken()`
- Utils: `getStatusText()`, `getBadgeClass()`, `calculateCoolingOff()`, `isCurrentUserCreator()`, `getRequesterName()`, `formatDate()`, `formatDateOnly()`, `buildTimeline()`, `shouldShowCoolingOff()`, `shouldShowGracePeriod()`, `shouldShowEmergencyStop()`, `showToast()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit in `_lib/`)
- 36% Reduktion der +page.svelte Zeilen (848 → 540)
- 59% Reduktion der Script-Logik (518 → 214 Zeilen)
- DSGVO-konforme Löschlogik sauber dokumentiert
- Timeline-Builder als pure function
- API mit strukturierter Fehlerbehandlung (404 = no error)

---

### 2025-12-21: Admin Dashboard Refactored

**Vorher:** 829 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 423 |
| _lib/types.ts | 91 |
| _lib/constants.ts | 68 |
| _lib/api.ts | 195 |
| _lib/utils.ts | 152 |
| **Total** | 929 |

**Extrahiert:**
- Types: `DashboardStats`, `Department`, `Team`, `User`, `Document`, `CalendarEvent`, `BlackboardEntry`, `FormattedEventDate`, `Priority`, `OrgLevel`, `BlackboardOrgLevel`
- Constants: `ORG_LEVEL_LABELS`, `BLACKBOARD_ORG_LABELS`, `PRIORITY_LABELS`, `DEFAULT_STATS`, `LIST_LIMITS`, `CALENDAR_MONTHS_AHEAD`, `MESSAGES`
- API: `getAuthToken()`, `apiGet()`, `loadEmployees()`, `loadDocuments()`, `loadDepartments()`, `loadTeams()`, `loadUpcomingEvents()`, `loadBlackboard()`
- Utils: `getEmployeeName()`, `getOrgLevelText()`, `getOrgLevelClass()`, `getPriorityLabel()`, `getBlackboardOrgLabel()`, `formatBlackboardDate()`, `parseContent()`, `truncateContent()`, `formatEventDate()`, `isAllDay()`, `openBlackboardEntry()`, `navigateTo()`, `goToCalendar()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit in `_lib/`)
- 49% Reduktion der +page.svelte Zeilen (829 → 423)
- 75% Reduktion der Script-Logik (500 → 125 Zeilen)
- Blackboard-Widget vollständig modularisiert
- API-Calls mit strukturierter Rückgabe (recent + count)
- Alle UI-Strings in MESSAGES konstante für i18n-Vorbereitung

---

### 2025-12-22: Root Dashboard Refactored

**Vorher:** 450 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 303 |
| _lib/types.ts | 59 |
| _lib/constants.ts | 90 |
| _lib/api.ts | 172 |
| _lib/utils.ts | 89 |
| **Total** | 713 |

**Extrahiert:**
- Types: `DashboardData`, `ActivityLog`, `UserData`, `ApiResponse`, `LogsApiResponse`, `UserRole`, `ActionType`
- Constants: `ACTION_LABELS`, `ACTION_BADGE_CLASSES`, `ROLE_LABELS`, `ROLE_BADGE_CLASSES`, `EMPLOYEE_NUMBER`, `API_ENDPOINTS`, `STORAGE_KEYS`, `MESSAGES`
- API: `getAccessToken()`, `removeAccessToken()`, `loadDashboardData()`, `loadActivityLogs()`, `checkEmployeeNumber()`, `saveEmployeeNumber()`
- Utils: `getActionLabel()`, `getActionBadgeClass()`, `getRoleLabel()`, `getRoleBadgeClass()`, `getDisplayName()`, `isTemporaryEmployeeNumber()`, `filterEmployeeNumberInput()`, `isValidEmployeeNumber()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit in `_lib/`)
- 33% Reduktion der +page.svelte Zeilen (450 → 303)
- Employee Number Validierung als pure functions
- API-Calls mit strukturierter Rückgabe (data + error + unauthorized)
- Alle UI-Strings in MESSAGES Konstante für i18n-Vorbereitung

---

### 2025-12-22: Account Settings Refactored

**Vorher:** 529 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 382 |
| _lib/types.ts | 57 |
| _lib/constants.ts | 50 |
| _lib/api.ts | 126 |
| _lib/utils.ts | 69 |
| **Total** | 684 |

**Extrahiert:**
- Types: `DeletionStatus`, `ToastType`, `DeletionStatusData`, `DeletionQueueResponse`, `DeletionStatusResponse`, `RootUsersResponse`, `JwtPayload`
- Constants: `STATUS_LABELS`, `DELETE_CONFIRMATION_TEXT`, `MIN_REASON_LENGTH`, `MIN_ROOT_USERS`, `MESSAGES`, `STORAGE_KEYS`
- API: `parseJwtPayload()`, `getAccessToken()`, `checkAuthRole()`, `loadDeletionStatus()`, `getRootUserCount()`, `deleteTenant()`
- Utils: `formatDate()`, `getStatusLabel()`, `showToast()`, `isDeleteConfirmationValid()`, `isReasonValid()`, `canDelete()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit in `_lib/`)
- 28% Reduktion der +page.svelte Zeilen (529 → 382)
- DSGVO-konforme Löschlogik (Zwei-Personen-Prinzip)
- Validierungs-Konstanten für Confirmation Text und Reason Length
- Auth-Check als wiederverwendbare Funktion

---

### 2025-12-22: Root Profile Refactored

**Vorher:** 820 Zeilen (alles in einer Datei mit JSDoc)

**Nachher:**
| Datei | Zeilen |
|-------|--------|
| +page.svelte | 538 |
| _lib/types.ts | 79 |
| _lib/constants.ts | 59 |
| _lib/api.ts | 188 |
| _lib/utils.ts | 76 |
| **Total** | 940 |

**Extrahiert:**
- Types: `UserProfile`, `ApprovalItem`, `PasswordStrengthResult`, `PasswordField`, `ToastType`, `ProfileUpdatePayload`, `PasswordChangePayload`, `UserResponse`, `ApprovalsResponse`, `PictureUploadResponse`, `JwtPayload`
- Constants: `PASSWORD_RULES`, `PICTURE_CONSTRAINTS`, `STORAGE_KEYS`, `MESSAGES`, `PASSWORD_TOOLTIP`
- API: `loadProfile()`, `loadProfilePicture()`, `loadPendingApprovals()`, `saveProfile()`, `uploadProfilePicture()`, `removeProfilePicture()`, `changePassword()`, `approveRequest()`, `rejectRequest()`, `parseJwtRole()`
- Utils: `formatDate()`, `showToast()`, `triggerFileInput()`, `isCurrentPasswordError()`, `isPasswordLengthValid()`, `doPasswordsMatch()`

**Verbesserungen:**
- JSDoc → TypeScript (volle Typsicherheit in `_lib/`)
- 34% Reduktion der +page.svelte Zeilen (820 → 538)
- Passwort-Validierung mit min/max Länge
- Tenant Deletion Approvals (2-Personen-Prinzip) sauber isoliert
- LocalStorage Cache für Profilbild
- Toast-System über Custom Events

---

## Regeln (Quick Reference)

1. **TypeScript überall** - `.ts` für alle `_lib/` Dateien
2. **`state.svelte.ts`** nur wenn State exportiert werden muss (Objekt-Pattern!)
3. **Pure Functions** - Filter/Validators ohne Side Effects
4. **Keine Business-Logik im Template** - Nur Aufrufe
5. **Jede Datei = Eine Verantwortung** (Single Responsibility)

---

_Siehe auch: [SVELTEKIT-MIGRATION-PLAN.md](./SVELTEKIT-MIGRATION-PLAN.md) Sektion 0.6_
