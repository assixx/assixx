# Real-Time Notification System - Best Practice Plan

> **Ziel:** Facebook/Microsoft-Level Benachrichtigungen mit Badge-Updates in Echtzeit
> **Stack:** NestJS + Fastify + SvelteKit 5 + PostgreSQL
> **Erstellt:** 2026-01-08
> **Aktualisiert:** 2026-01-11 - VOLLSTÄNDIG IMPLEMENTIERT

---

## EXECUTIVE SUMMARY

### Aktueller Status (2026-01-11)

| Komponente                   | Status    | Details                                           |
| ---------------------------- | --------- | ------------------------------------------------- |
| Backend SSE Endpoint         | ✅ Fertig | `/api/v2/notifications/stream`                    |
| Backend EventBus             | ✅ Fertig | Survey, Document, KVP, Message Events             |
| Backend NotificationsService | ✅ Fertig | CRUD komplett, unreadCount funktioniert           |
| Frontend SSE Client          | ✅ Fertig | `notification-sse.ts` mit Auto-Reconnect          |
| Frontend Notification Store  | ✅ Fertig | `notification.store.svelte.ts` mit Svelte 5 Runes |
| Frontend Badge in Sidebar    | ✅ Fertig | `NotificationBadge.svelte` mit Animation          |
| Event Emissions in Services  | ✅ Fertig | Surveys, Documents, KVP, Chat emittieren Events   |
| Initial Count Loading        | ✅ Fertig | `loadInitialCounts()` beim App-Start              |
| Count Reset on Page Visit    | ✅ Fertig | Chat-Count wird bei `/chat` Besuch zurückgesetzt  |

**Fazit:** System ist vollständig implementiert und funktionsfähig!

> **Siehe auch:** [ADR-003: Notification System Architecture](./adr/ADR-003-notification-system.md) für Details zur Architektur und Anleitung zum Hinzufügen neuer Features.

---

## TECHNOLOGIE-ENTSCHEIDUNG

### SSE vs WebSocket vs Long-Polling

| Kriterium          | SSE                 | WebSocket        | Long-Polling    |
| ------------------ | ------------------- | ---------------- | --------------- |
| Komplexität        | Einfach             | Komplex          | Mittel          |
| Richtung           | Server → Client     | Bidirektional    | Client → Server |
| Auto-Reconnect     | ✅ Browser built-in | ❌ Manuell       | ❌ Manuell      |
| HTTP/2 Support     | ✅ Multiplexing     | ❌ Separate Conn | ✅              |
| NestJS Support     | ✅ @Sse() Decorator | ⚠️ Gateway nötig | ❌ Manuell      |
| Mobile Ready       | ✅                  | ✅               | ✅              |
| Batterie-Effizient | ✅                  | ⚠️               | ❌              |

### Empfehlung: **SSE für Notifications** + **WebSocket nur für Chat**

**Warum SSE:**

1. Notifications sind UNIDIREKTIONAL (Server → Client)
2. NestJS `@Sse()` ist bereits implementiert und funktioniert
3. Browser `EventSource` hat Auto-Reconnect eingebaut
4. Weniger Overhead als WebSocket
5. Funktioniert über HTTP/2 mit Multiplexing

**Warum WebSocket NUR für Chat:**

- Chat braucht bidirektionale Kommunikation (Typing-Indicator, sofortige Zustellung)
- Bereits implementiert und funktioniert

---

## ARCHITEKTUR (Best Practice wie Facebook/Microsoft)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (SvelteKit 5)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│  │ NotificationSSE │───▶│ NotificationStore│───▶│ Badge Component │    │
│  │   (EventSource) │    │  ($state rune)  │    │  (in Sidebar)   │    │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘    │
│           │                      │                                      │
│           │              ┌───────┴───────┐                             │
│           │              │ Toast Notify  │                             │
│           │              └───────────────┘                             │
│           │                                                             │
│           ▼ EventSource('/api/v2/notifications/stream')                │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SSE (text/event-stream)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (NestJS + Fastify)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐         ┌─────────────────┐                       │
│  │ SSE Controller  │◀────────│    EventBus     │                       │
│  │  @Sse('stream') │         │   (Singleton)   │                       │
│  └─────────────────┘         └────────┬────────┘                       │
│                                       │                                 │
│            ┌──────────────────────────┼──────────────────────────┐     │
│            │                          │                          │     │
│            ▼                          ▼                          ▼     │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐│
│  │ SurveysService  │      │DocumentsService │      │   KvpService    ││
│  │ emitSurvey...() │      │emitDocument...()│      │ emitKvp...()    ││
│  └─────────────────┘      └─────────────────┘      └─────────────────┘│
│            │                          │                          │     │
│            └──────────────────────────┴──────────────────────────┘     │
│                                       │                                 │
│                                       ▼                                 │
│                            ┌─────────────────┐                         │
│                            │    PostgreSQL   │                         │
│                            │  notifications  │                         │
│                            └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTIERUNGSPLAN

### Phase 1: Backend Event Emissions (KRITISCH)

**Problem:** EventBus wird NIEMALS aufgerufen.

**Lösung:** In jeden relevanten Service `eventBus.emit*()` einbauen.

#### 1.1 SurveysService (`backend/src/nest/surveys/surveys.service.ts`)

```typescript
import { eventBus } from '../../utils/eventBus.js';

async createSurvey(dto: CreateSurveyDto, userId: number, tenantId: number) {
  // ... existing creation logic ...
  const survey = await this.db.query<SurveyRow>(...);

  // EMIT EVENT FOR SSE
  eventBus.emitSurveyCreated(tenantId, {
    id: survey.id,
    title: dto.title,
    deadline: dto.deadline,
  });

  return survey;
}
```

#### 1.2 DocumentsService (`backend/src/nest/documents/documents.service.ts`)

```typescript
import { eventBus } from '../../utils/eventBus.js';

async uploadDocument(...) {
  // ... existing upload logic ...

  eventBus.emitDocumentUploaded(tenantId, {
    id: document.id,
    filename: document.filename,
    category: document.category,
  });
}
```

#### 1.3 KvpService (`backend/src/nest/kvp/kvp.service.ts`)

```typescript
import { eventBus } from '../../utils/eventBus.js';

async submitKvp(...) {
  // ... existing submit logic ...

  eventBus.emitKvpSubmitted(tenantId, {
    id: kvp.id,
    title: dto.title,
    submitted_by: username,
  });
}
```

#### 1.4 ChatService - Neues Event für Chat-Nachrichten

```typescript
// EventBus erweitern für Chat-Nachrichten
emitNewMessage(tenantId: number, message: MessageEvent): void {
  this.emit('message.new', { tenantId, message });
}
```

---

### Phase 2: Frontend SSE Client (Svelte 5)

**Datei:** `frontend/src/lib/utils/notification-sse.ts`

```typescript
import { browser } from '$app/environment';

export interface NotificationEvent {
  type: 'NEW_SURVEY' | 'NEW_DOCUMENT' | 'NEW_KVP' | 'NEW_MESSAGE' | 'CONNECTED' | 'HEARTBEAT';
  data?: unknown;
  timestamp: string;
}

type NotificationHandler = (event: NotificationEvent) => void;

class NotificationSSEClient {
  private eventSource: EventSource | null = null;
  private handlers: Set<NotificationHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  connect(): void {
    if (!browser) return;
    if (this.eventSource?.readyState === EventSource.OPEN) return;
    if (this.isConnecting) return;

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[SSE] No token available');
      return;
    }

    this.isConnecting = true;

    // SSE endpoint with token as query param (SSE doesn't support headers)
    const url = `/api/v2/notifications/stream?token=${encodeURIComponent(token)}`;

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.info('[SSE] Connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.isConnecting = false;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as NotificationEvent;
        this.notifyHandlers(data);
      } catch (error) {
        console.error('[SSE] Parse error:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.error('[SSE] Connection error');
      this.eventSource?.close();
      this.isConnecting = false;
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.info(`[SSE] Reconnecting in ${this.reconnectDelay}ms...`);

    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30s
  }

  subscribe(handler: NotificationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private notifyHandlers(event: NotificationEvent): void {
    this.handlers.forEach((handler) => handler(event));
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    console.info('[SSE] Disconnected');
  }
}

// Singleton
let instance: NotificationSSEClient | null = null;

export function getNotificationSSE(): NotificationSSEClient {
  instance ??= new NotificationSSEClient();
  return instance;
}
```

---

### Phase 3: Frontend Notification Store (Svelte 5 Runes)

**Datei:** `frontend/src/lib/stores/notification.store.svelte.ts`

```typescript
import { browser } from '$app/environment';
import { getApiClient } from '$lib/utils/api-client';
import { type NotificationEvent, getNotificationSSE } from '$lib/utils/notification-sse';

interface NotificationCounts {
  total: number;
  surveys: number;
  documents: number;
  kvp: number;
  chat: number;
}

interface NotificationState {
  counts: NotificationCounts;
  isConnected: boolean;
  lastUpdate: Date | null;
}

// Svelte 5 Runes Store
function createNotificationStore() {
  let state = $state<NotificationState>({
    counts: { total: 0, surveys: 0, documents: 0, kvp: 0, chat: 0 },
    isConnected: false,
    lastUpdate: null,
  });

  const apiClient = getApiClient();
  let unsubscribe: (() => void) | null = null;

  async function fetchCounts(): Promise<void> {
    try {
      const response = await apiClient.get<{ unread: number; byType: Record<string, number> }>(
        '/notifications/stats/me',
      );

      if (response.success && response.data) {
        state.counts = {
          total: response.data.unread,
          surveys: response.data.byType?.survey ?? 0,
          documents: response.data.byType?.document ?? 0,
          kvp: response.data.byType?.kvp ?? 0,
          chat: response.data.byType?.message ?? 0,
        };
        state.lastUpdate = new Date();
      }
    } catch (error) {
      console.error('[NotificationStore] Fetch error:', error);
    }
  }

  function handleSSEEvent(event: NotificationEvent): void {
    switch (event.type) {
      case 'CONNECTED':
        state.isConnected = true;
        // Fetch initial counts on connect
        void fetchCounts();
        break;

      case 'NEW_SURVEY':
        state.counts.surveys++;
        state.counts.total++;
        state.lastUpdate = new Date();
        break;

      case 'NEW_DOCUMENT':
        state.counts.documents++;
        state.counts.total++;
        state.lastUpdate = new Date();
        break;

      case 'NEW_KVP':
        state.counts.kvp++;
        state.counts.total++;
        state.lastUpdate = new Date();
        break;

      case 'NEW_MESSAGE':
        state.counts.chat++;
        state.counts.total++;
        state.lastUpdate = new Date();
        break;
    }
  }

  function connect(): void {
    if (!browser) return;

    const sse = getNotificationSSE();
    unsubscribe = sse.subscribe(handleSSEEvent);
    sse.connect();
  }

  function disconnect(): void {
    unsubscribe?.();
    getNotificationSSE().disconnect();
    state.isConnected = false;
  }

  function decrementCount(type: keyof Omit<NotificationCounts, 'total'>): void {
    if (state.counts[type] > 0) {
      state.counts[type]--;
      state.counts.total--;
    }
  }

  function resetCount(type: keyof Omit<NotificationCounts, 'total'>): void {
    state.counts.total -= state.counts[type];
    state.counts[type] = 0;
  }

  return {
    get state() {
      return state;
    },
    get counts() {
      return state.counts;
    },
    get isConnected() {
      return state.isConnected;
    },
    connect,
    disconnect,
    fetchCounts,
    decrementCount,
    resetCount,
  };
}

export const notificationStore = createNotificationStore();
```

---

### Phase 4: Badge Component in Sidebar

**Datei:** `frontend/src/lib/components/NotificationBadge.svelte`

```svelte
<script lang="ts">
  interface Props {
    count: number;
    max?: number;
  }

  const { count, max = 99 }: Props = $props();

  const displayCount = $derived(count > max ? `${max}+` : count.toString());
  const show = $derived(count > 0);
</script>

{#if show}
  <span class="notification-badge" aria-label="{count} ungelesene Benachrichtigungen">
    {displayCount}
  </span>
{/if}

<style>
  .notification-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    text-align: center;
    color: white;
    background: var(--danger-500, #ef4444);
    border-radius: 9px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    animation: badge-pop 0.2s ease-out;
  }

  @keyframes badge-pop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
</style>
```

---

### Phase 5: Integration in Layout

**Datei:** `frontend/src/routes/(app)/+layout.svelte` (Änderungen)

```svelte
<script lang="ts">
  // ... existing imports ...
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import NotificationBadge from '$lib/components/NotificationBadge.svelte';

  // Connect SSE on mount
  onMount(() => {
    notificationStore.connect();
    return () => notificationStore.disconnect();
  });

  // Menu items with badge support
  interface NavItem {
    id: string;
    icon?: string;
    label: string;
    url?: string;
    badgeType?: 'surveys' | 'documents' | 'kvp' | 'chat';
    // ...
  }

  // Example: Chat menu item with badge
  const menuItems = $derived<NavItem[]>([
    // ...
    {
      id: 'chat',
      icon: ICONS.chat,
      label: 'Chat',
      url: '/chat',
      badgeType: 'chat',  // ← Badge hinzufügen
    },
    // ...
  ]);
</script>

<!-- In der Sidebar-Navigation -->
{#each menuItems as item}
  <a href={item.url} class="nav-item" class:active={isActive(item)}>
    <span class="nav-icon" style="position: relative;">
      {@html item.icon}
      {#if item.badgeType}
        <NotificationBadge count={notificationStore.counts[item.badgeType]} />
      {/if}
    </span>
    <span class="nav-label">{item.label}</span>
  </a>
{/each}
```

---

## NGINX KONFIGURATION FÜR SSE

**Wichtig:** Nginx muss SSE-Verbindungen korrekt behandeln.

```nginx
# docker/nginx/nginx.conf

location /api/v2/notifications/stream {
    proxy_pass http://backend:3000;

    # SSE-spezifische Einstellungen
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;

    # Lange Timeouts für SSE
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    # Chunked Transfer deaktivieren
    chunked_transfer_encoding off;

    # Headers
    proxy_set_header X-Accel-Buffering no;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## TESTPLAN

### Backend-Test (Terminal)

```bash
# 1. SSE-Stream manuell testen
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v2/notifications/stream

# Erwartete Ausgabe:
# data: {"type":"CONNECTED","timestamp":"...","user":{...}}
# (alle 30s) data: {"type":"HEARTBEAT","timestamp":"..."}
```

### Event-Emission-Test

```bash
# 2. Survey erstellen (als Admin) - sollte SSE-Event auslösen
curl -X POST http://localhost:3000/api/v2/surveys \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Survey","deadline":"2026-12-31"}'

# Im SSE-Stream sollte erscheinen:
# data: {"type":"NEW_SURVEY","survey":{"id":1,"title":"Test Survey"}}
```

### Frontend-Test

1. Browser öffnen → DevTools → Network → Filter: "EventSource"
2. Login → SSE-Verbindung sollte erscheinen
3. In zweitem Tab: Survey erstellen
4. Badge in Sidebar sollte sich aktualisieren

---

## MOBILE-READINESS (Phase 2)

Für Mobile später:

1. **Service Worker** für Push Notifications
2. **Web Push API** (VAPID Keys)
3. **Background Sync** für Offline-Support

SSE funktioniert auch auf Mobile, aber Push Notifications sind besser für:

- App ist im Hintergrund
- Gerät ist gesperrt
- Batterie-Optimierung

---

## ZUSAMMENFASSUNG

| Task                          | Priorität | Aufwand | Status   |
| ----------------------------- | --------- | ------- | -------- |
| EventBus Calls in Services    | KRITISCH  | 1h      | ✅ DONE  |
| Frontend SSE Client           | KRITISCH  | 2h      | ✅ DONE  |
| Notification Store (Svelte 5) | KRITISCH  | 2h      | ✅ DONE  |
| Badge Component               | HOCH      | 30min   | ✅ DONE  |
| Layout Integration            | HOCH      | 1h      | ✅ DONE  |
| Nginx SSE Config              | MITTEL    | 15min   | ✅ DONE  |
| Initial Count Loading         | HOCH      | 30min   | ✅ DONE  |
| Count Reset on Visit          | MITTEL    | 15min   | ✅ DONE  |
| Toast Integration             | MITTEL    | 30min   | ⬜ LATER |
| Mobile Push (Phase 2)         | NIEDRIG   | 4h      | ⬜ LATER |

**Phase 1 abgeschlossen:** 2026-01-11

---

## IMPLEMENTIERTE DATEIEN

### Backend

- `backend/src/utils/eventBus.ts` - EventEmitter Singleton
- `backend/src/nest/notifications/notifications.controller.ts` - SSE Stream
- `backend/src/nest/surveys/surveys.service.ts` - emit bei Create/Update
- `backend/src/nest/documents/documents.service.ts` - emit bei Upload
- `backend/src/nest/kvp/kvp.service.ts` - emit bei Submit
- `backend/src/nest/chat/chat.service.ts` - emit bei sendMessage

### Frontend

- `frontend/src/lib/utils/notification-sse.ts` - EventSource Client
- `frontend/src/lib/stores/notification.store.svelte.ts` - Svelte 5 Store
- `frontend/src/lib/components/NotificationBadge.svelte` - Badge Component
- `frontend/src/routes/(app)/+layout.svelte` - SSE Connect + Badge Integration
- `frontend/src/routes/(app)/chat/+page.svelte` - Count Reset

### Config

- `docker/nginx/nginx.conf` - SSE Proxy Settings

---

## NEUES FEATURE HINZUFÜGEN

Siehe **[ADR-003: Notification System Architecture](./adr/ADR-003-notification-system.md)** für eine Schritt-für-Schritt-Anleitung.

**Kurzfassung:**

1. Event in `eventBus.ts` definieren
2. `emit*()` in deinem Service aufrufen
3. Handler in `notifications.controller.ts` registrieren
4. Event-Type in `notification-sse.ts` hinzufügen
5. Event in `notification.store.svelte.ts` handlen
6. (Optional) Badge in Sidebar hinzufügen

---

**Erstellt:** 2026-01-08
**Aktualisiert:** 2026-01-11
**Autor:** Assixx
**Status:** ✅ PHASE 1 VOLLSTÄNDIG IMPLEMENTIERT
