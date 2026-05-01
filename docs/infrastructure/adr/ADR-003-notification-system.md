# ADR-003: Real-Time Notification System Architecture

**Status:** Accepted
**Date:** 2026-01-11
**Deciders:** Development Team
**Technical Story:** Implement real-time notifications with badge updates in sidebar

## Context and Problem Statement

Users need real-time notifications for various events (new messages, surveys, documents, KVP submissions) without manual page refresh. The system must:

- Update badge counts instantly in the sidebar
- Support multiple event types
- Scale to many concurrent users
- Be easy to extend for new features

## Decision Drivers

- Real-time updates without polling
- Low latency for notifications
- Battery efficiency on mobile
- Simple integration for new features
- Existing infrastructure (NestJS, SvelteKit)

## Considered Options

1. **Server-Sent Events (SSE)** - Unidirectional server-to-client streaming
2. **WebSocket** - Bidirectional communication
3. **Long Polling** - Repeated HTTP requests

## Decision Outcome

**Chosen option: SSE (Server-Sent Events)** for notifications, keeping WebSocket only for Chat.

### Rationale

| Criterion      | SSE                | WebSocket      | Long Polling    |
| -------------- | ------------------ | -------------- | --------------- |
| Complexity     | Simple             | Complex        | Medium          |
| Direction      | Server → Client    | Bidirectional  | Client → Server |
| Auto-Reconnect | Browser built-in   | Manual         | Manual          |
| NestJS Support | `@Sse()` decorator | Gateway needed | Manual          |
| Battery        | Efficient          | Medium         | Poor            |

Notifications are **unidirectional** (server pushes to client), making SSE the ideal choice.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (SvelteKit 5)                       │
│                                                                  │
│  notification-sse.ts ──► notification.store.svelte.ts ──► Badge │
│       (EventSource)           ($state rune)           (Sidebar)  │
│              │                                                   │
│              ▼ GET /api/v2/notifications/stream?token=...        │
└──────────────────────────────────────────────────────────────────┘
                              │ SSE
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS + Fastify)                    │
│                                                                  │
│  notifications.controller.ts ◄──── eventBus.ts (Singleton)      │
│         @Sse('stream')                    │                      │
│                                           │                      │
│     ┌─────────────┬─────────────┬─────────┴─────────┐           │
│     ▼             ▼             ▼                   ▼           │
│  surveys     documents       kvp              chat              │
│  .service    .service     .service          .service            │
│     │             │             │                   │           │
│     └─────────────┴─────────────┴───────────────────┘           │
│                    eventBus.emit*()                              │
└──────────────────────────────────────────────────────────────────┘
```

## How to Add a New Feature to the Notification System

### Step 1: Define Event in EventBus

**File:** `backend/src/utils/eventBus.ts`

```typescript
// 1. Add interface for your event data
interface YourFeatureEvent {
  tenantId: number;
  yourFeature: {
    id: number;
    title: string;
    // ... other fields
  };
}

// 2. Add emit method to NotificationEventBus class
emitYourFeatureCreated(tenantId: number, data: YourFeatureEvent['yourFeature']): void {
  logger.info(`[EventBus] Emitting yourfeature.created for tenant ${tenantId}`);
  this.emit('yourfeature.created', { tenantId, yourFeature: data });
}
```

### Step 2: Emit Event in Your Service

**File:** `backend/src/nest/yourfeature/yourfeature.service.ts`

```typescript
import { eventBus } from '../../utils/eventBus.js';

async createYourFeature(dto: CreateDto): Promise<YourFeature> {
  const tenantId = this.getTenantId();

  // ... your creation logic ...
  const result = await this.db.query(...);

  // Emit event AFTER successful creation
  eventBus.emitYourFeatureCreated(tenantId, {
    id: result.id,
    title: dto.title,
  });

  return result;
}
```

### Step 3: Handle Event in Notifications Controller

**File:** `backend/src/nest/notifications/notifications.controller.ts`

```typescript
// 1. Add to SSE_EVENTS constant
const SSE_EVENTS = {
  // ... existing events
  YOURFEATURE_CREATED: 'yourfeature.created',
} as const;

// 2. Add to NotificationEventData interface
interface NotificationEventData {
  // ... existing fields
  yourFeature?: {
    id: number;
    title: string;
  };
}

// 3. Register handler in registerSSEHandlers()
function registerSSEHandlers(...) {
  // ... existing handlers

  // Add your handler (decide which roles should receive it)
  const yourFeatureHandler = createSSEHandler(
    'NEW_YOURFEATURE',  // Event type sent to frontend
    'yourFeature',       // Key in eventData
    tenantId,
    eventSubject
  );
  eventBus.on(SSE_EVENTS.YOURFEATURE_CREATED, yourFeatureHandler);
  handlers.push({ event: SSE_EVENTS.YOURFEATURE_CREATED, handler: yourFeatureHandler });
}
```

### Step 4: Add Event Type in Frontend

**File:** `frontend/src/lib/utils/notification-sse.ts`

```typescript
export type NotificationEventType =
  | 'CONNECTED'
  | 'HEARTBEAT'
  // ... existing types
  | 'NEW_YOURFEATURE'; // Add your new type
```

### Step 5: Handle Event in Notification Store

**File:** `frontend/src/lib/stores/notification.store.svelte.ts`

```typescript
// 1. Add to NotificationCounts interface
export interface NotificationCounts {
  total: number;
  // ... existing counts
  yourfeature: number; // Add your count
}

// 2. Handle in handleSSEEvent()
function handleSSEEvent(state: NotificationState, event: NotificationEvent): void {
  switch (event.type) {
    // ... existing cases
    case 'NEW_YOURFEATURE':
      incrementCount(state, 'yourfeature');
      break;
  }
}

// 3. Update createInitialCounts()
function createInitialCounts(): NotificationCounts {
  return { total: 0, surveys: 0, documents: 0, kvp: 0, chat: 0, yourfeature: 0 };
}
```

### Step 6: Add Badge to Sidebar (Optional)

**File:** `frontend/src/routes/(app)/+layout.svelte`

```typescript
// Add badgeType to your menu item
{
  id: 'yourfeature',
  icon: ICONS.yourfeature,
  label: 'Your Feature',
  url: '/yourfeature',
  badgeType: 'yourfeature',  // Must match key in NotificationCounts
}
```

### Step 7: Reset Count on Page Visit (Optional)

**File:** `frontend/src/routes/(app)/yourfeature/+page.svelte`

```typescript
import { notificationStore } from '$lib/stores/notification.store.svelte';

onMount(() => {
  notificationStore.resetCount('yourfeature');
});
```

## Event Types Reference

| Event Type     | Trigger           | Recipients         | Badge Location |
| -------------- | ----------------- | ------------------ | -------------- |
| `NEW_SURVEY`   | Survey created    | Employees          | Surveys menu   |
| `NEW_DOCUMENT` | Document uploaded | All users          | Documents menu |
| `NEW_KVP`      | KVP submitted     | Admins/Root        | KVP menu       |
| `NEW_MESSAGE`  | Chat message sent | Message recipients | Chat menu      |

## Testing

### Backend: Test SSE Stream

```bash
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v2/notifications/stream
```

### Backend: Trigger Event

```bash
# Create a survey to trigger NEW_SURVEY event
curl -X POST http://localhost:3000/api/v2/surveys \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
```

### Frontend: Check DevTools

1. Open DevTools → Network → Filter "EventStream"
2. Verify SSE connection is active
3. Trigger event and verify badge updates

## Consequences

### Positive

- Simple, unidirectional architecture
- Browser handles reconnection automatically
- Easy to add new event types
- Low overhead compared to WebSocket

### Negative

- No client-to-server communication (not needed for notifications)
- Need query param for token (EventSource doesn't support headers)

### Risks

- SSE connections count against browser connection limit (6 per domain in HTTP/1.1)
- Long-lived connections may be terminated by proxies (mitigated by Nginx config)

## Email Notifications (Added 2026-04-10)

### Architecture: NestJS MailerService Wrapper

The legacy `backend/src/utils/email-service.ts` (Nodemailer with module-level
state — transporter, queue, logo cache) is wrapped by a thin NestJS service:
`backend/src/nest/common/services/mailer.service.ts`. Domain services
(e.g. `AuthService`) inject `MailerService` via the constructor instead of
calling `await import('../../utils/email-service.js')` inside business logic.

**Why:**

1. **No dynamic imports in domain code.** Dynamic `await import(...)` is a
   KISS violation: it hides dependencies, breaks IDE navigation, and forces
   tests to mock the module loader. The NestJS DI container handles lifecycle
   and substitution natively.
2. **Zero duplication.** The legacy module already exposes `loadTemplate`,
   `loadBrandedTemplate`, `escapeHtmlTemplate` and `sendEmail`. The wrapper
   composes these — it never reimplements template loading or HTML escaping.
   `AuthService` previously carried duplicated `escapeHtml` + manual
   `fs.readFile` template loading, all of which is now deleted.
3. **Centralized failure swallowing.** `MailerService.sendPasswordReset()`
   logs send failures and resolves normally. Callers can trust they will
   never throw, which preserves the email enumeration prevention contract
   (`forgot-password` always returns the same generic response).
4. **Quiet bug fixed.** The previous inline implementation referenced
   `cid:assixx-logo` in the HTML template but never attached the logo file —
   resulting in broken images in every reset email. `loadBrandedTemplate`
   attaches the CID image automatically.

**Why NOT migrate `email-service.ts` itself to a `@Injectable()` class?**

The legacy file holds module-level singleton state (transporter, queue,
`isProcessingQueue` flag, branded logo buffer cache). Unwinding these into
proper instance state would touch every caller — out of scope for an
incremental refactor. Wrapping is the KISS-compliant first step; a full
migration is tracked separately.

**Future email types** (welcome, document notification, etc.) get their own
typed method on `MailerService` instead of bypassing it. New domain services
inject `MailerService` from `../common/services/mailer.service.js`.

### SMTP Transport

The existing `email-service.ts` (Nodemailer) was connected to SMTP via environment variables:

| Env Var     | Source  | Example              |
| ----------- | ------- | -------------------- |
| `SMTP_HOST` | Doppler | `smtp.office365.com` |
| `SMTP_PORT` | Doppler | `587`                |
| `SMTP_USER` | Doppler | `info@assixx.com`    |
| `SMTP_PASS` | Doppler | M365 App-Passwort    |
| `SMTP_FROM` | Doppler | `info@assixx.com`    |

> **Migration note (2026-04-29):** SMTP-Provider von Gmail auf Microsoft 365
> umgestellt. Office365 enforced strict sender-match → `SMTP_FROM` muss
> `SMTP_USER` matchen (oder ein konfigurierter Alias der Mailbox sein), sonst
> `5.7.60 SenderNotAllowed`. Alle SMTP-Werte (inkl. HOST/PORT/FROM) liegen
> jetzt in Doppler — `docker/.env` enthält keine SMTP-Konfiguration mehr.

**Fix applied:** `email-service.ts` previously read `EMAIL_*` env vars, but `docker-compose.yml` injects `SMTP_*`. Aligned to `SMTP_*` as primary, `EMAIL_*` as fallback.

### Password Reset Flow

First email-based feature implemented. Public endpoints (rate-limited via `@AuthThrottle()`):

- `POST /auth/forgot-password` — Accepts email, generates SHA-256 hashed token in `password_reset_tokens`, sends email. **Always returns generic response** (email enumeration prevention).
- `POST /auth/reset-password` — Validates token, updates password (bcrypt, 12 rounds), invalidates token, revokes all refresh tokens (force re-login on all devices).

**Token Security:**

- Raw token: 32 bytes (`crypto.randomBytes(32).toString('hex')`)
- Stored as SHA-256 hash (never raw)
- 60-minute expiry
- Single-use (marked `used = true` after consumption)
- Previous unused tokens invalidated on new request

**Email Template:** `backend/templates/email/password-reset.html` — responsive, dark mode support, MSO-compatible (Outlook VML roundrect), fallback URL for broken buttons.

**Frontend Pages:**

- `/forgot-password` — Email input, generic success message
- `/reset-password?token=xxx` — Password form with strength meter (NIST 800-63B: 12+ chars, 3/4 categories)

### Future: Event-Triggered Email Notifications

Planned: Hook into EventBus to send emails alongside SSE for configured event types. Will respect `notification_preferences.email_notifications` flag per user. Not yet implemented.

## Related Decisions

- ADR-002: Chat uses WebSocket for bidirectional communication (typing indicators)
- ADR-005: Authentication Strategy (JWT, password hashing, token revocation)

## Notes

- Nginx must be configured to disable buffering for SSE endpoint
- Token refresh triggers SSE reconnection with new token
