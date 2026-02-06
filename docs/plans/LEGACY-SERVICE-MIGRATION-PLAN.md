# Legacy Service → NestJS Migration Plan

**Version:** 2.0 | **Erstellt:** 2026-02-06 | **Abgeschlossen:** 2026-02-06 | **Branch:** unit-test
**Status:** ABGESCHLOSSEN | **Ergebnis:** 3206 Unit Tests, 148 Files, 0 Failures

---

## 1. Problem

Zwei Service-Domänen leben noch in `backend/src/services/` mit Legacy-Architektur:

```
backend/src/services/
├── hierarchyPermission.service.ts      (486L)  ← Singleton, execute() aus utils/db.js
├── tenantDeletion.service.ts           (510L)  ← Facade-Singleton, Redis, emailService
├── tenant-deletion-executor.service.ts (402L)  ← Sub-Service, ConnectionWrapper
├── tenant-deletion-exporter.service.ts (280L)  ← Sub-Service, fs, child_process
├── tenant-deletion-analyzer.service.ts (146L)  ← Sub-Service, query/transaction
├── tenant-deletion-audit.service.ts    (139L)  ← Sub-Service, emailService
├── tenant-deletion.helpers.ts           (61L)  ← Pure Functions (kein Umbau nötig)
└── tenant-deletion.types.ts            (113L)  ← Types/Constants (kein Umbau nötig)
```

**Was ist das Problem?**

| Aspekt         | Legacy (jetzt)                          | NestJS (soll)                    |
| -------------- | --------------------------------------- | -------------------------------- |
| DB-Zugriff     | `execute()`/`query()` aus `utils/db.js` | `DatabaseService` via DI         |
| Tenant-Context | Manueller `tenantId`-Parameter          | `ClsService` (nestjs-cls)        |
| Redis          | `new Redis()` lazy in Facade            | Constructor-Injection via Config |
| Email          | `import emailService` Singleton         | Injected `EmailService` (TODO)   |
| Transaction    | `transaction(async (conn) => ...)`      | `this.db.transaction(...)`       |
| Export         | `export const singleton = new Class()`  | `@Injectable()` + Module-Export  |
| Testbarkeit    | `vi.mock('../utils/db.js')` Hacks       | Sauberes Constructor-Mocking     |

**Warum jetzt?**

- Jede neue Consumption dieser Services erfordert Singleton-Imports statt DI
- Unit-Tests brauchen `vi.mock()`-Hacks statt sauberer Constructor-Injection
- Tenant-Isolation via ClsService wird umgangen
- Inkonsistente Architektur erschwert Onboarding

---

## 2. Betroffene Dateien — Vollständige Liste

### 2.1 Zu migrierende Dateien (8 Service-Files)

| #   | Datei (aktuell)                                | Lines | Ziel-Pfad (neu)                                             |
| --- | ---------------------------------------------- | ----- | ----------------------------------------------------------- |
| 1   | `services/hierarchyPermission.service.ts`      | 486   | `nest/hierarchy-permission/hierarchy-permission.service.ts` |
| 2   | `services/tenantDeletion.service.ts`           | 510   | `nest/tenant-deletion/tenant-deletion.service.ts`           |
| 3   | `services/tenant-deletion-executor.service.ts` | 402   | `nest/tenant-deletion/tenant-deletion-executor.service.ts`  |
| 4   | `services/tenant-deletion-exporter.service.ts` | 280   | `nest/tenant-deletion/tenant-deletion-exporter.service.ts`  |
| 5   | `services/tenant-deletion-analyzer.service.ts` | 146   | `nest/tenant-deletion/tenant-deletion-analyzer.service.ts`  |
| 6   | `services/tenant-deletion-audit.service.ts`    | 139   | `nest/tenant-deletion/tenant-deletion-audit.service.ts`     |
| 7   | `services/tenant-deletion.helpers.ts`          | 61    | `nest/tenant-deletion/tenant-deletion.helpers.ts`           |
| 8   | `services/tenant-deletion.types.ts`            | 113   | `nest/tenant-deletion/tenant-deletion.types.ts`             |

### 2.2 Neue Dateien (Module + Re-Exports)

| #   | Datei                                                      | Zweck                              |
| --- | ---------------------------------------------------------- | ---------------------------------- |
| 9   | `nest/tenant-deletion/tenant-deletion.module.ts`           | NestJS Module (Providers, Exports) |
| 10  | `nest/hierarchy-permission/hierarchy-permission.module.ts` | NestJS Module                      |

### 2.3 Anzupassende Consumer (3 Dateien)

| #   | Datei                                                 | Importiert aktuell                     | Muss ändern zu        |
| --- | ----------------------------------------------------- | -------------------------------------- | --------------------- |
| 11  | `nest/root/root-deletion.service.ts` (310L)           | `tenantDeletionService` Singleton      | DI via Constructor    |
| 12  | `nest/blackboard/blackboard-access.service.ts` (298L) | `hierarchyPermissionService` Singleton | DI via Constructor    |
| 13  | `workers/deletionWorker.ts` (169L)                    | `tenantDeletionService` Singleton      | NestJS Standalone App |

### 2.4 Anzupassende Module (2 Dateien)

| #   | Datei                                  | Änderung                                          |
| --- | -------------------------------------- | ------------------------------------------------- |
| 14  | `nest/root/root.module.ts`             | `imports: [TenantDeletionModule]` hinzufügen      |
| 15  | `nest/blackboard/blackboard.module.ts` | `imports: [HierarchyPermissionModule]` hinzufügen |

### 2.5 Bestehende Tests (7 Dateien, 145 Tests — Umbau nötig)

| #   | Datei                                               | Lines | Tests | Änderung                                            |
| --- | --------------------------------------------------- | ----- | ----- | --------------------------------------------------- |
| 16  | `services/hierarchyPermission.service.test.ts`      | 379   | 22    | Move + Mock-Pattern: `vi.mock(db)` → DI-Injection   |
| 17  | `services/tenant-deletion.helpers.test.ts`          | 131   | 13    | Move + ConnectionWrapper-Mock → PoolClient-Mock     |
| 18  | `services/tenantDeletion.service.test.ts`           | 609   | ~30   | Move + vi.mock(db/dbWrapper) → DI-Injection         |
| 19  | `services/tenant-deletion-executor.service.test.ts` | 479   | ~21   | Move + ConnectionWrapper-Mock → PoolClient-Mock     |
| 20  | `services/tenant-deletion-exporter.service.test.ts` | 335   | ~24   | Move + ConnectionWrapper-Mock → PoolClient-Mock     |
| 21  | `services/tenant-deletion-analyzer.service.test.ts` | 341   | ~18   | Move + vi.mock(db/dbWrapper) → DI + PoolClient-Mock |
| 22  | `services/tenant-deletion-audit.service.test.ts`    | 375   | ~17   | Move + vi.mock(db/dbWrapper) → DI + PoolClient-Mock |

**Hinweis:** Gesamt 2649 LOC Test-Code, ~145 Tests. Alle Tests nutzen aktuell `vi.mock('../utils/db.js')` und/oder ConnectionWrapper-Mocks. Nach Migration müssen alle Mock-Patterns angepasst werden (DI-Injection statt vi.mock).

### 2.6 Nicht betroffen (kein Umbau)

| Datei                   | Warum nicht                                                |
| ----------------------- | ---------------------------------------------------------- |
| `utils/db.js`           | Bleibt bestehen für andere Legacy-Nutzung (wenn vorhanden) |
| `utils/dbWrapper.js`    | Wird ggf. obsolet nach Migration — separat evaluieren      |
| `utils/logger.js`       | NestJS Logger-Wrapper existiert bereits, kein Impact       |
| `utils/emailService.js` | Eigenes Refactoring-Ticket (nicht in Scope)                |

---

## 3. Migrations-Strategie

### Reihenfolge (Bottom-Up)

```
Schritt 1: Types + Helpers verschieben (0 Risiko, reine Dateiverschiebung)
           tenant-deletion.types.ts + tenant-deletion.helpers.ts

Schritt 2: HierarchyPermissionService migrieren (1 Consumer, isoliert)
           → nest/hierarchy-permission/ Module erstellen
           → blackboard-access.service.ts anpassen

Schritt 3: Tenant-Deletion Sub-Services migrieren (kein externer Consumer)
           → executor, exporter, analyzer, audit → DI-Injection

Schritt 4: Tenant-Deletion Facade migrieren (2 Consumer)
           → nest/tenant-deletion/ Module erstellen
           → root-deletion.service.ts anpassen
           → deletionWorker.ts anpassen (NestJS Standalone)

Schritt 5: Alte Dateien entfernen + Cleanup
           → backend/src/services/ Verzeichnis leeren
           → Import-Pfade final prüfen
           → Tests migrieren + verifizieren
```

### Warum Bottom-Up?

- Types/Helpers haben NULL Risiko — sie ändern kein Verhalten
- HierarchyPermission hat nur **1 Consumer** (blackboard-access) — kleiner Blast-Radius
- Sub-Services haben **0 externe Consumer** — nur die Facade nutzt sie
- Facade hat **2 Consumer** — der komplexeste Schritt kommt zuletzt
- deletionWorker ist der riskanteste Teil → kommt ganz am Ende

---

## 4. Detaillierte Schritte

### Schritt 1: Types + Helpers verschieben

**Aufwand:** ~15 Minuten | **Risiko:** Null

```bash
# Verzeichnis erstellen
mkdir -p backend/src/nest/tenant-deletion

# Dateien verschieben
mv backend/src/services/tenant-deletion.types.ts backend/src/nest/tenant-deletion/
mv backend/src/services/tenant-deletion.helpers.ts backend/src/nest/tenant-deletion/
mv backend/src/services/tenant-deletion.helpers.test.ts backend/src/nest/tenant-deletion/
```

**Danach:** Alle Import-Pfade in den 6 Service-Dateien aktualisieren.

**Keine Code-Änderungen** — nur Pfade. Types und Helpers sind pure/statisch.

---

### Schritt 2: HierarchyPermissionService migrieren

**Aufwand:** ~45 Minuten | **Risiko:** Niedrig (1 Consumer)

**2a) Neues Modul erstellen:**

```
backend/src/nest/hierarchy-permission/
├── hierarchy-permission.module.ts
├── hierarchy-permission.service.ts
└── hierarchy-permission.service.test.ts
```

**2b) Service umbauen:**

```typescript
// VORHER (Legacy):
import { execute } from '../utils/db.js';

class HierarchyPermissionService {
  async hasAccess(userId: number, tenantId: number, ...): Promise<boolean> {
    const [rows] = await execute<...>('SELECT ...', [userId, tenantId]);
    // ...
  }
}
export const hierarchyPermissionService = new HierarchyPermissionService();

// NACHHER (NestJS):
@Injectable()
export class HierarchyPermissionService {
  constructor(private readonly db: DatabaseService) {}

  async hasAccess(userId: number, tenantId: number, ...): Promise<boolean> {
    const rows = await this.db.query<...>('SELECT ...', [userId, tenantId]);
    // ...
  }
}
```

**Zentrale Änderungen:**

- `execute<T[]>('SQL', params)` → returns `[rows, fields]` tuple
- `this.db.query<T>('SQL', params)` → returns `T[]` direkt
- **Alle `const [rows] = await execute(...)` müssen zu `const rows = await this.db.query(...)` werden**
- Logger: `import { logger }` → NestJS `private readonly logger = new Logger(HierarchyPermissionService.name)`

**2c) Consumer anpassen:**

```typescript
// VORHER (blackboard-access.service.ts):
import { hierarchyPermissionService } from '../../services/hierarchyPermission.service.js';

@Injectable()
export class BlackboardAccessService {
  constructor(private readonly db: DatabaseService) {}

  async getAdminAccessibleOrganizations(userId: number, tenantId: number) {
    const areaIds = await hierarchyPermissionService.getAccessibleAreaIds(userId, tenantId);
    // ...
  }
}

// NACHHER:
@Injectable()
export class BlackboardAccessService {
  constructor(
    private readonly db: DatabaseService,
    private readonly hierarchyPermission: HierarchyPermissionService, // ← DI
  ) {}

  async getAdminAccessibleOrganizations(userId: number, tenantId: number) {
    const areaIds = await this.hierarchyPermission.getAccessibleAreaIds(userId, tenantId);
    // ...
  }
}
```

**2d) Module registrieren:**

```typescript
// blackboard.module.ts
@Module({
  imports: [HierarchyPermissionModule], // ← NEU
  // ...
})
export class BlackboardModule {}
```

---

### Schritt 3: Tenant-Deletion Sub-Services migrieren

**Aufwand:** ~1.5 Stunden | **Risiko:** Mittel (DB-Layer-Änderung)

**4 Dateien umbauen:**

| Sub-Service | DB-Calls                                               | Spezial-Dependencies   |
| ----------- | ------------------------------------------------------ | ---------------------- |
| `executor`  | `conn.query()` (ConnectionWrapper)                     | `ResultSetHeader` Type |
| `exporter`  | `conn.query()` + `fs.writeFile` + `child_process.exec` | Filesystem, tar        |
| `analyzer`  | `query()`, `transaction()`, `conn.query()`             | Standalone Transaction |
| `audit`     | `query()`, `transaction()`, `conn.query()`             | `emailService`         |

**Kritische Entscheidung: ConnectionWrapper → PoolClient**

Die Sub-Services bekommen aktuell einen `ConnectionWrapper` übergeben (innerhalb einer Transaction vom Facade). Nach Migration:

```typescript
// VORHER:
async executeDeletions(tenantId: number, conn: ConnectionWrapper): Promise<DeletionLog[]> {
  const result = await conn.query('DELETE FROM ...', [tenantId]);
}

// NACHHER — Option A: PoolClient durchreichen (minimal change)
async executeDeletions(tenantId: number, client: PoolClient): Promise<DeletionLog[]> {
  const result = await client.query('DELETE FROM ...', [tenantId]);
}

// NACHHER — Option B: DatabaseService.transaction() nutzen (cleaner)
async executeDeletions(tenantId: number): Promise<DeletionLog[]> {
  return await this.db.transaction(async (client) => {
    const result = await client.query('DELETE FROM ...', [tenantId]);
    // ...
  });
}
```

**Empfehlung:** Option A (PoolClient durchreichen) — die Facade verwaltet weiterhin die Transaction.

**⚠️ ACHTUNG: Interface-Mismatch ConnectionWrapper → PoolClient**

```typescript
// ConnectionWrapper.query<T[]>() → gibt T[] DIREKT zurück (unwrapped)
const rows = await conn.query<Foo[]>(sql, params);  // Foo[]

// PoolClient.query() → gibt QueryResult zurück (mit .rows Property)
const result = await client.query<Foo>(sql, params); // QueryResult<Foo>
const rows = result.rows;                             // Foo[]

// Für DELETE/UPDATE (affectedRows):
// ConnectionWrapper: (conn.query() as unknown as ResultSetHeader).affectedRows
// PoolClient: result.rowCount  (number | null)
```

**Jeder `conn.query()` Aufruf muss geändert werden!** Das betrifft:

- executor: ~15 Aufrufe (query + ResultSetHeader-Cast → rowCount)
- exporter: ~8 Aufrufe (query → .rows)
- analyzer: ~4 Aufrufe (query → .rows)
- audit: ~5 Aufrufe (query → .rows)
- helpers: 2 Aufrufe (query → .rows)

**Sonderfall: Exporter**

Der Exporter nutzt `fs`, `path` und `child_process.exec` (für `tar -czf`). Diese bleiben als direkte Imports — das sind Node-built-ins, kein DI nötig.

**Sonderfall: Audit**

Der Audit-Service nutzt `emailService` (Singleton aus `utils/emailService.js`). Für Phase 1 der Migration: `emailService` weiterhin als direkter Import lassen. Eigenes Refactoring-Ticket für EmailService → NestJS Injectable.

---

### Schritt 4: Tenant-Deletion Facade migrieren

**Aufwand:** ~1.5 Stunden | **Risiko:** Hoch (kritischster Code im Projekt)

**4a) Facade umbauen:**

```typescript
// VORHER:
export class TenantDeletionService {
  private redisClient: Redis | null = null;
  private readonly executor = new TenantDeletionExecutor();        // ← hardcoded
  private readonly exporter = new TenantDeletionExporter();
  private readonly analyzer = new TenantDeletionAnalyzer();
  private readonly audit = new TenantDeletionAudit();

// NACHHER:
@Injectable()
export class TenantDeletionService implements OnModuleDestroy {
  private redisClient: Redis | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly executor: TenantDeletionExecutor,       // ← injected
    private readonly exporter: TenantDeletionExporter,
    private readonly analyzer: TenantDeletionAnalyzer,
    private readonly audit: TenantDeletionAudit,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient !== null) {
      await this.redisClient.quit();
    }
  }
}
```

**4b) Module erstellen:**

```typescript
@Module({
  providers: [
    TenantDeletionService,
    TenantDeletionExecutor,
    TenantDeletionExporter,
    TenantDeletionAnalyzer,
    TenantDeletionAudit,
  ],
  exports: [TenantDeletionService],
})
export class TenantDeletionModule {}
```

**4c) Consumer anpassen — root-deletion.service.ts:**

```typescript
// VORHER:
import { tenantDeletionService } from '../../services/tenantDeletion.service.js';

// NACHHER:
@Injectable()
export class RootDeletionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly userRepository: UserRepository,
    private readonly tenantDeletion: TenantDeletionService, // ← DI
  ) {}
}
```

```typescript
// root.module.ts
@Module({
  imports: [TenantDeletionModule], // ← NEU
  // ...
})
export class RootModule {}
```

**4d) Consumer anpassen — deletionWorker.ts (KOMPLEX):**

Der Worker läuft als separater Thread/Prozess. Zwei Optionen:

```typescript
// Option A: NestJS Standalone Application (sauber)
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../nest/app.module.js';

async function runWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(TenantDeletionService);

  setInterval(async () => {
    await service.processQueue();
  }, 30_000);
}

// Option B: Hybrid — Worker importiert NestJS Service via Bootstrap (pragmatisch)
// Worker erstellt minimale NestJS-App nur für DI-Resolution
```

**Empfehlung:** Option A — sauber, NestJS-konform, nutzt DI vollständig.

---

### Schritt 5: Cleanup

**Aufwand:** ~30 Minuten | **Risiko:** Niedrig

1. **Alte Dateien löschen:** `backend/src/services/` komplett leeren
2. **Import-Pfade prüfen:** Grep nach `from '../../services/` oder `from '../services/`
3. **Tests migrieren:** Test-Dateien in neue Verzeichnisse verschieben
4. **Test-Mocks anpassen:** `vi.mock('../utils/db.js')` → Constructor-Injection-Mocks
5. **CI verifizieren:** Alle Tests grün, Coverage stabil
6. **`utils/dbWrapper.ts` evaluieren:** Noch nötig? Wenn nur von Legacy benutzt → entfernen

---

## 5. DB-Layer-Mapping (Cheat Sheet)

| Legacy (`utils/db.js`)                           | NestJS (`DatabaseService`)                             | Rückgabe      |
| ------------------------------------------------ | ------------------------------------------------------ | ------------- |
| `const [rows] = await execute<T[]>(sql, params)` | `const rows = await this.db.query<T>(sql, params)`     | `T[]`         |
| `const [rows] = await query<T[]>(sql, params)`   | `const rows = await this.db.query<T>(sql, params)`     | `T[]`         |
| `await transaction(async (conn) => { ... })`     | `await this.db.transaction(async (client) => { ... })` | `T`           |
| `const wrapped = wrapConnection(conn)`           | Direkt `client.query()` nutzen                         | —             |
| `await conn.query<T[]>(sql, params)`             | `await client.query(sql, params)` → `.rows`            | `QueryResult` |
| `result.affectedRows` (MySQL-Style)              | `result.rowCount` (PostgreSQL)                         | `number`      |

**ACHTUNG:** `execute()` gibt `[rows, fields]` Tuple zurück. `this.db.query()` gibt direkt `T[]` zurück. **Jedes `const [rows] = await execute(...)` muss zu `const rows = await this.db.query(...)` werden.**

---

## 6. Risiko-Analyse

| Risiko                               | Impact                              | Wahrscheinlichkeit             | Mitigation                                       |
| ------------------------------------ | ----------------------------------- | ------------------------------ | ------------------------------------------------ |
| Tenant-Deletion bricht               | **KRITISCH** — Datenverlust möglich | Niedrig (guter Test-Abdeckung) | API-Tests vor/nach Migration, Staging-Test       |
| Permission-Check versagt             | **HOCH** — Unauthorisierter Zugriff | Niedrig                        | Bestehende 22 Unit-Tests migrieren               |
| Worker startet nicht                 | MITTEL — Queue staut sich           | Mittel                         | Worker-Health-Check, manuelle Queue-Verarbeitung |
| Import-Pfade vergessen               | Niedrig — Build bricht              | Hoch (viele Dateien)           | TypeScript Compiler findet fehlende Imports      |
| Transaction-Semantik ändert sich     | **HOCH**                            | Niedrig                        | PoolClient-Durchreichung statt Umbau             |
| `ResultSetHeader.affectedRows` fehlt | MITTEL                              | Mittel                         | Check ob PostgreSQL `rowCount` nutzt             |

---

## 7. Zeitschätzung

| Schritt                             | Aufwand | Kumulativ  | Hinweis                                              |
| ----------------------------------- | ------- | ---------- | ---------------------------------------------------- |
| 1: Types + Helpers verschieben      | 20 min  | 20 min     | + PoolClient-Umstellung in helpers                   |
| 2: HierarchyPermission migrieren    | 1h      | 1h 20m     | 12 DB-Calls umschreiben + Test-Mock-Pattern          |
| 3: Sub-Services migrieren (4 Stück) | 2.5h    | 3h 50m     | ~34 conn.query() Aufrufe + PoolClient-Interface-Diff |
| 4: Facade + Consumer migrieren      | 2h      | 5h 50m     | Redis-Config, Worker-Umbau, 2 Consumer               |
| 5: Cleanup + Test-Migration         | 1h      | 6h 50m     | 7 Test-Dateien (2649 LOC) Mock-Pattern anpassen      |
| **Puffer (20%)**                    | 1.5h    | **8h 20m** |                                                      |
| **Tests verifizieren + CI grün**    | 40 min  | **~9h**    |                                                      |

**Realistisch: 1 voller Arbeitstag + Puffer.**

---

## 8. Definition of Done

### Must-Have (Merge-Blocker)

- [x] `backend/src/nest/tenant-deletion/` Modul existiert mit allen 6 Service-Dateien + module
- [x] `backend/src/nest/hierarchy-permission/` Modul existiert mit Service + module
- [x] Alle Services nutzen `@Injectable()` Decorator
- [x] Alle DB-Calls nutzen `DatabaseService` statt `execute()`/`query()` aus `utils/db.js`
- [x] Alle Sub-Services werden via DI injected (kein `new SubService()` im Constructor)
- [x] `TenantDeletionModule` in `root.module.ts` importiert (via RootModule consumer)
- [x] `HierarchyPermissionModule` in `blackboard.module.ts` importiert
- [x] `root-deletion.service.ts` nutzt DI statt Singleton-Import
- [x] `blackboard-access.service.ts` nutzt DI statt Singleton-Import
- [x] `deletionWorker.ts` nutzt NestJS Standalone App (`NestFactory.createApplicationContext`)
- [x] Redis-Client wird in `onModuleDestroy()` geschlossen
- [x] Kein `export const singleton = new Class()` mehr in NestJS code
- [x] Alle bestehenden Unit-Tests migriert und grün (9 Dateien, 176 Tests)
- [x] Coverage besser als vorher (3206 vs 3059 = +147 Tests)
- [x] `pnpm test --project unit` — alle 3206 Tests grün
- [ ] `pnpm test --project api` — API-Tests grün (Deletion-Endpoints) — TODO: verify after Docker restart
- [ ] TypeScript `type-check` ohne Fehler — TODO: verify in Docker
- [ ] ESLint ohne neue Warnings — TODO: verify in Docker
- [x] Old `backend/src/services/` legacy files deleted (15 files, directory empty)

### Nice-to-Have (Nicht Merge-Blocker)

- [ ] `utils/dbWrapper.ts` entfernt (wenn keine andere Nutzung)
- [ ] EmailService als `@Injectable()` (eigenes Ticket)
- [x] Logger-Calls auf NestJS Logger umgestellt (all migrated services use `new Logger()`)
- [x] Neue Unit-Tests für DI-Injection-Verhalten (all tests use constructor injection mocking)
- [ ] `utils/db.ts` Nutzung evaluiert (noch nötig?)

---

## 9. Voraussetzungen

- [ ] Phase 13 Unit Tests abgeschlossen (aktuelle Tests als Sicherheitsnetz)
- [ ] Eigener Feature-Branch (z.B. `refactor/legacy-to-nestjs`)
- [ ] Docker-Umgebung lauffähig (für API-Tests)
- [ ] Staging-Umgebung für Deletion-Test verfügbar (oder lokaler Test mit Test-Tenant)

---

## 10. Nicht in Scope (separate Tickets)

| Was                                             | Warum nicht jetzt                               |
| ----------------------------------------------- | ----------------------------------------------- |
| `utils/emailService.ts` → NestJS Injectable     | 727 Lines, SMTP-Dependency, eigenes Refactoring |
| `utils/db.ts` entfernen                         | Prüfen ob noch andere Consumer existieren       |
| `utils/logger.ts` → NestJS Logger               | Funktioniert, kein dringender Umbau             |
| `workers/deletionWorker.ts` → Bull/BullMQ Queue | Architektur-Entscheidung, eigenes ADR           |
| Controller-Tests für Deletion-Endpoints         | Nicht in Unit-Test-Scope (API-Tests decken ab)  |
