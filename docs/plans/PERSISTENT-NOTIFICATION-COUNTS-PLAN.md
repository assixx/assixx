# Persistent Notification Counts - Implementierungsplan

> **ADR:** [ADR-004: Persistent Notification Counts](./adr/ADR-004-persistent-notification-counts.md)
> **Erstellt:** 2026-01-14
> **Status:** Geplant
> **Geschätzter Aufwand:** 4-6 Stunden

---

## Problemstellung

```
AKTUELL:
┌─────────────────────────────────────────────────────────────┐
│  User loggt ein                                              │
│  ├── Chat Badge: 5 (aus /chat/unread-count)        ✅       │
│  ├── Survey Badge: 0 (nur SSE, keine Persistenz)   ❌       │
│  ├── Document Badge: 0 (nur SSE, keine Persistenz) ❌       │
│  └── KVP Badge: 0 (nur SSE, keine Persistenz)      ❌       │
└─────────────────────────────────────────────────────────────┘

ZIEL:
┌─────────────────────────────────────────────────────────────┐
│  User loggt ein                                              │
│  ├── Chat Badge: 5 (aus /chat/unread-count)        ✅       │
│  ├── Survey Badge: 3 (aus /notifications/stats/me) ✅       │
│  ├── Document Badge: 2 (aus /notifications/stats/me) ✅     │
│  └── KVP Badge: 1 (aus /notifications/stats/me)    ✅       │
└─────────────────────────────────────────────────────────────┘
```

---

## Referenzen

- **[ADR-004](./adr/ADR-004-persistent-notification-counts.md)** - Architektur-Entscheidung
- **[ADR-003](./adr/ADR-003-notification-system.md)** - SSE Notification System
- **[DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md)** - Migration Workflow

---

## Implementierungsschritte

### Phase 1: Database Migration

**Referenz:** [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - Abschnitt "Migration Workflow"

#### 1.1 Backup erstellen (PFLICHT!)

```bash
cd /home/scs/projects/Assixx
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --format=custom --compress=9 \
    > database/backups/full_backup_${TIMESTAMP}.dump
```

#### 1.2 Migration-Datei erstellen

**Datei:** `database/migrations/009-notification-type-extension.sql`

```sql
-- =====================================================
-- Migration: Extend notification_type enum for feature events
-- Date: 2026-01-14
-- Author: Development Team
-- ADR: ADR-004-persistent-notification-counts
-- =====================================================

-- 1. Extend notification_type enum with new values
-- PostgreSQL requires adding enum values one at a time
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'survey';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'document';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kvp';

-- 2. Add feature_id column to link back to source entity
-- This allows finding the original survey/document/kvp
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS feature_id INTEGER;

-- 3. Add index for efficient queries by type and feature
CREATE INDEX IF NOT EXISTS idx_notifications_type_feature
ON notifications(tenant_id, type, feature_id)
WHERE feature_id IS NOT NULL;

-- 4. Add index for unread count queries (used by /stats/me)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
ON notifications(tenant_id, recipient_type, recipient_id, type)
WHERE type IN ('survey', 'document', 'kvp');

-- 5. Add unique constraint to prevent duplicate notifications
-- One notification per feature per recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_feature
ON notifications(tenant_id, type, feature_id, recipient_type, recipient_id)
WHERE feature_id IS NOT NULL;

-- Note: RLS policies already exist on notifications table
-- No additional RLS changes needed
```

#### 1.3 Migration ausführen

```bash
# Migration kopieren und ausführen
docker cp database/migrations/009-notification-type-extension.sql assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx \
    -v ON_ERROR_STOP=1 \
    -f /tmp/009-notification-type-extension.sql

# Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'notification_type'::regtype
ORDER BY enumsortorder;"
```

#### 1.4 Baseline aktualisieren (PFLICHT!)

```bash
# Schema neu dumpen
docker exec assixx-postgres pg_dump -U assixx_user -d assixx \
    --schema-only --no-owner --no-privileges --quote-all-identifiers \
    -f /tmp/schema.sql
docker cp assixx-postgres:/tmp/schema.sql database/migrations/001_baseline_complete_schema.sql

# Customer aktualisieren
cp database/migrations/001_baseline_complete_schema.sql customer/fresh-install/001_schema.sql

# Verifizieren
diff database/migrations/001_baseline_complete_schema.sql customer/fresh-install/001_schema.sql && echo "✅ Synchronized"
```

---

### Phase 2: Backend - NotificationsService erweitern

**Datei:** `backend/src/nest/notifications/notifications.service.ts`

#### 2.1 Neue Methode: createAddonNotification()

```typescript
/**
 * Create notification for feature event (survey, document, kvp)
 * Used by SurveysService, DocumentsService, KvpService
 *
 * @param type - 'survey' | 'document' | 'kvp'
 * @param featureId - ID of the created feature
 * @param title - Notification title
 * @param message - Notification message
 * @param recipientType - 'user' | 'department' | 'team' | 'all'
 * @param recipientId - ID of recipient (null for 'all')
 * @param tenantId - Tenant ID
 * @param createdBy - User ID who created the feature
 */
async createAddonNotification(
  type: 'survey' | 'document' | 'kvp',
  featureId: number,
  title: string,
  message: string,
  recipientType: 'user' | 'department' | 'team' | 'all',
  recipientId: number | null,
  tenantId: number,
  createdBy: number,
): Promise<void> {
  try {
    await this.db.query(
      `INSERT INTO notifications (
        tenant_id, type, title, message,
        recipient_type, recipient_id, feature_id,
        created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (tenant_id, type, feature_id, recipient_type, recipient_id)
      WHERE feature_id IS NOT NULL
      DO NOTHING`,
      [tenantId, type, title, message, recipientType, recipientId, featureId, createdBy]
    );
    this.logger.log(`Created ${type} notification for feature ${featureId}`);
  } catch (error) {
    // Log but don't fail - notification is secondary to feature creation
    this.logger.error(`Failed to create ${type} notification: ${error}`);
  }
}
```

#### 2.2 getPersonalStats() anpassen

Die existierende Methode funktioniert bereits, da sie `GROUP BY type` verwendet.
Verifizieren dass die neuen Typen korrekt gezählt werden:

```typescript
// Existing query in getPersonalStats():
const byTypeRows = await this.db.query<DbTypeCountRow>(
  `SELECT n.type, COUNT(*) as count FROM notifications n
   LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $2
   WHERE n.tenant_id = $1
   AND nrs.id IS NULL  -- Only unread
   AND (n.recipient_type = 'all'
        OR (n.recipient_type = 'user' AND n.recipient_id = $2)
        OR (n.recipient_type = 'department' AND n.recipient_id IN (...))
        OR (n.recipient_type = 'team' AND n.recipient_id IN (...)))
   GROUP BY n.type`,
  [tenantId, userId],
);
// Returns: { survey: 3, document: 2, kvp: 1, system: 0, ... }
```

---

### Phase 3: Backend - Feature Services integrieren

#### 3.1 SurveysService

**Datei:** `backend/src/nest/surveys/surveys.service.ts`

```typescript
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class SurveysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationsService: NotificationsService, // Inject
  ) {}

  async create(dto: CreateSurveyDto, userId: number, tenantId: number): Promise<Survey> {
    // ... existing creation logic ...
    const survey = await this.db.query<SurveyRow>(...);

    // EXISTING: Emit SSE event for real-time update
    eventBus.emitSurveyCreated(tenantId, {
      id: survey.id,
      title: dto.title,
      deadline: dto.deadline,
    });

    // NEW: Create persistent notification
    await this.notificationsService.createAddonNotification(
      'survey',
      survey.id,
      `Neue Umfrage: ${dto.title}`,
      `Eine neue Umfrage wurde erstellt. Deadline: ${dto.deadline ?? 'Keine'}`,
      'all', // Or target specific departments/teams based on survey settings
      null,
      tenantId,
      userId,
    );

    return survey;
  }
}
```

#### 3.2 DocumentsService

**Datei:** `backend/src/nest/documents/documents.service.ts`

```typescript
async uploadDocument(dto: UploadDto, userId: number, tenantId: number): Promise<Document> {
  // ... existing upload logic ...
  const document = await this.db.query<DocumentRow>(...);

  // EXISTING: Emit SSE event
  eventBus.emitDocumentUploaded(tenantId, {
    id: document.id,
    filename: document.filename,
    category: document.category,
  });

  // NEW: Create persistent notification
  await this.notificationsService.createAddonNotification(
    'document',
    document.id,
    `Neues Dokument: ${document.filename}`,
    `Ein neues Dokument wurde hochgeladen in ${document.category ?? 'Allgemein'}`,
    dto.recipientType ?? 'all',
    dto.recipientId ?? null,
    tenantId,
    userId,
  );

  return document;
}
```

#### 3.3 KvpService

**Datei:** `backend/src/nest/kvp/kvp.service.ts`

```typescript
async submitKvp(dto: CreateKvpDto, userId: number, tenantId: number): Promise<Kvp> {
  // ... existing submit logic ...
  const kvp = await this.db.query<KvpRow>(...);

  // EXISTING: Emit SSE event
  eventBus.emitKvpSubmitted(tenantId, {
    id: kvp.id,
    title: dto.title,
    submitted_by: username,
  });

  // NEW: Create persistent notification for admins
  await this.notificationsService.createAddonNotification(
    'kvp',
    kvp.id,
    `Neuer KVP-Vorschlag: ${dto.title}`,
    `Ein neuer Verbesserungsvorschlag wurde eingereicht`,
    'all', // Admins will see this based on their role permissions
    null,
    tenantId,
    userId,
  );

  return kvp;
}
```

---

### Phase 4: Frontend - fetchInitialCounts() korrigieren

**Datei:** `frontend/src/lib/stores/notification.store.svelte.ts`

Der Code wurde bereits teilweise geändert. Hier die finale Version:

```typescript
/** API response types */
interface ChatUnreadResponse {
  success: boolean;
  data: { totalUnread: number };
}

interface NotificationStatsResponse {
  success: boolean;
  data: {
    total: number;
    unread: number;
    byType: Record<string, number>;
  };
}

/**
 * Fetch initial counts from both APIs in parallel:
 * - /chat/unread-count → chat messages
 * - /notifications/stats/me → system notifications (surveys, documents, kvp)
 */
async function fetchInitialCounts(state: NotificationState): Promise<void> {
  try {
    const [chatResponse, notificationsResponse] = await Promise.all([
      fetch('/api/v2/chat/unread-count', { credentials: 'include' }),
      fetch('/api/v2/notifications/stats/me', { credentials: 'include' }),
    ]);

    let chatCount = 0;
    let surveyCount = 0;
    let documentCount = 0;
    let kvpCount = 0;

    // Parse chat unread count
    if (chatResponse.ok) {
      const chatJson = (await chatResponse.json()) as ChatUnreadResponse;
      chatCount = chatJson.data?.totalUnread ?? 0;
    }

    // Parse notification stats (surveys, documents, kvp)
    if (notificationsResponse.ok) {
      const notifJson = (await notificationsResponse.json()) as NotificationStatsResponse;
      const byType = notifJson.data?.byType ?? {};
      surveyCount = byType['survey'] ?? 0;
      documentCount = byType['document'] ?? 0;
      kvpCount = byType['kvp'] ?? 0;
    }

    // Update state with all counts
    state.counts.chat = chatCount;
    state.counts.surveys = surveyCount;
    state.counts.documents = documentCount;
    state.counts.kvp = kvpCount;
    state.counts.total = chatCount + surveyCount + documentCount + kvpCount;
    state.lastUpdate = new Date();
  } catch {
    // Silently fail - SSE will update counts when connected
  }
}
```

---

### Phase 5: Count Reset bei Feature-Besuch

Wenn User eine Feature-Seite besucht, Notification als gelesen markieren.

#### 5.1 Backend: markFeatureAsRead()

**Datei:** `backend/src/nest/notifications/notifications.service.ts`

```typescript
/**
 * Mark all notifications of a type as read for a user
 * Called when user visits the feature page (e.g., /surveys)
 */
async markFeatureTypeAsRead(
  type: 'survey' | 'document' | 'kvp',
  userId: number,
  tenantId: number,
): Promise<number> {
  const result = await this.db.query<{ count: number }>(
    `WITH unread_notifications AS (
      SELECT n.id FROM notifications n
      LEFT JOIN notification_read_status nrs
        ON n.id = nrs.notification_id AND nrs.user_id = $2
      WHERE n.tenant_id = $1
        AND n.type = $3
        AND nrs.id IS NULL
        AND (n.recipient_type = 'all'
             OR (n.recipient_type = 'user' AND n.recipient_id = $2)
             OR (n.recipient_type = 'department' AND n.recipient_id IN
                 (SELECT department_id FROM user_departments WHERE user_id = $2 AND tenant_id = $1))
             OR (n.recipient_type = 'team' AND n.recipient_id IN
                 (SELECT team_id FROM user_teams WHERE user_id = $2 AND tenant_id = $1)))
    )
    INSERT INTO notification_read_status (notification_id, user_id, tenant_id, read_at)
    SELECT id, $2, $1, NOW() FROM unread_notifications
    ON CONFLICT DO NOTHING
    RETURNING 1`,
    [tenantId, userId, type],
  );

  return result.length;
}
```

#### 5.2 Backend: Endpoint

**Datei:** `backend/src/nest/notifications/notifications.controller.ts`

```typescript
/**
 * POST /notifications/mark-read/:type
 * Mark all notifications of a type as read
 */
@Post('mark-read/:type')
async markTypeAsRead(
  @Param('type') type: 'survey' | 'document' | 'kvp',
  @CurrentUser() user: NestAuthUser,
  @TenantId() tenantId: number,
): Promise<{ marked: number }> {
  const marked = await this.notificationsService.markFeatureTypeAsRead(
    type,
    user.id,
    tenantId,
  );
  return { marked };
}
```

#### 5.3 Frontend: Reset on Page Visit

**Datei:** `frontend/src/routes/(app)/surveys/+page.svelte`

```typescript
import { notificationStore } from '$lib/stores/notification.store.svelte';
import { getApiClient } from '$lib/utils/api-client';

import { onMount } from 'svelte';

const apiClient = getApiClient();

onMount(async () => {
  // Reset local count immediately
  notificationStore.resetCount('surveys');

  // Mark as read in backend (fire and forget)
  void apiClient.post('/notifications/mark-read/survey', {});
});
```

Analog für `/documents` und `/kvp` Seiten.

---

## Testplan

### 1. Migration Test

```bash
# Prüfe neue Enum-Werte
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'notification_type'::regtype;"

# Erwartete Ausgabe: survey, document, kvp (zusätzlich zu bestehenden)
```

### 2. Backend Test

```bash
# Survey erstellen und Notification prüfen
curl -X POST http://localhost:3000/api/v2/surveys \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Survey"}'

# Notification prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT id, type, title, feature_id FROM notifications
WHERE type = 'survey' ORDER BY created_at DESC LIMIT 5;"
```

### 3. Frontend Test

```bash
# Stats Endpoint testen
curl http://localhost:3000/api/v2/notifications/stats/me \
  -H "Authorization: Bearer TOKEN"

# Erwartete Ausgabe:
# { "data": { "byType": { "survey": 1, "document": 0, "kvp": 0 } } }
```

### 4. E2E Test

1. User A erstellt Survey
2. User B loggt ein → Survey Badge zeigt "1"
3. User B besucht /surveys → Badge wird "0"
4. User B refresht → Badge bleibt "0" (persistent!)

---

## Rollback Plan

Falls Probleme auftreten:

```bash
# 1. Restore from Backup
docker exec -i assixx-postgres pg_restore -U assixx_user -d assixx \
  --clean --if-exists \
  < database/backups/full_backup_XXXXXX.dump

# 2. Backend neustarten
cd /home/scs/projects/Assixx/docker
docker-compose restart backend

# 3. Frontend Code zurückrollen (fetchInitialCounts)
git checkout frontend/src/lib/stores/notification.store.svelte.ts
```

---

## Checkliste

- [ ] **Phase 1:** Database Migration
  - [ ] Backup erstellt
  - [ ] Migration 009 ausgeführt
  - [ ] Baseline aktualisiert
  - [ ] Enum-Werte verifiziert

- [ ] **Phase 2:** NotificationsService
  - [ ] `createAddonNotification()` implementiert
  - [ ] `markFeatureTypeAsRead()` implementiert
  - [ ] Unit Tests geschrieben

- [ ] **Phase 3:** Feature Services
  - [ ] SurveysService integriert
  - [ ] DocumentsService integriert
  - [ ] KvpService integriert

- [ ] **Phase 4:** Frontend
  - [ ] `fetchInitialCounts()` aktualisiert
  - [ ] Typen definiert

- [ ] **Phase 5:** Count Reset
  - [ ] `/notifications/mark-read/:type` Endpoint
  - [ ] Surveys Page resetCount
  - [ ] Documents Page resetCount
  - [ ] KVP Page resetCount

- [ ] **Tests**
  - [ ] Migration Test bestanden
  - [ ] Backend Test bestanden
  - [ ] E2E Test bestanden

---

**Erstellt:** 2026-01-14
**Letzte Aktualisierung:** 2026-01-14
