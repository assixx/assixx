# ADR-004: Persistent Notification Counts for Feature Events

**Status:** Accepted (amended 2026-03-28)
**Date:** 2026-01-14
**Deciders:** Development Team
**Technical Story:** Enable initial unread counts for surveys, documents, and KVP on page load. Amended: Documents the actual two-system architecture (Sidebar Badge Counts + "Neu" Badge on Items) as implemented across all modules.

## Context and Problem Statement

The current notification system (ADR-003) uses Server-Sent Events (SSE) for real-time badge updates. However, there is a critical gap:

**Problem:** When a user logs in, they should see unread counts for:

- New surveys assigned to them
- New documents shared with them
- New KVP submissions (for admins)

**Current State:**

- SSE events (`NEW_SURVEY`, `NEW_DOCUMENT`, `NEW_KVP`) only increment counts AFTER connection
- No persistent storage tracks which items a user has "seen"
- On page refresh, all counts reset to 0 (except chat)

**Chat Works Differently:**

- Chat has persistent `read_at` tracking in `chat_messages` table
- `/chat/unread-count` returns initial count on load
- SSE `NEW_MESSAGE` events increment from that baseline

**Desired Behavior:**

```
User logs in with:
- 3 unread surveys
- 5 unread documents
- 2 unread KVP submissions
→ Badges show: Surveys(3), Documents(5), KVP(2)
→ SSE events increment from there
```

## Decision Drivers

- Consistent UX across all notification types
- Minimal changes to existing architecture
- Leverage existing `notifications` table
- Follow DATABASE-MIGRATION-GUIDE.md for schema changes
- Maintain tenant isolation (RLS)

## Considered Options

### Option A: Store Feature Events in `notifications` Table

Create notifications when surveys/documents/KVP are created:

- Reuse existing `notifications` + `notification_read_status` tables
- Add new notification types: `survey`, `document`, `kvp`
- `/notifications/stats/me` already returns `byType` counts

**Pros:**

- Reuses existing infrastructure
- Unified notification model
- Already has read/unread tracking

**Cons:**

- Notifications table may grow large
- Mixing "alerts" with "feature events"

### Option B: Separate `feature_read_status` Table

Create a dedicated table to track which items users have seen:

```sql
CREATE TABLE feature_read_status (
    user_id INT,
    tenant_id INT,
    feature_type VARCHAR(20), -- 'survey', 'document', 'kvp'
    feature_id INT,
    read_at TIMESTAMPTZ
);
```

**Pros:**

- Clean separation of concerns
- Simpler queries per feature

**Cons:**

- New table to maintain
- Duplicate logic with notifications
- Need new API endpoints

### Option C: Store Counts in Redis (Session-Based)

Store unread counts in Redis, populated on login:

```
user:123:unread:surveys = 5
user:123:unread:documents = 3
```

**Pros:**

- Fast reads
- No schema changes

**Cons:**

- Counts lost on Redis restart
- Complex sync logic
- Not truly persistent

## Decision Outcome

**Chosen Option: A - Store Feature Events in `notifications` Table**

### Rationale

1. **Infrastructure Reuse:** `notifications` + `notification_read_status` already exist
2. **Unified Model:** All unread counts come from one source
3. **Existing API:** `/notifications/stats/me` already returns `byType`
4. **RLS Ready:** Tables already have tenant isolation
5. **Scalable:** Can add cleanup jobs for old notifications

### Implementation Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT STATE                             │
│                                                                  │
│  Survey Created → eventBus.emit() → SSE → Badge++               │
│                   (in-memory only, lost on refresh)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        NEW STATE                                 │
│                                                                  │
│  Survey Created → eventBus.emit() → SSE → Badge++               │
│                 → notificationsService.create() → DB            │
│                                                                  │
│  Page Load → /notifications/stats/me → Initial Counts           │
│            → SSE Connect → Real-time Updates                    │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

### Database Schema Change

Extend `notification_type` enum:

```sql
-- Migration: 009-extend-notification-types.sql
ALTER TYPE notification_type ADD VALUE 'survey';
ALTER TYPE notification_type ADD VALUE 'document';
ALTER TYPE notification_type ADD VALUE 'kvp';
```

### Notification Creation Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  SurveyService   │     │  EventBus        │     │ NotificationsCtrl│
│                  │     │                  │     │                  │
│  createSurvey()  │────▶│ emitSurvey...()  │────▶│ SSE Stream       │
│        │         │     │                  │     │                  │
│        ▼         │     └──────────────────┘     └──────────────────┘
│  createNotif()   │
│        │         │     ┌──────────────────┐
│        └────────────▶ │  notifications   │ (PostgreSQL)
│                  │     │  table           │
└──────────────────┘     └──────────────────┘
```

### API Changes

**Existing endpoint (no changes needed):**

```
GET /api/v2/notifications/stats/me
Response: {
  total: number,
  unread: number,
  byType: {
    survey: number,    // NEW - will now have data
    document: number,  // NEW - will now have data
    kvp: number,       // NEW - will now have data
    system: number,
    announcement: number
  }
}
```

### Frontend Changes

Update `fetchInitialCounts()` to use `/notifications/stats/me`:

```typescript
// notification.store.svelte.ts
async function fetchInitialCounts(state: NotificationState): Promise<void> {
  const [chatResponse, notificationsResponse] = await Promise.all([
    fetch('/api/v2/chat/unread-count'),
    fetch('/api/v2/notifications/stats/me'), // Now returns survey/document/kvp
  ]);

  // Parse notification stats
  const byType = notificationsResponse.data.byType;
  state.counts.surveys = byType.survey ?? 0;
  state.counts.documents = byType.document ?? 0;
  state.counts.kvp = byType.kvp ?? 0;
}
```

## Consequences

### Positive

- **Consistent UX:** All features show accurate unread counts on load
- **No New Tables:** Leverages existing notification infrastructure
- **Unified Tracking:** Single source of truth for all unread counts
- **RLS Compatible:** Existing tenant isolation works automatically
- **Extensible:** Easy to add new notification types in future

### Negative

- **Notification Volume:** More rows in `notifications` table
- **Migration Required:** Schema change to add enum values
- **Backend Changes:** Services must create notifications

### Risks

- **Performance:** Large notification tables may slow queries
  - _Mitigation:_ Add cleanup job for old/read notifications
  - _Mitigation:_ Index on `(tenant_id, recipient_id, type, created_at)`

- **Duplicate Notifications:** Must prevent duplicates on retry
  - _Mitigation:_ Use `ON CONFLICT DO NOTHING` with unique constraint

## Implementation Checklist

See: **[PERSISTENT-NOTIFICATION-COUNTS-PLAN.md](../PERSISTENT-NOTIFICATION-COUNTS-PLAN.md)**

Reference: **[DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md)** for migration workflow

## Related Decisions

- [ADR-003: Notification System Architecture](./ADR-003-notification-system.md) - SSE infrastructure
- [ADR-031: Centralized Read Tracking](./ADR-031-centralized-read-tracking.md) - ReadTrackingService
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) - Migration workflow

## Notes

- Chat unread count remains separate (`/chat/unread-count`) as it uses different table structure
- Cleanup job should run nightly to remove notifications older than 30 days
- Consider adding `feature_id` column to notifications for linking back to source

---

## Amendment: Actual Implementation — Two-System Architecture (2026-03-28)

### Status Change: Proposed → **Accepted** (with deviation)

Option A (notifications table for counts) was partially implemented. In practice, a **two-system architecture** evolved that is more modular:

1. **Sidebar Badge Counts** (red number) — SSE + SSR initial counts
2. **"Neu" Badge on Items** (green badge) — per-module read-tracking tables

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  SYSTEM 1: Sidebar Badge Count (rote Zahl)                          │
│                                                                     │
│  SSR Page Load → +layout.server.ts → /dashboard/counts              │
│                  → notification.store.svelte.ts (initial counts)    │
│                                                                     │
│  Real-time     → eventBus.emit*() → SSE → store.incrementCount()   │
│  Reset         → User visits page → store.resetCount('approvals')  │
│                                                                     │
│  Sidebar       → navigation-config.ts: badgeType: 'approvals'      │
│                  → reads count from notification store              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SYSTEM 2: "Neu" Badge on Items (grünes Badge)                      │
│                                                                     │
│  DB            → *_read_status / *_confirmations table per module   │
│  Backend       → LEFT JOIN in list queries → isRead boolean         │
│  Mark-as-read  → POST /module/:uuid/read (fire-and-forget)         │
│  Frontend      → {#if !item.isRead}                                 │
│                    <span class="badge badge--sm badge--success">     │
│                      Neu                                            │
│                    </span>                                          │
│                  {/if}                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### System 1: Sidebar Badge Counts — Implementation Details

#### Backend: EventBus → SSE

Each module emits events after mutations. The notifications controller routes them to the right users via SSE.

| Module      | Event               | Recipients         | Registered in                 |
| ----------- | ------------------- | ------------------ | ----------------------------- |
| KVP         | `kvp.submitted`     | Admins/Root        | `registerKvpHandlers()`       |
| Documents   | `document.uploaded` | All users          | `registerDocumentHandlers()`  |
| Surveys     | `survey.created`    | Employees          | `registerSurveyHandlers()`    |
| Work Orders | `workorder.*`       | Assignees          | `registerWorkOrderHandlers()` |
| Approvals   | `approval.created`  | Configured masters | `registerApprovalHandlers()`  |
| Approvals   | `approval.decided`  | Requester          | `registerApprovalHandlers()`  |

**File:** `backend/src/nest/notifications/notifications.controller.ts`

#### Frontend: SSR Initial Counts + SSE Increments

```
+layout.server.ts
  → GET /api/v2/dashboard/counts (aggregates all module counts)
  → Returns SSRCounts { approvals: { count: N }, kvp: { count: N }, ... }

notification.store.svelte.ts
  → initFromSSRData(counts) — sets initial counts from SSR
  → SSE connection — incrementCount() on NEW_* events
  → resetCount('approvals') — when user visits /manage-approvals

navigation-config.ts
  → { id: 'approvals', url: '/manage-approvals', badgeType: 'approvals' }
  → Sidebar reads count from store, renders red badge if > 0
```

**Key files:**

- `frontend/src/lib/stores/notification.store.svelte.ts` — Store mit `SSE_EVENT_TO_COUNT` Mapping
- `frontend/src/routes/(app)/_lib/navigation-config.ts` — `badgeType` pro NavItem
- `frontend/src/lib/utils/notification-sse.ts` — `NotificationEventType` Union

#### How to add Sidebar Badge to a new module

1. **Backend:** Add `eventBus.emit*()` call in service after mutation
2. **Backend:** Add `emit*()` method to `event-bus.ts` with typed interface
3. **Backend:** Register SSE handler in `notifications.controller.ts`
4. **Frontend:** Add event type to `NotificationEventType` in `notification-sse.ts`
5. **Frontend:** Add `[EVENT, 'countKey']` to `SSE_EVENT_TO_COUNT` in store
6. **Frontend:** Add `countKey` to `NotificationCounts` interface + `SSRCounts`
7. **Frontend:** Add `badgeType: 'countKey'` to NavItem in `navigation-config.ts`
8. **Backend:** Add count to `/dashboard/counts` response (for SSR initial load)

---

### System 2: "Neu" Badge on Items — Implementation Details

Two patterns exist, both track per-user read state:

#### Pattern A: Confirmations (Blackboard, KVP)

Dual-state: `first_seen_at` (first view) + `is_confirmed` (explicit read toggle).

```sql
CREATE TABLE kvp_confirmations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    suggestion_id INTEGER NOT NULL REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmed_at TIMESTAMPTZ DEFAULT NOW(),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_confirmed BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(tenant_id, suggestion_id, user_id)
);
```

| Zustand                  | `first_seen_at` | `is_confirmed` | Badge          |
| ------------------------ | --------------- | -------------- | -------------- |
| Noch nie gesehen         | `NULL`          | —              | **Neu** (grün) |
| Gesehen, nicht bestätigt | Timestamp       | `false`        | Ungelesen      |
| Bestätigt                | Timestamp       | `true`         | —              |

**Backend:** UPSERT `ON CONFLICT DO UPDATE SET is_confirmed = true, confirmed_at = NOW()` (first_seen_at wird nur beim INSERT gesetzt, nie überschrieben).

**Frontend:** `const isNew = $derived(item.firstSeenAt === null || item.firstSeenAt === undefined);`

#### Pattern B: ReadStatus (Work Orders, Approvals) — Empfohlen für neue Module

Einfacher: Write-once `read_at`. Nutzt den zentralen `ReadTrackingService` (ADR-031).

```sql
CREATE TABLE approval_read_status (
    id SERIAL PRIMARY KEY,
    approval_id INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(approval_id, user_id, tenant_id)
);
-- + RLS (NULLIF pattern) + GRANTs für app_user
```

| Zustand   | `read_at`         | Badge          |
| --------- | ----------------- | -------------- |
| Ungelesen | `NULL` (kein Row) | **Neu** (grün) |
| Gelesen   | Timestamp         | —              |

**Backend:** LEFT JOIN in List-Queries:

```sql
SELECT a.*, rs.read_at
FROM approvals a
LEFT JOIN approval_read_status rs
  ON rs.approval_id = a.id AND rs.user_id = $X AND rs.tenant_id = $Y
```

**Mapper:** `isRead: row.read_at !== undefined && row.read_at !== null`

**Endpoint:** `POST /module/:uuid/read` via `ReadTrackingService.markAsReadByUuid(config, uuid, userId, tenantId)`

**Frontend:** `{#if !item.isRead}<span class="badge badge--sm badge--success ml-2">Neu</span>{/if}`

#### Module-Übersicht

| Modul       | Pattern           | Tabelle                    | "Neu" =                 | Mark-as-read      |
| ----------- | ----------------- | -------------------------- | ----------------------- | ----------------- |
| Blackboard  | A (Confirmations) | `blackboard_confirmations` | `first_seen_at IS NULL` | UPSERT on view    |
| KVP         | A (Confirmations) | `kvp_confirmations`        | `first_seen_at IS NULL` | UPSERT on view    |
| Work Orders | B (ReadStatus)    | `work_order_read_status`   | LEFT JOIN NULL          | `POST :uuid/read` |
| Approvals   | B (ReadStatus)    | `approval_read_status`     | LEFT JOIN NULL          | `POST :uuid/read` |

#### How to add "Neu" Badge to a new module (Pattern B)

1. **Migration:** Create `{module}_read_status` table (identisch zu `approval_read_status`)
   - Spalten: `id`, `{entity}_id` (FK), `user_id` (FK), `tenant_id` (FK), `read_at`, `created_at`
   - UNIQUE auf `({entity}_id, user_id, tenant_id)`
   - RLS + GRANTs
2. **Backend Controller:** Define `ReadTrackingConfig` + `POST :uuid/read` Endpoint
   ```typescript
   const CONFIG: ReadTrackingConfig = {
     tableName: '{module}_read_status',
     entityColumn: '{entity}_id',
     entityTable: '{modules}',
     entityUuidColumn: 'uuid',
   };
   ```
3. **Backend Service:** LEFT JOIN `{module}_read_status rs ON rs.{entity}_id = e.id AND rs.user_id = $X` in List-Queries
4. **Backend Types:** Add `read_at?: string | null` to DB row type, `isRead: boolean` to API type
5. **Backend Mapper:** `isRead: row.read_at !== undefined && row.read_at !== null`
6. **Frontend:** `{#if !item.isRead}<span class="badge badge--sm badge--success ml-2">Neu</span>{/if}`
7. **Frontend:** Fire-and-forget `fetch('/api/v2/{module}/${uuid}/read', { method: 'POST' })` on detail view or action

#### Wann Pattern A vs B?

- **Pattern B (ReadStatus)** für alle neuen Module — einfacher, nutzt `ReadTrackingService`
- **Pattern A (Confirmations)** nur wenn ein expliziter Gelesen/Ungelesen-Toggle nötig ist (wie Blackboard "Kenntnisnahme")

---

### Files Reference

| Schicht        | Datei                                                        | Zweck                              |
| -------------- | ------------------------------------------------------------ | ---------------------------------- |
| Backend SSE    | `backend/src/utils/event-bus.ts`                             | EventBus mit typed emit-Methoden   |
| Backend SSE    | `backend/src/nest/notifications/notifications.controller.ts` | SSE Handler pro Modul              |
| Backend Read   | `backend/src/nest/common/services/read-tracking.service.ts`  | Generischer ReadTrackingService    |
| Frontend Store | `frontend/src/lib/stores/notification.store.svelte.ts`       | Counts, SSR init, SSE increments   |
| Frontend SSE   | `frontend/src/lib/utils/notification-sse.ts`                 | Event types, connection management |
| Frontend Nav   | `frontend/src/routes/(app)/_lib/navigation-config.ts`        | `badgeType` Mapping                |
