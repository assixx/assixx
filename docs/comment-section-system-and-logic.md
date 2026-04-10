# Comment Section System & Logic

> YouTube-Style Threaded Comments mit Lazy Loading
> Stand: 2026-02-17 | Branch: `refactor/vacation-feature`

---

## Inhaltsverzeichnis

1. [Überblick & Architektur](#1-überblick--architektur)
2. [Datenbank-Schema](#2-datenbank-schema)
3. [Backend Types](#3-backend-types)
4. [Backend Services](#4-backend-services)
5. [Backend Controller & DTOs](#5-backend-controller--dtos)
6. [Frontend Types](#6-frontend-types)
7. [Frontend API](#7-frontend-api)
8. [Frontend State Management](#8-frontend-state-management)
9. [SSR (Server-Side Rendering)](#9-ssr-server-side-rendering)
10. [Frontend Components](#10-frontend-components)
11. [Datenfluss (End-to-End)](#11-datenfluss-end-to-end)
12. [Dateien-Übersicht](#12-dateien-übersicht)

---

## 1. Überblick & Architektur

### Was wurde gebaut

Ein **YouTube-Style Kommentar-System** mit:

- **Threaded Replies**: Kommentare können auf Top-Level-Kommentare antworten (1 Ebene tief)
- **Lazy Loading**: Initial 20 Top-Level-Kommentare via SSR, dann 10 weitere per IntersectionObserver
- **Flat Design**: Kein Card-Styling pro Kommentar (kein Border/Background pro Kommentar)
- **Thread-Linie**: Vertikale 2px-Linie als visueller Thread-Indikator bei Replies
- **Inline Reply Form**: Öffnet sich direkt unter dem Kommentar beim Klick auf "Antworten"
- **Reply Count Toggle**: "X Antworten" Button klappt Replies auf/zu (on-demand geladen)
- **Keine Like-Funktion**

### Zwei Module — identische Architektur

| Modul          | Entity               | Comment-Tabelle       |
| -------------- | -------------------- | --------------------- |
| **Blackboard** | `blackboard_entries` | `blackboard_comments` |
| **KVP**        | `kvp_suggestions`    | `kvp_comments`        |

Beide Module folgen exakt demselben Pattern. Der einzige Unterschied:

- **Blackboard** verwendet lokalen Component-State (Props → `$state`)
- **KVP** verwendet einen zentralen State-Store (`kvpDetailState` Singleton)

### Architektur-Stack

```
┌─────────────────────────────────────────────────────┐
│  Frontend (SvelteKit 5 + Runes)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ +page.server │→│ +page.svelte  │→│ Comment-    │ │
│  │ (SSR Load)   │  │ (Hydration)  │  │ Section    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                │        │
│         │          ┌──────┴───────┐  ┌─────┴──────┐ │
│         │          │ state.svelte │  │ api.ts     │ │
│         │          │ (KVP only)   │  │ (fetch)    │ │
│         │          └──────────────┘  └─────┬──────┘ │
├─────────┼──────────────────────────────────┼────────┤
│         │           HTTP / fetch()         │        │
├─────────┼──────────────────────────────────┼────────┤
│  Backend (NestJS 11 + Fastify)             │        │
│  ┌──────┴───────┐  ┌──────────────┐  ┌────┴──────┐ │
│  │ Controller   │→│ Service       │→│ Comments  │ │
│  │ (Routes)     │  │ (Facade)     │  │ Service   │ │
│  └──────────────┘  └──────────────┘  └─────┬──────┘ │
├────────────────────────────────────────────┼────────┤
│  Database (PostgreSQL 18.3)                │        │
│  ┌─────────────────────────────────────────┴──────┐ │
│  │ blackboard_comments / kvp_comments             │ │
│  │ parent_id → self-referencing FK (CASCADE)      │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 2. Datenbank-Schema

### Migration

**Datei:** `database/migrations/20260217000039_comment-threading.ts`

Beide Tabellen erhalten eine **self-referencing FK-Spalte** `parent_id`:

```sql
-- Blackboard
ALTER TABLE blackboard_comments ADD COLUMN parent_id INTEGER NULL;
ALTER TABLE blackboard_comments ADD CONSTRAINT fk_bb_comment_parent
  FOREIGN KEY (parent_id) REFERENCES blackboard_comments(id) ON DELETE CASCADE;
CREATE INDEX idx_bb_comments_parent_id ON blackboard_comments(parent_id);

-- KVP
ALTER TABLE kvp_comments ADD COLUMN parent_id INTEGER NULL;
ALTER TABLE kvp_comments ADD CONSTRAINT fk_kvp_comment_parent
  FOREIGN KEY (parent_id) REFERENCES kvp_comments(id) ON DELETE CASCADE;
CREATE INDEX idx_kvp_comments_parent_id ON kvp_comments(parent_id);
```

### Semantik

| Wert                | Bedeutung                         |
| ------------------- | --------------------------------- |
| `parent_id = NULL`  | Top-Level-Kommentar               |
| `parent_id = <int>` | Reply auf Kommentar mit dieser ID |

### Verhalten

- **ON DELETE CASCADE**: Löscht man einen Top-Level-Kommentar, werden alle Replies automatisch mitgelöscht
- **Index**: `idx_*_parent_id` für schnelle Thread-Abfragen (`WHERE parent_id = ?` und `WHERE parent_id IS NULL`)
- **Rollback**: `down()` entfernt Index → Constraint → Spalte in umgekehrter Reihenfolge

---

## 3. Backend Types

### Blackboard (`backend/src/nest/blackboard/blackboard.types.ts`)

```typescript
// DB-Row (snake_case)
interface DbBlackboardComment {
  id: number;
  tenant_id: number;
  entry_id: number;
  user_id: number;
  comment: string;
  is_internal: number; // 0 oder 1
  parent_id: number | null; // NEU: NULL = top-level, int = reply
  created_at: Date;
  // ... user joins
  reply_count?: number; // NEU: Correlated sub-query result
}

// API-Response (camelCase)
interface BlackboardComment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  parentId: number | null; // NEU
  replyCount: number; // NEU
  createdAt: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
}

// Pagination wrapper
interface PaginatedBlackboardComments {
  comments: BlackboardComment[];
  total: number;
  hasMore: boolean;
}
```

### KVP (`backend/src/nest/kvp/kvp.types.ts`)

```typescript
// DB-Row
interface DbComment {
  id: number;
  suggestion_id: number;
  user_id: number;
  comment: string;
  is_internal: boolean;
  parent_id: number | null; // NEU
  created_at: Date;
  // ... user joins
  reply_count?: number; // NEU
}

// API-Response
interface KVPComment {
  id: number;
  suggestionId: number;
  comment: string;
  isInternal: boolean;
  parentId: number | null; // NEU
  replyCount: number; // NEU
  createdBy: number;
  createdByName?: string;
  createdByLastname?: string;
  profilePicture?: string | null;
  createdAt: string;
}

// Pagination wrapper
interface PaginatedKVPComments {
  comments: KVPComment[];
  total: number;
  hasMore: boolean;
}
```

### Transformation (`blackboard.helpers.ts`)

`transformComment()` mappt `DbBlackboardComment → BlackboardComment`:

```typescript
function transformComment(comment: DbBlackboardComment): BlackboardComment {
  return {
    // ...bestehende Felder...
    parentId: comment.parent_id, // NEU
    replyCount: comment.reply_count ?? 0, // NEU: Fallback 0
  };
}
```

KVP verwendet eine lokale `mapComment()` Funktion im Comments Service mit derselben Logik.

---

## 4. Backend Services

### Shared SQL Pattern (beide Services)

```sql
-- SELECT mit Reply-Count Sub-Query
SELECT
  c.*, u.first_name, u.last_name, u.role, u.profile_picture,
  (SELECT COUNT(*)::int FROM x_comments r WHERE r.parent_id = c.id) AS reply_count
FROM x_comments c
LEFT JOIN users u ON c.user_id = u.id
```

Der `reply_count` wird als **correlated sub-query** berechnet — einfach und korrekt für die typische Kommentar-Menge (<1000 pro Entry).

### Blackboard Comments Service (`blackboard-comments.service.ts`)

#### `getComments(id, tenantId, limit=20, offset=0) → PaginatedBlackboardComments`

1. `resolveEntryId()` — UUID oder numerische ID auflösen
2. **Parallel**: `COUNT(*)` + `SELECT` (nur `WHERE parent_id IS NULL`)
3. Sortierung: `ORDER BY created_at DESC` (neueste zuerst)
4. Pagination: `LIMIT $3 OFFSET $4`
5. Return: `{ comments, total, hasMore: offset + limit < total }`

#### `getReplies(commentId, tenantId) → BlackboardComment[]`

1. `SELECT ... WHERE parent_id = $1 AND tenant_id = $2`
2. Sortierung: `ORDER BY created_at ASC` (älteste zuerst — natürliche Lesereihenfolge)
3. **Kein Paging** — Replies sind typischerweise <20

#### `addComment(id, userId, tenantId, comment, isInternal, parentId?) → { id, message }`

1. `resolveEntryId()`
2. **Parent-Validierung** (wenn `parentId` vorhanden):
   - Prüfe ob Parent existiert: `SELECT entry_id FROM blackboard_comments WHERE id = $1 AND tenant_id = $2`
   - Prüfe ob Parent zum selben Entry gehört: `parentRows[0].entry_id !== numericId` → `BadRequestException`
3. `INSERT INTO blackboard_comments (..., parent_id) VALUES (..., $6)`
4. Return: `{ id, message: 'Comment added successfully' }`

#### `deleteComment(commentId, tenantId)`

- `DELETE FROM blackboard_comments WHERE id = $1 AND tenant_id = $2`
- **Replies werden via CASCADE automatisch mitgelöscht**

### KVP Comments Service (`kvp-comments.service.ts`)

Identisches Pattern, zusätzlich:

- **Internal-Filter**: Employees (`userRole === 'employee'`) können interne Kommentare nicht sehen → `AND c.is_internal = FALSE` wird an Query angehängt
- **Role Check**: Nur `admin`/`root` können Kommentare erstellen → `ForbiddenException`
- `addComment()` returned das vollständige `KVPComment`-Objekt (nicht nur `{ id, message }`)

### Facade Services (Delegation)

Die Haupt-Services (`BlackboardService`, `KvpService`) delegieren an die Comment-Sub-Services:

```typescript
// BlackboardService
async getComments(id, tenantId, limit?, offset?) {
  return this.commentsService.getComments(id, tenantId, limit, offset);
}
async getReplies(commentId, tenantId) {
  return this.commentsService.getReplies(commentId, tenantId);
}
async addComment(id, userId, tenantId, comment, isInternal, parentId?) {
  return this.commentsService.addComment(id, userId, tenantId, comment, isInternal, parentId);
}

// KvpService — gleiche Delegation, aber mit userRole-Parameter
```

Die `getEntryFull()` Methode im BlackboardService gibt jetzt `PaginatedBlackboardComments` statt `BlackboardComment[]` zurück.

---

## 5. Backend Controller & DTOs

### DTOs (Zod-basiert)

**Datei:** `backend/src/nest/blackboard/dto/comment.dto.ts` und `kvp/dto/comment.dto.ts`

```typescript
const AddCommentSchema = z.object({
  comment: z.string().trim().min(1, 'Comment is required').max(5000, 'Comment must not exceed 5000 characters'), // Blackboard: 5000, KVP: 2000
  isInternal: z.boolean().optional().default(false),
  parentId: z.number().int().positive().optional(), // NEU
});
```

### Blackboard Controller (`blackboard.controller.ts`)

| Method | Route                                     | Änderung                                                          |
| ------ | ----------------------------------------- | ----------------------------------------------------------------- |
| `GET`  | `/blackboard/entries/:id/comments`        | **Pagination**: `?limit=&offset=` → `PaginatedBlackboardComments` |
| `GET`  | `/blackboard/comments/:commentId/replies` | **NEU**: Replies für einen Kommentar                              |
| `POST` | `/blackboard/entries/:id/comments`        | **parentId**: `dto.parentId` wird durchgereicht                   |

```typescript
// Pagination-Parsing im Controller
@Get('entries/:id/comments')
async getComments(
  @Param('id') id: string,
  @Query('limit') limit: string | undefined,
  @Query('offset') offset: string | undefined,
  @TenantId() tenantId: number,
): Promise<PaginatedBlackboardComments> {
  const parsedLimit = limit !== undefined ? Number.parseInt(limit, 10) : undefined;
  const parsedOffset = offset !== undefined ? Number.parseInt(offset, 10) : undefined;
  return this.blackboardService.getComments(entryId, tenantId, parsedLimit, parsedOffset);
}

// Neuer Replies-Endpoint
@Get('comments/:commentId/replies')
async getReplies(
  @Param('commentId', ParseIntPipe) commentId: number,
  @TenantId() tenantId: number,
): Promise<BlackboardComment[]> {
  return this.blackboardService.getReplies(commentId, tenantId);
}
```

### KVP Controller (`kvp.controller.ts`)

Identische Änderungen:

| Method | Route                              | Änderung                                                   |
| ------ | ---------------------------------- | ---------------------------------------------------------- |
| `GET`  | `/kvp/:id/comments`                | **Pagination**: `?limit=&offset=` → `PaginatedKVPComments` |
| `GET`  | `/kvp/comments/:commentId/replies` | **NEU**: Replies für einen Kommentar                       |
| `POST` | `/kvp/:id/comments`                | **parentId**: `dto.parentId` wird durchgereicht            |

### Route-Ordering

`GET /kvp/comments/:commentId/replies` (3 Segmente) kollidiert **nicht** mit `GET /kvp/:id` (1 Segment) — NestJS matched nach vollständigem Pattern inkl. Segment-Anzahl.

### FullEntryResponse (Blackboard Controller)

```typescript
interface FullEntryResponse {
  entry: BlackboardEntryResponse;
  comments: PaginatedBlackboardComments; // War vorher: BlackboardComment[]
  attachments: Record<string, unknown>[];
}
```

---

## 6. Frontend Types

### Blackboard (`blackboard/[uuid]/_lib/types.ts`)

```typescript
interface Comment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  parentId: number | null; // NEU
  replyCount: number; // NEU
  createdAt: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profilePicture?: string | null;
}

interface PaginatedComments {
  // NEU
  comments: Comment[];
  total: number;
  hasMore: boolean;
}

interface FullEntryResponse {
  success: boolean;
  data: {
    entry: DetailEntry;
    comments?: PaginatedComments; // War vorher: Comment[]
    attachments?: Attachment[];
  };
}
```

### KVP (`kvp-detail/_lib/types.ts`)

```typescript
interface Comment {
  id: number;
  suggestionId: number;
  comment: string;
  isInternal: boolean;
  parentId: number | null; // NEU
  replyCount: number; // NEU
  createdBy: number;
  createdByName: string;
  createdByLastname: string;
  profilePicture?: string | null;
  createdAt: string;
}

interface PaginatedComments {
  // NEU
  comments: Comment[];
  total: number;
  hasMore: boolean;
}
```

---

## 7. Frontend API

### Blackboard (`blackboard/[uuid]/_lib/api.ts`)

```typescript
// Top-Level Kommentare mit Pagination (für Lazy Loading)
async function fetchComments(uuid: string, limit = 20, offset = 0): Promise<PaginatedComments>;

// Replies für einen Kommentar (on-demand)
async function fetchReplies(commentId: number): Promise<Comment[]>;

// Kommentar oder Reply erstellen
async function addComment(uuid: string, comment: string, parentId?: number): Promise<boolean>;
```

**Endpoints:**

- `GET /blackboard/entries/${uuid}/comments?limit=${limit}&offset=${offset}`
- `GET /blackboard/comments/${commentId}/replies`
- `POST /blackboard/entries/${uuid}/comments` → `{ comment, parentId? }`

### KVP (`kvp-detail/_lib/api.ts`)

```typescript
// Top-Level Kommentare mit Pagination
async function fetchComments(idOrUuid: string, limit = 20, offset = 0): Promise<PaginatedComments>;

// Replies für einen Kommentar
async function fetchReplies(commentId: number): Promise<Comment[]>;

// Kommentar oder Reply erstellen
async function addComment(
  idOrUuid: string,
  comment: string,
  parentId?: number,
): Promise<{ success: boolean; error?: string }>;
```

**Endpoints:**

- `GET /kvp/${idOrUuid}/comments?limit=${limit}&offset=${offset}`
- `GET /kvp/comments/${commentId}/replies`
- `POST /kvp/${idOrUuid}/comments` → `{ comment, parentId? }`

### Error Handling

Alle API-Funktionen haben try/catch mit Fallback-Werten:

- `fetchComments` → `{ comments: [], total: 0, hasMore: false }`
- `fetchReplies` → `[]`
- `addComment` → `false` (Blackboard) / `{ success: false, error: string }` (KVP)

---

## 8. Frontend State Management

### Blackboard: Lokaler Component-State

Blackboard verwendet **keine zentralen State-Stores**. Der CommentSection-Component verwaltet alles lokal:

```typescript
// Props von SSR
const { comments: initialComments, total, hasMore: initialHasMore, isArchived, uuid } = $props();

// Lokaler State
let allComments = $state<Comment[]>(initialComments);
let hasMore = $state(initialHasMore);
let loadingMore = $state(false);
let expandedReplies = $state<Map<number, Comment[]>>(new Map());
let loadingReplies = $state<Set<number>>(new Set());
let replyingTo = $state<number | null>(null);
let replyText = $state('');

// Sync mit SSR-Daten bei invalidateAll()
$effect(() => {
  allComments = initialComments;
  hasMore = initialHasMore;
});
```

### KVP: Zentraler State-Store (Composed State Pattern)

KVP verwendet einen **Singleton-State** (`kvpDetailState`), zusammengesetzt aus 3 Sub-Modulen:

```
state.svelte.ts (Facade)
├── state-data.svelte.ts  ← Kommentar-State lebt hier
├── state-ui.svelte.ts
└── state-user.svelte.ts
```

**`state-data.svelte.ts`** — Relevante State-Felder:

```typescript
function createDataState() {
  let comments = $state<Comment[]>([]);
  let commentTotal = $state(0);
  let commentsHasMore = $state(false);

  return {
    get comments() {
      return comments;
    },
    get commentTotal() {
      return commentTotal;
    },
    get commentsHasMore() {
      return commentsHasMore;
    },

    setComments: (data, total?, hasMore?) => {
      comments = data;
      if (total !== undefined) commentTotal = total;
      if (hasMore !== undefined) commentsHasMore = hasMore;
    },

    appendComments: (data, hasMore) => {
      comments = [...comments, ...data];
      commentsHasMore = hasMore;
    },
  };
}
```

**`state.svelte.ts`** — Exponiert alles als Singleton:

```typescript
export const kvpDetailState = createKvpDetailState();
// → kvpDetailState.comments, .commentTotal, .commentsHasMore
// → kvpDetailState.setComments(), .appendComments()
```

---

## 9. SSR (Server-Side Rendering)

### Blackboard (`blackboard/[uuid]/+page.server.ts`)

```typescript
const result = await fetch(`${API_BASE}/blackboard/entries/${uuid}/full`, { ... });
const data = result.data;

return {
  entry: data.entry,
  comments: data.comments ?? { comments: [], total: 0, hasMore: false },  // PaginatedComments
  attachments: data.attachments ?? [],
  currentUser: mapCurrentUser(parentData.user),
};
```

Die `/full`-Route liefert bereits paginierte Kommentare (erste 20 Top-Level).

### KVP (`kvp-detail/+page.server.ts`)

```typescript
// Kommentare separat geladen (nicht in einem /full Endpoint)
const commentsData = await apiFetch<PaginatedComments>(`/kvp/${idOrUuid}/comments?limit=20&offset=0`, token, fetch);

const comments = commentsData ?? { comments: [], total: 0, hasMore: false };

return {
  suggestion,
  comments, // PaginatedComments
  attachments,
  departments,
  teams,
  areas,
  currentUser: parentData.user,
};
```

### Hydration in +page.svelte

**Blackboard:**

```svelte
<CommentSection
  comments={comments.comments}
  total={comments.total}
  hasMore={comments.hasMore}
  {isArchived}
  {uuid}
/>
```

**KVP:**

```typescript
$effect(() => {
  untrack(() => {
    kvpDetailState.setComments(comments.comments, comments.total, comments.hasMore);
  });
});
```

---

## 10. Frontend Components

### Blackboard CommentSection (`CommentSection.svelte`)

**Props:**

```typescript
interface Props {
  comments: Comment[]; // Initial top-level comments from SSR
  total: number; // Gesamtanzahl top-level comments
  hasMore: boolean; // Gibt es mehr zum Laden?
  isArchived: boolean; // Archived entries: kein Kommentar-Form
  uuid: string; // Entry UUID für API-Calls
}
```

**Lokaler State:**
| Variable | Typ | Zweck |
|----------|-----|-------|
| `allComments` | `Comment[]` | Akkumulierte Top-Level-Kommentare (SSR + lazy loaded) |
| `hasMore` | `boolean` | Gibt es noch mehr zu laden? |
| `loadingMore` | `boolean` | Wird gerade geladen? |
| `expandedReplies` | `Map<number, Comment[]>` | Geladene Replies pro Comment-ID |
| `loadingReplies` | `Set<number>` | Welche Replies werden gerade geladen? |
| `replyingTo` | `number \| null` | Für welchen Kommentar ist das Reply-Form offen? |
| `replyText` | `string` | Text im Reply-Formular |
| `submittingReply` | `boolean` | Reply wird gerade gesendet? |
| `newComment` | `string` | Text im Top-Level-Formular |
| `submittingComment` | `boolean` | Top-Level-Kommentar wird gesendet? |
| `sentinelEl` | `HTMLDivElement` | IntersectionObserver-Sentinel |

### KVP CommentsSection (`CommentsSection.svelte`)

**Props:**

```typescript
interface Props {
  onaddcomment: () => void; // Callback für Top-Level-Kommentar
}
```

Liest alles aus `kvpDetailState`:

- `kvpDetailState.comments`
- `kvpDetailState.commentTotal`
- `kvpDetailState.commentsHasMore`
- `kvpDetailState.effectiveRole` (für Berechtigungsprüfung)

**Exportierte Methoden** (für Parent-Zugriff):

```typescript
export function getCommentInput(): HTMLTextAreaElement | undefined;
export function clearInput(): void;
```

### Shared Logic (beide Components)

#### IntersectionObserver (Lazy Loading)

```typescript
$effect(() => {
  if (sentinelEl === undefined || !hasMore) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
        void loadMoreComments();
      }
    },
    { rootMargin: '200px' }, // 200px vor dem Sichtfeld triggern
  );

  observer.observe(sentinelEl);
  return () => observer.disconnect();
});
```

#### loadMoreComments()

```typescript
async function loadMoreComments(): Promise<void> {
  if (loadingMore || !hasMore) return;
  loadingMore = true;
  const result = await fetchComments(uuid, 10, allComments.length);
  allComments = [...allComments, ...result.comments]; // Append
  hasMore = result.hasMore;
  loadingMore = false;
}
```

- **Offset**: `allComments.length` — Position im Gesamtarray
- **Limit**: 10 (nach initial 20 via SSR)

#### toggleReplies(commentId)

```typescript
async function toggleReplies(commentId: number): Promise<void> {
  // Collapse
  if (expandedReplies.has(commentId)) {
    const next = new Map(expandedReplies);
    next.delete(commentId);
    expandedReplies = next;
    return;
  }

  // Expand: Load from API
  loadingReplies = new Set(loadingReplies).add(commentId);
  const replies = await fetchReplies(commentId);
  expandedReplies = new Map(expandedReplies).set(commentId, replies);
  loadingReplies = /* remove commentId */;
}
```

**Warum `new Map()`/`new Set()`?** Svelte 5 Runes erkennen nur Referenz-Änderungen. Eine Mutation auf dem bestehenden Objekt würde kein Re-Render auslösen.

#### handleSubmitReply(parentId)

```typescript
async function handleSubmitReply(parentId: number): Promise<void> {
  const text = replyText.trim();
  if (text === '') return;

  submittingReply = true;
  const success = await addComment(uuid, text, parentId);

  if (success) {
    replyText = '';
    replyingTo = null;
    // 1. Replies für diesen Kommentar neu laden
    const replies = await fetchReplies(parentId);
    expandedReplies = new Map(expandedReplies).set(parentId, replies);
    // 2. Reply-Count im Top-Level-Kommentar aktualisieren
    allComments = allComments.map((c) => (c.id === parentId ? { ...c, replyCount: replies.length } : c));
  }
  submittingReply = false;
}
```

### HTML-Struktur

```
CommentSection
├── <h3> Kommentare [Badge: total]
├── <form> comment-form (Top-Level, nur wenn !isArchived / canAddComments)
│   ├── <textarea> bind:value={newComment}
│   └── <button> Senden [spinner wenn submitting]
│
├── <div> thread-list
│   ├── {#if allComments.length === 0} "Keine Kommentare"
│   ├── {#each allComments as comment}
│   │   └── <div> thread-item [.thread-item--internal]
│   │       ├── thread-item__main
│   │       │   ├── avatar (Avatar oder Initialen)
│   │       │   └── thread-item__content
│   │       │       ├── thread-item__meta (Name, Datum, Internal-Badge)
│   │       │       ├── thread-item__text
│   │       │       └── thread-item__actions
│   │       │           ├── "Antworten" Button
│   │       │           └── "X Antworten" Toggle [chevron up/down]
│   │       │
│   │       ├── {#if replyingTo === comment.id}
│   │       │   └── reply-form-wrapper
│   │       │       ├── thread-line (2px vertical)
│   │       │       └── reply-form (textarea + Abbrechen/Antworten)
│   │       │
│   │       └── {#if expandedReplies.has(comment.id)}
│   │           └── replies-thread (eingerückt)
│   │               └── {#each replies as reply}
│   │                   └── reply-item
│   │                       ├── thread-line (2px vertical)
│   │                       └── reply-item__main (avatar + content)
│   │
│   └── {#if hasMore}
│       └── <div> load-more-sentinel (IntersectionObserver)
│           └── [spinner: "Weitere Kommentare laden..."]
```

### CSS-Design (YouTube-Style)

```css
/* Flat — kein Card pro Kommentar */
.thread-item {
  border-bottom: 1px solid var(--color-glass-border);
  padding: var(--spacing-3) 0;
}
.thread-item:last-child {
  border-bottom: none;
}

/* Thread-Linie (vertikaler Connector) */
.thread-line {
  margin-right: var(--spacing-3);
  background: var(--color-glass-border);
  width: 2px;
  min-height: 100%;
}

/* Replies eingerückt (Avatar-Breite + Gap) */
.replies-thread {
  padding-left: calc(32px + var(--spacing-3));
}

/* Interne Kommentare: subtiler Hintergrund */
.thread-item--internal {
  border-radius: var(--radius-lg);
  background: rgb(255 182 107 / 5%);
}

/* Internal Badge */
.internal-badge {
  border-radius: 10px;
  background: rgb(255 182 107 / 20%);
  padding: 1px 6px;
  color: #ff6b6b;
  font-size: 0.65rem;
}
```

---

## 11. Datenfluss (End-to-End)

### Initial Load (SSR)

```
1. Browser → GET /blackboard/entries/[uuid]
2. +page.server.ts → fetch(/blackboard/entries/${uuid}/full)
3. Backend Controller → blackboardService.getEntryFull()
4. Service → commentsService.getComments(id, tenant, 20, 0)
5. SQL: SELECT ... WHERE parent_id IS NULL LIMIT 20 OFFSET 0
6. Return: { entry, comments: { comments: [...], total: 45, hasMore: true }, attachments }
7. +page.server.ts → return { entry, comments, attachments, currentUser }
8. +page.svelte → <CommentSection comments={comments.comments} total={comments.total} hasMore={comments.hasMore}>
9. Browser rendert 20 Top-Level-Kommentare mit Reply-Count-Badges
```

### Lazy Load (Scroll)

```
1. User scrollt nach unten
2. IntersectionObserver → sentinelEl wird sichtbar (200px rootMargin)
3. loadMoreComments() → fetchComments(uuid, 10, 20)  // offset=20
4. GET /blackboard/entries/${uuid}/comments?limit=10&offset=20
5. Backend: SELECT ... WHERE parent_id IS NULL LIMIT 10 OFFSET 20
6. Return: { comments: [...10], total: 45, hasMore: true }
7. allComments = [...allComments, ...result.comments]  // Jetzt 30
8. hasMore = result.hasMore
9. Browser rendert 30 Kommentare, Sentinel bleibt aktiv
```

### Reply Thread öffnen

```
1. User klickt "3 Antworten"
2. toggleReplies(42) → fetchReplies(42)
3. GET /blackboard/comments/42/replies
4. Backend: SELECT ... WHERE parent_id = 42 ORDER BY created_at ASC
5. Return: [reply1, reply2, reply3]
6. expandedReplies.set(42, [reply1, reply2, reply3])
7. Browser rendert Replies eingerückt mit Thread-Linie
```

### Reply erstellen

```
1. User klickt "Antworten" bei Kommentar #42
2. replyingTo = 42 → Inline-Reply-Form erscheint
3. User tippt Text, klickt "Antworten"
4. handleSubmitReply(42) → addComment(uuid, text, 42)
5. POST /blackboard/entries/${uuid}/comments → { comment: text, parentId: 42 }
6. Backend: Validiert Parent gehört zum Entry, INSERT mit parent_id = 42
7. Nach Erfolg: fetchReplies(42) → Replies neu laden
8. expandedReplies.set(42, [...neueReplies])
9. allComments[i].replyCount = neueReplies.length  // Count updaten
10. Reply-Form schließt sich
```

### Top-Level-Kommentar erstellen

```
1. User tippt in Top-Level-Textarea, klickt "Senden"
2. handleSubmitComment() → addComment(uuid, text)  // kein parentId
3. POST /blackboard/entries/${uuid}/comments → { comment: text }
4. Backend: INSERT mit parent_id = NULL
5. Nach Erfolg: invalidateAll() → SSR-Daten werden neu geladen
6. Svelte re-rendert mit neuen SSR-Daten
7. $effect synct allComments mit neuen initialComments
```

---

## 12. Dateien-Übersicht

| Layer                  | Datei                                                        | Zweck                                    |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| **Migration**          | `database/migrations/20260217000039_comment-threading.ts`    | `parent_id` Spalte + FK + Index          |
| **Backend Types**      | `backend/src/nest/blackboard/blackboard.types.ts`            | DB + API Interfaces (Blackboard)         |
| **Backend Types**      | `backend/src/nest/kvp/kvp.types.ts`                          | DB + API Interfaces (KVP)                |
| **Backend Helpers**    | `backend/src/nest/blackboard/blackboard.helpers.ts`          | `transformComment()` Mapping             |
| **Backend Service**    | `backend/src/nest/blackboard/blackboard-comments.service.ts` | SQL-Queries, Business Logic (Blackboard) |
| **Backend Service**    | `backend/src/nest/kvp/kvp-comments.service.ts`               | SQL-Queries, Business Logic (KVP)        |
| **Backend Facade**     | `backend/src/nest/blackboard/blackboard.service.ts`          | Delegation an Sub-Services               |
| **Backend Facade**     | `backend/src/nest/kvp/kvp.service.ts`                        | Delegation an Sub-Services               |
| **Backend Controller** | `backend/src/nest/blackboard/blackboard.controller.ts`       | HTTP-Routes (Blackboard)                 |
| **Backend Controller** | `backend/src/nest/kvp/kvp.controller.ts`                     | HTTP-Routes (KVP)                        |
| **Backend DTO**        | `backend/src/nest/blackboard/dto/comment.dto.ts`             | Zod-Validierung (Blackboard)             |
| **Backend DTO**        | `backend/src/nest/kvp/dto/comment.dto.ts`                    | Zod-Validierung (KVP)                    |
| **Frontend Types**     | `frontend/.../blackboard/[uuid]/_lib/types.ts`               | Comment + PaginatedComments              |
| **Frontend Types**     | `frontend/.../kvp-detail/_lib/types.ts`                      | Comment + PaginatedComments              |
| **Frontend API**       | `frontend/.../blackboard/[uuid]/_lib/api.ts`                 | fetchComments, fetchReplies, addComment  |
| **Frontend API**       | `frontend/.../kvp-detail/_lib/api.ts`                        | fetchComments, fetchReplies, addComment  |
| **Frontend State**     | `frontend/.../kvp-detail/_lib/state-data.svelte.ts`          | Runes State (comments, appendComments)   |
| **Frontend State**     | `frontend/.../kvp-detail/_lib/state.svelte.ts`               | Composed Singleton Facade                |
| **Frontend SSR**       | `frontend/.../blackboard/[uuid]/+page.server.ts`             | SSR: Load + PaginatedComments            |
| **Frontend SSR**       | `frontend/.../kvp-detail/+page.server.ts`                    | SSR: Load + PaginatedComments            |
| **Frontend Page**      | `frontend/.../blackboard/[uuid]/+page.svelte`                | Hydration → CommentSection Props         |
| **Frontend Page**      | `frontend/.../kvp-detail/+page.svelte`                       | Hydration → kvpDetailState.setComments() |
| **Frontend Component** | `frontend/.../blackboard/[uuid]/_lib/CommentSection.svelte`  | YouTube-Style UI (Blackboard)            |
| **Frontend Component** | `frontend/.../kvp-detail/_lib/CommentsSection.svelte`        | YouTube-Style UI (KVP)                   |
