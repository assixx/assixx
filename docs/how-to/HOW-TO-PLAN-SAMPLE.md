# HOW TO: Feature Execution Masterplan erstellen

> **Version:** 1.0.0
> **Erstellt:** 2026-02-14
> **Quelle:** Extrahiert aus `FEAT_VACCATION_MASTERPLAN.md` (24 Sessions, 6 Phasen, 115+ Unit Tests, 33 API Tests)
> **Zweck:** Template + Anleitung für strukturierte Feature-Planung auf Senior-Engineer-Niveau

---

> **WICHTIG: Alle Masterpläne MÜSSEN in Englisch geschrieben werden.** Dieses Template ist auf Deutsch als Anleitung, aber der tatsächliche Masterplan — alle Phasen, Steps, Session-Protokolle, Risk Register, DoDs — wird ausschließlich auf Englisch verfasst. Kein Denglisch, kein Mix. Englisch. Punkt.

---

## Warum ein Masterplan?

Ohne Plan baust du ein Haus ohne Bauzeichnung. Du wirst fertig — aber die Türen passen nicht, die Rohre kreuzen sich, und beim dritten Umbau reißt du alles ab.

Ein Masterplan ist kein Overhead. Er ist **Versicherung gegen Chaos**.

---

## Template: FEAT\_{NAME}\_MASTERPLAN.md

Kopiere das folgende Template und passe es an dein Feature an.

---

````markdown
# FEAT: {Feature Name} — Execution Masterplan

> **Created:** {YYYY-MM-DD}
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feat/{feature-name}`
> **Spec:** [{spec-datei}](./{spec-datei})
> **Context:** [{brainstorming-datei}](./{brainstorming-datei})
> **Author:** {Name} (Senior Engineer)
> **Estimated Sessions:** {X}
> **Actual Sessions:** 0 / {X}

---

## Changelog

| Version | Datum      | Änderung                                       |
| ------- | ---------- | ---------------------------------------------- |
| 0.1.0   | YYYY-MM-DD | Initial Draft — Phasen 1-6 geplant             |
| 0.2.0   | YYYY-MM-DD | Phase 1 Detail-Design nach DB-Analyse          |
| 1.0.0   | YYYY-MM-DD | Phase 1 COMPLETE — Migrationen angewendet      |
| 1.1.0   | YYYY-MM-DD | Phase 2 COMPLETE — Backend fertig              |
| 1.2.0   | YYYY-MM-DD | Phase 3 COMPLETE — Unit Tests grün             |
| 2.0.0   | YYYY-MM-DD | Alle Phasen COMPLETE — Feature produktionsreif |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt: `{backup_datei}` ({Größe})
- [ ] Branch `feat/{feature-name}` checked out
- [ ] Keine pending Migrations (aktueller Stand: Migration {N})
- [ ] Abhängige Features fertig: {liste oder "keine"}
- [ ] Spec/Requirements vom Stakeholder abgesegnet

### 0.2 Risk Register

| #   | Risiko                        | Impact        | Wahrscheinlichkeit    | Mitigation                              | Verifikation                                      |
| --- | ----------------------------- | ------------- | --------------------- | --------------------------------------- | ------------------------------------------------- |
| R1  | {Beschreibung}                | {Hoch/Mittel} | {Hoch/Mittel/Niedrig} | {Konkrete Gegenmaßnahme}                | {Test/Query/Check der beweist, dass es wirkt}     |
| R2  | Race Condition bei {X}        | Hoch          | Mittel                | `FOR UPDATE` Lock auf Row               | Unit Test: paralleler Approve → ConflictException |
| R3  | Migration bricht bei Daten ab | Hoch          | Niedrig               | Pre-Check Query + RAISE EXCEPTION       | Dry-Run mit Testdaten vor Apply                   |
| R4  | Cross-Modul-Abhängigkeit      | Mittel        | Hoch                  | Atomisches Deployment (gleiche Session) | Type-Check + bestehende Tests nach Deploy         |

> **Regel:** Jedes Risiko MUSS eine konkrete Mitigation UND eine Verifikation haben.
> "Aufpassen" ist KEINE Mitigation. "Wird schon passen" ist KEINE Verifikation.

### 0.3 Ecosystem Integration Points

| Bestehendes System         | Art der Integration                        | Phase | Verifiziert am |
| -------------------------- | ------------------------------------------ | ----- | -------------- |
| {z.B. audit_trail}         | Jede Statusänderung → Audit Entry          | 2     |                |
| {z.B. EventBus}            | {N} neue typed Emit-Methoden               | 2     |                |
| {z.B. SSE/Notifications}   | {N} neue Event-Handler                     | 2     |                |
| {z.B. Permission Registry} | Neuer Registrar via OnModuleInit           | 2     |                |
| {z.B. FeatureCheckService} | Feature-Gate auf jedem Controller-Endpoint | 2     |                |
| {z.B. Kalender}            | Frontend-Merge: Daten im Kalender zeigen   | 5     |                |

> **Warum diese Tabelle?** Sie zwingt dich, VOR dem Coding alle Berührungspunkte
> zu identifizieren. Session 11 im Vacation-Masterplan hätte ohne diese Tabelle
> 3 Integrationen vergessen.

---

## Phase 1: Database Migrations

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** {N} neue Migrationsdateien
> **Letzte Migration:** `{dateiname}` → nächste ist `{nächste_nummer}`

### Step 1.1: {Beschreibung} [STATUS]

**Neue Dateien:**

- `database/migrations/{timestamp}_{name}.ts`

**Was passiert:**

1. {SQL-Operation 1}
2. {SQL-Operation 2}
3. {SQL-Operation 3}

**Mandatory Checklist pro Tabelle (Multi-Tenant!):**

- [ ] `id UUID PRIMARY KEY` (UUIDv7)
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS Policy mit `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON table TO app_user`
- [ ] Keine Sequence-GRANTs nötig (UUID PK, nicht SERIAL)
- [ ] Passende Indexes mit `WHERE is_active = 1` Partial Indexes
- [ ] `is_active INTEGER NOT NULL DEFAULT 1` (Ausnahmen dokumentieren!)
- [ ] `up()` UND `down()` implementiert

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt {tabellenname}"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE '{prefix}_%';"
```
````

### Step 1.N: ... [STATUS]

{Weitere Schritte analog}

### Phase 1 — Definition of Done

- [ ] {N} Migrationsdateien mit `up()` AND `down()`
- [ ] Alle Migrationen bestehen Dry-Run: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] Alle Migrationen erfolgreich angewendet
- [ ] {N} neue Tabellen existieren mit RLS Policies ({N}/{N} verifiziert)
- [ ] Backend kompiliert fehlerfrei nach Rename/Schema-Änderungen
- [ ] Bestehende Tests laufen weiterhin durch
- [ ] Backup vorhanden vor Migrationen

---

## Phase 2: Backend Module

> **Abhängigkeit:** Phase 1 complete
> **Referenz-Modul:** `backend/src/nest/{bestehendes_modul}/` (Dateistruktur kopieren)

### Step 2.1: Module Skeleton + Types + DTOs [STATUS]

**Neues Verzeichnis:** `backend/src/nest/{feature}/`

**Dateistruktur:**

```
backend/src/nest/{feature}/
    {feature}.module.ts                    # NestJS Modul
    {feature}.types.ts                     # Interfaces + DB Row Types
    {feature}.permissions.ts               # PermissionCategoryDef (ADR-020)
    {feature}-permission.registrar.ts      # OnModuleInit Registrar
    dto/
        common.dto.ts                      # Wiederverwendbare Zod Schemas
        index.ts                           # Barrel Export
        {operation}.dto.ts                 # Je eine DTO pro Operation
```

**Registrierung in app.module.ts:**

- [ ] `{Feature}Module` zu imports Array (alphabetisch sortiert)

### Step 2.2 - 2.N: Services (Abhängigkeitsreihenfolge!)

> **KRITISCH:** Services in der richtigen Reihenfolge implementieren!
> Jeder Service darf nur von bereits implementierten Services abhängen.

**Empfohlene Reihenfolge:**

| #   | Service                     | Warum diese Reihenfolge                      |
| --- | --------------------------- | -------------------------------------------- |
| 2.2 | {Basis-Service}             | Keine Abhängigkeiten, wird von allen genutzt |
| 2.3 | {Config/Settings-Service}   | Andere Services brauchen Config-Werte        |
| 2.4 | {Berechnung-Service}        | Wird von Validierung + Core gebraucht        |
| 2.5 | {CRUD-Service A}            | Eigenständig, wird von Core referenziert     |
| 2.6 | {CRUD-Service B}            | Eigenständig, wird von Core referenziert     |
| 2.7 | {Analyse/Capacity-Service}  | Braucht alle CRUD-Services als Input         |
| 2.8 | {Core-Service (Mutationen)} | Das Herz — braucht ALLES                     |
| 2.9 | {Notification-Service}      | Reagiert auf Core-Events                     |

**Pro Service dokumentieren:**

```markdown
### Step 2.X: {ServiceName} [STATUS]

**Datei:** `backend/src/nest/{feature}/{service-name}.service.ts`

**Warum jetzt:** {Begründung der Reihenfolge}

**Methoden:**

- `methodA(tenantId, ...)` — {Beschreibung}
- `methodB(tenantId, ...)` — {Beschreibung}

**Abhängigkeiten:** {Liste der injizierten Services}

**Kritische Patterns:**

- Alle Queries via `db.tenantTransaction()` (ADR-019)
- Return raw Data, KEIN `{ success, data }` Wrapping (ADR-007)
- `$1, $2, $3` Placeholders (PostgreSQL)
- `?? null` nicht `|| null` für Defaults
```

### Step 2.N+1: Controller [STATUS]

**Datei:** `backend/src/nest/{feature}/{feature}.controller.ts`

**Endpoints ({N} total):**

| Method | Route          | Guard/Permission | Beschreibung      |
| ------ | -------------- | ---------------- | ----------------- |
| GET    | /{feature}     | canRead          | Liste (paginiert) |
| POST   | /{feature}     | canWrite         | Erstellen         |
| GET    | /{feature}/:id | canRead          | Einzelnes Item    |
| PATCH  | /{feature}/:id | canWrite         | Aktualisieren     |
| DELETE | /{feature}/:id | canDelete        | Soft-Delete       |

**Jeder Endpoint MUSS:**

- [ ] `FeatureCheckService.checkTenantAccess(tenantId, '{feature}')` aufrufen
- [ ] `@RequirePermission(...)` Decorator verwenden
- [ ] Raw Data zurückgeben (ResponseInterceptor wrapped automatisch)

### Phase 2 — Definition of Done

- [ ] `{Feature}Module` registriert in `app.module.ts`
- [ ] Alle {N} Services implementiert und injiziert
- [ ] Controller mit allen {N} Endpoints
- [ ] Permission Registrar registriert bei Module Init
- [ ] Feature Check auf jedem Controller-Endpoint
- [ ] `db.tenantTransaction()` für ALLE tenant-scoped Queries
- [ ] KEIN Double-Wrapping — Services returnen raw Data (ADR-007)
- [ ] EventBus-Methoden hinzugefügt (falls nötig)
- [ ] SSE-Handler registriert (falls nötig)
- [ ] `??` nicht `||`, kein `any`, explizite Boolean-Checks
- [ ] ESLint 0 Errors: `docker exec assixx-backend pnpm exec eslint backend/src/nest/{feature}/`
- [ ] Type-Check passed: `docker exec assixx-backend pnpm run type-check`
- [ ] Alle DTOs nutzen Zod + `createZodDto()` Pattern

---

## Phase 3: Unit Tests

> **Abhängigkeit:** Phase 2 complete
> **Pattern:** `backend/src/nest/{bestehendes_modul}/{modul}.service.test.ts`

### Test-Dateien

```
backend/src/nest/{feature}/
    {feature}.service.test.ts              # {N} Tests (Core Mutations)
    {feature}-{sub}.service.test.ts        # {N} Tests (Sub-Service)
    ...
```

### Kritische Test-Szenarien (MUSS abgedeckt sein)

**Geschäftslogik:**

- [ ] Happy Path für jede Mutation
- [ ] Validierungsfehler → BadRequestException
- [ ] Duplikat/Konflikt → ConflictException
- [ ] Fehlende Berechtigung → ForbiddenException
- [ ] Nicht gefunden → NotFoundException

**Edge Cases:**

- [ ] Grenzwerte (0, MAX, negative Werte)
- [ ] Cross-{Domain}-Szenarien (z.B. jahresübergreifend)
- [ ] Race Conditions (FOR UPDATE Lock verifizieren)
- [ ] Self-Referenz-Schleifen (z.B. Self-Approval)

**Datenintegrität:**

- [ ] Tenant-Isolation (Tenant A sieht nicht Tenant B)
- [ ] Cascade-Verhalten bei DELETE
- [ ] Audit-Trail-Einträge werden geschrieben

### Phase 3 — Definition of Done

- [ ] > = {N} Unit Tests total (Minimum: 75)
- [ ] Alle Tests grün: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/{feature}/`
- [ ] Jeder ConflictException / BadRequestException Pfad abgedeckt
- [ ] Edge Cases für {Domain-spezifische Szenarien} getestet
- [ ] Race Condition getestet (falls relevant)
- [ ] Coverage: Alle public Methoden haben mindestens 1 Test

---

## Phase 4: API Integration Tests

> **Abhängigkeit:** Phase 3 complete
> **Pattern:** `backend/test/*.api.test.ts` (HOW-TO-TEST-WITH-VITEST.md)

### Test-Datei

`backend/test/{feature}.api.test.ts`

### Szenarien (>= 20 Assertions)

**Auth & Feature:**

- [ ] Unauthenticated → 401
- [ ] Feature disabled → 403

**CRUD pro Endpoint:**

- [ ] POST → 201 (Happy Path)
- [ ] POST → 400 (Validierungsfehler)
- [ ] POST → 409 (Duplikat)
- [ ] GET → 200 (paginiert, korrekte Struktur)
- [ ] PATCH → 200 (Update)
- [ ] DELETE → 200 (Soft-Delete)

**RLS:**

- [ ] Tenant A kann Tenant B Daten nicht sehen

### Phase 4 — Definition of Done

- [ ] > = 20 API Integration Tests
- [ ] Alle Tests grün
- [ ] Tenant-Isolation verifiziert
- [ ] Addon-Flag-Gating verifiziert
- [ ] Pagination verifiziert auf List-Endpoints

---

## Phase 5: Frontend

> **Abhängigkeit:** Phase 2 complete (Backend-Endpoints verfügbar)
> **Referenz:** `frontend/src/routes/(app)/(shared)/{bestehendes_modul}/`

### Route-Struktur

```
frontend/src/routes/(app)/
    (shared)/{feature}/
        +page.svelte                # Hauptseite (rollenabhängig)
        +page.server.ts             # Auth + SSR Data Loading
        _lib/
            api.ts                  # apiClient Wrapper
            types.ts                # TypeScript Interfaces
            constants.ts            # Deutsche Labels, Badges, Filter
            state.svelte.ts         # Root State (re-exports Sub-States)
            state-data.svelte.ts    # Data State ($state)
            state-ui.svelte.ts      # UI State ($state für Filter, Modals)
            {Component}.svelte      # Einzelne Komponenten

    (admin)/{feature}/
        {sub-route}/+page.svelte + +page.server.ts + _lib/
```

### Step 5.1: Hauptseite [STATUS]

**Neue Dateien:** {N}

**Qualitätsprüfung:**

```bash
cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json
cd frontend && pnpm exec eslint src/routes/(app)/(shared)/{feature}/
```

### Step 5.N: Weitere Seiten [STATUS]

{Analog}

### Frontend-Patterns (PFLICHT)

**apiClient — KRITISCH (Kaizen-Bug!):**

```typescript
// apiClient.get<T>() returned Data DIREKT (bereits unwrapped)
const data = await apiClient.get<MyType>('/my-endpoint');
// data IST das MyType Objekt — NICHT { success, data: MyType }
```

**State Management (Svelte 5 Runes):**

```typescript
// state-data.svelte.ts
let items = $state<MyType[]>([]);
let selected = $state<MyType | null>(null);
```

**+page.server.ts Pattern:**

```typescript
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (!token) redirect(302, '/login');
  const { user } = await parent();
  // Feature Check + Data Loading
};
```

### Phase 5 — Definition of Done

- [ ] Hauptseite rendert für alle relevanten Rollen
- [ ] Alle CRUD-Operationen funktionieren über UI
- [ ] Svelte 5 Runes ($state, $derived, $effect) verwendet
- [ ] apiClient generic = DATA Shape (nicht Wrapper)
- [ ] svelte-check 0 Errors, 0 Warnings
- [ ] ESLint 0 Errors
- [ ] Navigation Config aktualisiert (alle Rollen-Menüs)
- [ ] Breadcrumb-Einträge hinzugefügt
- [ ] Responsive Design (Mobile + Desktop)
- [ ] Deutsche Labels/Texte überall

---

## Phase 6: Integration + Polish

> **Abhängigkeit:** Phase 5 complete

### Integrationen

- [ ] {System A}: {Beschreibung der Integration}
- [ ] {System B}: {Beschreibung der Integration}
- [ ] Notification-System: Persistent DB Notifications + SSE + Badges
- [ ] Audit Logging: ActivityLoggerService in alle Mutation-Services
- [ ] Dashboard: Neuer Count in Dashboard-Widget

### Dokumentation

- [ ] ADR-{N} geschrieben (Architekturentscheidungen)
- [ ] FEATURES.md aktualisiert
- [ ] Customer-Migrations synchronisiert: `./scripts/sync-customer-migrations.sh`

### Phase 6 — Definition of Done

- [ ] Alle Integrationen funktionieren end-to-end
- [ ] ADR geschrieben und reviewed
- [ ] FEATURES.md Feature-Status aktualisiert
- [ ] Keine offenen TODOs im Code (sofort implementieren, nicht TODO schreiben!)

---

## Session Tracking

> **Regel:** Jede Session = ein logischer Arbeitsblock. Nicht zu klein (1 Funktion),
> nicht zu groß (ganzes Modul). Ideal: 1-3 Stunden fokussierte Arbeit.

| Session | Phase | Beschreibung                       | Status | Datum      |
| ------- | ----- | ---------------------------------- | ------ | ---------- |
| 1       | 1     | Migration {N}: {Beschreibung}      | DONE   | YYYY-MM-DD |
| 2       | 1     | Migration {N+1}: {Beschreibung}    | DONE   | YYYY-MM-DD |
| 3       | 2     | Module Skeleton + Types + DTOs     | DONE   | YYYY-MM-DD |
| 4       | 2     | {Basis-Service} + {Config-Service} |        |            |
| 5       | 2     | {CRUD-Services}                    |        |            |
| 6       | 2     | {Core-Service} + Controller        |        |            |
| 7       | 3     | Unit Tests ({N}+ Tests)            |        |            |
| 8       | 4     | API Integration Tests ({N}+ Tests) |        |            |
| 9       | 5     | Frontend: Hauptseite               |        |            |
| 10      | 5     | Frontend: Admin-Seiten             |        |            |
| 11      | 6     | Integration + Polish + ADR         |        |            |

### Session-Protokoll (pro Session ausfüllen)

```markdown
### Session {N} — {Datum}

**Ziel:** {Was soll erreicht werden}
**Ergebnis:** {Was wurde tatsächlich erreicht}
**Neue Dateien:** {Liste}
**Geänderte Dateien:** {Liste}
**Verifikation:**

- ESLint: {0 Errors / N Errors → gefixt}
- Type-Check: {0 Errors}
- Tests: {N/N passed}
  **Abweichungen vom Plan:** {Was lief anders als geplant und warum}
  **Nächste Session:** {Was kommt als nächstes}
```

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                | Zweck               |
| ---------------------------------------------------- | ------------------- |
| `backend/src/nest/{feature}/{feature}.module.ts`     | NestJS Modul        |
| `backend/src/nest/{feature}/{feature}.controller.ts` | REST Controller     |
| `backend/src/nest/{feature}/{feature}.service.ts`    | Core Business Logic |
| `backend/src/nest/{feature}/{feature}.types.ts`      | Alle Interfaces     |
| `backend/src/nest/{feature}/dto/*.ts`                | DTOs (Zod)          |

### Backend (geändert)

| Datei                            | Änderung                        |
| -------------------------------- | ------------------------------- |
| `backend/src/nest/app.module.ts` | Module Import hinzugefügt       |
| `backend/src/utils/eventBus.ts`  | Event Interface + Emit-Methoden |

### Database (neu)

| Datei                                       | Zweck         |
| ------------------------------------------- | ------------- |
| `database/migrations/{timestamp}_{name}.ts` | Migration {N} |

### Frontend (neu)

| Pfad                                                 | Zweck        |
| ---------------------------------------------------- | ------------ |
| `frontend/src/routes/(app)/(shared)/{feature}/`      | Hauptseite   |
| `frontend/src/routes/(app)/(admin)/{feature}/{sub}/` | Admin-Seiten |

---

## Spec Deviations

> **Wichtig:** Wenn der Spec/Prompt vom tatsächlichen Code abweicht,
> IMMER dem tatsächlichen Code folgen und die Abweichung hier dokumentieren.

| #   | Spec sagt     | Tatsächlicher Code  | Entscheidung               |
| --- | ------------- | ------------------- | -------------------------- |
| D1  | {Spec-Angabe} | {Was wirklich gilt} | {Was wir machen und warum} |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

> **Regel:** Explizit dokumentieren, was NICHT gebaut wird.
> Verhindert Scope Creep und setzt Erwartungen.

1. **{Limitation A}** — {Warum nicht in V1, Alternative}
2. **{Limitation B}** — {Warum nicht in V1, Alternative}
3. **{Limitation C}** — {Warum nicht in V1, Alternative}

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- {Punkt 1}
- {Punkt 2}

### Was lief schlecht

- {Punkt 1 + wie wir es beim nächsten Mal vermeiden}
- {Punkt 2 + wie wir es beim nächsten Mal vermeiden}

### Metriken

| Metrik                    | Geplant | Tatsächlich |
| ------------------------- | ------- | ----------- |
| Sessions                  | {N}     | {N}         |
| Migrationsdateien         | {N}     | {N}         |
| Neue Backend-Dateien      | {N}     | {N}         |
| Neue Frontend-Dateien     | {N}     | {N}         |
| Geänderte Dateien         | {N}     | {N}         |
| Unit Tests                | {N}     | {N}         |
| API Tests                 | {N}     | {N}         |
| ESLint Errors bei Release | 0       | {N}         |
| Spec Deviations           | 0       | {N}         |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**

```

```

---

## Anhang: Regeln für einen guten Masterplan

### 1. Abhängigkeitsreihenfolge ist heilig

```
Phase 1 (DB) → Phase 2 (Backend) → Phase 3 (Unit Tests) → Phase 4 (API Tests) → Phase 5 (Frontend) → Phase 6 (Integration)
```

Niemals Phase 5 starten, bevor Phase 2 mindestens die Endpoints hat. Niemals Phase 3 starten, bevor Phase 2 die Services hat. Die Reihenfolge ist nicht verhandelbar.

### 2. Definition of Done = Vertrag mit dir selbst

Jede Phase hat eine DoD. Jeder Punkt ist eine Checkbox. Du darfst die nächste Phase NICHT starten, bevor alle Checkboxen der aktuellen Phase grün sind. Ausnahmen sind erlaubt — aber müssen mit Begründung dokumentiert werden.

### 3. Session = Atomare Einheit

Eine Session hat:

- **Ein Ziel** (nicht fünf)
- **Verifikation am Ende** (ESLint, Type-Check, Tests)
- **Protokoll** (was wurde gemacht, was wich ab)

Wenn du eine Session nicht sauber abschließen kannst, ist sie zu groß. Teile sie auf.

### 4. Verifikation ist nicht optional

Nach JEDER Session:

```bash
# Backend
docker exec assixx-backend pnpm exec eslint backend/src/nest/{feature}/
docker exec assixx-backend pnpm run type-check

# Frontend
cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json

# Tests
docker exec assixx-backend pnpm exec vitest run backend/src/nest/{feature}/
```

Wenn du das nicht machst, akkumulierst du Schulden. Schulden kosten Zinsen. Session 22 im Vacation-Plan war ein reiner Refactoring-Session, weil die Datei über 800 Zeilen wuchs. Das hätte man früher fangen können.

### 5. Risk Register ernst nehmen

Jedes identifizierte Risiko braucht:

- **Impact** (was passiert im Worst Case)
- **Mitigation** (was tun wir dagegen)
- **Verifikation** (wie prüfen wir, dass die Mitigation wirkt)

"Aufpassen" ist keine Mitigation. "Unit Test für Szenario X" ist eine.

### 6. Spec Deviations sofort dokumentieren

Wenn der Spec etwas sagt, der Code aber anders funktioniert → SOFORT in die Deviations-Tabelle. Nicht "merke ich mir" — aufschreiben. Session 5 im Vacation-Plan hat 3 Deviations gefunden, die ohne Dokumentation zu Bugs geführt hätten.

### 7. Known Limitations = Anti-Scope-Creep

Schreibe explizit auf, was du NICHT baust. Das verhindert:

- Scope Creep ("ach, könnten wir nicht auch noch...")
- Falsche Erwartungen ("ich dachte das kann auch X")
- Endlose Sessions ("nur noch dieses eine Feature...")

### 8. Masterplan IMMER auf Englisch

Der gesamte Masterplan — Phasen, Steps, Session-Protokolle, Risk Register, Spec Deviations, Known Limitations, Post-Mortem — wird auf Englisch geschrieben. Keine Ausnahmen. Deutsche Labels/Texte im Frontend-Code sind davon unberührt, aber die Dokumentation des Plans ist Englisch.

### 9. Post-Mortem = Lernen für das nächste Feature

Nach Abschluss: Was lief gut? Was lief schlecht? Konkrete Metriken (geplant vs. tatsächlich). Das ist kein Overhead — das ist Investment in dein zukünftiges Ich.
