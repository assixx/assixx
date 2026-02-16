# ADR-024: Frontend Feature Guards — Per-Tenant Feature Gating im Frontend

| Metadata                | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                   |
| **Date**                | 2026-02-15                                                                 |
| **Decision Makers**     | SCS Technik                                                                |
| **Affected Components** | SvelteKit Frontend: Layout, Sidebar, Page Guards, api-client, Feature Page |

---

## Context

### Das Problem: Backend-Guards ohne Frontend-Gegenstück

Das Backend hat einen vollständigen `TenantFeatureGuard` (APP_GUARD), der auf Controller-Ebene prüft, ob ein Feature für den Tenant aktiviert ist. Das Frontend hatte **keinerlei Feature-Awareness:**

1. **Sidebar zeigt ALLE Features** — unabhängig davon, ob sie für den Tenant aktiviert sind
2. **Kein Page-Level Guard** — Direkt-Navigation zu `/blackboard` bei deaktiviertem Blackboard → leere Seite oder kryptischer Fehler
3. **403 Feature-Error = stiller Crash** — `api-client.ts` behandelte Feature-403 wie Auth-403, fand keinen "expired"/"invalid token" Match → generischer Error-Toast
4. **Keine Feature-spezifische Fehlerseite** — `/permission-denied` spricht nur von Berechtigungen, nicht von Feature-Aktivierung

### Anforderungen

- Sidebar zeigt nur aktivierte Features (SSR, kein Flash)
- Direkt-Navigation zu deaktiviertem Feature → sauberer Redirect
- Client-Side API-403 bei deaktiviertem Feature → Redirect statt Error-Toast
- Core-Features (Dashboard, Profil, Settings) dürfen NIE gefiltert werden
- Kein zusätzlicher Roundtrip (parallel fetch)
- Rekursive Submenu-Filterung (z.B. "LEAN-Management" verschwindet wenn kvp+surveys deaktiviert)

---

## Decision

### Utility-Funktion pro Page statt Layout-Gruppe

**Gewählt: Option B — `requireFeature()` Utility in jeder `+page.server.ts`**

```typescript
// frontend/src/lib/utils/feature-guard.ts
export function requireFeature(activeFeatures: string[], featureCode: string): void {
  if (!activeFeatures.includes(featureCode)) {
    redirect(302, `/feature-unavailable?feature=${featureCode}`);
  }
}
```

**Einbau (1-2 Zeilen pro Datei):**

```typescript
const { activeFeatures } = await parent();
requireFeature(activeFeatures, 'blackboard');
```

### Architektur-Entscheidungen

| Entscheidung            | Gewählt                                     | Begründung                                                                   |
| ----------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| **Feature-Daten laden** | Parallel-Fetch in `+layout.server.ts`       | Kein Extra-Roundtrip, läuft parallel mit `/users/me` und `/dashboard/counts` |
| **Sidebar-Filterung**   | `filterMenuByFeatures()` in Layout          | SSR → kein Flash, rekursiv für Submenus                                      |
| **Page-Level Guard**    | Utility-Funktion pro `+page.server.ts`      | Features liegen in verschiedenen Route-Gruppen                               |
| **Fehlerseite**         | Eigene `/feature-unavailable` Seite         | Semantisch verschieden von `/permission-denied`                              |
| **Client-Side 403**     | Feature-403 VOR `handleAuthenticationError` | Erkennung via `message.includes('feature is not enabled')`                   |
| **Core-Features**       | Explicit Allowlist (kein `featureCode`)     | Items ohne `featureCode` werden NIE gefiltert                                |
| **Submenu-Filterung**   | Rekursiv + leere Container entfernen        | `lean-management` ohne Kinder → verschwindet                                 |

### Security Layers (erweitert)

```
Layer 1: hooks.server.ts          → Authentication (Token valid?)
Layer 2: (app)/+layout.server.ts  → User Data Fetch + Feature Fetch (NEU)
Layer 3: Group Layout              → Role Authorization (ADR-012)
Layer 4: +page.server.ts          → Feature Authorization (NEU: requireFeature)
Layer 5: Sidebar Filter            → UX: Deaktivierte Features unsichtbar (NEU)
Layer 6: api-client.ts            → Client-Side Feature-403 Redirect (NEU)
Layer 7: Backend API Guards        → TenantFeatureGuard + PermissionGuard (DONE)
```

### Filter-Chain in `+layout.svelte`

```typescript
const menuItems = $derived(
  filterMenuByFeatures(filterMenuByAccess(getMenuItemsForRole(currentRole), hasFullAccess), activeFeaturesSet),
);
```

**Reihenfolge:** Rolle → Access → Features

---

## Alternatives Considered

### Option A: Layout-Gruppe `(feature-gated)/`

Neue Route-Gruppe analog zu ADR-012 Pattern:

```
routes/(app)/(feature-gated)/
  +layout.server.ts  ← Feature-Check
  blackboard/
  calendar/
  chat/
  ...
```

| Pro                             | Contra                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| ADR-012 Pattern wiederverwendet | Verschiedene Features = verschiedene Codes → 1 Guard pro Gruppe?        |
| Zentraler Guard                 | Features liegen in `(shared)`, `(admin)`, `(root)` → Gruppe passt nicht |
| Weniger Dateien zu ändern       | Müsste bestehende Route-Gruppen-Struktur aufbrechen                     |

**Entscheidung:** Verworfen — Features liegen verteilt über alle 3 bestehenden Route-Gruppen. Eine Layout-Gruppe würde die bestehende RBAC-Architektur (ADR-012) untergraben.

### Option C: Middleware in hooks.server.ts

Feature-Check direkt in hooks, analog zum alten ROUTE_PERMISSIONS Pattern:

| Pro                   | Contra                                                            |
| --------------------- | ----------------------------------------------------------------- |
| Zentraler Ort         | hooks.server.ts ist nur für Authentication (ADR-012 SRP-Prinzip)  |
| Kein `parent()` nötig | Feature-Route-Mapping = Fail-Open (genau das Problem von ADR-012) |
| Einfach               | Verstößt gegen die eigene ADR-012 Architektur                     |

**Entscheidung:** Verworfen — Wiederholt das Fail-Open Anti-Pattern das ADR-012 gelöst hat.

---

## Consequences

### Positive

1. **Defense in Depth** — 4 Frontend-Layers + Backend-Guard = Feature ist auf jeder Ebene geschützt
2. **SSR-first** — Feature-Daten serverseitig geladen, kein Sidebar-Flash
3. **Minimal-invasiv** — 1-2 Zeilen pro `+page.server.ts`, keine Architektur-Umbauten
4. **ADR-012 kompatibel** — Utility-Funktion arbeitet innerhalb der bestehenden Route-Gruppen
5. **Core-Features sicher** — Explicit Allowlist: nur Items mit `featureCode` werden gefiltert
6. **Rekursive Submenus** — LEAN-Management verschwindet automatisch wenn alle Kinder deaktiviert
7. **57 Unit Tests** — `filterMenuByFeatures()` (31) + `requireFeature()` (26) abgesichert

### Negative

1. **17 Dateien manuell geändert** — Jede Feature-Page braucht `requireFeature()` Aufruf
2. **Kein Real-Time Update** — Feature-Deaktivierung sichtbar erst nach Page-Reload
3. **String-basierte Feature-Erkennung** — `message.includes('feature is not enabled')` ist fragil

### Mitigations

| Problem                        | Mitigation                                                              |
| ------------------------------ | ----------------------------------------------------------------------- |
| Vergessener `requireFeature()` | Backend-Guard fängt ab (Layer 7) + Sidebar versteckt Link (Layer 5)     |
| Kein Real-Time                 | Backend-Guard blockt sofort, User sieht Error-Toast bei nächster Aktion |
| String-Matching fragil         | Backend-Message ist standardisiert, Test deckt Pattern ab               |

### Permission-Reset bei Feature-Deaktivierung

Wenn ein Feature deaktiviert wird (`FeaturesService.deactivateFeature()`), werden **alle `user_feature_permissions`** für dieses Feature auf `can_read=false, can_write=false, can_delete=false` zurückgesetzt.

**Warum:** Verhindert "Magic Restore" — ohne Reset würden alte Permissions beim Re-Aktivieren eines Features automatisch wiederhergestellt, ohne dass der Admin das bewusst entscheidet.

**Implementierung:**

```typescript
// In features.service.ts → deactivateFeature()
await this.db.query(
  `UPDATE user_feature_permissions
   SET can_read = false, can_write = false, can_delete = false, updated_at = NOW()
   WHERE tenant_id = $1 AND feature_code = $2`,
  [tenantId, featureCode],
);
```

**Verhalten:**

- Feature deaktiviert → Permissions unsichtbar (Backend filtert) **UND** auf `false` resettet
- Feature re-aktiviert → Permissions sichtbar, aber alle `false` → Admin muss bewusst neu vergeben
- Rows werden **nicht gelöscht** (Soft Reset) — DB-Struktur bleibt intakt, Audit-Trail erhalten

---

## Betroffene Dateien

### Neu erstellt (5)

| Datei                                                           | Zweck                      |
| --------------------------------------------------------------- | -------------------------- |
| `frontend/src/lib/utils/feature-guard.ts`                       | `requireFeature()` Utility |
| `frontend/src/lib/utils/feature-guard.test.ts`                  | 26 Unit Tests              |
| `frontend/src/routes/(app)/feature-unavailable/+page.svelte`    | Feature-Unavailable-Seite  |
| `frontend/src/routes/(app)/feature-unavailable/+page.server.ts` | Server-Load                |
| `frontend/src/routes/(app)/_lib/navigation-config.test.ts`      | 31 Unit Tests              |

### Geändert (22)

| Datei                             | Änderung                                   |
| --------------------------------- | ------------------------------------------ |
| `(app)/+layout.server.ts`         | Parallel-Fetch `/features/my-features`     |
| `(app)/+layout.svelte`            | 3-stufige Filter-Chain                     |
| `(app)/_lib/navigation-config.ts` | `featureCode` + `filterMenuByFeatures()`   |
| `lib/utils/api-client.ts`         | Feature-403 Handling                       |
| 17× Feature `+page.server.ts`     | `requireFeature()` Aufruf                  |
| `backend/.../features.service.ts` | Permission-Reset bei Feature-Deaktivierung |

---

## Verification

| Szenario                                     | Erwartet                               | Status |
| -------------------------------------------- | -------------------------------------- | ------ |
| Blackboard deaktiviert → Sidebar             | Blackboard-Item unsichtbar             | ✅     |
| Blackboard deaktiviert → URL direkt eingeben | Redirect `/feature-unavailable`        | ✅     |
| kvp+surveys deaktiviert → Sidebar            | LEAN-Management Container verschwindet | ✅     |
| Dashboard, Profil, Settings → immer sichtbar | Nie gefiltert (kein `featureCode`)     | ✅     |
| Client-Side API-Call → Feature-403           | Redirect `/feature-unavailable`        | ✅     |
| Auth-403 (expired token) → unverändert       | Session-Expired Handling               | ✅     |
| Root → /features Admin-Seite                 | Immer erreichbar (Core-Admin)          | ✅     |
| 57 Unit Tests                                | Alle grün                              | ✅     |
| svelte-check                                 | 0 Errors                               | ✅     |

---

## References

- [ADR-012: Frontend Route Security Groups](./ADR-012-frontend-route-security-groups.md) — Blueprint für Fail-Closed RBAC
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — "Unsubscribed features produce no UI"
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) — 403 Response Format
- [Masterplan](../../FEAT_FRONTEND_FEATURE_GUARDS_MASTERPLAN.md) — Execution Plan mit Phasen 1-4
