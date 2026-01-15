# ADR-004: Persistent Notification Counts for Feature Events

**Status:** Proposed
**Date:** 2026-01-14
**Deciders:** Development Team
**Technical Story:** Enable initial unread counts for surveys, documents, and KVP on page load

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
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) - Migration workflow

## Notes

- Chat unread count remains separate (`/chat/unread-count`) as it uses different table structure
- Cleanup job should run nightly to remove notifications older than 30 days
- Consider adding `feature_id` column to notifications for linking back to source
