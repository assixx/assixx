# Sidebar Notification Badges

> **Last Updated:** 2026-01-19
> **Status:** Production Ready

## Overview

The sidebar notification badge system displays real-time unread/pending counts for various features in the navigation menu. Each feature can show a badge with the count of items requiring user attention.

## Supported Features

| Feature    | Badge Shows                   | API Endpoint                           |
| ---------- | ----------------------------- | -------------------------------------- |
| Chat       | Unread messages               | `/api/v2/chat/unread-count`            |
| Surveys    | New/unread surveys            | `/api/v2/notifications/stats/me`       |
| Documents  | New/unread documents          | `/api/v2/notifications/stats/me`       |
| KVP        | New/unread KVP entries        | `/api/v2/notifications/stats/me`       |
| Blackboard | Unconfirmed entries           | `/api/v2/blackboard/unconfirmed-count` |
| Calendar   | Upcoming events (next 7 days) | `/api/v2/calendar/upcoming-count`      |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  +layout.svelte                                                  │
│  ├── NavItem with badgeType                                     │
│  └── <NotificationBadge count={notificationStore.counts[type]}/>│
│                              │                                   │
│                              ▼                                   │
│  notification.store.svelte.ts                                   │
│  ├── NotificationCounts interface                               │
│  ├── fetchInitialCounts() - parallel API calls                  │
│  └── SSE subscription for real-time updates                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
├─────────────────────────────────────────────────────────────────┤
│  BlackboardController                                            │
│  └── GET /blackboard/unconfirmed-count                          │
│                                                                  │
│  CalendarController                                              │
│  └── GET /calendar/upcoming-count                               │
│                                                                  │
│  NotificationsController                                         │
│  └── GET /notifications/stats/me (surveys, documents, kvp)      │
│                                                                  │
│  ChatController                                                  │
│  └── GET /chat/unread-count                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Implementation

### 1. Notification Store

**File:** `frontend/src/lib/stores/notification.store.svelte.ts`

```typescript
export interface NotificationCounts {
  total: number;
  surveys: number;
  documents: number;
  kvp: number;
  chat: number;
  blackboard: number;
  calendar: number;
}
```

The store fetches all counts in parallel on initialization:

```typescript
async function fetchInitialCounts(state: NotificationState): Promise<void> {
  const [chatResponse, notificationsResponse, blackboardResponse, calendarResponse] = await Promise.all([
    fetch('/api/v2/chat/unread-count', { credentials: 'include' }),
    fetch('/api/v2/notifications/stats/me', { credentials: 'include' }),
    fetch('/api/v2/blackboard/unconfirmed-count', { credentials: 'include' }),
    fetch('/api/v2/calendar/upcoming-count', { credentials: 'include' }),
  ]);
  // ... parse and set counts
}
```

### 2. Menu Item Configuration

**File:** `frontend/src/routes/(app)/+layout.svelte`

Each menu item can have a `badgeType` property:

```typescript
interface NavItem {
  id: string;
  icon?: string;
  label: string;
  url?: string;
  hasSubmenu?: boolean;
  submenu?: NavItem[];
  badgeType?: 'surveys' | 'documents' | 'kvp' | 'chat' | 'blackboard' | 'calendar';
}
```

Example menu configuration:

```typescript
const menuItems: NavItem[] = [
  { id: 'blackboard', icon: ICONS.pin, label: 'Schwarzes Brett', url: '/blackboard', badgeType: 'blackboard' },
  { id: 'calendar', icon: ICONS.calendar, label: 'Kalender', url: '/calendar', badgeType: 'calendar' },
  { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
  {
    id: 'features',
    icon: ICONS.features,
    label: 'Features',
    hasSubmenu: true,
    submenu: [
      { id: 'kvp', label: 'KVP System', url: '/kvp', badgeType: 'kvp' },
      { id: 'surveys', label: 'Umfragen', url: '/survey-admin', badgeType: 'surveys' },
      { id: 'documents-explorer', label: 'Datei Explorer', url: '/documents-explorer', badgeType: 'documents' },
    ],
  },
];
```

### 3. Badge Rendering

Main menu items:

```svelte
{#if item.badgeType}
  <NotificationBadge count={notificationStore.counts[item.badgeType]} />
{/if}
```

Submenu items:

```svelte
<ul class="submenu">
  {#each item.submenu as subItem (subItem.id)}
    <li class="submenu-item">
      <a href={subItem.url} class="submenu-link">
        <span>{subItem.label}</span>
        {#if subItem.badgeType}
          <NotificationBadge count={notificationStore.counts[subItem.badgeType]} size="sm" />
        {/if}
      </a>
    </li>
  {/each}
</ul>
```

## Backend Implementation

### Blackboard Unconfirmed Count

**File:** `backend/src/nest/blackboard/blackboard.controller.ts`

```typescript
@Get('unconfirmed-count')
async getUnconfirmedCount(
  @CurrentUser() user: NestAuthUser,
  @TenantId() tenantId: number,
): Promise<{ count: number }> {
  return await this.blackboardService.getUnconfirmedCount(user.id, tenantId);
}
```

**Service Logic:** Counts active blackboard entries that the user hasn't confirmed yet, respecting org_level visibility (company, department, team).

### Calendar Upcoming Count

**File:** `backend/src/nest/calendar/calendar.controller.ts`

```typescript
@Get('upcoming-count')
async getUpcomingCount(
  @CurrentUser() user: NestAuthUser,
  @TenantId() tenantId: number,
): Promise<{ count: number }> {
  return await this.calendarService.getUpcomingCount(
    tenantId,
    user.id,
    user.departmentId ?? null,
    user.teamId ?? null,
  );
}
```

**Service Logic:** Counts non-cancelled calendar events in the next 7 days that are visible to the user (public or matching user/department/team).

## API Response Format

All count endpoints return:

```json
{
  "success": true,
  "data": {
    "count": 6
  }
}
```

The frontend `parseSimpleCount()` helper handles both wrapped and unwrapped responses:

```typescript
async function parseSimpleCount(response: Response): Promise<number> {
  if (!response.ok) return 0;
  const json = await response.json();
  return json.data?.count ?? json.count ?? 0;
}
```

## When Badges Update

| Trigger                 | Update Method                        |
| ----------------------- | ------------------------------------ |
| Page load               | `fetchInitialCounts()` on mount      |
| User marks item as read | `decrementCount()` or `resetCount()` |
| New item via SSE        | `handleSSEEvent()` increments        |
| User logs in            | Fresh fetch on layout mount          |

## Update Patterns

There are two patterns for updating notification counts:

### Pattern 1: Batch Reset on Page Visit

Used when visiting a page marks ALL notifications of that type as read.

**Applicable to:** Documents, KVP, Surveys

```typescript
// In +page.svelte - mark all as read when page is visited
import { notificationStore } from '$lib/stores/notification.store.svelte';

let markedAsRead = $state(false);
$effect(() => {
  if (!markedAsRead) {
    markedAsRead = true;
    void notificationStore.markTypeAsRead('document'); // or 'kvp', 'survey'
  }
});
```

### Pattern 2: Individual Decrement/Increment

Used when user actions mark individual items as read/unread.

**Applicable to:** Blackboard (confirm/unconfirm), Chat (open conversation)

```typescript
// Example 1: Blackboard - single item confirm/unconfirm
import { notificationStore } from '$lib/stores/notification.store.svelte';

async function confirmEntry(): Promise<void> {
  const success = await confirmApi(uuid);
  if (success) {
    notificationStore.decrementCount('blackboard'); // Update badge immediately
    showSuccessAlert('Marked as read');
    await invalidateAll();
  }
}

async function unconfirmEntry(): Promise<void> {
  const success = await unconfirmApi(uuid);
  if (success) {
    notificationStore.incrementCount('blackboard'); // Update badge immediately
    showSuccessAlert('Marked as unread');
    await invalidateAll();
  }
}

// Example 2: Chat - decrement by N when opening a conversation
async function selectConversation(conversation: Conversation): Promise<void> {
  const result = await handlers.loadMessages(conversation.id);

  const conv = conversations.find((c) => c.id === conversation.id);
  if (conv) {
    // Decrement by number of unread messages in this conversation
    const unreadToDecrement = conv.unreadCount ?? 0;
    for (let i = 0; i < unreadToDecrement; i++) {
      notificationStore.decrementCount('chat');
    }
    conv.unreadCount = 0;
  }
}
```

## Critical Rule: Immediate UI Update

**ALWAYS** update the notification store **immediately** after a successful API call, **BEFORE** any `invalidateAll()` or page navigation.

```typescript
// CORRECT ORDER
if (success) {
  notificationStore.decrementCount('blackboard'); // 1. Update store FIRST
  showSuccessAlert('Success'); // 2. Show feedback
  await invalidateAll(); // 3. Refresh page data
}

// WRONG - User sees stale count during page refresh
if (success) {
  await invalidateAll(); // Page refreshes with old count
  notificationStore.decrementCount('blackboard'); // Too late
}
```

## Adding a New Badge Type

### 1. Extend the NotificationCounts interface

```typescript
// notification.store.svelte.ts
export interface NotificationCounts {
  // ... existing
  newFeature: number;
}
```

### 2. Update createInitialCounts

```typescript
function createInitialCounts(): NotificationCounts {
  return {
    // ... existing
    newFeature: 0,
  };
}
```

### 3. Add API endpoint (backend)

```typescript
@Get('new-feature-count')
async getNewFeatureCount(@CurrentUser() user, @TenantId() tenantId): Promise<{ count: number }> {
  // ... implementation
}
```

### 4. Update fetchInitialCounts

```typescript
const [, /* existing */ newFeatureResponse] = await Promise.all([
  // ... existing fetches
  fetch('/api/v2/new-feature/count', { credentials: 'include' }),
]);

const newFeatureCount = await parseSimpleCount(newFeatureResponse);
state.counts.newFeature = newFeatureCount;
```

### 5. Add badgeType to menu item

```typescript
{ id: 'new-feature', label: 'New Feature', url: '/new-feature', badgeType: 'newFeature' }
```

### 6. Update CountType union (if needed for mutations)

```typescript
type CountType = keyof Omit<NotificationCounts, 'total'>;
```

## Styling

The `NotificationBadge` component supports sizes:

- Default: Standard badge size
- `size="sm"`: Smaller badge for submenu items

Badge CSS is in `frontend/src/lib/components/NotificationBadge.svelte`.

## Troubleshooting

### Badge shows 0 but should have count

1. Check API response in Network tab
2. Verify user has permission to see the items
3. Check tenant_id is correct
4. For blackboard: verify entries have `status = 'active'`
5. For calendar: verify events aren't cancelled and within 7-day window

### Badge doesn't update after action

1. Ensure the action calls `notificationStore.decrementCount()` or `resetCount()`
2. Check if SSE connection is active (`notificationStore.isConnected`)
3. Verify SSE event type matches expected pattern

### API returns 401/403

1. User session may have expired
2. Check authentication middleware
3. Verify tenant context is available
