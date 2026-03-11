# Backend Splitting Refactoring Plan (v3 — Review-Hardened)

> All backend service files exceeding the ESLint `max-lines: 800` limit, sorted by size, with a decision-driven splitting approach.
>
> **v3 Changes (from v2):** Fixed contradictory facade line limits (250 target vs 400 max clarified), extracted blackboard access control to stay under 400-line sub-service limit, added rules for inter-sub-service communication and shared types, expanded transaction boundary pattern, added Bruno coverage pre-check to checklist. Net result: ~70 new files.
>
> **v2 Changes:** Added Decision Framework, merged micro-services (<100 lines), dropped `*.queries.ts` default layer, fixed users.service.ts facade bloat, consolidated reports module, added Risk Mitigation section.

---

## Decision Framework

Before extracting any code into a new file, it **MUST** pass this test.

### Create an @Injectable sub-service when:

- It has **its own database table(s)** and distinct operations
- It has a **clear bounded context** that doesn't overlap with the facade
- It will be **>=100 lines** after extraction (including class boilerplate)
- It **needs dependency injection** (DatabaseService, other services, ConfigService)
- The domain has **growth potential** — likely to expand with new features

### Use a plain helper file (no DI) when:

- **Pure functions** — no side effects, no DB calls, no injected dependencies
- **Mappers/transforms** — DB rows to API responses
- **Validation logic** — that doesn't need DB access
- **Formatting/serialization** — CSV, error formatting, date math
- **Algorithms** — recurrence calculation, cycle state, statistical computations

### Keep it in the facade when:

- **1-2 simple methods** that don't justify their own file
- **Orchestration logic** — calling multiple sub-services in sequence
- **Thin wrappers** — methods that mainly delegate with minimal logic
- The domain is **fully covered** (no growth potential) at <100 lines

### Do NOT split when:

- Resulting file would be **<100 lines** with no growth potential
- It's **1 method** with no distinct domain
- It's **tightly coupled** to the facade's core flow (splitting creates back-and-forth calls)

---

## Splitting Schema (Universal Template)

Not every service needs all layers. Use only what's justified.

```
Layer 1: *.service.ts              Facade — pure delegation        target 250 lines
                                   OR Facade + core CRUD           max 400 lines
Layer 2: *-[domain].service.ts     Sub-domain business logic       max 400 lines  (needs DI)
Layer 3: *.helpers.ts              Transform, mapping, pure fns    max 300 lines  (no DI)
Layer 4: *.constants.ts            Defaults, enums, config values  max 100 lines
```

**When to use Facade + core CRUD (max 400):** When extracting CRUD into a sub-service would leave the facade as a pointless pass-through with no orchestration logic (e.g., machines, documents, teams). When the facade has 3+ sub-domains to coordinate, extract CRUD into its own sub-service and keep the facade at <=250 lines (e.g., users, chat, blackboard).

**Dropped from v1:** `*.queries.ts` — SQL stays co-located with the service that executes it. Extracting SQL into a separate file breaks co-location: you change business logic in one file, its SQL in another. Only extract shared query builders if genuinely reused by 3+ services.

### Rules

1. **Facade stays thin** — Orchestrates sub-services, holds no complex logic. Target: **<=250 lines** for pure delegation. Hard max: **400 lines** when the facade also holds core CRUD (see Splitting Schema above for when each applies).
2. **Sub-services own one domain** — Each handles one bounded context (e.g., comments, attachments, maintenance).
3. **Helpers are stateless** — Mappers, transformers, parsers. No injected dependencies, no DB calls.
4. **Constants never change at runtime** — Defaults, column lists, enum-like objects.
5. **No micro-services** — Every @Injectable sub-service must have **>=100 lines** of genuine logic (not counting imports/boilerplate).
6. **Sub-services never call each other** — All cross-domain coordination goes through the facade. Sub-services depend only on `DatabaseService`, shared utilities, and `ConfigService`. This prevents circular dependencies and keeps the facade as the single orchestration point.
7. **Shared types stay in the module's existing types file** — When splitting, shared interfaces/types remain in the existing `*.dto.ts` or module types file. Sub-services import from there. Do NOT create per-sub-service type files.

### NestJS Integration

- Sub-services are `@Injectable()` and injected into the facade via constructor.
- Sub-services can share the same `DatabaseService` / pool injection.
- The controller continues to call **only** the facade service.
- Module `providers` array registers all sub-services.

---

## File Inventory (Sorted by Size)

| #   | File                                                              | Lines | Priority |
| --- | ----------------------------------------------------------------- | ----: | -------- |
| 1   | `backend/src/nest/chat/chat.service.ts`                           |  1723 | CRITICAL |
| 2   | `backend/src/nest/blackboard/blackboard.service.ts`               |  1600 | CRITICAL |
| 3   | `backend/src/nest/surveys/surveys.service.ts`                     |  1542 | CRITICAL |
| 4   | `backend/src/nest/kvp/kvp.service.ts`                             |  1441 | CRITICAL |
| 5   | `backend/src/nest/root/root.service.ts`                           |  1407 | HIGH     |
| 6   | `backend/src/nest/shifts/rotation.service.ts`                     |  1401 | HIGH     |
| 7   | `backend/src/nest/shifts/shifts.service.ts`                       |  1387 | HIGH     |
| 8   | `backend/src/nest/calendar/calendar.service.ts`                   |  1362 | HIGH     |
| 9   | `backend/src/services/tenantDeletion.service.ts`                  |  1299 | HIGH     |
| 10  | `backend/src/nest/reports/reports.service.ts`                     |  1294 | HIGH     |
| 11  | `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` |  1280 | CRITICAL |
| 12  | `backend/src/nest/machines/machines.service.ts`                   |  1265 | MODERATE |
| 13  | `backend/src/nest/documents/documents.service.ts`                 |  1263 | MODERATE |
| 14  | `backend/src/nest/users/users.service.ts`                         |  1204 | MODERATE |
| 15  | `backend/src/nest/notifications/notifications.service.ts`         |  1074 | MODERATE |
| 16  | `backend/src/nest/settings/settings.service.ts`                   |   905 | LOW      |
| 17  | `backend/src/websocket.ts`                                        |   852 | LOW      |
| 18  | `backend/src/nest/teams/teams.service.ts`                         |   804 | LOW      |

**Priority Key:**

- **CRITICAL** = >1400 lines OR structural anti-pattern
- **HIGH** = 1200-1400 lines
- **MODERATE** = 1000-1265 lines
- **LOW** = 800-905 lines

---

## Per-File Splitting Plan

---

### 1. chat.service.ts (1723 lines | 35 methods)

**Current Domains:** Users, Conversations, Messages, Scheduled Messages, Participants, Helpers

**New files: 4** | Conversations, Messages, and Scheduled are genuine bounded contexts with their own tables and 5+ methods each.

```
chat/
  chat.service.ts                   Facade (~250 lines)
    delegates to:
  chat-conversations.service.ts     Conversation CRUD (~400 lines)
    - listConversations()
    - getConversation()
    - createConversation()
    - updateConversation()
    - deleteConversation()
    - getConversationParticipants()
  chat-messages.service.ts          Message operations (~400 lines)
    - listMessages()
    - sendMessage()
    - editMessage()
    - deleteMessage()
    - markAsRead()
    - getUnreadCount()
  chat-scheduled.service.ts         Scheduled messages (~150 lines)
    - listScheduled()
    - createScheduled()
    - cancelScheduled()
    - processScheduledMessages()
  chat.helpers.ts                   Mappers, transforms (~150 lines)
```

**v2 change:** Dropped `chat.queries.ts`. SQL stays inline in each sub-service. No query is shared across sub-services here.

---

### 2. blackboard.service.ts (1600 lines | 35 methods)

**Current Domains:** Entry CRUD, Access Control, Org Management, Comments, Attachments, Confirmations

**New files: 7** | Comments, confirmations, and attachments each have their own table and distinct bounded context. Despite being ~100 lines each, they pass the Decision Framework: own table, DI needed, clear growth potential (threading, reactions, bulk operations). Access control extracted from entries to stay under the 400-line sub-service limit — consistent with `calendar-permission.service.ts` pattern.

```
blackboard/
  blackboard.service.ts                    Facade (~200 lines)
    delegates to:
  blackboard-entries.service.ts            Entry CRUD (~350 lines)
    - listEntries()
    - getEntryById()
    - createEntry()
    - updateEntry()
    - deleteEntry()
    - archiveEntry()
  blackboard-access.service.ts             Access control (~150 lines)
    - checkAccess()
    - buildOrgLevelFilter()
    - buildPermissionFilter()
  blackboard-comments.service.ts           Comments (~100 lines)
    - listComments()
    - addComment()
    - deleteComment()
  blackboard-confirmations.service.ts      Read confirmations (~100 lines)
    - confirmEntry()
    - getConfirmationStatus()
    - getUnconfirmedCount()
  blackboard-attachments.service.ts        File attachments (~150 lines)
    - listAttachments()
    - addAttachment()
    - deleteAttachment()
  blackboard.helpers.ts                    Mappers, transforms (~150 lines)
  blackboard.constants.ts                  Defaults, visibility rules (~50 lines)
```

---

### 3. surveys.service.ts (1542 lines | 44 methods)

**Current Domains:** Survey CRUD, Questions, Responses, Statistics, Templates, Exports, Transforms

**New files: 4** | Questions, Responses, and Statistics are substantial bounded contexts. Templates (2 methods, ~60 lines) merged into facade. Export (1 method) merged into Responses — exporting responses IS a response operation.

```
surveys/
  surveys.service.ts                  Facade (~350 lines)
    - listSurveys()
    - getSurveyById()
    - createSurvey()
    - updateSurvey()
    - deleteSurvey()
    - getTemplates()               ← absorbed from v1 survey-templates.service.ts
    - createFromTemplate()         ← absorbed from v1 survey-templates.service.ts
    delegates to:
  survey-questions.service.ts         Question management (~250 lines)
    - loadQuestions()
    - insertQuestions()
    - insertOptions()
    - insertAssignments()
    - buildOptionsMap()
    - attachOptions()
  survey-responses.service.ts         Response handling + export (~400 lines)
    - submitResponse()
    - getAllResponses()
    - getMyResponse()
    - getResponseById()
    - updateResponse()
    - checkDuplicate()
    - insertAnswer()
    - exportResponses()            ← absorbed from v1 survey-export.service.ts
  survey-statistics.service.ts        Analytics (~200 lines)
    - getStatistics()
    - getChoiceQuestionStats()
    - getTextQuestionResponses()
    - getRatingQuestionStats()
    - getDateQuestionStats()
  surveys.helpers.ts                  Transforms (~100 lines)
    - transformSurveyWithMetadata()
    - transformSurveyToApi()
    - normalizeAnswers()
    - parseDbCount()
```

**v2 changes:**

- `survey-templates.service.ts` (60 lines, 2 methods) → merged into facade. Two thin methods with no distinct table. Templates are a fixed concept unlikely to grow.
- `survey-export.service.ts` (80 lines, 1 method) → merged into responses. Exporting responses is semantically a response operation.

---

### 4. kvp.service.ts (1441 lines | 24 methods)

**Current Domains:** Org/Permissions, Categories, Dashboard, Suggestions, Comments, Attachments, Confirmations

**New files: 5** | Same pattern as blackboard — comments, attachments, confirmations each have own table and bounded context.

```
kvp/
  kvp.service.ts                     Facade (~300 lines)
    - listSuggestions()
    - getSuggestionById()
    - createSuggestion()
    - updateSuggestion()
    - deleteSuggestion()
    delegates to:
  kvp-comments.service.ts            Comments (~100 lines)
    - listComments()
    - addComment()
    - deleteComment()
  kvp-attachments.service.ts         File attachments (~150 lines)
    - listAttachments()
    - addAttachment()
    - deleteAttachment()
  kvp-confirmations.service.ts       Read confirmations (~100 lines)
    - confirmSuggestion()
    - getConfirmationStatus()
  kvp.helpers.ts                     Mappers, transforms (~150 lines)
  kvp.constants.ts                   Status codes, categories (~50 lines)
```

---

### 5. root.service.ts (1407 lines | 33 methods)

**Current Domains:** Admin Mgmt, Root User Mgmt, Tenant Mgmt, Dashboard, Tenant Deletion

**New files: 3** | Admin management is a substantial sub-domain. Tenant management is thin (2 methods, ~100 lines) but tenants are a core domain with high growth potential (billing, feature flags, storage management).

```
root/
  root.service.ts                    Facade - Root users (~250 lines)
    - getRootUsers()
    - getRootUserById()
    - createRootUser()
    - updateRootUser()
    - deleteRootUser()
    - getDashboardStats()
    delegates to:
  root-admin.service.ts              Admin management (~200 lines)
    - getAdmins()
    - getAdminById()
    - createAdmin()
    - updateAdmin()
    - deleteAdmin()
    - getAdminLogs()
  root-tenant.service.ts             Tenant management (~100 lines)
    - getTenants()
    - getStorageInfo()
  root.helpers.ts                    Mappers (~100 lines)
    - mapDbUserToAdminUser()
    - mapDbUserToRootUser()
    - mapDbLogToAdminLog()
    - buildAdminUpdateFields()
    - buildRootUserUpdateFields()
    - checkDuplicateEmail()
    - handleDuplicateEntryError()
```

Note: Tenant deletion methods already delegate to `tenantDeletion.service.ts` (see #9).

---

### 6. rotation.service.ts (1401 lines | 45 methods)

**Current Domains:** Pattern CRUD, Assignments, Shift Generation, Shift Calculation, History

**New files: 4** | The generator at ~550 lines exceeds the 400-line guideline but the shift generation algorithm is a tightly coupled state asset. Splitting it would scatter related logic across files and harm readability. This is the correct trade-off.

```
shifts/
  rotation.service.ts                     Facade (~200 lines)
    delegates to:
  rotation-pattern.service.ts             Pattern CRUD (~200 lines)
    - getRotationPatterns()
    - getRotationPattern()
    - createRotationPattern()
    - updateRotationPattern()
    - deleteRotationPattern()
    - parsePatternConfig()
    - patternRowToResponse()
  rotation-assignment.service.ts          Assignments (~100 lines)
    - assignUsersToPattern()
    - getPatternAssignments()
    - validateTeamExists()
    - validateAssignmentUserIds()
  rotation-generator.service.ts           Shift generation engine (~550 lines)
    - generateRotationShifts()
    - generateRotationFromConfig()
    - generateShiftsForAssignment()
    - determineShiftType()
    - determineAlternatingShiftType()
    - saveGeneratedShifts()
    - mapShiftTypeToGroup()
    - shouldSkipBySpecialRules()
    - advanceCycleState()
    - generateUserShiftHistory()
  rotation-history.service.ts             History (~220 lines)
    - getRotationHistory()
    - deleteRotationHistory()
    - deleteRotationHistoryByDateRange()
    - deleteRotationHistoryEntry()
```

---

### 7. shifts.service.ts (1387 lines | 27 methods)

**Current Domains:** Shift CRUD, Shift Plans, Swap Requests, Reporting

**New files: 4** | Plans are a substantial domain. Swap requests have their own table and workflow (request → approve/reject). Shift reporting is domain-specific analytics that belongs near the shift logic, not in the global reports module.

```
shifts/
  shifts.service.ts                  Facade (~250 lines)
    - listShifts()
    - getShiftById()
    - createShift()
    - updateShift()
    - deleteShift()
    delegates to:
  shift-plans.service.ts             Plan management (~350 lines)
    - listPlans()
    - getPlanById()
    - createPlan()
    - updatePlan()
    - deletePlan()
    - getShiftsByPlan()
    - duplicatePlan()
  shift-swap.service.ts              Swap requests (~100 lines)
    - listSwapRequests()
    - createSwapRequest()
    - approveSwapRequest()
    - rejectSwapRequest()
  shift-reporting.service.ts         Reports (~100 lines)
    - getShiftStatistics()
    - getOvertimeReport()
    - getAttendanceSummary()
  shifts.helpers.ts                  Mappers, transforms (~150 lines)
```

---

### 8. calendar.service.ts (1362 lines | 36 methods)

**Current Domains:** Event CRUD, Creation Logic, Recurrence, Permissions, Exports, Dashboard, Notifications

**New files: 4** | Recurrence calculation (2 pure functions, ~80 lines) moved to helpers — no DI needed. Dashboard queries and notification counts merged into one service (~175 lines combined) — both are read-only aggregation queries for the calendar overview.

```
calendar/
  calendar.service.ts                     Facade (~280 lines)
    - listEvents()
    - getEventById()
    - createEvent()
    - updateEvent()
    - deleteEvent()
    delegates to:
  calendar-creation.service.ts            Event creation logic (~150 lines)
    - insertEvent()
    - createChildEvents()
    - addAttendeesToEvent()
    - addEventAttendee()
    - determineOrgTarget()
    - logEventCreated()
  calendar-permission.service.ts          Access control (~200 lines)
    - buildAdminOrgLevelFilter()
    - buildPermissionBasedFilter()
    - buildVisibilityClause()
    - checkEventAccess()
    - getUserRole()
  calendar-overview.service.ts            Dashboard + notifications (~175 lines)
    - getDashboardEvents()
    - getRecentlyAddedEvents()
    - getUpcomingCount()
    - countUpcomingForFullAccess()
    - countUpcomingWithPermissions()
  calendar.helpers.ts                     Mappers + recurrence (~160 lines)
    - dbToApiEvent()
    - normalizePagination()
    - buildEventUpdateQuery()
    - calculateRecurrenceDates()       ← absorbed from v1 calendar-recurrence.service.ts
    - addRecurrenceInterval()          ← absorbed from v1 calendar-recurrence.service.ts
```

**v2 changes:**

- `calendar-recurrence.service.ts` (80 lines, 2 methods) → moved to helpers. These are **pure date calculation functions** with zero DI needs. Making them @Injectable was over-engineering.
- `calendar-dashboard.service.ts` + `calendar-notification.service.ts` → merged into `calendar-overview.service.ts` (~175 lines). Both are read-only aggregation queries for the calendar overview page.

---

### 9. tenantDeletion.service.ts (1299 lines | 39 methods)

**Current Domains:** Deletion Main, Workflow, Approval, Analysis, Multi-Pass Engine, Table Ops, Export, Audit

**New files: 4** | Queue/workflow methods (processQueue, approve, reject, emergencyStop) absorbed into facade — they ARE coordination. Audit stays separate despite being thin (60 lines) because compliance code deserves explicit ownership and visibility during security reviews.

```
services/
  tenant-deletion.service.ts               Coordinator facade (~280 lines)
    - deleteTenant()
    - requestTenantDeletion()
    - cancelDeletion()
    - processQueue()                   ← absorbed from v1 tenant-deletion-queue.service.ts
    - approveDeletion()                ← absorbed from v1 tenant-deletion-queue.service.ts
    - rejectDeletion()                 ← absorbed from v1 tenant-deletion-queue.service.ts
    - triggerEmergencyStop()           ← absorbed from v1 tenant-deletion-queue.service.ts
    delegates to:
  tenant-deletion-executor.service.ts      Multi-pass engine (~330 lines)
    - executeDeletions()
    - multiPassDelete()
    - multiPassDeleteUserRelated()
    - processUserRelatedTable()
    - deleteFromTable()
    - deleteFromTableDirect()
    - clearCriticalTableUserReferences()
  tenant-deletion-analyzer.service.ts      Dry-run & verification (~100 lines)
    - performDryRun()
    - verifyCompleteDeletion()
  tenant-deletion-exporter.service.ts      Backup & export (~140 lines)
    - createTenantDataExport()
    - createSqlBackup()
    - exportTablesToJson()
    - generateInsertStatement()
  tenant-deletion-audit.service.ts         Audit & compliance (~60 lines)
    - createDeletionAuditTrail()
    - checkLegalHolds()
    - sendDeletionWarningEmails()
```

**v2 changes:**

- `tenant-deletion-queue.service.ts` (80 lines, 4 methods) → absorbed into facade. The queue methods (process, approve, reject, emergency stop) are **orchestration** — exactly what the facade does. Facade grows from ~200 to ~280 lines, still well under the 400 limit.
- `tenant-deletion-audit.service.ts` kept despite being 60 lines. **Exception to the 100-line rule:** Compliance code deserves its own file for auditability, even if thin. During a GDPR review, you want `tenant-deletion-audit.service.ts` to be immediately findable.

---

### 10. reports.service.ts (1294 lines | 38 methods)

**Current Domains:** Metrics, Overview, Employee, Department, Shift, KVP, Attendance, Compliance, Custom, Export

**New files: 3** | v1 proposed 8 new files with 6 micro-services (80-150 lines each). Reports are fundamentally read-only SQL queries with formatting — the overhead of 6+ @Injectable services is unjustified. Consolidated into 2 substantial sub-services by domain affinity: people-focused analytics and operations-focused analytics. Export logic split: routing goes to facade, pure formatting goes to helpers.

```
reports/
  reports.service.ts                   Facade (~250 lines)
    - getOverviewReport()
    - generateCustomReport()
    - exportReport()
    - getReportDataByType()           ← absorbed from v1 report-export.service.ts
    delegates to:
  report-people.service.ts            People analytics (~300 lines)
    - getEmployeeMetrics()
    - getEmployeeReport()
    - getDepartmentMetrics()
    - getDepartmentReport()
    - getPerformanceMetrics()
    - getAttendanceReport()
    - getComplianceReport()
  report-operations.service.ts        Operations analytics (~300 lines)
    - getShiftMetrics()
    - getShiftReport()
    - getShiftSummary()
    - getShiftOvertimeByDepartment()
    - getShiftPeakHours()
    - getKvpMetrics()
    - getKvpReport()
    - getKvpSummary()
    - getKvpByCategory()
    - getKvpTopPerformers()
    - getSurveyMetrics()
  reports.helpers.ts                   Shared helpers + formatting (~180 lines)
    - parseIntOrZero()
    - parseFloatOrZero()
    - getDefaultDateFrom()
    - getDefaultDateTo()
    - buildShiftQueryConditions()
    - formatReportForExport()         ← absorbed from v1 report-export.service.ts
    - convertToCSV()                  ← absorbed from v1 report-export.service.ts
```

**v2 changes (major):**

- 8 new files → 3 new files. Every v1 sub-service was <150 lines with 1-5 methods.
- `report-employee` + `report-department` + `report-performance` → merged into `report-people.service.ts` (~300 lines). All query user/employee tables.
- `report-shift` + `report-kvp` + `report-survey` → merged into `report-operations.service.ts` (~300 lines). All query operational domain tables.
- `report-export.service.ts` (100 lines, 3 methods) → dissolved. Router method goes to facade, pure formatting functions go to helpers. No DI needed for CSV conversion.

---

### 11. audit-trail.interceptor.ts (1280 lines | 41 methods)

**STRUCTURAL ANTI-PATTERN** — A single interceptor doing 10 different jobs. Needs aggressive splitting, but v1 over-split by making pure functions into @Injectable services.

**New files: 5** | Three genuine @Injectable services (request filtering, metadata extraction + prefetch, persistence). All pure logic (action determination, sanitization, error formatting) consolidated into helpers — these are stateless functions that don't need DI.

```
common/interceptors/
  audit-trail.interceptor.ts              Facade (~150 lines)
    - intercept()
    - handleMutationWithPreFetch()
    delegates to:

common/audit/
  audit-request-filter.service.ts         Request filtering (~150 lines)
    - shouldSkipRequest()
    - shouldExclude()
    - shouldSkipGetRequest()
    - shouldThrottleCurrentUser()
    - shouldThrottleListOrView()
    - shouldThrottleByEndpoint()
  audit-metadata.service.ts               Metadata extraction + prefetch (~240 lines)
    - extractRequestMetadata()
    - extractResourceType()
    - extractResourceId()
    - extractResourceName()
    - extractLoginEmail()
    - extractIpAddress()
    - fetchResourceBeforeMutation()    ← absorbed from v1 audit-prefetch.service.ts
  audit-logging.service.ts                Audit persistence (~180 lines)
    - logSuccess()
    - logFailure()
    - logToAuditTrail()
  audit.helpers.ts                        Pure functions (~230 lines)
    - determineAction()                ← from v1 audit-action.service.ts (pure logic)
    - getPathBasedAction()             ← from v1 audit-action.service.ts
    - determineGetAction()             ← from v1 audit-action.service.ts
    - isCurrentUserEndpoint()          ← from v1 audit-action.service.ts
    - sanitizeData()                   ← from v1 audit-sanitization.service.ts (pure logic)
    - buildAuditChanges()              ← from v1 audit-sanitization.service.ts
    - addMutationChanges()             ← from v1 audit-sanitization.service.ts
    - addUpdateChanges()               ← from v1 audit-sanitization.service.ts
    - addDeleteChanges()               ← from v1 audit-sanitization.service.ts
    - extractDetailedErrorMessage()    ← from v1 audit-error-formatter.service.ts (pure logic)
    - extractHttpExceptionMessage()    ← from v1 audit-error-formatter.service.ts
    - formatZodValidationErrors()      ← from v1 audit-error-formatter.service.ts
    - cleanupRecentLogs()
    - buildUserName()
    - extractNameFromData()
    - singularize()
  audit.constants.ts                      Excluded paths, table maps (~100 lines)
    - EXCLUDED_PATHS
    - RESOURCE_TABLE_MAP
    - SENSITIVE_FIELDS
```

**v2 changes (major):**

- 9 new files → 5 new files. Key insight: **3 of v1's @Injectable services were pure functions that don't need DI.**
- `audit-action.service.ts` (80 lines, 4 methods) → helpers. `determineAction(request)` is a pure function: input → string output. No DB, no side effects. Making it @Injectable is textbook over-engineering.
- `audit-sanitization.service.ts` (60 lines, 5 methods) → helpers. `sanitizeData(data)` is a pure transformation. Zero DI needs.
- `audit-error-formatter.service.ts` (90 lines, 3 methods) → helpers. String formatting is always a helper.
- `audit-prefetch.service.ts` (60 lines, 1 method) → merged into metadata service. Metadata extraction and resource prefetch are both "gather data for the audit entry." Same bounded context.

---

### 12. machines.service.ts (1265 lines | 39 methods)

**Current Domains:** Machine CRUD, Maintenance, Teams, Queries, Mappers

**New files: 3** | Maintenance and team associations are genuine bounded contexts. Dropped queries file — SQL stays with the service that executes it.

```
machines/
  machines.service.ts                  Facade + CRUD (~400 lines)
    - listMachines()
    - getMachineById()
    - createMachine()
    - updateMachine()
    - deleteMachine()
    - activateMachine()
    - deactivateMachine()
    delegates to:
  asset-maintenance.service.ts       Maintenance (~250 lines)
    - getMaintenanceHistory()
    - addMaintenanceRecord()
    - updateMachineAfterMaintenance()
    - getUpcomingMaintenance()
    - getStatistics()
    - getCategories()
  asset-team.service.ts              Team associations (~150 lines)
    - setMachineTeams()
    - getMachineTeams()
  machines.helpers.ts                  Mappers, transforms & query builders (~350 lines)
    - mapDbMachineToApi()
    - buildMachineStringFields()
    - buildMachineDateFields()
    - buildMachineReferenceFields()
    - parseTeamsJson()
    - mapMaintenanceToApi()
    - buildMaintenanceDetailFields()
    - buildMaintenanceNumericFields()
    - buildMachineInsertParams()       ← absorbed from v1 machines.queries.ts
    - buildMachineUpdateFields()       ← absorbed from v1 machines.queries.ts
    - buildMaintenanceInsertParams()   ← absorbed from v1 machines.queries.ts
```

**v2 change:** `machines.queries.ts` (150 lines) → absorbed into helpers. Query builder functions (buildInsertParams, buildUpdateFields) are pure functions. They belong with mappers, not in a separate file.

---

### 13. documents.service.ts (1263 lines | 32 methods)

**Current Domains:** Document CRUD, State Mgmt, Content, Analytics, Access Control, Query Building, File I/O

**New files: 4** | Access control, storage, and notifications are well-defined bounded contexts. Dropped queries file.

```
documents/
  documents.service.ts                 Facade + CRUD (~350 lines)
    - listDocuments()
    - getDocumentById()
    - createDocument()
    - updateDocument()
    - deleteDocument()
    - archiveDocument()
    - unarchiveDocument()
    - markDocumentAsRead()
    delegates to:
  document-access.service.ts           Access control (~180 lines)
    - checkDocumentAccess()
    - isConversationParticipant()
    - isDocumentRead()
    - buildDocumentQuery()
    - applyDocumentFilters()
  document-storage.service.ts          File I/O (~150 lines)
    - writeFileToDisk()
    - resolveFileContent()
    - readFileFromDisk()
    - getDocumentContent()
  document-notification.service.ts     Notifications (~100 lines)
    - createUploadNotification()
    - mapAccessScopeToRecipient()
  documents.helpers.ts                 Mappers + query builders (~250 lines)
    - enrichDocument()
    - parseTags()
    - buildDocumentFilters()
    - buildDocumentUpdateClause()
    - insertDocumentRecord()           ← absorbed from v1 documents.queries.ts
    - getDocumentRow()                 ← absorbed from v1 documents.queries.ts
```

**v2 change:** `documents.queries.ts` (100 lines, 2 functions) → absorbed into helpers. Two query builder functions don't justify their own file.

---

### 14. users.service.ts (1204 lines | 27 methods)

**Current Domains:** User CRUD, Profile, Availability, Password, Search

**New files: 3** | **v1 had a critical flaw:** the facade was ~600 lines — nearly as big as the original problem. v2 extracts CRUD into its own sub-service, keeping the facade at ~200 lines as intended.

```
users/
  users.service.ts                     Facade (~200 lines)
    - orchestrates CRUD + profile operations
    - delegates all heavy logic
    delegates to:
  user-crud.service.ts                 Core CRUD + search (~350 lines)    ← NEW in v2
    - listUsers()
    - getUserById()
    - createUser()
    - updateUser()
    - deleteUser()
    - searchUsers()
    - changePassword()
  user-profile.service.ts              Profile management (~150 lines)
    - getProfile()
    - updateProfile()
    - updateAvatar()
    - getAvailability()
    - updateAvailability()
  users.helpers.ts                     Mappers + query builders (~200 lines)
    - mapDbUserToApi()
    - buildUserUpdateFields()
    - buildUserInsertParams()
    - sanitizeUserInput()
```

**v2 changes:**

- **Fixed facade bloat**: v1 facade at ~600 lines defeats the entire purpose of splitting. v2 adds `user-crud.service.ts` to keep the facade at ~200 lines.
- `users.queries.ts` (150 lines) → absorbed into helpers. Query builders are pure functions.

---

### 15. notifications.service.ts (1074 lines | 28 methods)

**Current Domains:** Core CRUD, Bulk Ops, Preferences, Statistics, Feature Notifications

**New files: 4** | Preferences is a substantial sub-domain (own table, 4 methods). Statistics and feature notifications are kept separate — different concerns (read analytics vs write operations) despite being thin.

```
notifications/
  notifications.service.ts                 Core CRUD (~300 lines)
    - listNotifications()
    - createNotification()
    - deleteNotification()
    - markAsRead()
    - markAllAsRead()
    delegates to:
  notification-preferences.service.ts      Preferences (~150 lines)
    - getPreferences()
    - updatePreferences()
    - upsertPreferencesInDb()
    - getDefaultPreferences()
  notification-statistics.service.ts       Analytics (~120 lines)
    - getStatistics()
    - getPersonalStats()
    - getNotificationCounts()
  notification-addon.service.ts          Feature notifications (~100 lines)
    - createAddonNotification()
    - markAddonTypeAsRead()
  notifications.helpers.ts                 Mappers (~80 lines)
    - mapNotificationToApi()
    - buildNotificationConditions()
    - rowsToRecord()
```

---

### 16. settings.service.ts (905 lines | 28 methods)

**Current Domains:** System Settings, Tenant Settings, User Settings, Serialization

**New files: 4** | The three-tier split (system, tenant, user) maps directly to the domain model and database structure. Each tier has its own table with 4 CRUD methods. Clean, correct, keeps each file at ~140-160 lines.

```
settings/
  settings.service.ts                    Facade + routing (~150 lines)
    - bulkUpdate()
    - getCategories()
    delegates to:
  settings-system.service.ts             System-level (~140 lines)
    - getSystemSettings()
    - getSystemSetting()
    - upsertSystemSetting()
    - deleteSystemSetting()
  settings-tenant.service.ts             Tenant-level (~140 lines)
    - getTenantSettings()
    - getTenantSetting()
    - upsertTenantSetting()
    - deleteTenantSetting()
  settings-user.service.ts               User-level (~160 lines)
    - getUserSettings()
    - getUserSetting()
    - upsertUserSetting()
    - deleteUserSetting()
    - getAdminUserSettings()
  settings.helpers.ts                    Serialization + mappers (~120 lines)
    - serializeValue()
    - parseValue()
    - serializeBooleanValue()
    - serializeNumberValue()
    - serializeStringValue()
    - mapSystemSetting()
    - mapTenantSetting()
    - mapUserSetting()
```

---

### 17. websocket.ts (852 lines | 18 methods)

**Current Domains:** Connection Lifecycle, Message Handling, Persistence, Broadcast, Presence

**New files: 3** | Auth, messaging, and presence are classic WebSocket bounded contexts. Clean split, each sub-service has genuine substance.

```
  websocket.ts                            Core server (~300 lines)
    - handleConnection()
    - setupWebSocketClient()
    - handleMessage()
    - handleDisconnection()
    - handleError()
    - startHeartbeat()
    - shutdown()
    delegates to:
  websocket-auth.service.ts               Authentication (~100 lines)
    - consumeTicket()
    - extractTicketFromRequest()
    - isUserActive()
  websocket-message.service.ts            Message handling (~200 lines)
    - handleSendMessage()
    - saveMessage()
    - linkAttachmentsToMessage()
    - getMessageAttachments()
    - buildMessageData()
    - broadcastToParticipants()
  websocket-presence.service.ts           Presence tracking (~120 lines)
    - handleTyping()
    - handleMarkRead()
    - handleJoinConversation()
    - broadcastUserStatus()
    - getSenderInfo()
```

---

### 18. teams.service.ts (804 lines | 24 methods)

**Current Domains:** Team CRUD, Leadership, Members, Machines

**New files: 2** | Barely over the 800 limit. Leadership (4 methods, ~100 lines) merged into member service — "who's in the team" and "who leads the team" are the same bounded context: team composition.

```
teams/
  teams.service.ts                     Core CRUD (~300 lines)
    - listTeams()
    - getTeamById()
    - createTeam()
    - updateTeam()
    - deleteTeam()
    - checkDuplicateName()
    - mapToResponse()
    - buildUpdateFields()
    delegates to:
  team-member.service.ts               Membership + leadership (~280 lines)
    - getTeamMembers()
    - addTeamMember()
    - removeTeamMember()
    - handleLeaderChange()             ← absorbed from v1 team-leadership.service.ts
    - ensureLeaderInTeam()             ← absorbed from v1 team-leadership.service.ts
    - validateLeader()                 ← absorbed from v1 team-leadership.service.ts
    - validateDepartment()             ← absorbed from v1 team-leadership.service.ts
  team-asset.service.ts              Machine associations (~140 lines)
    - getTeamMachines()
    - addTeamMachine()
    - removeTeamMachine()
```

**v2 change:** `team-leadership.service.ts` (100 lines, 4 methods) → merged into `team-member.service.ts` (~280 lines combined). Leadership IS membership: the leader is a member with a special role. The validation methods (validateLeader, ensureLeaderInTeam) are called during member operations. Separating them creates artificial coupling between two files that always change together.

---

## Execution Order

Revised to prioritize by **business value + risk**, not just file size.

### Phase 1: Anti-Patterns + Actively Developed (highest impact)

| #   | Service                    | Lines | Reason                                                             |
| --- | -------------------------- | ----: | ------------------------------------------------------------------ |
| 11  | audit-trail.interceptor.ts |  1280 | Structural anti-pattern, affects ALL routes                        |
| 1   | chat.service.ts            |  1723 | Largest file, most actively used feature, highest bug risk         |
| 6   | rotation.service.ts        |  1401 | Complex algorithm, tightly coupled to shifts, actively developed   |
| 7   | shifts.service.ts          |  1387 | Core feature, complex interplay with rotation, frequently modified |

### Phase 2: Critical Size (>1400 lines, stable)

| #   | Service               | Lines | Reason                              |
| --- | --------------------- | ----: | ----------------------------------- |
| 2   | blackboard.service.ts |  1600 | Large but established, lower churn  |
| 3   | surveys.service.ts    |  1542 | Large, complex domain, moderate use |
| 4   | kvp.service.ts        |  1441 | Large, stable feature               |
| 5   | root.service.ts       |  1407 | Admin interface, less frequent dev  |

### Phase 3: High Size (1200-1400 lines)

| #   | Service                   | Lines | Reason                      |
| --- | ------------------------- | ----: | --------------------------- |
| 8   | calendar.service.ts       |  1362 | Moderate change frequency   |
| 9   | tenantDeletion.service.ts |  1299 | Critical but rarely changed |
| 10  | reports.service.ts        |  1294 | Read-only, low risk         |

### Phase 4: Moderate/Low (800-1265 lines)

| #   | Service                  | Lines | Reason                             |
| --- | ------------------------ | ----: | ---------------------------------- |
| 12  | machines.service.ts      |  1265 | Stable, straightforward CRUD       |
| 13  | documents.service.ts     |  1263 | Stable, file I/O complexity        |
| 14  | users.service.ts         |  1204 | Core but stable, facade fix needed |
| 15  | notifications.service.ts |  1074 | Moderate size, low risk            |
| 16  | settings.service.ts      |   905 | Small overage, clean domain split  |
| 17  | websocket.ts             |   852 | Small overage, classic split       |
| 18  | teams.service.ts         |   804 | Barely over limit, minimal split   |

---

## Risk Mitigation

### Per-PR Risks

| Risk                       | Mitigation                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Circular dependencies**  | NestJS detects at startup. Run `docker-compose restart backend` after each split. Check logs for circular DI warnings.                                     |
| **Transaction boundaries** | Facade owns the transaction lifecycle — see **Transaction Pattern** below.                                                                                 |
| **Missing providers**      | Forgetting to register a sub-service in the module's `providers` array → NestJS throws at startup. Always verify container startup after adding providers. |
| **Import path breakage**   | After extracting to new files, all internal imports need updating. `pnpm run type-check` catches 100% of these.                                            |
| **Test mock updates**      | Unit tests mocking the original service need updating to mock sub-services. Verify all existing tests still pass.                                          |
| **Behavioral regression**  | Use Bruno API tests as the integration safety net. Run the full suite for the affected module after each split.                                            |

### Branching Strategy

- **One service per PR.** Never split two services in the same PR.
- Branch naming: `refactor/split-{service-name}` (e.g., `refactor/split-chat-service`)
- Each PR must include: type-check pass, lint pass, Bruno test results, startup log showing no circular dependency warnings.
- Merge to development branch first. Verify in staging before main.

### Transaction Pattern

When a facade operation spans multiple sub-services atomically, the **facade** owns the full lifecycle:

1. Acquire `PoolClient` from the pool
2. `BEGIN` the transaction
3. Pass the client to each sub-service method
4. `COMMIT` on success, `ROLLBACK` on error, `release` in `finally`

Sub-service methods that participate in transactions accept an **optional `PoolClient` parameter**. When provided, they use it instead of acquiring their own connection. When called without it, they acquire their own (for standalone operations).

Document which facade methods require transactional coordination in their JSDoc.

### Rollback Plan

If a split causes production issues:

1. Revert the PR (single commit revert since it's one service per PR)
2. Re-deploy the pre-split version
3. Investigate root cause before re-attempting

---

## Expected Outcomes

| Metric                    | Before | After (v2) | v1 estimate |
| ------------------------- | -----: | ---------: | ----------: |
| Files over 800 lines      |     18 |          0 |           0 |
| Average lines per service |   1244 |       ~200 |        ~200 |
| Max file size             |   1723 |       ~550 |        ~550 |
| Total new files created   |      — |        ~70 |         ~75 |
| Average methods per file  |     33 |         ~8 |          ~8 |
| Smallest @Injectable      |      — | ~100 lines |   ~60 lines |

**Key v2 improvements over v1:**

- **7 fewer new files** — each remaining file has genuine substance
- **No 60-line @Injectable micro-services** — everything passes the Decision Framework
- **No separate queries files** — SQL stays co-located with business logic
- **Fixed users.service.ts** — facade properly at ~200 lines (v1 was ~600)
- **Reports module: 3 new files vs 8** — consolidated by domain affinity
- **Audit module: 5 new files vs 9** — pure functions in helpers, not Injectable

---

## Checklist Per Service Refactoring

For each service being split:

0. **Verify Bruno API test coverage exists** for the module's endpoints. If not, create basic smoke tests BEFORE splitting — otherwise the "run Bruno tests" safety net in step 8 is meaningless.
1. Create sub-service files with `@Injectable()` decorator
2. Move methods to their new home (**copy, not rewrite** — zero behavior changes)
3. Update the facade to inject and delegate to sub-services
4. Register all sub-services in the module's `providers` array
5. Update the controller only if method signatures changed (they should NOT)
6. Run `pnpm run type-check` in the backend container
7. Run `pnpm run lint:fix` to verify `max-lines` compliance
8. Run the relevant Bruno API tests to verify no regressions
9. Verify no circular dependency warnings at startup (`docker-compose logs backend`)
10. Update the service's module test file if unit tests exist

---

## Revision History

| Version | Date       | Changes                                                                                                                                                                                                                                               |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1      | 2026-01-26 | Initial plan. 18 services, ~75 new files, mechanical splitting by size.                                                                                                                                                                               |
| v2      | 2026-01-26 | Pragmatic revision. Decision Framework added. Micro-services merged. Queries layer dropped. Risk mitigation added. ~69 new files with genuine substance per file.                                                                                     |
| v3      | 2026-01-27 | Review-hardened. Facade line limits clarified (250 target / 400 max). Blackboard access control extracted. Rules 6-7 added (no inter-sub-service calls, shared types). Transaction pattern documented. Bruno coverage pre-check added. ~70 new files. |

---

**ESLint Rule:** `max-lines: 800` (error)
**Total Services Affected:** 18
**Total New Files Estimated:** ~70
