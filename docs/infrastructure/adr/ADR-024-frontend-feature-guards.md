# ADR-024: Frontend Addon Guards — Per-Tenant Addon Gating im Frontend

| Metadata                | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| **Status**              | Accepted                                                                 |
| **Date**                | 2026-02-15                                                               |
| **Decision Makers**     | SCS Technik                                                              |
| **Affected Components** | SvelteKit Frontend: Layout, Sidebar, Page Guards, api-client, Addon Page |

---

## Context

### Das Problem: Backend-Guards ohne Frontend-Gegenstück

Das Backend hat einen vollständigen `TenantAddonGuard` (APP_GUARD), der auf Controller-Ebene prüft, ob ein Addon für den Tenant aktiviert ist. Das Frontend hatte **keinerlei Addon-Awareness:**

1. **Sidebar zeigt ALLE Addons** — unabhängig davon, ob sie für den Tenant aktiviert sind
2. **Kein Page-Level Guard** — Direkt-Navigation zu `/blackboard` bei deaktiviertem Blackboard → leere Seite oder kryptischer Fehler
3. **403 Addon-Error = stiller Crash** — `api-client.ts` behandelte Addon-403 wie Auth-403, fand keinen "expired"/"invalid token" Match → generischer Error-Toast
4. **Keine Addon-spezifische Fehlerseite** — `/permission-denied` spricht nur von Berechtigungen, nicht von Addon-Aktivierung

### Anforderungen

- Sidebar zeigt nur aktivierte Addons (SSR, kein Flash)
- Direkt-Navigation zu deaktiviertem Addon → sauberer Redirect
- Client-Side API-403 bei deaktiviertem Addon → Redirect statt Error-Toast
- Core-Addons (Dashboard, Profil, Settings) dürfen NIE gefiltert werden
- Kein zusätzlicher Roundtrip (parallel fetch)
- Rekursive Submenu-Filterung (z.B. "LEAN-Management" verschwindet wenn kvp+surveys deaktiviert)

---

## Decision

### Utility-Funktion pro Page statt Layout-Gruppe

**Gewählt: Option B — `requireAddon()` Utility in jeder `+page.server.ts`**

```typescript
// frontend/src/lib/utils/addon-guard.ts
export function requireAddon(activeAddons: string[], addonCode: string): void {
  if (!activeAddons.includes(addonCode)) {
    redirect(302, `/addon-unavailable?addon=${addonCode}`);
  }
}
```

**Einbau (1-2 Zeilen pro Datei):**

```typescript
const { activeAddons } = await parent();
requireAddon(activeAddons, 'blackboard');
```

### Architektur-Entscheidungen

| Entscheidung          | Gewählt                                   | Begründung                                                                   |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| **Addon-Daten laden** | Parallel-Fetch in `+layout.server.ts`     | Kein Extra-Roundtrip, läuft parallel mit `/users/me` und `/dashboard/counts` |
| **Sidebar-Filterung** | `filterMenuByAddons()` in Layout          | SSR → kein Flash, rekursiv für Submenus                                      |
| **Page-Level Guard**  | Utility-Funktion pro `+page.server.ts`    | Addons liegen in verschiedenen Route-Gruppen                                 |
| **Fehlerseite**       | Eigene `/addon-unavailable` Seite         | Semantisch verschieden von `/permission-denied`                              |
| **Client-Side 403**   | Addon-403 VOR `handleAuthenticationError` | Erkennung via `message.includes('addon is not enabled')`                     |
| **Core-Addons**       | Explicit Allowlist (kein `addonCode`)     | Items ohne `addonCode` werden NIE gefiltert                                  |
| **Submenu-Filterung** | Rekursiv + leere Container entfernen      | `lean-management` ohne Kinder → verschwindet                                 |

### Security Layers (erweitert)

```
Layer 1: hooks.server.ts          → Authentication (Token valid?)
Layer 2: (app)/+layout.server.ts  → User Data Fetch + Addon Fetch (NEU)
Layer 3: Group Layout              → Role Authorization (ADR-012)
Layer 4: +page.server.ts          → Addon Authorization (NEU: requireAddon)
Layer 5: Sidebar Filter            → UX: Deaktivierte Addons unsichtbar (NEU)
Layer 6: api-client.ts            → Client-Side Addon-403 Redirect (NEU)
Layer 7: Backend API Guards        → TenantAddonGuard + PermissionGuard (DONE)
```

### Filter-Chain in `+layout.svelte`

```typescript
const menuItems = $derived(
  filterMenuByAddons(filterMenuByAccess(getMenuItemsForRole(currentRole), hasFullAccess), activeAddonsSet),
);
```

**Reihenfolge:** Rolle → Access → Addons

---

## Alternatives Considered

### Option A: Layout-Gruppe `(addon-gated)/`

Neue Route-Gruppe analog zu ADR-012 Pattern:

```
routes/(app)/(addon-gated)/
  +layout.server.ts  ← Addon-Check
  blackboard/
  calendar/
  chat/
  ...
```

| Pro                             | Contra                                                                |
| ------------------------------- | --------------------------------------------------------------------- |
| ADR-012 Pattern wiederverwendet | Verschiedene Addons = verschiedene Codes → 1 Guard pro Gruppe?        |
| Zentraler Guard                 | Addons liegen in `(shared)`, `(admin)`, `(root)` → Gruppe passt nicht |
| Weniger Dateien zu ändern       | Müsste bestehende Route-Gruppen-Struktur aufbrechen                   |

**Entscheidung:** Verworfen — Addons liegen verteilt über alle 3 bestehenden Route-Gruppen. Eine Layout-Gruppe würde die bestehende RBAC-Architektur (ADR-012) untergraben.

### Option C: Middleware in hooks.server.ts

Addon-Check direkt in hooks, analog zum alten ROUTE_PERMISSIONS Pattern:

| Pro                   | Contra                                                           |
| --------------------- | ---------------------------------------------------------------- |
| Zentraler Ort         | hooks.server.ts ist nur für Authentication (ADR-012 SRP-Prinzip) |
| Kein `parent()` nötig | Addon-Route-Mapping = Fail-Open (genau das Problem von ADR-012)  |
| Einfach               | Verstößt gegen die eigene ADR-012 Architektur                    |

**Entscheidung:** Verworfen — Wiederholt das Fail-Open Anti-Pattern das ADR-012 gelöst hat.

---

## Consequences

### Positive

1. **Defense in Depth** — 4 Frontend-Layers + Backend-Guard = Addon ist auf jeder Ebene geschützt
2. **SSR-first** — Addon-Daten serverseitig geladen, kein Sidebar-Flash
3. **Minimal-invasiv** — 1-2 Zeilen pro `+page.server.ts`, keine Architektur-Umbauten
4. **ADR-012 kompatibel** — Utility-Funktion arbeitet innerhalb der bestehenden Route-Gruppen
5. **Core-Addons sicher** — Explicit Allowlist: nur Items mit `addonCode` werden gefiltert
6. **Rekursive Submenus** — LEAN-Management verschwindet automatisch wenn alle Kinder deaktiviert
7. **57 Unit Tests** — `filterMenuByAddons()` (31) + `requireAddon()` (26) abgesichert

### Negative

1. **17 Dateien manuell geändert** — Jede Addon-Page braucht `requireAddon()` Aufruf
2. **Kein Real-Time Update** — Addon-Deaktivierung sichtbar erst nach Page-Reload
3. **String-basierte Addon-Erkennung** — `message.includes('addon is not enabled')` ist fragil

### Mitigations

| Problem                      | Mitigation                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| Vergessener `requireAddon()` | Backend-Guard fängt ab (Layer 7) + Sidebar versteckt Link (Layer 5)     |
| Kein Real-Time               | Backend-Guard blockt sofort, User sieht Error-Toast bei nächster Aktion |
| String-Matching fragil       | Backend-Message ist standardisiert, Test deckt Pattern ab               |

### Permission-Reset bei Addon-Deaktivierung

Wenn ein Addon deaktiviert wird (`AddonsService.deactivateAddon()`), werden **alle `user_addon_permissions`** für dieses Addon auf `can_read=false, can_write=false, can_delete=false` zurückgesetzt.

**Warum:** Verhindert "Magic Restore" — ohne Reset würden alte Permissions beim Re-Aktivieren eines Addons automatisch wiederhergestellt, ohne dass der Admin das bewusst entscheidet.

**Implementierung:**

```typescript
// In addons.service.ts → deactivateAddon()
await this.db.query(
  `UPDATE user_addon_permissions
   SET can_read = false, can_write = false, can_delete = false, updated_at = NOW()
   WHERE tenant_id = $1 AND addon_code = $2`,
  [tenantId, addonCode],
);
```

**Verhalten:**

- Addon deaktiviert → Permissions unsichtbar (Backend filtert) **UND** auf `false` resettet
- Addon re-aktiviert → Permissions sichtbar, aber alle `false` → Admin muss bewusst neu vergeben
- Rows werden **nicht gelöscht** (Soft Reset) — DB-Struktur bleibt intakt, Audit-Trail erhalten

---

## Betroffene Dateien

### Neu erstellt (5)

| Datei                                                         | Zweck                    |
| ------------------------------------------------------------- | ------------------------ |
| `frontend/src/lib/utils/addon-guard.ts`                       | `requireAddon()` Utility |
| `frontend/src/lib/utils/addon-guard.test.ts`                  | 26 Unit Tests            |
| `frontend/src/routes/(app)/addon-unavailable/+page.svelte`    | Addon-Unavailable-Seite  |
| `frontend/src/routes/(app)/addon-unavailable/+page.server.ts` | Server-Load              |
| `frontend/src/routes/(app)/_lib/navigation-config.test.ts`    | 31 Unit Tests            |

### Geändert (22)

| Datei                             | Änderung                                 |
| --------------------------------- | ---------------------------------------- |
| `(app)/+layout.server.ts`         | Parallel-Fetch `/addons/my-addons`       |
| `(app)/+layout.svelte`            | 3-stufige Filter-Chain                   |
| `(app)/_lib/navigation-config.ts` | `addonCode` + `filterMenuByAddons()`     |
| `lib/utils/api-client.ts`         | Addon-403 Handling                       |
| 17× Addon `+page.server.ts`       | `requireAddon()` Aufruf                  |
| `backend/.../addons.service.ts`   | Permission-Reset bei Addon-Deaktivierung |

---

## Verification

| Szenario                                     | Erwartet                               | Status |
| -------------------------------------------- | -------------------------------------- | ------ |
| Blackboard deaktiviert → Sidebar             | Blackboard-Item unsichtbar             | ✅     |
| Blackboard deaktiviert → URL direkt eingeben | Redirect `/addon-unavailable`          | ✅     |
| kvp+surveys deaktiviert → Sidebar            | LEAN-Management Container verschwindet | ✅     |
| Dashboard, Profil, Settings → immer sichtbar | Nie gefiltert (kein `addonCode`)       | ✅     |
| Client-Side API-Call → Addon-403             | Redirect `/addon-unavailable`          | ✅     |
| Auth-403 (expired token) → unverändert       | Session-Expired Handling               | ✅     |
| Root → /addons Admin-Seite                   | Immer erreichbar (Core-Admin)          | ✅     |
| 57 Unit Tests                                | Alle grün                              | ✅     |
| svelte-check                                 | 0 Errors                               | ✅     |

---

## References

- [ADR-012: Frontend Route Security Groups](./ADR-012-frontend-route-security-groups.md) — Blueprint für Fail-Closed RBAC
- [ADR-020: Per-User Addon Permissions](./ADR-020-per-user-feature-permissions.md) — "Unsubscribed addons produce no UI"
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) — 403 Response Format
- [Masterplan](../../FEAT_FRONTEND_ADDON_GUARDS_MASTERPLAN.md) — Execution Plan mit Phasen 1-4
