# KRITISCH: Role-Based Access Control (RBAC) Sicherheitslücke

> **Severity:** KRITISCH
> **Entdeckt:** 2026-01-13
> **Status:** OFFEN - Sofortige Behebung erforderlich

---

## Zusammenfassung

Ein **Employee kann jede Seite im System aufrufen** (z.B. `/root-dashboard`, `/manage-employees`, `/admin-dashboard`) durch einfaches Ändern der URL. Die Frontend-Middleware prüft NUR ob ein Token existiert, NICHT die Benutzerrolle.

### Beweis

```
1. Login als Employee → Redirect zu /employee-dashboard ✓
2. URL manuell ändern zu /root-dashboard
3. Seite wird geladen! ← SICHERHEITSLÜCKE
```

---

## Root Cause Analysis

### Aktuelle Architektur (FEHLERHAFT)

```
Browser Request → hooks.server.ts → (app)/+layout.server.ts → +page.server.ts
                       │                      │                      │
                       │                      │                      │
                  ❌ Kein Check          ✓ Token Check           ❌ Meist kein
                                         ❌ Kein Role Check         Role Check
```

### Dateien analysiert

| Datei                                | Auth Check | Role Check   | Problem                           |
| ------------------------------------ | ---------- | ------------ | --------------------------------- |
| `hooks.server.ts`                    | ❌         | ❌           | Nur Logging, Sentry, HTML-Minify  |
| `(app)/+layout.server.ts`            | ✅ Token   | ❌           | Lädt User, prüft aber keine Rolle |
| `root-dashboard/+page.server.ts`     | ✅ Token   | ❌           | **KRITISCH**                      |
| `admin-dashboard/+page.server.ts`    | ✅ Token   | ❌           | **KRITISCH**                      |
| `manage-employees/+page.server.ts`   | ✅ Token   | ❌           | **KRITISCH**                      |
| `manage-root/+page.server.ts`        | ✅ Token   | ❌           | **KRITISCH**                      |
| `manage-admins/+page.server.ts`      | ✅ Token   | ❌           | **KRITISCH**                      |
| `logs/+page.server.ts`               | ✅ Token   | ✅ root only | OK                                |
| `employee-dashboard/+page.server.ts` | ✅ Token   | ✅ alle      | OK                                |

### Betroffene Routes (Vollständige Liste)

**ROOT ONLY:**

- `/root-dashboard` ❌ KEIN CHECK
- `/manage-root` ❌ KEIN CHECK
- `/logs` ✅ Hat Check

**ADMIN + ROOT:**

- `/admin-dashboard` ❌ KEIN CHECK
- `/manage-employees` ❌ KEIN CHECK
- `/manage-admins` ❌ KEIN CHECK
- `/manage-teams` ❌ KEIN CHECK (vermutlich)
- `/manage-departments` ❌ KEIN CHECK (vermutlich)
- `/manage-areas` ❌ KEIN CHECK (vermutlich)
- `/manage-machines` ❌ KEIN CHECK (vermutlich)
- `/features` ❌ KEIN CHECK (vermutlich)
- `/survey-admin` ❌ KEIN CHECK (vermutlich)
- `/survey-results` ❌ KEIN CHECK (vermutlich)

**ALLE AUTHENTIFIZIERTEN:**

- `/employee-dashboard` ✅ Hat Check
- `/blackboard` - OK (alle Rollen)
- `/calendar` - OK (alle Rollen)
- `/chat` - OK (alle Rollen)
- `/documents-explorer` - OK (alle Rollen)
- `/kvp` - OK (alle Rollen)
- `/account-settings` - OK (alle Rollen)

---

## Lösungsvorschlag

### Option A: Zentrale Route Guards in `hooks.server.ts` (EMPFOHLEN)

**Vorteile:**

- Einzelner Ort für alle Berechtigungsprüfungen
- Konsistent, keine vergessenen Checks
- Einfach zu testen und zu auditen

**Implementierung:**

```typescript
// hooks.server.ts
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

/** Role hierarchy: root > admin > employee */
type UserRole = 'root' | 'admin' | 'employee';

/** Route → Required minimum role mapping */
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  // ROOT ONLY
  '/root-dashboard': ['root'],
  '/root-profile': ['root'],
  '/manage-root': ['root'],
  '/logs': ['root'],

  // ADMIN + ROOT
  '/admin-dashboard': ['admin', 'root'],
  '/admin-profile': ['admin', 'root'],
  '/manage-employees': ['admin', 'root'],
  '/manage-admins': ['admin', 'root'],
  '/manage-teams': ['admin', 'root'],
  '/manage-departments': ['admin', 'root'],
  '/manage-areas': ['admin', 'root'],
  '/manage-machines': ['admin', 'root'],
  '/features': ['admin', 'root'],
  '/survey-admin': ['admin', 'root'],
  '/survey-results': ['admin', 'root'],
  '/shifts': ['admin', 'root'],
  '/storage-upgrade': ['admin', 'root'],
  '/tenant-deletion-status': ['admin', 'root'],

  // ALL AUTHENTICATED (default - no entry needed)
  // '/employee-dashboard': ['employee', 'admin', 'root'],
  // '/blackboard': ['employee', 'admin', 'root'],
  // etc.
};

/** Public routes (no auth required) */
const PUBLIC_ROUTES = ['/login', '/signup', '/tenant-deletion-approve'];

/** API base for fetching user */
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/**
 * Role-based Access Control Hook
 */
const rbacHandle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return resolve(event);
  }

  // Skip non-page routes (API, assets, etc.)
  if (pathname.startsWith('/api/') || pathname.startsWith('/_app/') || pathname.startsWith('/favicon')) {
    return resolve(event);
  }

  // Get token from cookie
  const token = event.cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Check if route requires specific roles
  const requiredRoles = ROUTE_PERMISSIONS[pathname];

  // No specific requirement = allow all authenticated users
  if (!requiredRoles) {
    return resolve(event);
  }

  // Fetch user to check role
  try {
    const response = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      event.cookies.delete('accessToken', { path: '/' });
      redirect(302, '/login');
    }

    const userData = await response.json();
    const userRole = userData.data?.role ?? userData.role;

    // Store in locals for downstream use
    event.locals.user = userData.data ?? userData;

    // Check permission
    if (!requiredRoles.includes(userRole)) {
      // Redirect to permission denied page
      redirect(302, '/permission-denied');
    }
  } catch (err) {
    redirect(302, '/login');
  }

  return resolve(event);
};

export const handle = sequence(
  Sentry.sentryHandle(),
  rbacHandle, // ← NEU: RBAC vor allen anderen Hooks
  requestLoggingHandle,
  htmlMinificationHandle,
);
```

### Option B: Guards in Layout (weniger empfohlen)

Würde `(app)/+layout.server.ts` erweitern, hat aber Nachteile:

- Layout wird nach dem Request aufgerufen
- Weniger klar, wann Check passiert
- Kann nicht alle Routen-Patterns abdecken

### Option C: Per-Page Checks (NICHT empfohlen)

Aktueller Ansatz - jede Seite prüft selbst. Probleme:

- Inkonsistent (wie gesehen)
- Code-Duplikation
- Leicht zu vergessen
- Schwer zu auditen

---

## Zusätzlich: Permission Denied Page

Erstelle neue Route `/permission-denied`:

```svelte
<!-- frontend/src/routes/(app)/permission-denied/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';

  let { data } = $props();

  function goBack() {
    history.back();
  }

  function goHome() {
    // Redirect basierend auf Rolle
    const role = data.user?.role;
    if (role === 'root') goto('/root-dashboard');
    else if (role === 'admin') goto('/admin-dashboard');
    else goto('/employee-dashboard');
  }
</script>

<div class="permission-denied">
  <div class="card-glass">
    <div class="icon">🚫</div>
    <h1>Zugriff verweigert</h1>
    <p>Sie haben keine Berechtigung, diese Seite aufzurufen.</p>
    <div class="actions">
      <button class="btn-secondary" onclick={goBack}>Zurück</button>
      <button class="btn-primary" onclick={goHome}>Zur Startseite</button>
    </div>
  </div>
</div>

<style>
  .permission-denied {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
  }

  .card-glass {
    text-align: center;
    padding: 3rem;
    max-width: 400px;
  }

  .icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  h1 {
    color: var(--color-error);
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
</style>
```

---

## Implementierungs-Reihenfolge

### Phase 1: Sofort (Kritisch)

1. ✅ Erstelle `/permission-denied` Route
2. ✅ Implementiere `rbacHandle` in `hooks.server.ts`
3. ✅ Definiere `ROUTE_PERMISSIONS` Map
4. ✅ Teste alle betroffenen Routes manuell

### Phase 2: Bereinigung

1. Entferne redundante Role-Checks aus einzelnen `+page.server.ts`
2. Zentralisiere alle Berechtigungslogik
3. Füge Audit-Logging für Permission-Denied Events hinzu

### Phase 3: Testing

1. Schreibe E2E Tests für RBAC:
   - Employee → /root-dashboard → 302 /permission-denied
   - Admin → /root-dashboard → 302 /permission-denied
   - Root → /root-dashboard → 200 OK
2. Bruno API Tests für Backend-Guards (falls vorhanden)

---

## Backend-Abdeckung (Wichtig!)

**ACHTUNG:** Die Frontend-Guards sind nur die erste Verteidigungslinie!

Das Backend MUSS ebenfalls Role-Checks haben für:

- `GET /root/dashboard` - nur root
- `GET /users?role=root` - nur root
- `POST /users` (mit role=admin) - nur root
- etc.

Prüfe: `backend/src/nest/*/guards/` und `*.controller.ts` für `@Roles()` Decorator.

---

## Checkliste vor Go-Live

- [ ] `hooks.server.ts` mit RBAC implementiert
- [ ] `/permission-denied` Route erstellt
- [ ] Alle 20+ Routes in `ROUTE_PERMISSIONS` Map
- [ ] Manueller Test: Employee → /root-dashboard → Permission Denied
- [ ] Manueller Test: Admin → /root-dashboard → Permission Denied
- [ ] Manueller Test: Root → /root-dashboard → OK
- [ ] Backend Guards verifiziert
- [ ] Code Review
- [ ] E2E Tests bestanden

---

## Risiko-Bewertung

| Ohne Fix                                       | Mit Fix                |
| ---------------------------------------------- | ---------------------- |
| Employee kann Admin-Funktionen sehen           | Klare Rollentrennung   |
| Daten-Leak möglich (wenn API auch ungeschützt) | Defense-in-Depth       |
| Compliance-Verstoß (GDPR?)                     | Audit-fähig            |
| Vertrauensverlust                              | Professionelles System |

---

**Priorität: P0 - Kritisch**
**Geschätzter Aufwand: 2-3 Stunden**
**Verantwortlich: [TBD]**
