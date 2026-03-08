# Svelte 5 & SvelteKit - Quick Reference

> **Version:** 1.0.0 | **Svelte:** 5.x | **SvelteKit:** 2.x

---

## Why Svelte? (vs React/Vue)

| Feature         | Svelte 5          | React           | Vue 3         |
| --------------- | ----------------- | --------------- | ------------- |
| **Reactivity**  | Compile-time      | Runtime (hooks) | Runtime (ref) |
| **Bundle Size** | Tiny (no runtime) | ~40kb           | ~30kb         |
| **Boilerplate** | Minimal           | High            | Medium        |
| **Performance** | No VDOM           | VDOM diffing    | VDOM diffing  |

**Key Wins:** No Virtual DOM, compile-time reactivity, ~40% less code, built-in animations, scoped CSS.

---

## File Types: When to Use What?

| File              | When to use                    | Runes? | Example                               |
| ----------------- | ------------------------------ | ------ | ------------------------------------- |
| `.svelte`         | UI components with markup      | Yes    | `Button.svelte`, `Modal.svelte`       |
| `.svelte.ts`      | Shared state, logic WITHOUT UI | Yes    | `counter.svelte.ts`, `auth.svelte.ts` |
| `.ts`             | Utilities, Types, Constants    | No     | `utils.ts`, `types.ts`, `api.ts`      |
| `+page.svelte`    | SvelteKit pages                | Yes    | Route components                      |
| `+page.server.ts` | Server-only Load/Actions       | No     | DB access, Auth                       |

**Decision Tree:**

```
Does it have UI/Markup?
  → YES: .svelte
  → NO: Does it need Runes ($state, $derived)?
      → YES: .svelte.ts (reactive logic)
      → NO: .ts (plain TypeScript)
```

**Example .svelte.ts (Shared State):**

```typescript
// lib/auth.svelte.ts - Reactive auth state for entire app
let user = $state<User | null>(null);
export const auth = {
  get user() {
    return user;
  },
  get isLoggedIn() {
    return user !== null;
  },
  login: (u: User) => (user = u),
  logout: () => (user = null),
};
```

### .svelte File Structure

```svelte
<!-- 1. Module Script (optional) - runs ONCE on import -->
<script module>
  // Shared between all instances
  export const metadata = { title: 'My Component' };
  let instanceCount = 0;
</script>

<!-- 2. Instance Script - runs per component instance -->
<script lang="ts">
  import { onMount } from 'svelte';

  // Props
  let { name, count = 0 } = $props();

  // State
  let localState = $state('');

  // Derived
  let doubled = $derived(count * 2);

  // Effects
  $effect(() => {
    console.log('Count changed:', count);
  });

  // Lifecycle (rarely needed with Runes)
  onMount(() => {
    console.log('Mounted');
    return () => console.log('Destroyed');
  });
</script>

<!-- 3. Markup - HTML with Svelte syntax -->
<div class="container">
  <h1>Hello {name}!</h1>
  <p>Count: {count}, Doubled: {doubled}</p>
</div>

<!-- 4. Style (optional) - Scoped CSS! -->
<style>
  .container { padding: 1rem; }
  h1 { color: blue; }  /* Only THIS component affected! */
</style>
```

### Server-Only Modules (Security!)

**CRITICAL:** Prevent secrets from reaching the browser!

```
src/lib/
├── server/              # Everything here is SERVER-ONLY
│   ├── db.ts           # Database connection
│   ├── auth.ts         # Auth logic with secrets
│   └── api-keys.ts     # API Keys
├── utils.ts            # Shared (Client + Server)
└── types.ts            # Shared Types
```

**Two Methods for Server-Only:**

```typescript
// 1. Directory: $lib/server/
// src/lib/server/db.ts
import { DATABASE_URL } from '$env/static/private';

// Private env!
export const db = createConnection(DATABASE_URL);

// 2. Filename: .server.ts
// src/lib/secrets.server.ts
export const API_KEY = process.env.SECRET_API_KEY;
```

**Environment Variables:**

```typescript
// PRIVATE - server only!
import { DATABASE_URL, API_SECRET } from '$env/static/private';
import { DATABASE_URL } from '$env/dynamic/private';

// PUBLIC - also available in browser
import { PUBLIC_API_URL } from '$env/static/public';
import { PUBLIC_APP_NAME } from '$env/dynamic/public';
```

**SvelteKit blocks automatically:**

```typescript
// src/routes/+page.svelte
import { db } from '$lib/server/db';  // ERROR! Server-only in client code

// src/routes/+page.server.ts
import { db } from '$lib/server/db';  // OK! Server-only file
```

---

## Runes - Core of Svelte 5

**What are Runes?** Compiler symbols with `$` prefix that control reactivity.

- Based on **Signals** (like Solid.js) - fine-grained reactivity
- Work everywhere: `.svelte`, `.svelte.js`, `.svelte.ts`
- Replace: `export let`, `$:` labels, Stores, Lifecycle functions

**Svelte 3/4 → Svelte 5:**

```js
// OLD (Svelte 4)          →  NEW (Svelte 5)
export let count;          →  let { count } = $props();
let doubled;               →  let doubled = $derived(count * 2);
$: doubled = count * 2;    →  // (automatically tracked)
$: console.log(count);     →  $effect(() => console.log(count));
```

### $state - Reactive State

```svelte
<script>
  let count = $state(0);           // Primitive
  let user = $state({ name: '' }); // Deep reactive object
  let items = $state([1, 2, 3]);   // Deep reactive array
  items.push(4); // Triggers update!
</script>
<button onclick={() => count++}>Clicked {count}</button>
```

- **$state.raw** - Non-deep (only reassignment triggers)
- **$state.snapshot** - Get plain object for APIs

**Universal Reactivity (.svelte.ts) - State outside components:**

```typescript
// lib/counter.svelte.ts
export function createCounter(initial = 0) {
  let count = $state(initial);
  return {
    get count() {
      return count;
    },
    increment: () => count++,
  };
}
// In component: const c = createCounter(); <button onclick={c.increment}>{c.count}</button>
```

### $derived - Computed Values

```js
let doubled = $derived(count * 2); // Simple
let total = $derived.by(() => {
  // Complex
  return items.reduce((a, b) => a + b, 0);
});
```

**Rules:** Side-effect free, auto-tracked deps, lazy recalc.

### $effect - Side Effects

```js
$effect(() => {
  console.log(`Count: ${count}`);
  return () => console.log('Cleanup'); // Optional cleanup
});
```

**Use for:** Analytics, 3rd-party libs, DOM manipulation, WebSockets.

**NEVER sync state:**

```js
// BAD
$effect(() => {
  doubled = count * 2;
});
// GOOD
let doubled = $derived(count * 2);
```

### $props - Component Properties

```svelte
<script lang="ts">
  // Basic + Defaults + Rest
  let { name, age = 18, ...rest } = $props();

  // Renaming (reserved words)
  let { class: className, for: htmlFor } = $props();

  // TypeScript Interface (recommended)
  interface Props {
    name: string;
    age?: number;
    onSave: () => void;   // Callback Event
    children?: Snippet;   // Slot content
  }
  let { name, age = 18, onSave, children }: Props = $props();
</script>

<!-- Pass rest props -->
<button {...rest}>{name}</button>

<!-- Render children (slot replacement) -->
{@render children?.()}
```

**$bindable - Two-Way Binding:**

```svelte
<!-- Child: Input.svelte -->
<script>
  let { value = $bindable('') } = $props();
</script>
<input bind:value />

<!-- Parent -->
<Input bind:value={searchTerm} />
```

**Don't mutate props!**

```js
// BAD:  user.name = 'New';  // Props are readonly!
// GOOD: let local = $state({ ...user }); local.name = 'New';
```

### $inspect - Debug Only

```js
$inspect(count); // Logs on change
```

### Context API (Avoid Prop Drilling)

**setContext / getContext:**

```svelte
<!-- App.svelte (Provider) -->
<script>
  import { setContext } from 'svelte';

  const user = $state({ name: 'John', role: 'admin' });
  setContext('user', user);  // Key can be string or Symbol
</script>

<!-- DeepChild.svelte (Consumer - arbitrarily deep nested) -->
<script>
  import { getContext } from 'svelte';

  const user = getContext('user');  // Reactive!
</script>
<p>Logged in as: {user.name}</p>
```

**TypeScript Pattern:**

```svelte
<script lang="ts">
  import { setContext, getContext } from 'svelte';

  // Typed Context Key
  interface UserContext { name: string; role: string }
  const USER_KEY = Symbol('user');

  // Provider
  setContext<UserContext>(USER_KEY, { name: 'John', role: 'admin' });

  // Consumer
  const user = getContext<UserContext>(USER_KEY);
</script>
```

**When Context vs Props?**

- **Props:** Direct Parent→Child communication
- **Context:** Data across many levels (Theme, Auth, i18n)

### Stores (Legacy - Runes preferred!)

**Svelte 5:** Use Runes instead of Stores. Stores only for compatibility.

```typescript
// stores/auth.ts - Legacy Pattern
import { derived, writable } from 'svelte/store';

export const user = writable<User | null>(null);
export const isLoggedIn = derived(user, ($u) => $u !== null);
```

```svelte
<!-- In components: $ prefix for auto-subscribe -->
{#if $isLoggedIn}<p>Welcome {$user.name}</p>{/if}
<button onclick={() => user.set(null)}>Logout</button>
```

**Recommendation:** Context + `$state` instead of Stores for new code.

---

## Template Syntax

### Expressions & Attributes

```svelte
<p>Hello {name}!</p>
<img src={url} alt={desc} />
<input {value} {disabled} />     <!-- Shorthand -->
<button {...props}>Click</button> <!-- Spread -->
```

### Events (Svelte 5 Syntax)

**IMPORTANT:** Svelte 5 uses `oneventname` (NOT `on:event` like Svelte 4!)

```svelte
<!-- DOM Events -->
<button onclick={() => count++}>Click</button>
<button onclick={handleClick}>Click</button>
<input oninput={(e) => value = e.target.value} />
<form onsubmit={handleSubmit}>...</form>

<!-- With preventDefault/stopPropagation -->
<button onclick={(e) => { e.preventDefault(); doSomething(); }}>Click</button>

<!-- Keyboard -->
<input onkeydown={(e) => e.key === 'Enter' && submit()} />

<!-- Mouse/Focus -->
<div onmouseenter={show} onmouseleave={hide}>Hover</div>
<input onfocus={onFocus} onblur={onBlur} />
```

**Svelte 4 → 5 Migration:**

```svelte
<!-- OLD --> <button on:click|preventDefault={fn}>
<!-- NEW --> <button onclick={(e) => { e.preventDefault(); fn(); }}>
```

**Component Events = Callback Props:**

```svelte
<!-- Child --> let { onSave } = $props();  <button onclick={onSave}>Save</button>
<!-- Parent --> <Child onSave={() => save()} />
```

### Class & Style

```svelte
<div class:active={isActive}>...</div>
<div class:active>...</div>  <!-- shorthand -->
<div style:color={textColor}>...</div>
```

---

## Control Flow

### {#if} / {#each} / {#await}

```svelte
{#if condition}<p>True</p>{:else if other}<p>Other</p>{:else}<p>False</p>{/if}

{#each items as item, i (item.id)}  <!-- ALWAYS use key! -->
  <p>{i}: {item.name}</p>
{:else}<p>No items</p>{/each}

{#await promise}<p>Loading...</p>{:then data}<p>{data}</p>{:catch e}<p>{e.message}</p>{/await}
```

### {#snippet} - Reusable Markup

```svelte
{#snippet card(title)}<div class="card"><h2>{title}</h2></div>{/snippet}
{@render card('Hello')}
<!-- In Components: <Table {data}>{#snippet row(item)}<td>{item.name}</td>{/snippet}</Table> -->
```

---

## Bindings

```svelte
<input bind:value={name} />
<input type="checkbox" bind:checked={ok} />
<select bind:value={selected}>...</select>
<div bind:this={element}></div>
<div bind:clientWidth={w}></div>

<!-- Group bindings -->
{#each opts as opt}
  <input type="checkbox" bind:group={selected} value={opt} />
{/each}
```

---

## SvelteKit

### Page Options (Rendering Control)

**Where to define:** `+page.ts`, `+page.server.ts`, `+layout.ts`, `+layout.server.ts`

```typescript
// src/routes/dashboard/+page.ts
export const ssr = true; // Server-Side Rendering (default)
export const csr = true; // Client-Side Rendering/Hydration (default)
export const prerender = false; // Static Generation at build time
export const trailingSlash = 'never'; // URL trailing slash handling
```

**Option Details:**

| Option          | Values                          | Default   | Description            |
| --------------- | ------------------------------- | --------- | ---------------------- |
| `ssr`           | `true`/`false`                  | `true`    | Server renders HTML    |
| `csr`           | `true`/`false`                  | `true`    | Client hydration + JS  |
| `prerender`     | `true`/`false`/`'auto'`         | `false`   | Build-time static HTML |
| `trailingSlash` | `'never'`/`'always'`/`'ignore'` | `'never'` | URL Format             |

**Strategic Combinations:**

| Scenario          | ssr     | csr     | prerender | Use Case                     |
| ----------------- | ------- | ------- | --------- | ---------------------------- |
| **Full SPA**      | `false` | `true`  | `false`   | Admin Panels, Real-time Apps |
| **Static Site**   | `true`  | `false` | `true`    | Docs, Blog (no JS!)          |
| **Dynamic + SEO** | `true`  | `true`  | `false`   | User-specific pages          |
| **Marketing**     | `true`  | `true`  | `true`    | Fast Landing Pages           |
| **Browser-only**  | `false` | `true`  | `false`   | Canvas, WebGL, localStorage  |

**Examples:**

```typescript
// Marketing Landing Page - fast, SEO-optimized
// src/routes/+page.ts
export const prerender = true;

// Dashboard - needs Auth, no prerender
// src/routes/dashboard/+page.ts
export const prerender = false;

// Canvas App - needs window/document
// src/routes/editor/+page.ts
export const ssr = false;  // No server rendering

// Blog Post - static, no JS needed
// src/routes/blog/[slug]/+page.ts
export const prerender = true;
export const csr = false;  // No JavaScript!

// Dynamic Prerendering
// src/routes/blog/[slug]/+page.server.ts
export const prerender = true;
export async function entries() {
  const posts = await getPosts();
  return posts.map(p => ({ slug: p.slug }));
}
```

**Inheritance:** Layout options inherit to all child routes (can be overridden).

### Project Structure

```
src/
├── lib/             # $lib alias
│   └── server/      # $lib/server (server-only)
├── routes/          # File-based routing
│   ├── +page.svelte
│   ├── +page.server.ts
│   ├── +page.ts
│   ├── +layout.svelte
│   ├── +error.svelte
│   └── api/+server.ts
├── hooks.server.ts
└── app.html
```

### Routing & Layouts

| Pattern                               | URL                   | Description                 |
| ------------------------------------- | --------------------- | --------------------------- |
| `routes/+page.svelte`                 | `/`                   | Home                        |
| `routes/about/+page.svelte`           | `/about`              | Static route                |
| `routes/blog/[slug]/+page.svelte`     | `/blog/:slug`         | Dynamic param               |
| `routes/[[lang]]/about/+page.svelte`  | `/about`, `/de/about` | Optional param              |
| `routes/[...path]/+page.svelte`       | `/*`                  | Rest/Catch-all              |
| `routes/(app)/dashboard/+page.svelte` | `/dashboard`          | Route group (URL unchanged) |

**+layout.svelte - Shared UI for all child routes:**

```svelte
<!-- routes/+layout.svelte -->
<script>
  let { children } = $props();  // Important: children prop!
</script>
<nav><a href="/">Home</a><a href="/about">About</a></nav>
<main>{@render children()}</main>  <!-- +page.svelte renders here -->
<footer>Copyright 2024</footer>
```

**Nested Layouts:**

```
routes/
├── +layout.svelte        ← Root Layout (Nav, Footer)
├── +page.svelte          ← / (Home)
├── (app)/                ← Route Group (no URL segment!)
│   ├── +layout.svelte    ← App Layout (Sidebar)
│   ├── dashboard/+page.svelte  ← /dashboard
│   └── settings/+page.svelte   ← /settings
└── (auth)/               ← Different Layout
    ├── +layout.svelte    ← Auth Layout (centered, no Nav)
    ├── login/+page.svelte      ← /login
    └── signup/+page.svelte     ← /signup
```

**Breaking out of layouts with @:**

```svelte
<!-- routes/(app)/embed/+page@.svelte → Uses ONLY root layout, ignores (app) layout -->
```

### Load Functions

**+page.server.ts (Server only):**

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const user = await fetch(`/api/users/${params.id}`).then((r) => r.json());
  return { user };
};
```

**+page.svelte:**

```svelte
<script>
  let { data } = $props();
</script>
<h1>{data.user.name}</h1>
```

### Form Actions

**+page.server.ts:**

```typescript
import { fail, redirect } from '@sveltejs/kit';

import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const email = form.get('email');
    if (!email) return fail(400, { missing: true });
    // Save...
    redirect(303, '/success');
  },
  delete: async ({ params }) => {
    await deleteItem(params.id);
    return { success: true };
  },
};
```

**+page.svelte:**

```svelte
<script>
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="email" />
  {#if form?.missing}<p class="error">Required</p>{/if}
  <button>Submit</button>
</form>

<form method="POST" action="?/delete" use:enhance>
  <button>Delete</button>
</form>
```

### API Endpoints (+server.ts) - RESTful APIs

**Structure for REST API:**

```
src/routes/api/
├── users/
│   ├── +server.ts           # GET /api/users, POST /api/users
│   └── [id]/
│       └── +server.ts       # GET/PUT/DELETE /api/users/:id
├── posts/
│   ├── +server.ts           # GET /api/posts, POST /api/posts
│   └── [id]/+server.ts      # GET/PUT/DELETE /api/posts/:id
└── health/
    └── +server.ts           # GET /api/health
```

**Complete CRUD Example:**

```typescript
// src/routes/api/users/+server.ts
import { db } from '$lib/server/db';

import { error, json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

// GET /api/users - List all users
export const GET: RequestHandler = async ({ url }) => {
  const limit = Number(url.searchParams.get('limit')) || 10;
  const offset = Number(url.searchParams.get('offset')) || 0;

  const users = await db.query('SELECT * FROM users LIMIT $1 OFFSET $2', [limit, offset]);
  const total = await db.query('SELECT COUNT(*) FROM users');

  return json({
    data: users,
    pagination: { limit, offset, total: total[0].count },
  });
};

// POST /api/users - Create new user
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  // Validation
  if (!body.email || !body.name) {
    error(400, { message: 'Email and name required' });
  }

  const user = await db.query('INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *', [body.email, body.name]);

  return json({ data: user[0] }, { status: 201 });
};
```

```typescript
// src/routes/api/users/[id]/+server.ts
import { db } from '$lib/server/db';

import { error, json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

// GET /api/users/:id - Single user
export const GET: RequestHandler = async ({ params }) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [params.id]);

  if (!user[0]) {
    error(404, { message: 'User not found' });
  }

  return json({ data: user[0] });
};

// PUT /api/users/:id - Update user
export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();

  const user = await db.query('UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *', [
    body.name,
    body.email,
    params.id,
  ]);

  if (!user[0]) {
    error(404, { message: 'User not found' });
  }

  return json({ data: user[0] });
};

// PATCH /api/users/:id - Partial update
export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  // Update only provided fields...
  return json({ data: updatedUser });
};

// DELETE /api/users/:id - Delete user
export const DELETE: RequestHandler = async ({ params }) => {
  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [params.id]);

  if (!result[0]) {
    error(404, { message: 'User not found' });
  }

  return new Response(null, { status: 204 }); // No Content
};
```

**Request/Response Helpers:**

```typescript
import { error, json, redirect, text } from '@sveltejs/kit';

// JSON Response
return json({ data }, { status: 200 });
return json({ data }, { status: 201 }); // Created

// Text Response
return text('OK');

// Error Response (throws exception)
error(400, { message: 'Bad Request' });
error(401, { message: 'Unauthorized' });
error(403, { message: 'Forbidden' });
error(404, { message: 'Not Found' });
error(500, { message: 'Internal Server Error' });

// Redirect
redirect(301, '/new-location'); // Permanent
redirect(302, '/temporary'); // Temporary
redirect(303, '/after-post'); // After POST (See Other)

// Custom Response
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'max-age=3600',
  },
});
```

**Auth-protected API:**

```typescript
// src/routes/api/protected/+server.ts
import { error, json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  // locals.user is set in hooks.server.ts
  if (!locals.user) {
    error(401, { message: 'Unauthorized' });
  }

  if (locals.user.role !== 'admin') {
    error(403, { message: 'Forbidden - Admin only' });
  }

  return json({ data: 'Secret admin data' });
};
```

**File Upload API:**

```typescript
// src/routes/api/upload/+server.ts
import { error, json } from '@sveltejs/kit';
import { writeFile } from 'fs/promises';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    error(400, { message: 'No file provided' });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name}`;
  await writeFile(`uploads/${filename}`, buffer);

  return json({ filename }, { status: 201 });
};
```

### Hooks (hooks.server.ts) - Middleware & Auth

**All Hook Types:**

```typescript
// src/hooks.server.ts
import type { Handle, HandleFetch, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// 1. HANDLE - Main middleware (runs on EVERY request)
const authHandle: Handle = async ({ event, resolve }) => {
  // Check auth token
  const token = event.cookies.get('auth_token');

  if (token) {
    try {
      const user = await verifyJWT(token);
      event.locals.user = user;
    } catch {
      // Token invalid - delete cookie
      event.cookies.delete('auth_token', { path: '/' });
    }
  }

  return resolve(event);
};

// 2. Route Protection Middleware
const protectRoutes: Handle = async ({ event, resolve }) => {
  const protectedPaths = ['/dashboard', '/settings', '/admin'];
  const isProtected = protectedPaths.some((p) => event.url.pathname.startsWith(p));

  if (isProtected && !event.locals.user) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(event.url.pathname);
    return new Response(null, {
      status: 303,
      headers: { Location: `/login?return=${returnUrl}` },
    });
  }

  // Admin-only routes
  if (event.url.pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  return resolve(event);
};

// 3. Logging Middleware
const loggingHandle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const response = await resolve(event);
  const duration = Date.now() - start;

  console.log(`${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms)`);

  return response;
};

// 4. CORS Middleware (for API)
const corsHandle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api')) {
    if (event.request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
  }

  const response = await resolve(event);

  if (event.url.pathname.startsWith('/api')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  return response;
};

// Combine hooks with sequence()
export const handle = sequence(loggingHandle, authHandle, corsHandle, protectRoutes);

// 5. HANDLE FETCH - Modify outgoing fetch() requests
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  // Add auth header to internal API requests
  if (request.url.startsWith('https://api.internal.com')) {
    request = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        Authorization: `Bearer ${event.locals.user?.token}`,
      },
    });
  }

  return fetch(request);
};

// 6. HANDLE SERVER ERROR - Error logging
export const handleError: HandleServerError = async ({ error, event }) => {
  const errorId = crypto.randomUUID();

  // Log error (Sentry, etc.)
  console.error(`Error ${errorId}:`, error);

  // Return user-friendly error message
  return {
    message: 'An error occurred',
    errorId,
  };
};
```

**app.d.ts - Locals Typing:**

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        role: 'user' | 'admin';
        token?: string;
      } | null;
    }

    interface Error {
      message: string;
      errorId?: string;
    }

    interface PageData {
      // Shared page data types
    }

    interface Platform {
      // Platform-specific types (Cloudflare, etc.)
    }
  }
}

export {};
```

### Navigation

```svelte
<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
</script>

<a href="/about">About</a>
<button onclick={() => goto('/dashboard')}>Go</button>
<button onclick={() => invalidateAll()}>Refresh</button>
```

---

## Quick Reference

### Runes

| Rune              | Purpose           |
| ----------------- | ----------------- |
| `$state(v)`       | Reactive state    |
| `$state.raw(v)`   | Non-deep reactive |
| `$derived(expr)`  | Computed value    |
| `$derived.by(fn)` | Complex computed  |
| `$effect(fn)`     | Side effects      |
| `$effect.pre(fn)` | Pre-DOM effect    |
| `$props()`        | Component props   |
| `$bindable()`     | Two-way prop      |
| `$inspect(v)`     | Debug (dev)       |

### SvelteKit Files

| File              | Purpose               |
| ----------------- | --------------------- |
| `+page.svelte`    | Page component        |
| `+page.ts`        | Universal load        |
| `+page.server.ts` | Server load + actions |
| `+layout.svelte`  | Layout wrapper        |
| `+error.svelte`   | Error boundary        |
| `+server.ts`      | API endpoint          |

### Common Mistakes

```svelte
<!-- BAD: Sync state in effect -->
$effect(() => { doubled = count * 2; });
<!-- GOOD --> let doubled = $derived(count * 2);

<!-- BAD: Missing key in each -->
{#each items as item}
<!-- GOOD --> {#each items as item (item.id)}

<!-- BAD: Mutating props -->
props.value = x;
<!-- GOOD --> let { value = $bindable() } = $props();
```

---

## Session-Expired Handling (Centralized)

**All session-expired logic is centralized in `$lib/utils/session-expired.ts`.** Never re-implement locally.

```typescript
// $lib/utils/session-expired.ts — THE single source of truth
import { checkSessionExpired, handleSessionExpired, isSessionExpiredError } from '$lib/utils/session-expired.js';

// Pattern 1: Quick check + redirect (most common)
} catch (err) {
  if (checkSessionExpired(err)) return;
  // handle other errors...
}

// Pattern 2: Separate check and redirect
if (isSessionExpiredError(err)) {
  handleSessionExpired();
  return;
}
```

**NEVER do this:**

```typescript
// WRONG -- local re-implementation
function isSessionExpiredError(err: unknown): boolean { ... }
function handleSessionExpired(): void { ... }

// WRONG -- direct goto
void goto(resolve('/login?session=expired', {}));

// WRONG -- inconsistent URL
goto('/login?expired=true');
```

**Enforced by:** Architectural test (`shared/src/architectural.test.ts`) — CI fails on local re-implementations.

---

**References:** [svelte.dev/docs](https://svelte.dev/docs) | [learn.svelte.dev](https://learn.svelte.dev)
