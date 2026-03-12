# SvelteKit SSR Migration Strategy

> **Status:** IN PROGRESS
> **Last Updated:** 2026-01-03

## Overview

Migrate from client-side data fetching (onMount) to server-side rendering (SSR) with +page.server.ts.

```
BEFORE (SLOW):                       AFTER (FAST):
Browser → Server (empty HTML)        Browser → Server
Browser ← HTML shell                 Server fetches ALL data in parallel
JS downloads & hydrates              Browser ← HTML WITH data
onMount fires                        Instant render!
6+ API calls (waterfall)
Finally shows data
~2-3 seconds                         ~200-500ms
```

---

## Completed Work

### 1. Backend Cookie Auth ✅

**File:** `backend/src/nest/auth/auth.controller.ts`

```typescript
// Login sets httpOnly cookies
reply.setCookie('accessToken', result.accessToken, {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 60 * 1000, // 30 minutes
});
```

### 2. Layout Server Load ✅

**File:** `routes/(app)/+layout.server.ts`

- Loads user/tenant data ONCE for ALL child pages
- Handles auth redirect server-side (no window.location)
- Child pages access via `data.user` or `await parent()`

### 3. Layout Client Update ✅

**File:** `routes/(app)/+layout.svelte`

- Uses `$props()` for SSR data
- Removed `window.location.replace()` calls
- Uses `goto()` for client-side navigation
- Kept token timer and session management

### 4. Admin Dashboard ✅

**File:** `routes/(app)/admin-dashboard/+page.server.ts`

- 6 parallel API calls via `Promise.all()`
- ~20-40ms server-side load time
- Zero client-side loading states

---

## Migration Pattern

### File Structure

```
routes/(app)/[page-name]/
├── +page.server.ts    ← NEW: Server-side data loading
├── +page.svelte       ← UPDATED: Use $props() for data
└── _lib/
    ├── types.ts       ← Keep
    ├── constants.ts   ← Keep
    ├── utils.ts       ← Keep (UI helpers)
    ├── api.ts         ← REMOVE client-side fetching
    └── state.svelte.ts ← UPDATE: Remove onMount loading
```

### +page.server.ts Template

```typescript
/**
 * [Page Name] - Server-Side Data Loading
 * @module [page-name]/+page.server
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  // 1. Auth check
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // 2. Parallel fetch ALL data
  const [data1, data2, data3] = await Promise.all([
    apiFetch<Type1[]>('/endpoint1', token, fetch),
    apiFetch<Type2[]>('/endpoint2', token, fetch),
    apiFetch<Type3>('/endpoint3', token, fetch),
  ]);

  // 3. Process with safe fallbacks
  const items1 = Array.isArray(data1) ? data1 : [];
  const items2 = Array.isArray(data2) ? data2 : [];

  // 4. Return typed data
  return {
    items1,
    items2,
    item3: data3 ?? null,
  };
};
```

> **Shared Utility:** `apiFetch` ist in `$lib/server/api-fetch.ts` definiert. Handles auth headers, API envelope unwrapping (`{success, data}`, `{data}`, raw), und error logging. **Keine lokale Kopie anlegen!**

### +page.svelte Template

```svelte
<script lang="ts">
  import type { PageData } from './$types';

  // SSR Data - INSTANTLY available
  const { data }: { data: PageData } = $props();

  // Safe fallbacks for hydration edge cases
  const items = $derived(data?.items ?? []);
  const stats = $derived(data?.stats ?? { count: 0 });

  // Client-side state (UI only - NOT for initial data)
  let selectedId = $state<number | null>(null);
  let showModal = $state(false);

  // onMount ONLY for:
  // - WebSocket connections
  // - Timers/intervals
  // - DOM manipulation
  // - NOT for data fetching!
</script>

<!-- NO loading spinner for initial data! -->
<div class="page-content">
  <h1>Items: {items.length}</h1>
  {#each items as item (item.id)}
    <div>{item.name}</div>
  {/each}
</div>
```

---

## Page Migration Status

### ✅ Completed (19)

| Page               | Lines | SSR File            | API Calls                  |
| ------------------ | ----- | ------------------- | -------------------------- |
| Layout             | 720   | `+layout.server.ts` | user, tenant               |
| admin-dashboard    | 362   | `+page.server.ts`   | 6 parallel                 |
| root-dashboard     | 303   | `+page.server.ts`   | 2 parallel                 |
| manage-employees   | 568   | `+page.server.ts`   | 2 parallel                 |
| manage-teams       | 619   | `+page.server.ts`   | 5 parallel                 |
| manage-departments | 592   | `+page.server.ts`   | 4 parallel                 |
| manage-assets      | 583   | `+page.server.ts`   | 4 parallel                 |
| manage-areas       | 579   | `+page.server.ts`   | 4 parallel                 |
| manage-admins      | 566   | `+page.server.ts`   | 3 parallel                 |
| manage-root        | 540   | `+page.server.ts`   | 1 call                     |
| blackboard         | 682   | `+page.server.ts`   | 4 parallel                 |
| blackboard/[uuid]  | ~300  | `+page.server.ts`   | 1 call (full entry)        |
| calendar           | 573   | `+page.server.ts`   | 5 parallel                 |
| documents-explorer | 621   | `+page.server.ts`   | 2 parallel                 |
| kvp                | 579   | `+page.server.ts`   | 4 parallel (admin: +stats) |
| kvp-detail         | 591   | `+page.server.ts`   | 6 API calls                |
| survey-admin       | 400   | `+page.server.ts`   | 5 parallel                 |
| survey-employee    | 588   | `+page.server.ts`   | 1+n API calls              |
| survey-results     | 442   | `+page.server.ts`   | 4 parallel                 |

### ✅ SSR Migration ~96% Complete

24 of 25 pages have SSR. Only `shifts` (2411 lines) pending due to size/complexity. WebSocket-based pages (chat) load initial data server-side while real-time connections happen client-side.

### ✅ Recently Completed

| Page                    | Lines | SSR File          | API Calls                                |
| ----------------------- | ----- | ----------------- | ---------------------------------------- |
| features                | 553   | `+page.server.ts` | 3 parallel (plans, current, features)    |
| chat                    | 571   | `+page.server.ts` | 1 (conversations), WebSocket client-side |
| logs                    | ~400  | `+page.server.ts` | 1 (logs with pagination)                 |
| tenant-deletion-status  | ~540  | `+page.server.ts` | 1 (deletion status)                      |
| tenant-deletion-approve | ~330  | `+page.server.ts` | 1 (deletion status + validation)         |

### 🔄 Pending

| Page   | Lines | Status                                      |
| ------ | ----- | ------------------------------------------- |
| shifts | 2411  | Page migrated, SSR pending (large refactor) |

### ✅ No SSR Needed (2)

- `account-settings` - uses layout user data only
- `root-profile` - uses layout user data only

---

## Step-by-Step Migration Guide

### Step 1: Analyze Current Page

```bash
# Check what APIs are called in onMount
grep -n "apiClient\|fetch\|getApiClient" routes/(app)/[page]/+page.svelte
grep -n "apiClient\|fetch" routes/(app)/[page]/_lib/api.ts
```

### Step 2: Create +page.server.ts

1. Copy template above
2. Add imports for page-specific types
3. Replace endpoints with actual API calls
4. Add proper TypeScript types

### Step 3: Update +page.svelte

1. Change from `onMount` loading to `$props()`
2. Add safe fallbacks: `data?.items ?? []`
3. Remove loading states for initial data
4. Keep `onMount` only for WebSocket/timers

### Step 4: Update \_lib/state.svelte.ts (if exists)

1. Remove `loadData()` functions
2. Keep client-side state (modals, filters, selection)
3. Add `initFromSSR(data)` function if needed

### Step 5: Test

```bash
# Check for TypeScript errors
pnpm exec svelte-check --threshold error

# Run dev server
pnpm run dev

# Check server logs for SSR timing
# Should see: [SSR] [page-name] loaded in XXms
```

---

## Common Pitfalls

### ❌ DON'T: Use window.location for navigation

```typescript
// CORRECT - client-side navigation
import { goto } from '$app/navigation';

// WRONG - causes full page reload
window.location.href = '/dashboard';
window.location.replace('/login');

await goto('/dashboard');
await goto('/login', { replaceState: true });
```

### ❌ DON'T: Fetch same data in multiple pages

```typescript
// WRONG - user fetched in every page
const user = await apiFetch('/users/me', token, fetch);

// CORRECT - use parent() for layout data
const { user } = await parent();
```

### ❌ DON'T: Access undefined data during hydration

```typescript
// WRONG - may crash during hydration
const count = data.items.length;

// CORRECT - safe fallbacks
const items = $derived(data?.items ?? []);
const count = $derived(items.length);
```

### ❌ DON'T: Keep onMount for initial data

```svelte
<!-- WRONG - defeats SSR -->
<script>
  let items = $state([]);
  onMount(async () => {
    items = await fetchItems(); // NO!
  });
</script>

<!-- CORRECT - use SSR data -->
<script>
  const { data } = $props();
  const items = $derived(data?.items ?? []);
</script>
```

---

## Performance Targets

| Metric                 | Before SSR    | After SSR   |
| ---------------------- | ------------- | ----------- |
| First Contentful Paint | ~2s           | <500ms      |
| Time to Interactive    | ~3s           | <800ms      |
| API calls on page load | 6+ sequential | 0 (in HTML) |
| Server-side load time  | N/A           | <100ms      |

---

## References

- [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)
- [SvelteKit Performance](https://kit.svelte.dev/docs/performance)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
