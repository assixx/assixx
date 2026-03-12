# FEAT: Frontend Addon Guards — Execution Masterplan

> **Created:** 2026-02-15
> **Version:** 2.0.0 (Feature Complete)
> **Status:** DONE ✅ — Alle 5 Phasen abgeschlossen
> **Branch:** `todo` (aktueller Branch)
> **Context:** Backend TenantAddonGuard bereits implementiert (Session 1-2)
> **Estimated Sessions:** 5
> **Actual Sessions:** 5 / 5

---

## Changelog

| Version | Datum      | Änderung                                                                                |
| ------- | ---------- | --------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-02-15 | Initial Draft — Phasen 1-3 geplant (rein Frontend-Feat.)                                |
| 0.2.0   | 2026-02-15 | Double-Check: Exakte Dateiliste (16), ADR-Referenzen, 403-Fix                           |
| 1.0.0   | 2026-02-15 | Phase 1 DONE: Sidebar Feature-Filterung (SSR), manuell getestet                         |
| 1.1.0   | 2026-02-15 | Phase 2 DONE: Page-Level Guards (17 Dateien) + 403-Handling + /feature-unavailable      |
| 1.2.0   | 2026-02-15 | ESLint-Fix: `?? []` entfernt (10×), `features/+page.svelte` ternary→`??` (2×)           |
| 1.3.0   | 2026-02-15 | Phase 3 Tests: 31 Tests navigation-config + 26 Tests addon-guard = 57 neue Tests        |
| 1.4.0   | 2026-02-15 | Phase 4: Features Page komplett modernisiert (Design System, Dark/Light, Confirm Modal) |
| 2.0.0   | 2026-02-15 | Feature COMPLETE: ADR-024 + FEATURES.md + DAILY-PROGRESS.md — alle 5 Phasen done        |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## ADR-Referenzen

| ADR     | Titel                           | Relevanz                                                                                                 |
| ------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ADR-012 | Frontend Route Security Groups  | **Blueprint:** Fail-Closed RBAC via SvelteKit Route Groups — unser Feature-Guard folgt demselben Muster  |
| ADR-020 | Per-User Feature Permissions    | **Bestätigt:** "Unsubscribed features produce **no UI**" — Sidebar-Filterung ist architektonisch gewollt |
| ADR-007 | API Response Standardization    | **403 Format:** `{ success: false, error: { code: "FORBIDDEN", message: "..." } }`                       |
| ADR-005 | Authentication Strategy         | **Kontext:** JWT-Guard liefert User-Daten die wir im Layout verwenden                                    |
| ADR-019 | Multi-Tenant RLS Data Isolation | **Kontext:** Backend-Sicherheit, Features-Query ist RLS-geschützt                                        |

### Security Layers (Defense in Depth) — erweitert um Feature-Layer

```
Layer 1: hooks.server.ts          → Authentication (Token valid?)
Layer 2: (app)/+layout.server.ts  → User Data Fetch + Feature Fetch (NEU)
Layer 3: Group Layout              → Role Authorization (ADR-012)
Layer 4: +page.server.ts          → Feature Authorization (NEU: requireAddon)
Layer 5: Sidebar Filter            → UX: Deaktivierte Features unsichtbar (NEU)
Layer 6: api-client.ts            → Client-Side Feature-403 Redirect (NEU)
Layer 7: Backend API Guards        → TenantAddonGuard + PermissionGuard (DONE)
```

Layers 2, 4, 5, 6 sind das, was dieser Masterplan implementiert.

---

## Kontext: Was existiert bereits?

### Backend (FERTIG — vorherige Sessions)

| Komponente                  | Status | Beschreibung                                                         |
| --------------------------- | ------ | -------------------------------------------------------------------- |
| `TenantAddonGuard`          | DONE   | Globaler APP_GUARD, prüft `@RequireAddon()` Decorator                |
| `@RequireAddon('code')`     | DONE   | Decorator auf allen 8 Feature-Controllern + 1 Rotation-Controller    |
| `FeatureCheckService`       | DONE   | Prüft `tenant_addons` Tabelle (is_active + expires_at)               |
| `GET /features/my-features` | DONE   | Gibt alle Features mit Tenant-Status zurück (code, status, isActive) |
| Unit Tests (52 Tests)       | DONE   | TenantAddonGuard (16) + VacationController (36)                      |
| Guard Reihenfolge           | DONE   | JwtAuth → Roles → **TenantFeature** → Permission                     |

### Frontend (GELÖST — Phase 1+2 implementiert)

| Problem                               | Impact                                                                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar zeigt ALLE Features           | User klickt auf deaktiviertes Feature → leere Seite oder kryptischer Fehler                                                                                                                    |
| Kein Feature-Check im Layout          | `+layout.server.ts` fetched NICHT `/features/my-features`                                                                                                                                      |
| Kein Page-Level Guard                 | `+page.server.ts` Dateien prüfen Feature-Aktivierung nicht                                                                                                                                     |
| 403 Feature-Error → stiller Crash     | `api-client.ts` Z.437: `403 → handleAuthenticationError()` prüft nur "expired"/"invalid token" → trifft nicht zu → `handleV2Response()` wirft generischen `ApiError` → kein Redirect, keine UX |
| Keine Feature-spezifische Fehlerseite | `/permission-denied` existiert, aber spricht nur von "Berechtigung"                                                                                                                            |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Backend TenantAddonGuard deployed und getestet (DONE)
- [ ] `GET /features/my-features` Endpoint erreichbar
- [ ] Mindestens 1 Test-Tenant mit aktivierten UND deaktivierten Features
- [ ] Bestehende Frontend-Tests laufen durch

### 0.2 Risk Register

| #   | Risiko                                                      | Impact  | Wahrscheinlichkeit | Mitigation                                                                               | Verifikation                                                             |
| --- | ----------------------------------------------------------- | ------- | ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R1  | Core-Features (Dashboard, Profil) versehentlich versteckt   | Hoch    | Mittel             | Explicit Allowlist: Nur die 8 bekannten Feature-Codes filtern, Rest passiert immer durch | Unit Test: NavItem ohne `addonCode` wird NIE gefiltert                   |
| R2  | SSR Performance: Extra API-Call pro Navigation              | Mittel  | Hoch               | Parallel-Fetch mit `/users/me` + `/dashboard/counts` (bereits bestehendes Pattern)       | Perf-Log: Layout-Load < 200ms (Messung in +layout.server.ts)             |
| R3  | Race Condition: Feature wird deaktiviert während User aktiv | Niedrig | Niedrig            | Backend-Guard fängt ab → 403 → api-client redirected zu Feature-Unavailable              | Manueller Test: Feature deaktivieren → nächste Aktion zeigt Fehler       |
| R4  | Root-User sieht keine Features-Admin-Seite                  | Hoch    | Niedrig            | `/features`-Route KEIN Feature-Gate (ist Core-Admin-Funktion)                            | Root login → /features erreichbar ohne Feature-Aktivierung               |
| R5  | Sidebar-Flash: Items erscheinen kurz und verschwinden       | Mittel  | Mittel             | SSR: Feature-Daten serverseitig laden, kein Client-Side-Fetch für Sidebar                | Visueller Test: Kein Flackern bei Page Load                              |
| R6  | `parent()` Daten-Kette bricht in (admin)/(root) Gruppe      | Hoch    | Mittel             | `activeAddons` kommt von (app)/+layout.server.ts → fließt durch alle Group-Layouts       | Test: `await parent()` in (admin) Seite gibt `activeAddons` Array zurück |
| R7  | `lean-management` Submenu-Sonderfall: verschachtelte kvp    | Niedrig | Mittel             | Rekursiver Filter: `addonCode` auf `kvp` Sub-Item, nicht auf `kvp-main`/`kvp-categories` | Unit Test: kvp deaktiviert → ganzer kvp-Submenu-Block verschwindet       |

### 0.3 Ecosystem Integration Points

| Bestehendes System            | Art der Integration                                      | Phase | Verifiziert am |
| ----------------------------- | -------------------------------------------------------- | ----- | -------------- |
| `+layout.server.ts`           | Neuer paralleler Fetch: `/features/my-features`          | 1     | 2026-02-15     |
| `navigation-config.ts`        | Neues `addonCode?` Feld auf `NavItem` + Filter-Funktion  | 1     | 2026-02-15     |
| `+layout.svelte`              | `menuItems` Derived-Chain erweitern um Feature-Filter    | 1     | 2026-02-15     |
| `api-client.ts`               | 403 Feature-Error abfangen VOR handleAuthenticationError | 2     | 2026-02-15     |
| 17× Feature `+page.server.ts` | Page-Level Guard: Feature-Check + redirect               | 2     | 2026-02-15     |
| `feature-unavailable/` (NEU)  | Neue Fehlerseite für deaktivierte Features               | 2     | 2026-02-15     |
| ADR-012 Pattern               | `requireAddon()` folgt dem Group-Layout-Guard-Muster     | 2     | 2026-02-15     |

---

## Phase 1: Sidebar Feature-Filterung (SSR)

> **Abhängigkeit:** Backend TenantAddonGuard (DONE)
> **Ziel:** Sidebar zeigt NUR Features an, die für den Tenant aktiviert sind

### Step 1.1: Feature-Daten im Layout laden [DONE ✅]

**Datei:** `frontend/src/routes/(app)/+layout.server.ts`

**Was passiert:**

1. Neuer paralleler Fetch zu `GET /features/my-features` (analog zu `/dashboard/counts` und `/settings/user/theme`)
2. Response parsen → `Set<string>` mit aktiven Feature-Codes extrahieren
3. Set als `activeAddons: string[]` an Layout-Data zurückgeben

**Konkrete Änderungen:**

```typescript
// In fetchCountsAndTheme() → wird zu fetchCountsThemeAndFeatures()
const [countsResponse, themeResponse, featuresResponse] = await Promise.all([
  fetchFn(`${API_BASE}/dashboard/counts`, { headers }).catch(() => null),
  fetchFn(`${API_BASE}/settings/user/theme`, { headers }).catch(() => null),
  fetchFn(`${API_BASE}/features/my-features`, { headers }).catch(() => null),
]);
```

```typescript
// Neue Hilfsfunktion
async function parseActiveFeatures(response: Response | null): Promise<string[]> {
  if (response?.ok !== true) return [];
  const json = await response.json();
  const features = json.data ?? json;
  return features.filter((f) => f.tenantFeature?.isActive === true).map((f) => f.code);
}
```

**Return-Shape erweitert:**

```typescript
return {
  user: mapUserData(userData),
  tenant: userData.tenant ?? null,
  isAuthenticated: true,
  dashboardCounts: await parseDashboardCounts(countsResponse),
  theme: await parseThemeSetting(themeResponse),
  activeAddons: await parseActiveFeatures(featuresResponse), // NEU
};
```

**Performance:** Kein zusätzlicher Roundtrip — läuft parallel zu bestehenden Fetches.

### Step 1.2: NavItem um `addonCode` erweitern [DONE]

**Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

**Was passiert:**

1. `NavItem` Interface um optionales `addonCode?: string` Feld erweitern
2. Allen Feature-gebundenen NavItems das Feld zuweisen
3. Neue Filter-Funktion `filterMenuByFeatures()` erstellen

**Mapping NavItem.id → addonCode:**

| NavItem.id          | addonCode        | Betrifft Rollen       | Hinweis                                                  |
| ------------------- | ---------------- | --------------------- | -------------------------------------------------------- |
| `blackboard`        | `blackboard`     | root, admin, employee | Root/Admin: hat Submenu (main + archive)                 |
| `calendar`          | `calendar`       | root, admin, employee |                                                          |
| `chat`              | `chat`           | root, admin, employee |                                                          |
| `documents`         | `documents`      | root, admin, employee | Hat Submenu (documents-explorer)                         |
| `lean-management`   | —                | Eltern-Container      | KEIN addonCode — verschwindet wenn alle Kinder weg       |
| └ `kvp`             | `kvp`            | root, admin, employee | Root/Admin: hat Sub-Submenu (Vorschläge + Definitionen)  |
| └─ `kvp-main`       | —                | (Kind von kvp)        | Erbt von Eltern — KEIN eigenes addonCode                 |
| └─ `kvp-categories` | —                | (Kind von kvp)        | Erbt von Eltern — KEIN eigenes addonCode                 |
| └ `surveys`         | `surveys`        | root, admin, employee |                                                          |
| `shifts`            | `shift_planning` | admin, employee       | Root sieht keine Schichtplanung in Sidebar               |
| `vacation`          | `vacation`       | root, admin, employee | Hat Submenu (Übersicht, Anträge, Regeln, Ansprüche, ...) |

**Rekursions-Logik am Beispiel `lean-management`:**

```
lean-management (kein addonCode → passiert durch)
  ├─ kvp (addonCode: 'kvp')
  │    ├─ kvp-main (kein addonCode → passiert durch)
  │    └─ kvp-categories (kein addonCode → wird ggf. von filterMenuByAccess entfernt)
  └─ surveys (addonCode: 'surveys')

Szenario: kvp=DISABLED, surveys=DISABLED
→ kvp entfernt (addonCode nicht in activeAddons) → Kinder damit auch weg
→ surveys entfernt
→ lean-management hat 0 Kinder UND keine eigene URL → ENTFERNT

Szenario: kvp=ACTIVE, surveys=DISABLED
→ kvp bleibt (mit Sub-Items)
→ surveys entfernt
→ lean-management hat 1 Kind → BLEIBT
```

**WICHTIG — Items OHNE `addonCode` werden NIE gefiltert:**

- `dashboard` → Core (kein Gate)
- `root-users`, `admins`, `departments`, `areas`, `teams` → Core-Admin (kein Gate)
- `features`, `logs`, `profile`, `settings`, `system`, `machines` → Core (kein Gate)

**Neue Filter-Funktion:**

```typescript
/**
 * Filter menu items based on tenant feature activation.
 * Items without addonCode always pass through (core features).
 * Recursive for nested submenus — removes empty parent containers.
 */
export function filterMenuByFeatures(items: NavItem[], activeAddons: ReadonlySet<string>): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    // Item has addonCode and feature is NOT active → skip
    if (item.addonCode !== undefined && !activeAddons.has(item.addonCode)) {
      return acc;
    }

    // Recurse into submenus
    if (item.submenu !== undefined) {
      const filtered = filterMenuByFeatures(item.submenu, activeAddons);
      // Keep parent only if it has remaining children OR its own URL
      if (filtered.length > 0 || item.url !== undefined) {
        acc.push({ ...item, submenu: filtered });
      }
      return acc;
    }

    acc.push(item);
    return acc;
  }, []);
}
```

### Step 1.3: Layout Sidebar-Filterung aktivieren [DONE]

**Datei:** `frontend/src/routes/(app)/+layout.svelte`

**Was passiert:**

1. `activeAddons` aus SSR-Data lesen
2. `Set<string>` erzeugen
3. In `menuItems` Derived-Chain einfügen: **nach** `filterMenuByAccess`, **vor** Übergabe an `AppSidebar`

**Aktuelle Chain (Z.246-248):**

```typescript
const menuItems = $derived<NavItem[]>(filterMenuByAccess(getMenuItemsForRole(currentRole), hasFullAccess));
```

**Neue Chain:**

```typescript
const activeAddonsSet = $derived(new Set(data.activeAddons ?? []));

const menuItems = $derived<NavItem[]>(
  filterMenuByFeatures(filterMenuByAccess(getMenuItemsForRole(currentRole), hasFullAccess), activeAddonsSet),
);
```

**Reihenfolge:**

1. `getMenuItemsForRole()` → Rolle bestimmt Basis-Menü
2. `filterMenuByAccess()` → `has_full_access` filtert Admin-spezifische Items
3. `filterMenuByFeatures()` → Tenant-Feature-Aktivierung filtert Rest

### Phase 1 — Definition of Done ✅

- [x] `GET /features/my-features` wird parallel im Layout geladen (kein Extra-Roundtrip)
- [x] `NavItem` Interface hat optionales `addonCode?: string` Feld
- [x] Alle 8 Feature-NavItems haben korrektes `addonCode` zugewiesen
- [x] `filterMenuByFeatures()` Funktion existiert und ist rekursiv (Submenus)
- [x] Items OHNE `addonCode` werden NIE gefiltert (Core-Features sicher)
- [x] Leere Eltern-Container (z.B. "LEAN-Management" ohne kvp+surveys) werden entfernt
- [x] `+layout.svelte` verwendet 3-stufige Filter-Chain
- [x] Kein Sidebar-Flash (SSR → Daten sofort verfügbar)
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors in geänderten Dateien
- [x] Manueller Test: Feature deaktivieren → Sidebar-Item verschwindet

---

## Phase 2: Page-Level Guards + 403 Handling

> **Abhängigkeit:** Phase 1 complete
> **Ziel:** Direkt-Navigation zu deaktivierten Features → sauberer Redirect statt leere Seite

### Step 2.1: Feature-Unavailable-Seite erstellen [DONE]

**Datei:** `frontend/src/routes/(app)/feature-unavailable/+page.svelte` (NEU)
**Datei:** `frontend/src/routes/(app)/feature-unavailable/+page.server.ts` (NEU)

**Warum eigene Seite statt `/permission-denied`:**

- `/permission-denied` = "Du hast keine BERECHTIGUNG" (Rollen/Permissions)
- `/feature-unavailable` = "Dieses Feature ist NICHT AKTIVIERT" (Tenant/Billing)

Semantisch verschiedene Fehler mit verschiedenen Lösungswegen:

- Permission → "Fragen Sie Ihren Administrator"
- Feature → "Kontaktieren Sie den Vertrieb / Upgrade Ihren Plan"

**Design:** Gleiche Design-System-Komponenten wie `/permission-denied`:

- `empty-state empty-state--warning empty-state--bordered empty-state--full-height`
- Badge: `423 Feature nicht verfügbar` (statt 403 Forbidden)
- Icon: `fas fa-lock` (statt `fa-ban`)
- Titel: "Feature nicht verfügbar"
- Text: "Dieses Feature ist für Ihren Tenant nicht aktiviert. Bitte kontaktieren Sie Ihren Administrator oder wechseln Sie zu einem höheren Plan."
- Buttons: "Zurück" + "Zur Startseite"
- Optional Query-Param `?feature=vacation` für spezifischere Meldung

### Step 2.2: Page-Level Addon Guards [DONE]

**Konzept:** Analog zu `(admin)/+layout.server.ts` (RBAC-Guard), aber für Feature-Aktivierung.

**Option A — Layout-Gruppen (empfohlen):**

Neue SvelteKit Route-Gruppe `(feature-gated)` die Feature-Check auf Layout-Ebene macht:

```
frontend/src/routes/(app)/(shared)/
  blackboard/+page.server.ts     ← Bereits vorhanden, einzeln guardn
  calendar/+page.server.ts       ← Bereits vorhanden, einzeln guardn
  chat/+page.server.ts           ← Bereits vorhanden, einzeln guardn
  ...
```

**Aber:** Die Features liegen in verschiedenen Gruppen (`(shared)`, `(admin)`), und jedes Feature hat EINEN addonCode. Eine Layout-Gruppe würde nicht passen, weil verschiedene Features verschiedene Codes haben.

**→ Option B — Utility-Funktion in jeder `+page.server.ts` (gewählt):**

```typescript
// frontend/src/lib/utils/addon-guard.ts (NEU)
import { redirect } from '@sveltejs/kit';

/**
 * Page-level feature guard.
 * Call in +page.server.ts load() to redirect if feature is disabled.
 *
 * @param activeAddons - Array from parent layout data
 * @param addonCode - Required feature code (e.g., 'vacation')
 */
export function requireAddon(activeAddons: string[], addonCode: string): void {
  if (!activeAddons.includes(addonCode)) {
    redirect(302, `/feature-unavailable?feature=${addonCode}`);
  }
}
```

**Einbau in bestehende `+page.server.ts` Dateien (8 Features):**

```typescript
// Beispiel: blackboard/+page.server.ts
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (!token) redirect(302, '/login');

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'blackboard'); // ← NEU (1 Zeile!)

  // ... rest of load function
};
```

**Betroffene Dateien — EXAKTE Liste (16 Dateien):**

| #   | Feature-Code     | Datei                                           | Hat `parent()`? | Aufwand   |
| --- | ---------------- | ----------------------------------------------- | --------------- | --------- |
| 1   | `blackboard`     | `(shared)/blackboard/+page.server.ts`           | NEIN            | +3 Zeilen |
| 2   | `blackboard`     | `(shared)/blackboard/archived/+page.server.ts`  | NEIN            | +3 Zeilen |
| 3   | `blackboard`     | `(shared)/blackboard/[uuid]/+page.server.ts`    | JA (Z.81)       | +2 Zeilen |
| 4   | `calendar`       | `(shared)/calendar/+page.server.ts`             | JA (Z.89)       | +2 Zeilen |
| 5   | `chat`           | `(shared)/chat/+page.server.ts`                 | JA (Z.86)       | +2 Zeilen |
| 6   | `documents`      | `(shared)/documents-explorer/+page.server.ts`   | JA (Z.113)      | +2 Zeilen |
| 7   | `kvp`            | `(shared)/kvp/+page.server.ts`                  | JA (Z.152)      | +2 Zeilen |
| 8   | `kvp`            | `(admin)/kvp-categories/+page.server.ts`        | JA (Z.70)       | +2 Zeilen |
| 9   | `surveys`        | `(shared)/survey-employee/+page.server.ts`      | NEIN            | +3 Zeilen |
| 10  | `surveys`        | `(admin)/survey-admin/+page.server.ts`          | JA (Z.73)       | +2 Zeilen |
| 11  | `surveys`        | `(admin)/survey-results/+page.server.ts`        | NEIN            | +3 Zeilen |
| 12  | `shift_planning` | `(shared)/shifts/+page.server.ts`               | JA (Z.318)      | +2 Zeilen |
| 13  | `vacation`       | `(shared)/vacation/+page.server.ts`             | JA (Z.79)       | +2 Zeilen |
| 14  | `vacation`       | `(admin)/vacation/rules/+page.server.ts`        | NEIN            | +3 Zeilen |
| 15  | `vacation`       | `(admin)/vacation/overview/+page.server.ts`     | NEIN            | +3 Zeilen |
| 16  | `vacation`       | `(admin)/vacation/entitlements/+page.server.ts` | NEIN            | +3 Zeilen |

**Sonderfall:** `(root)/vacation/holidays/+page.server.ts` — liegt in `(root)` Gruppe. Braucht auch Guard.
→ **Ergibt 17 Dateien total.**

**Aufwand-Erklärung:**

- Dateien MIT `await parent()`: 2 Zeilen (destructure `activeAddons` + `requireAddon()`)
- Dateien OHNE `await parent()`: 3 Zeilen (`parent` in Params + destructure + `requireAddon()`)

**ACHTUNG:** 8 der 17 Dateien rufen `await parent()` noch NICHT auf.
Diese brauchen `parent` als zusätzlichen Parameter im load-Destrukturierung.

### Step 2.3: api-client 403 Feature-Error Handling [DONE]

**Datei:** `frontend/src/lib/utils/api-client.ts`

**Korrigierte Analyse (Z.383-396 + Z.437-438):**

```typescript
// Z.437-438: BEIDE Status-Codes gehen an handleAuthenticationError
if (response.status === 401 || response.status === 403) {
  this.handleAuthenticationError(data);
}

// Z.383-396: handleAuthenticationError prüft NUR "expired"/"invalid token"
private handleAuthenticationError(data): void {
  if (message.includes('expired') || message.includes('invalid token')) {
    clearTokens('token_expired');
    throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
  }
  // Feature-403 Message "X feature is not enabled" → KEIN Match
  // → Methode tut NICHTS → Execution fällt durch zu handleV2Response()
}
```

**Tatsächliches Verhalten bei Feature-403:**

1. Backend wirft: `"blackboard feature is not enabled for this tenant"`
2. `handleAuthenticationError()` → message enthält weder "expired" noch "invalid token" → **tut nichts**
3. `handleV2Response()` → liest `success: false` → wirft generischen `ApiError` mit Backend-Message
4. Aufrufender Code hat meistens `try/catch` mit generischem Error-Toast → **User sieht kryptische Fehlermeldung**

**Kein falsches "Session expired"** — aber auch **kein sauberer Redirect**. Der User bleibt auf der Seite mit einem Error-Toast.

**Lösung:** Feature-403 VOR `handleAuthenticationError` abfangen:

```typescript
// NEU: Feature-403 erkennen BEVOR auth-handler greift
if (response.status === 403) {
  const message = extractErrorMessage(data).message;
  if (message.includes('feature is not enabled')) {
    if (browser) {
      // goto() statt window.location für SvelteKit-konformes Routing
      void goto('/feature-unavailable');
    }
    throw new ApiError('Feature nicht verfügbar', 'FEATURE_DISABLED', 403);
  }
}

// Bestehend: Auth-Errors (401 + verbleibende 403)
if (response.status === 401 || response.status === 403) {
  this.handleAuthenticationError(data);
}
```

**Warum nötig:** Page-Level Guards decken SSR ab, aber Client-Side API-Calls (`apiClient.get()`) können auch Feature-403 zurückgeben — z.B. bei SPA-Navigation oder AJAX-Calls innerhalb einer bereits geladenen Seite.

### Phase 2 — Definition of Done ✅

- [x] `/feature-unavailable` Seite existiert mit korrektem Design-System Styling
- [x] `requireAddon()` Utility-Funktion erstellt
- [x] Alle 17 Feature-gated `+page.server.ts` Dateien verwenden `requireAddon()`
- [x] 8 Dateien ohne `await parent()` → `parent` Parameter ergänzt
- [x] `api-client.ts` unterscheidet Feature-403 von Auth-403
- [x] Direkt-Navigation zu deaktiviertem Feature → Redirect zu `/feature-unavailable`
- [x] Client-Side 403 (apiClient) → Redirect zu `/feature-unavailable`
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors
- [x] Manueller Test: URL direkt eingeben für deaktiviertes Feature → Feature-Unavailable-Seite

---

## Phase 3: Tests + Polish

> **Abhängigkeit:** Phase 2 complete
> **Ziel:** Alles abgesichert, edge cases getestet, Dokumentation aktualisiert

### Step 3.1: Unit Tests für navigation-config [DONE — 31 Tests]

**Datei:** `frontend/src/routes/(app)/_lib/navigation-config.test.ts` (NEU)

**Test-Szenarien:**

1. **filterMenuByFeatures — Happy Path:**
   - Alle Features aktiv → alle Items sichtbar
   - Kein Feature aktiv → nur Core-Items sichtbar
   - Einzelnes Feature deaktiviert → nur dieses Item verschwindet

2. **filterMenuByFeatures — Rekursion:**
   - Submenu komplett gefiltert → Eltern-Container entfernt
   - Submenu teilweise gefiltert → Eltern bleibt mit Rest
   - `lean-management` ohne kvp+surveys → verschwindet
   - `lean-management` mit kvp aber ohne surveys → bleibt mit nur kvp

3. **filterMenuByFeatures — Sicherheit:**
   - Items ohne `addonCode` werden NIE gefiltert
   - `dashboard`, `profile`, `settings` bleiben IMMER
   - Leere `activeAddons` Set → nur Core-Items

4. **Kombination mit filterMenuByAccess:**
   - `filterMenuByAccess` → `filterMenuByFeatures` Reihenfolge korrekt
   - Kein Konflikt zwischen Access-Filter und Feature-Filter

### Step 3.2: Unit Test für addon-guard Utility [DONE — 26 Tests]

**Datei:** `frontend/src/lib/utils/addon-guard.test.ts` (NEU)

**Test-Szenarien:**

1. Feature in `activeAddons` → kein Redirect (no-op)
2. Feature NICHT in `activeAddons` → Redirect zu `/feature-unavailable?feature=xxx`
3. Leere `activeAddons` → Redirect
4. Alle 8 Feature-Codes durchiterieren

### Step 3.3: Dokumentation [DONE ✅]

- [x] ADR-024 für Frontend Addon Guards (Architekturentscheidung: Utility statt Layout-Group)
- [x] FEATURES.md aktualisiert (Frontend Feature-Gating als System-Feature #10)
- [x] DAILY-PROGRESS.md erstellt

### Phase 3 — Definition of Done ✅

- [x] > = 20 Unit Tests für `filterMenuByFeatures()` → **31 Tests**
- [x] > = 8 Unit Tests für `requireAddon()` → **26 Tests**
- [x] Alle Tests grün (238 frontend-unit total)
- [x] ADR-024 geschrieben
- [x] FEATURES.md aktualisiert
- [x] Kein TODO im Code
- [x] ESLint 0 Errors in allen geänderten/neuen Dateien
- [x] svelte-check 0 Errors (2128 Dateien)

---

## Phase 4: Features Page Modernisierung [DONE ✅]

> **Abhängigkeit:** Phase 1-3 complete
> **Ziel:** `/features` Admin-Seite komplett modernisiert mit Design System

### Step 4.1: Feature Cards Redesign [DONE ✅]

**Dateien:** `features/+page.svelte`, `choice-card.feature.css`, `features/_lib/constants.ts`

**Was gemacht:**

1. Feature Cards komplett neu: 3-Zonen-Layout (Header mit Icon+Titel+Badge, Description, Footer mit Plan-Badge+Action)
2. `FEATURE_ICONS` Map in `constants.ts` — FontAwesome-Icons pro Feature-Code
3. Kategorie-Emojis (🔧💬📋) im Category-Header
4. CSS komplett neu geschrieben: minimalistisch, kein `translateY` hover, nur `border-color` Transition
5. BEM-Struktur: `.feature-card__header`, `.feature-card__icon`, `.feature-card__title-group`, `.feature-card__footer`
6. Feature Cards verwenden gleiche Border/Shadow/Radius wie `.card` (`var(--glass-border)`, `var(--shadow-md)`, `var(--radius-xl)`)

### Step 4.2: Plan Cards + Addon Cards [DONE ✅]

1. Plan-Badges: Custom `.plan-badge` → Design System `badge badge--lg badge--primary/warning`
2. Addon Cards mit BEM-Naming + Icons (👥 Mitarbeiter, 👨‍💼 Admins, 💾 Speicher)
3. Individuelle Plan-Beschreibungen, €-Symbol bei Preisen

### Step 4.3: Summary Card + Confirm Modal [DONE ✅]

1. Summary Bar → reguläre `card summary-card` im normalen Dokument-Flow (kein fixed/sticky)
2. Native `confirm()` ersetzt durch `confirm-modal confirm-modal--danger`
3. `changePlan()` aufgeteilt in `requestPlanChange()` + `confirmPlanChange()`

### Step 4.4: Dark/Light Mode [DONE ✅]

1. Alle Farben über CSS-Variablen
2. Light Mode Overrides mit `html:not(.dark)` in `choice-card.feature.css`
3. Premium Plan-Badge: Dark Orange `#c0621e` in Light Mode

### Phase 4 — Definition of Done ✅

- [x] Feature Cards: 3-Zonen-Layout mit Icon, Titel, Badge, Description, Footer
- [x] Design System Komponenten statt Custom CSS (badge, card, btn, confirm-modal)
- [x] Dark Mode + Light Mode korrekt (variable-basiert, `html:not(.dark)` Overrides)
- [x] Feature Cards Border/Shadow/Radius identisch mit `.card`
- [x] Native `confirm()` ersetzt durch `confirm-modal--danger`
- [x] Summary als reguläre Card im Flow
- [x] Premium Plan-Badge in Light Mode gut lesbar (dark orange)
- [x] Ungenutzte Imports entfernt

---

## Session Tracking

| Session | Phase | Beschreibung                                                     | Status | Datum      |
| ------- | ----- | ---------------------------------------------------------------- | ------ | ---------- |
| 1       | 1     | Layout Feature-Fetch + NavItem addonCode + Filtering             | DONE   | 2026-02-15 |
| 2       | 2     | Feature-Unavailable-Seite + requireAddon Utility                 | DONE   | 2026-02-15 |
| 3       | 2     | Page-Level Guards in 17 Dateien (8 ohne parent) + api-client Fix | DONE   | 2026-02-15 |
| 4       | 3+4   | Tests (57) + Features Page Modernisierung (Design System)        | DONE   | 2026-02-15 |
| 5       | 3+5   | ADR-024 + FEATURES.md + DAILY-PROGRESS.md + Masterplan 2.0.0     | DONE   | 2026-02-15 |

---

## Quick Reference: File Paths

### Frontend (neu)

| Datei                                                           | Zweck                         |
| --------------------------------------------------------------- | ----------------------------- |
| `frontend/src/lib/utils/addon-guard.ts`                         | Page-Level Addon Guard        |
| `frontend/src/lib/utils/addon-guard.test.ts`                    | Tests für Addon Guard         |
| `frontend/src/routes/(app)/feature-unavailable/+page.svelte`    | Feature-Unavailable-Seite     |
| `frontend/src/routes/(app)/feature-unavailable/+page.server.ts` | Server-Load für Feature-Seite |
| `frontend/src/routes/(app)/_lib/navigation-config.test.ts`      | Tests für Navigation-Filter   |

### Frontend (geändert — 21 Dateien)

| Datei                                                 | Änderung                                             |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `frontend/src/routes/(app)/+layout.server.ts`         | Parallel-Fetch `/features/my-features`, activeAddons |
| `frontend/src/routes/(app)/+layout.svelte`            | 3-stufige Filter-Chain für menuItems                 |
| `frontend/src/routes/(app)/_lib/navigation-config.ts` | `addonCode` auf NavItem + filterMenuByFeatures()     |
| `frontend/src/lib/utils/api-client.ts`                | Feature-403 VOR handleAuthenticationError abfangen   |
| `(shared)/blackboard/+page.server.ts`                 | +parent +requireAddon('blackboard')                  |
| `(shared)/blackboard/archived/+page.server.ts`        | +parent +requireAddon('blackboard')                  |
| `(shared)/blackboard/[uuid]/+page.server.ts`          | +requireAddon('blackboard')                          |
| `(shared)/calendar/+page.server.ts`                   | +requireAddon('calendar')                            |
| `(shared)/chat/+page.server.ts`                       | +requireAddon('chat')                                |
| `(shared)/documents-explorer/+page.server.ts`         | +requireAddon('documents')                           |
| `(shared)/kvp/+page.server.ts`                        | +requireAddon('kvp')                                 |
| `(admin)/kvp-categories/+page.server.ts`              | +requireAddon('kvp')                                 |
| `(shared)/survey-employee/+page.server.ts`            | +parent +requireAddon('surveys')                     |
| `(admin)/survey-admin/+page.server.ts`                | +requireAddon('surveys')                             |
| `(admin)/survey-results/+page.server.ts`              | +parent +requireAddon('surveys')                     |
| `(shared)/shifts/+page.server.ts`                     | +requireAddon('shift_planning')                      |
| `(shared)/vacation/+page.server.ts`                   | +requireAddon('vacation')                            |
| `(admin)/vacation/rules/+page.server.ts`              | +parent +requireAddon('vacation')                    |
| `(admin)/vacation/overview/+page.server.ts`           | +parent +requireAddon('vacation')                    |
| `(admin)/vacation/entitlements/+page.server.ts`       | +parent +requireAddon('vacation')                    |
| `(root)/vacation/holidays/+page.server.ts`            | +parent +requireAddon('vacation')                    |

---

## Spec Deviations

| #   | Erwartung                            | Tatsächlicher Code                | Entscheidung                                                         |
| --- | ------------------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| D1  | Layout-Gruppen für Feature-Gating    | Utility-Funktion pro Page         | Features liegen in verschiedenen Gruppen, Layout-Gruppe passt nicht  |
| D2  | `/permission-denied` wiederverwenden | Neue `/feature-unavailable` Seite | Semantisch verschiedene Fehler: Berechtigung vs. Feature-Aktivierung |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Real-Time Feature-Update:** Wenn ein Admin ein Feature deaktiviert, sieht der User die Änderung erst nach Page-Reload. Grund: SSR-Daten werden bei Navigation nicht invalidiert. Alternative: SSE-Event für Feature-Änderungen (V2).

2. **Kein Feature-spezifischer Text auf Feature-Unavailable-Seite:** V1 zeigt generischen Text. V2 könnte Feature-Name + Upgrade-Link zeigen basierend auf Query-Param `?feature=xxx`.

3. **Kein Caching der Feature-Liste:** Jede Navigation = neuer Fetch. Bei Performance-Problemen: ClientSide-Cache mit TTL (V2). Aktuell: Parallel-Fetch → kein Roundtrip-Overhead.

4. **Root-User Feature-Admin-Seite nicht Feature-gated:** `/features` bleibt immer erreichbar. Root muss Features verwalten können, auch wenn sie für den Tenant nicht aktiv sind.

---

## Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User navigiert zu /blackboard                │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  (app)/+layout.server.ts                                            │
│                                                                     │
│  1. Auth-Check (Cookie)                                             │
│  2. Parallel-Fetch:                                                 │
│     /users/me  |  /dashboard/counts  |  /settings/theme             │
│                |                     |  /features/my-features  ← NEU│
│  3. Return: { user, counts, theme, activeAddons }                 │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  (app)/+layout.svelte                                               │
│                                                                     │
│  menuItems = filterMenuByFeatures(                                  │
│    filterMenuByAccess(                                              │
│      getMenuItemsForRole(currentRole),                              │
│      hasFullAccess                                                  │
│    ),                                                               │
│    activeAddonsSet  ← NEU                                         │
│  )                                                                  │
│                                                                     │
│  Sidebar zeigt nur aktivierte Features                              │
└─────────────────┬───────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  (shared)/blackboard/+page.server.ts                                │
│                                                                     │
│  const { activeAddons } = await parent();                         │
│  requireAddon(activeAddons, 'blackboard');  ← NEU               │
│                                                                     │
│  Feature nicht aktiv?                                               │
│    → redirect(302, '/feature-unavailable?feature=blackboard')       │
│  Feature aktiv?                                                     │
│    → Normaler Data-Load                                             │
└─────────────────────────────────────────────────────────────────────┘
                  │
                  │ (Falls Client-Side Navigation → API-Call)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  api-client.ts                                                      │
│                                                                     │
│  Backend gibt 403: "blackboard feature is not enabled for tenant"   │
│                                                                     │
│  NEU: if (message.includes('feature is not enabled'))               │
│    → redirect to /feature-unavailable                               │
│  SONST: → handleAuthenticationError() (wie bisher)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
