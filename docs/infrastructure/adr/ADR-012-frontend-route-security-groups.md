# ADR-012: Frontend Route Security - Fail-Closed RBAC via Route Groups

| Metadata                | Value                                                   |
| ----------------------- | ------------------------------------------------------- |
| **Status**              | Accepted                                                |
| **Date**                | 2026-01-26                                              |
| **Decision Makers**     | SCS Technik                                             |
| **Affected Components** | SvelteKit Frontend, hooks.server.ts, Route Architecture |

---

## Context

### Das Problem: Fail-Open Route Security

Die bisherige RBAC-Implementierung in `hooks.server.ts` verwendet eine `ROUTE_PERMISSIONS`-Map:

```typescript
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/root-dashboard': ['root'],
  '/admin-dashboard': ['admin', 'root'],
  '/employee-dashboard': ['employee', 'admin', 'root'],
  // ...
};
```

**Kommentar im Code:** "Routes not listed here allow ALL authenticated users."

Das ist ein **Fail-Open Design**. Wenn ein Entwickler eine neue Route erstellt und vergisst, sie in `ROUTE_PERMISSIONS` einzutragen, ist diese Route für **jeden authentifizierten User** zugänglich — inklusive Employees, die Admin-Seiten sehen können.

### Konkretes Risiko

1. Entwickler erstellt `/manage-salaries/+page.svelte` (Admin-only)
2. Vergisst `ROUTE_PERMISSIONS`-Eintrag
3. Employee navigiert zu `/manage-salaries` → **Seite lädt**
4. Backend-API blockt zwar Daten (Guards), aber die UI selbst ist sichtbar
5. Information Leak: Feature-Existenz, Formular-Struktur, Labels

### Anforderungen

- **Fail-Closed by Default** — Neue Routes sind geschützt ohne manuellen Eintrag
- **Clean Architecture** — Trennung von Authentication (Wer bist du?) und Authorization (Was darfst du?)
- **Framework-Idiomatisch** — SvelteKit-native Lösung statt Custom-Middleware
- **FAST PATH erhalten** — Performance-Optimierung (50-80ms) aus `locals.user` Reuse
- **Zero URL Changes** — Bestehende URLs dürfen sich nicht ändern

---

## Decision

### SvelteKit Route Groups für strukturelle RBAC

Wir ersetzen die zentrale `ROUTE_PERMISSIONS`-Map durch **SvelteKit Route Groups** mit eigenen `+layout.server.ts` Dateien:

```
routes/(app)/
├── +layout.svelte           ← App Shell (Header, Sidebar, Footer) — UNVERÄNDERT
├── +layout.server.ts        ← User Data Fetch + FAST PATH — UNVERÄNDERT
├── permission-denied/       ← Bleibt direkt (alle Auth-User)
├── _lib/                    ← Shared Utilities — UNVERÄNDERT
│
├── (root)/                  ← 🔴 ROOT ONLY
│   ├── +layout.server.ts   ← if role !== 'root' → redirect
│   ├── root-dashboard/
│   ├── root-profile/
│   ├── manage-root/
│   └── logs/
│
├── (admin)/                 ← 🟡 ADMIN + ROOT
│   ├── +layout.server.ts   ← if role not in ['admin', 'root'] → redirect
│   ├── admin-dashboard/
│   ├── manage-employees/
│   ├── features/
│   └── ... (13 Routes)
│
└── (shared)/                ← 🟢 ALL AUTHENTICATED
    ├── +layout.server.ts   ← if !user → redirect (fail-closed auth check)
    ├── employee-dashboard/
    ├── chat/
    ├── blackboard/
    └── ... (11 Routes)
```

### Architektur-Entscheidungen

| Entscheidung               | Gewählt                 | Begründung                                      |
| -------------------------- | ----------------------- | ----------------------------------------------- |
| **Security-Mechanismus**   | SvelteKit Route Groups  | Strukturelle Sicherheit, Framework-nativ        |
| **Default Policy**         | Fail-Closed             | Neue Route MUSS in Gruppe → automatisch sicher  |
| **hooks.server.ts Rolle**  | Nur Authentication      | SRP: Token Check + User Fetch in locals.user    |
| **Authorization Location** | Group +layout.server.ts | Jede Gruppe prüft eigene Rolle                  |
| **App Shell Sharing**      | Layout-Vererbung        | (app)/+layout.svelte gilt für alle Gruppen      |
| **FAST PATH**              | Beibehalten             | hooks fetcht User → locals.user → Layout reused |

### Sicherheits-Layer (Defense in Depth)

```
Layer 1: hooks.server.ts      → Authentication (Token gültig?)
Layer 2: (app)/+layout.server → User Data Fetch (Wer bist du?)
Layer 3: Group Layout         → Authorization (Darfst du das?)
Layer 4: Backend API Guards   → API Authorization (NestJS @Roles())
```

### URL-Transparenz

SvelteKit Route Groups in Klammern `(root)`, `(admin)`, `(shared)` erscheinen **nicht** in der URL. `/admin-dashboard` bleibt `/admin-dashboard`.

---

## Alternatives Considered

### 1. Convention-Based Prefix + Default-Deny (Ansatz 2)

Rollen aus URL-Prefix ableiten (`/admin-*` → admin, `/root-*` → root):

```typescript
if (pathname.startsWith('/admin-')) return ['admin', 'root'];
if (pathname.startsWith('/manage-')) return ['admin', 'root'];
```

| Pro                     | Contra                                            |
| ----------------------- | ------------------------------------------------- |
| Keine Datei-Moves nötig | 13 von 30 Routes passen in kein Prefix-Schema     |
| Eine Datei zu pflegen   | SHARED_ROUTES Liste = weiterhin manuelle Pflege   |
| Schnell implementierbar | String-Matching ist fragil                        |
|                         | Naming Convention muss dokumentiert werden        |
|                         | Sicherheit hängt an Code-Logik, nicht Architektur |
|                         | Anti-Pattern: hooks.server.ts als God Object      |

**Entscheidung:** Abgelehnt — Nur 17 von 30 Routes passen in ein Prefix-Schema. Der Rest braucht manuelle Listen, was das gleiche Fail-Open-Problem wiederholt.

### 2. Status Quo + Default-Deny Toggle

Nur Zeile 204-206 in hooks.server.ts umdrehen (null → redirect statt pass-through):

| Pro                | Contra                                       |
| ------------------ | -------------------------------------------- |
| Ein Einzeiler      | Weiterhin manuelle ROUTE_PERMISSIONS-Pflege  |
| Sofort fail-closed | Jede neue Route braucht Map-Eintrag          |
| Kein Refactoring   | SRP-Verletzung: hooks = AuthN + AuthZ + mehr |
|                    | Nicht selbstdokumentierend                   |

**Entscheidung:** Abgelehnt — Quick Fix, nicht nachhaltig. Adressiert Symptom, nicht Ursache.

---

## Consequences

### Positive

1. **Fail-Closed by Architecture** — Neue Route MUSS in Gruppe → automatisch geschützt
2. **Selbstdokumentierend** — `ls routes/(app)/(admin)/` zeigt alle Admin-Routes
3. **Code Review sicher** — Falsche Gruppe = sichtbar im Git Diff
4. **SRP** — hooks = Authentication, Layout = Authorization
5. **Framework-Nativ** — SvelteKit Route Groups designed für genau diesen Use Case
6. **Zero URL Changes** — Keine Breaking Changes für Frontend/Bookmarks
7. **FAST PATH erhalten** — Performance-Optimierung bleibt intakt
8. **Onboarding** — "Admin-Seite? → Ordner (admin)" statt "Checke ROUTE_PERMISSIONS"

### Negative

1. **28 Verzeichnisse zu verschieben** — Einmaliger Refactoring-Aufwand
2. **33 CSS-Import-Pfade zu updaten** — Relative Pfade werden durch tiefere Verschachtelung länger
3. **permission-denied als Sonderfall** — Bleibt direkt unter (app), nicht in einer Gruppe

### Mitigations

| Problem                   | Mitigation                                                  |
| ------------------------- | ----------------------------------------------------------- |
| CSS-Import-Breakage       | Batch find-and-replace, visueller Check auf allen Routes    |
| Vergessene Route in (app) | Code Review Regel: Keine Pages direkt unter (app)/          |
| Relative Import-Pfade     | Zukünftig: `$styles` Vite-Alias als Verbesserung evaluieren |

---

## Implementation Details

### Group Layout Template

```typescript
// (app)/(admin)/+layout.server.ts
import { createLogger } from '$lib/utils/logger';

import { redirect } from '@sveltejs/kit';

import type { LayoutServerLoad } from './$types';

const log = createLogger('AdminGroupLayout');
const ALLOWED_ROLES: ReadonlySet<string> = new Set(['admin', 'root']);

export const load: LayoutServerLoad = async ({ parent, url }) => {
  const { user } = await parent();

  if (user === null || user === undefined) {
    redirect(302, '/login');
  }

  if (!ALLOWED_ROLES.has(user.role)) {
    log.warn({ pathname: url.pathname, userRole: user.role }, `RBAC(admin): Access denied`);
    redirect(302, '/permission-denied');
  }

  return {};
};
```

### hooks.server.ts Vereinfachung

```
VORHER: Token Check → User Fetch → Role Check (ROUTE_PERMISSIONS)
NACHHER: Token Check → User Fetch → locals.user setzen (fertig)
```

Role Check entfällt komplett — wird durch Group Layouts übernommen.

### Dateien

| Erstellt                           | Zweck       |
| ---------------------------------- | ----------- |
| `(app)/(root)/+layout.server.ts`   | Root Guard  |
| `(app)/(admin)/+layout.server.ts`  | Admin Guard |
| `(app)/(shared)/+layout.server.ts` | Auth Guard  |

| Modifiziert                         | Änderung     |
| ----------------------------------- | ------------ |
| `hooks.server.ts`                   | Auth-Only    |
| 28x `+page.svelte`                  | CSS-Pfade    |
| `docs/infrastructure/adr/README.md` | Index-Update |

---

## Verification

| Szenario                              | Erwartet                        | Status |
| ------------------------------------- | ------------------------------- | ------ |
| Employee → /admin-dashboard           | Redirect /permission-denied     | ☐      |
| Employee → /root-dashboard            | Redirect /permission-denied     | ☐      |
| Admin → /admin-dashboard              | Zugriff erlaubt                 | ☐      |
| Admin → /root-dashboard               | Redirect /permission-denied     | ☐      |
| Root → alle Routes                    | Zugriff erlaubt                 | ☐      |
| Employee → /chat, /blackboard         | Zugriff erlaubt                 | ☐      |
| Neue Route in (admin)/ ohne Map-Entry | Automatisch admin-only          | ☐      |
| URLs unverändert                      | /admin-dashboard (kein /admin/) | ☐      |
| FAST PATH in Server-Logs              | ⚡ FAST PATH Meldung            | ☐      |
| CSS korrekt geladen                   | Visueller Check                 | ☐      |
| pnpm run check                        | 0 Errors                        | ☐      |
| pnpm run build                        | Success                         | ☐      |

---

## References

- [Implementation Plan](./ADR-012-implementation-plan.md) — Detaillierter Schritt-für-Schritt Plan
- [SvelteKit Route Groups](https://svelte.dev/docs/kit/advanced-routing#Advanced-layouts-Group)
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — Backend Auth
- [ADR-010: User Role Assignment](./ADR-010-user-role-assignment-permissions.md) — Role System
- [OWASP Access Control](https://owasp.org/www-community/Access_Control) — Fail-Closed Principle
- [adr.github.io](https://adr.github.io/) — ADR Best Practices
