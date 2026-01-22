# Feature Visits System - Implementation Plan

> **Created:** 2026-01-21
> **Status:** Calendar Implemented (KVP/Surveys pending)
> **Author:** Claude

---

## Problem

Sidebar notification badges zeigen aktuell:

- **Calendar:** Alle upcoming events (7 Tage) - resettet nie
- **KVP:** Unread count - kein klares Reset-Konzept
- **Surveys:** Unread count - kein klares Reset-Konzept

**Gewünschtes Verhalten:** Badge resettet wenn User die Seite besucht (per User persistiert).

---

## Lösung: `feature_visits` Tabelle

Generische Tabelle die trackt wann ein User ein Feature zuletzt besucht hat.

```
┌─────────────────────────────────────────────────────────────┐
│  feature_visits                                              │
├─────────────────────────────────────────────────────────────┤
│  id              SERIAL PRIMARY KEY                          │
│  tenant_id       INTEGER NOT NULL → tenants(id)              │
│  user_id         INTEGER NOT NULL → users(id)                │
│  feature         VARCHAR(50) NOT NULL                        │
│  last_visited_at TIMESTAMPTZ DEFAULT NOW()                   │
│  created_at      TIMESTAMPTZ DEFAULT NOW()                   │
│  updated_at      TIMESTAMPTZ DEFAULT NOW()                   │
├─────────────────────────────────────────────────────────────┤
│  UNIQUE(user_id, feature, tenant_id)                         │
│  RLS: tenant_isolation                                       │
└─────────────────────────────────────────────────────────────┘
```

### Unterstützte Features

| Feature    | Badge zeigt aktuell | Badge zeigt neu                      |
| ---------- | ------------------- | ------------------------------------ |
| `calendar` | Upcoming 7 days     | Events erstellt seit letztem Besuch  |
| `kvp`      | Unread count        | KVP erstellt seit letztem Besuch     |
| `surveys`  | Unread count        | Surveys erstellt seit letztem Besuch |

---

## Phase 1: Database Migration

### Datei: `database/migrations/003-feature-visits.sql`

```sql
-- =====================================================
-- Migration: Feature Visits Tracking
-- Date: 2026-01-21
-- Author: Claude
-- Purpose: Track user's last visit per feature for badge reset
-- =====================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS feature_visits (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,  -- 'calendar', 'kvp', 'surveys'
    last_visited_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_feature_tenant UNIQUE(user_id, feature, tenant_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_feature_visits_user ON feature_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_visits_tenant ON feature_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_visits_feature ON feature_visits(feature);

-- 3. RLS
ALTER TABLE feature_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_visits FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON feature_visits
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- 4. Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON feature_visits TO app_user;
GRANT USAGE, SELECT ON SEQUENCE feature_visits_id_seq TO app_user;

-- 5. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_feature_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feature_visits_updated_at
    BEFORE UPDATE ON feature_visits
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_visits_updated_at();
```

### Ausführung

```bash
# 1. Backup erstellen
cd /home/scs/projects/Assixx
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_${TIMESTAMP}.dump

# 2. Migration ausführen
docker cp database/migrations/003-feature-visits.sql assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/003-feature-visits.sql

# 3. Customer sync
./scripts/sync-customer-migrations.sh

# 4. Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d feature_visits"
```

---

## Phase 2: Backend Implementation

### 2.1 Modul-Struktur

```
backend/src/nest/feature-visits/
├── feature-visits.module.ts
├── feature-visits.service.ts
├── feature-visits.controller.ts
└── dto/
    └── mark-visited.dto.ts
```

### 2.2 DTO

```typescript
// dto/mark-visited.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MarkVisitedSchema = z.object({
  feature: z.enum(['calendar', 'kvp', 'surveys']),
});

export class MarkVisitedDto extends createZodDto(MarkVisitedSchema) {}
```

### 2.3 Service

```typescript
// feature-visits.service.ts
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class FeatureVisitsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Upsert: Mark feature as visited (last_visited_at = NOW())
   */
  async markVisited(tenantId: number, userId: number, feature: string): Promise<void> {
    await this.db.query(
      `INSERT INTO feature_visits (tenant_id, user_id, feature, last_visited_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, feature, tenant_id)
       DO UPDATE SET last_visited_at = NOW(), updated_at = NOW()`,
      [tenantId, userId, feature],
    );
  }

  /**
   * Get last visit timestamp (or null if never visited)
   */
  async getLastVisited(tenantId: number, userId: number, feature: string): Promise<Date | null> {
    const result = await this.db.query<{ last_visited_at: Date }>(
      `SELECT last_visited_at FROM feature_visits
       WHERE tenant_id = $1 AND user_id = $2 AND feature = $3`,
      [tenantId, userId, feature],
    );
    return result.rows[0]?.last_visited_at ?? null;
  }
}
```

### 2.4 Controller

```typescript
// feature-visits.controller.ts
import { Body, Controller, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { NestAuthUser } from '../common/types/auth.types';
import { MarkVisitedDto } from './dto/mark-visited.dto';
import { FeatureVisitsService } from './feature-visits.service';

@Controller('feature-visits')
export class FeatureVisitsController {
  constructor(private readonly featureVisitsService: FeatureVisitsService) {}

  @Post('mark')
  async markVisited(
    @TenantId() tenantId: number,
    @CurrentUser() user: NestAuthUser,
    @Body() dto: MarkVisitedDto,
  ): Promise<{ success: true }> {
    await this.featureVisitsService.markVisited(tenantId, user.id, dto.feature);
    return { success: true };
  }
}
```

### 2.5 Module

```typescript
// feature-visits.module.ts
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { FeatureVisitsController } from './feature-visits.controller';
import { FeatureVisitsService } from './feature-visits.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FeatureVisitsController],
  providers: [FeatureVisitsService],
  exports: [FeatureVisitsService],
})
export class FeatureVisitsModule {}
```

### 2.6 Count Queries anpassen

#### CalendarService.getUpcomingCount()

```typescript
// Vorher:
SELECT COUNT(*) FROM calendar_events
WHERE tenant_id = $1
  AND start_time > NOW()
  AND start_time < NOW() + INTERVAL '7 days'
  AND status != 'cancelled'
  -- org_level checks...

// Nachher:
SELECT COUNT(*) FROM calendar_events ce
WHERE ce.tenant_id = $1
  AND ce.start_time > NOW()
  AND ce.start_time < NOW() + INTERVAL '7 days'
  AND ce.status != 'cancelled'
  AND ce.created_at > COALESCE(
    (SELECT last_visited_at FROM feature_visits
     WHERE tenant_id = $1 AND user_id = $2 AND feature = 'calendar'),
    '1970-01-01'::timestamptz
  )
  -- org_level checks...
```

Gleiche Logik für KVP und Surveys.

---

## Phase 3: Frontend Implementation

### 3.1 API Function

```typescript
// frontend/src/lib/api/feature-visits.ts
export type VisitableFeature = 'calendar' | 'kvp' | 'surveys';

export async function markFeatureVisited(feature: VisitableFeature): Promise<void> {
  try {
    await fetch('/api/v2/feature-visits/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature }),
      credentials: 'include',
    });
  } catch (error) {
    console.error(`Failed to mark ${feature} as visited:`, error);
  }
}
```

### 3.2 Calendar Page Integration

```svelte
<!-- frontend/src/routes/(app)/calendar/+page.svelte -->
<script lang="ts">
  import { markFeatureVisited } from '$lib/api/feature-visits';
  import { notificationStore } from '$lib/stores/notification.store.svelte';

  // Mark as visited on mount (once)
  let hasMarkedVisit = $state(false);

  $effect(() => {
    if (!hasMarkedVisit) {
      hasMarkedVisit = true;
      void markFeatureVisited('calendar');
      notificationStore.resetCount('calendar');
    }
  });

  // ... rest of component
</script>
```

### 3.3 KVP Page Integration

```svelte
<!-- frontend/src/routes/(app)/kvp/+page.svelte -->
<script lang="ts">
  import { markFeatureVisited } from '$lib/api/feature-visits';
  import { notificationStore } from '$lib/stores/notification.store.svelte';

  let hasMarkedVisit = $state(false);

  $effect(() => {
    if (!hasMarkedVisit) {
      hasMarkedVisit = true;
      void markFeatureVisited('kvp');
      notificationStore.resetCount('kvp');
    }
  });
</script>
```

### 3.4 Surveys Page Integration

```svelte
<!-- frontend/src/routes/(app)/survey-admin/+page.svelte (oder entsprechende Survey-Seite) -->
<script lang="ts">
  import { markFeatureVisited } from '$lib/api/feature-visits';
  import { notificationStore } from '$lib/stores/notification.store.svelte';

  let hasMarkedVisit = $state(false);

  $effect(() => {
    if (!hasMarkedVisit) {
      hasMarkedVisit = true;
      void markFeatureVisited('surveys');
      notificationStore.resetCount('surveys');
    }
  });
</script>
```

---

## Implementation Checkliste

| #   | Task                                 | Status | Komponente                    |
| --- | ------------------------------------ | ------ | ----------------------------- |
| 1   | Migration SQL erstellen              | ✅     | `003-feature-visits.sql`      |
| 2   | Backup erstellen                     | ✅     | Docker                        |
| 3   | Migration ausführen                  | ✅     | Docker                        |
| 4   | Sync script ausführen                | ✅     | `sync-customer-migrations.sh` |
| 5   | FeatureVisitsModule erstellen        | ✅     | Backend                       |
| 6   | FeatureVisitsService erstellen       | ✅     | Backend                       |
| 7   | FeatureVisitsController erstellen    | ✅     | Backend                       |
| 8   | MarkVisitedDto erstellen             | ✅     | Backend                       |
| 9   | Module in AppModule importieren      | ✅     | Backend                       |
| 10  | CalendarService count query anpassen | ✅     | Backend                       |
| 11  | KvpService count query anpassen      | ⬜     | Backend                       |
| 12  | SurveyService count query anpassen   | ⬜     | Backend                       |
| 13  | Frontend API function erstellen      | ✅     | Frontend                      |
| 14  | Calendar page integration            | ✅     | Frontend                      |
| 15  | KVP page integration                 | ⬜     | Frontend                      |
| 16  | Surveys page integration             | ⬜     | Frontend                      |
| 17  | Testen: Badge reset on visit         | ⬜     | E2E                           |
| 18  | Testen: Badge increment on new item  | ⬜     | E2E                           |

---

## KVP Implementation Guide (TODO)

### Schritt 1: Backend - KvpService finden

```bash
# Finde die KVP Service Datei
ls -la backend/src/nest/kvp/

# Suche nach der count Methode
grep -n "count\|Count" backend/src/nest/kvp/kvp.service.ts
```

### Schritt 2: Backend - FeatureVisitsModule importieren

**Datei:** `backend/src/nest/kvp/kvp.module.ts`

```typescript
// Import hinzufügen
import { FeatureVisitsModule } from '../feature-visits/feature-visits.module.js';

@Module({
  imports: [FeatureVisitsModule],  // ← HINZUFÜGEN
  // ... rest
})
```

### Schritt 3: Backend - KvpService anpassen

**Datei:** `backend/src/nest/kvp/kvp.service.ts`

```typescript
// 1. Import hinzufügen (oben)
import { FeatureVisitsService } from '../feature-visits/feature-visits.service.js';

// 2. Constructor erweitern
constructor(
  private readonly databaseService: DatabaseService,
  private readonly featureVisitsService: FeatureVisitsService,  // ← HINZUFÜGEN
) {}

// 3. Count Query anpassen (Methode finden die Badge-Count liefert)
// VORHER:
SELECT COUNT(*) FROM kvp_entries WHERE tenant_id = $1 AND ...

// NACHHER:
const lastVisited = await this.featureVisitsService.getLastVisited(tenantId, userId, 'kvp');

SELECT COUNT(*) FROM kvp_entries
WHERE tenant_id = $1
  AND created_at > $X  // ← lastVisited ?? '1970-01-01'
  AND ...
```

### Schritt 4: Frontend - API Function hinzufügen

**Datei:** `frontend/src/routes/(app)/kvp/_lib/api.ts` (oder ähnlich)

```typescript
// Am Ende der Datei hinzufügen:

// =============================================================================
// FEATURE VISITS - BADGE RESET
// =============================================================================

/**
 * Mark KVP as visited - resets the notification badge
 */
export async function markKvpVisited(): Promise<void> {
  try {
    await apiClient.post('/feature-visits/mark', { feature: 'kvp' });
  } catch (err) {
    console.warn('Failed to mark KVP as visited:', err);
  }
}
```

### Schritt 5: Frontend - Page Integration

**Datei:** `frontend/src/routes/(app)/kvp/+page.svelte`

```svelte
<script lang="ts">
  // 1. Imports hinzufügen (oben bei anderen imports)
  import { browser } from '$app/environment';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import * as api from './_lib/api';  // oder wo auch immer markKvpVisited ist

  // 2. Nach anderen $state Deklarationen hinzufügen:
  let hasMarkedVisit = $state(false);

  // 3. $effect hinzufügen (nach anderen $effect blocks)
  $effect(() => {
    if (!hasMarkedVisit && browser) {
      hasMarkedVisit = true;
      void api.markKvpVisited();
      notificationStore.resetCount('kvp');
    }
  });
</script>
```

### Schritt 6: Backend restart & testen

```bash
cd /home/scs/projects/Assixx/docker
docker-compose restart backend

# Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT * FROM feature_visits WHERE feature = 'kvp';"
```

---

## Surveys Implementation Guide (TODO)

### Schritt 1: Backend - SurveysService finden

```bash
# Finde die Surveys Service Datei
ls -la backend/src/nest/surveys/

# Suche nach der count Methode
grep -n "count\|Count" backend/src/nest/surveys/surveys.service.ts
```

### Schritt 2: Backend - FeatureVisitsModule importieren

**Datei:** `backend/src/nest/surveys/surveys.module.ts`

```typescript
// Import hinzufügen
import { FeatureVisitsModule } from '../feature-visits/feature-visits.module.js';

@Module({
  imports: [FeatureVisitsModule],  // ← HINZUFÜGEN
  // ... rest
})
```

### Schritt 3: Backend - SurveysService anpassen

**Datei:** `backend/src/nest/surveys/surveys.service.ts`

```typescript
// 1. Import hinzufügen (oben)
import { FeatureVisitsService } from '../feature-visits/feature-visits.service.js';

// 2. Constructor erweitern
constructor(
  private readonly databaseService: DatabaseService,
  private readonly featureVisitsService: FeatureVisitsService,  // ← HINZUFÜGEN
) {}

// 3. Count Query anpassen
const lastVisited = await this.featureVisitsService.getLastVisited(tenantId, userId, 'surveys');

// In der Query: AND created_at > lastVisited ?? '1970-01-01'
```

### Schritt 4: Frontend - API Function hinzufügen

**Datei:** `frontend/src/routes/(app)/survey-admin/_lib/api.ts` (oder surveys/)

```typescript
// Am Ende der Datei hinzufügen:

/**
 * Mark Surveys as visited - resets the notification badge
 */
export async function markSurveysVisited(): Promise<void> {
  try {
    await apiClient.post('/feature-visits/mark', { feature: 'surveys' });
  } catch (err) {
    console.warn('Failed to mark Surveys as visited:', err);
  }
}
```

### Schritt 5: Frontend - Page Integration

**Datei:** `frontend/src/routes/(app)/survey-admin/+page.svelte` (oder surveys/)

```svelte
<script lang="ts">
  // 1. Imports hinzufügen
  import { browser } from '$app/environment';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import * as api from './_lib/api';

  // 2. State hinzufügen
  let hasMarkedVisit = $state(false);

  // 3. $effect hinzufügen
  $effect(() => {
    if (!hasMarkedVisit && browser) {
      hasMarkedVisit = true;
      void api.markSurveysVisited();
      notificationStore.resetCount('surveys');
    }
  });
</script>
```

### Schritt 6: Backend restart & testen

```bash
cd /home/scs/projects/Assixx/docker
docker-compose restart backend

# Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT * FROM feature_visits WHERE feature = 'surveys';"
```

---

## Referenz: Calendar Implementation (DONE)

Als Referenz, so wurde Calendar implementiert:

### Geänderte Dateien:

| Datei                                             | Änderung                         |
| ------------------------------------------------- | -------------------------------- |
| `backend/src/nest/calendar/calendar.module.ts`    | `imports: [FeatureVisitsModule]` |
| `backend/src/nest/calendar/calendar.service.ts`   | Import + Constructor + Query     |
| `frontend/src/routes/(app)/calendar/_lib/api.ts`  | `markCalendarVisited()` function |
| `frontend/src/routes/(app)/calendar/+page.svelte` | Import + $state + $effect        |

### CalendarService.getUpcomingCount() - Final Code:

```typescript
async getUpcomingCount(
  tenantId: number,
  userId: number,
  userDepartmentId: number | null,
  userTeamId: number | null,
): Promise<{ count: number }> {
  // Get user's last visit to calendar
  const lastVisited = await this.featureVisitsService.getLastVisited(
    tenantId,
    userId,
    'calendar',
  );

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const query = `
    SELECT COUNT(DISTINCT e.id) as count
    FROM calendar_events e
    WHERE e.tenant_id = $1
      AND e.start_date >= $2
      AND e.start_date < $3
      AND e.status != 'cancelled'
      AND e.created_at > $7
      AND (
        e.is_private = false
        OR e.user_id = $4
        OR e.department_id = $5
        OR e.team_id = $6
      )
  `;

  const result = await this.databaseService.query<{ count: string }>(query, [
    tenantId,
    startOfDay,
    endOfWeek,
    userId,
    userDepartmentId ?? 0,
    userTeamId ?? 0,
    lastVisited ?? new Date('1970-01-01'),
  ]);

  return { count: Number.parseInt(result[0]?.count ?? '0', 10) };
}
```

### Calendar Frontend Integration - Final Code:

```svelte
<!-- In +page.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import * as api from './_lib/api';

  let hasMarkedVisit = $state(false);

  $effect(() => {
    if (!hasMarkedVisit && browser) {
      hasMarkedVisit = true;
      void api.markCalendarVisited();
      notificationStore.resetCount('calendar');
    }
  });
</script>
```

---

## Offene Fragen

1. **Surveys:** Welche Seite genau? `/survey-admin` oder `/surveys`?
2. **KVP:** Gibt es verschiedene KVP-Seiten (Admin vs Employee)?
3. **SSE:** Soll SSE auch `feature_visits` berücksichtigen für real-time badge updates?

---

## Quick Debug Commands

```bash
# Feature Visits Tabelle anzeigen
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT * FROM feature_visits ORDER BY updated_at DESC;"

# Für bestimmten User
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT * FROM feature_visits WHERE user_id = 5;"

# Count pro Feature
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT feature, COUNT(*) FROM feature_visits GROUP BY feature;"

# Eintrag manuell löschen (für Test-Reset)
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "DELETE FROM feature_visits WHERE user_id = 5 AND feature = 'calendar';"
```

---

## Verwandte Dokumentation

- [SIDEBAR-NOTIFICATION-BADGES.md](../SIDEBAR-NOTIFICATION-BADGES.md) - Aktuelle Badge-Logik
- [DATABASE-MIGRATION-GUIDE.md](../DATABASE-MIGRATION-GUIDE.md) - Migration Workflow

---

## Änderungshistorie

| Datum      | Änderung                        |
| ---------- | ------------------------------- |
| 2026-01-21 | Initial: Calendar implementiert |
| -          | TODO: KVP Implementation        |
| -          | TODO: Surveys Implementation    |
