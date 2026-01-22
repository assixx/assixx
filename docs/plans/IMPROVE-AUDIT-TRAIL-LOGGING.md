# Plan: Improve Audit Trail Logging

> **Created:** 2026-01-22
> **Status:** In Progress
> **Related ADR:** ADR-009-central-audit-logging.md

---

## Problem Statement

Das aktuelle Audit Trail System ist funktional und produktionsreif, hat aber folgende Lücken:

1. **Keine Request-Korrelation** - Mehrere Audit-Einträge desselben Requests können nicht zusammengeführt werden
2. **Keine Vorher-Werte bei UPDATE** - Nur neue Werte werden geloggt, nicht was geändert wurde
3. **Export-Aktionen werden nicht geloggt** - Daten-Exfiltration ist nicht trackbar
4. **Redundanz mit root_logs** - Zwei Tabellen loggen ähnliche Daten

---

## Implementation Plan

### Phase 1: Request Correlation (Priority 1)

**Ziel:** Alle Audit-Einträge eines Requests mit einer `request_id` verknüpfen.

#### 1.1 Database Migration

```sql
-- Migration: 004-audit-trail-request-id.sql
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE INDEX CONCURRENTLY idx_audit_trail_request_id ON audit_trail (request_id);
```

#### 1.2 Request ID Middleware

Erstelle Middleware die für jeden Request eine UUID generiert:

```typescript
// common/middleware/request-id.middleware.ts
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    // Check for existing X-Request-ID header (from nginx/load balancer)
    const existingId = req.headers['x-request-id'];
    const requestId = typeof existingId === 'string' ? existingId : randomUUID();

    // Attach to request object for interceptors
    (req as any).requestId = requestId;

    // Set response header for debugging
    res.header('X-Request-ID', requestId);

    next();
  }
}
```

#### 1.3 Interceptor Update

Erweitere `AuditTrailInterceptor`:

```typescript
// In AuditLogParams interface:
requestId: string | null;

// In extractRequestMetadata():
requestId: (request as any).requestId ?? null,

// In logToAuditTrail INSERT:
// Add request_id to columns and $14 to values
```

#### 1.4 Files to Modify

| File                                                              | Change              |
| ----------------------------------------------------------------- | ------------------- |
| `database/migrations/004-audit-trail-request-id.sql`              | NEW - Add column    |
| `backend/src/nest/common/middleware/request-id.middleware.ts`     | NEW - Middleware    |
| `backend/src/nest/app.module.ts`                                  | Register middleware |
| `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` | Add requestId field |

---

### Phase 2: Old Values for UPDATE (Priority 2)

**Ziel:** Bei UPDATE-Operationen sowohl alte als auch neue Werte erfassen.

#### 2.1 Strategy

Analog zum DELETE Pre-Fetch:

1. VOR dem UPDATE: Aktuelle Ressource aus DB laden
2. NACH dem UPDATE: Neue Werte aus Request Body
3. Beide in `changes.previous` und `changes.updated` speichern

#### 2.2 Implementation

Erweitere `AuditTrailInterceptor`:

```typescript
// New method:
private async fetchResourceBeforeUpdate(
  resourceType: string,
  resourceId: number | null,
  tenantId: number,
): Promise<Record<string, unknown> | null> {
  // Same logic as fetchResourceBeforeDelete
  // Returns current state of resource
}

// In intercept() - handle UPDATE like DELETE:
if ((action === 'update' || action === 'delete') && user !== undefined && metadata.resourceId !== null) {
  return this.handleMutationWithPreFetch(user, metadata, startTime, request, response, next);
}
```

#### 2.3 Changes Field Structure (Updated)

```typescript
interface AuditChanges {
  // For CREATE: the created data (sanitized)
  created?: Record<string, unknown>;

  // For UPDATE: the previous state (before change)
  previous?: Record<string, unknown>; // NEW!

  // For UPDATE: the updated fields (sanitized request body)
  updated?: Record<string, unknown>;

  // For DELETE: the deleted resource data (fetched before deletion)
  deleted?: Record<string, unknown>;

  // ... rest unchanged
}
```

#### 2.4 Files to Modify

| File                                                              | Change                   |
| ----------------------------------------------------------------- | ------------------------ |
| `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` | Add pre-fetch for UPDATE |

---

### Phase 3: Export Action Logging (Priority 3)

**Ziel:** Export-Aktionen explizit loggen (Daten-Exfiltration tracking).

#### 3.1 Changes

1. Entferne `/export` aus `SKIPPED_GET_SUFFIXES`
2. Füge `'export'` zu `AuditAction` type hinzu
3. Erkenne Export-Endpoints in `determineAction()`

```typescript
// In determineAction():
if (path.includes('/export')) {
  return 'export';
}
```

#### 3.2 What Gets Logged

```json
{
  "action": "export",
  "resource_type": "audit-trail",
  "changes": {
    "query": { "format": "csv", "from": "2026-01-01", "to": "2026-01-22" },
    "_http": { "method": "GET", "endpoint": "/api/v2/logs/export", "status": 200 }
  }
}
```

#### 3.3 Files to Modify

| File                                                              | Change            |
| ----------------------------------------------------------------- | ----------------- |
| `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` | Add export action |

---

### Phase 4: root_logs Consolidation Strategy (Priority 5 - Documentation Only)

**Ziel:** Langfristige Strategie zur Konsolidierung von `audit_trail` und `root_logs`.

#### Current State

| Table         | Writer                         | Purpose      | Used By            |
| ------------- | ------------------------------ | ------------ | ------------------ |
| `audit_trail` | AuditTrailInterceptor (global) | ALL requests | Export, Compliance |
| `root_logs`   | ActivityLoggerService (manual) | CRUD events  | Root Dashboard     |

#### Recommended Strategy

**Option A: Keep Both, Clear Separation**

- `audit_trail` = Technical audit (HTTP requests, system events)
- `root_logs` = Business audit (User actions, workflow changes)
- Pro: Clear separation, different retention policies possible
- Con: Some redundancy

**Option B: Deprecate root_logs (Long-term)**

- Migrate Root Dashboard to read from `audit_trail`
- Keep `root_logs` as view or deprecated table
- Pro: Single source of truth
- Con: Breaking change, migration effort

**Decision: Option A for now** - Keep both, document separation clearly.

---

## Testing Strategy

### Manual Testing

1. **Request Correlation:**

   ```bash
   # Make request, check X-Request-ID header in response
   curl -v http://localhost:3000/api/v2/calendar/events
   # Verify same request_id in audit_trail for related entries
   ```

2. **Old Values on UPDATE:**

   ```bash
   # Create event, then update it
   # Check audit_trail.changes for "previous" field
   ```

3. **Export Logging:**
   ```bash
   # Export logs
   curl http://localhost:3000/api/v2/logs/export?format=csv
   # Verify "export" action in audit_trail
   ```

### Database Verification

```sql
-- Check request_id is populated
SELECT request_id, COUNT(*)
FROM audit_trail
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY request_id;

-- Check UPDATE has previous values
SELECT changes
FROM audit_trail
WHERE action = 'update'
ORDER BY created_at DESC
LIMIT 5;

-- Check export is logged
SELECT * FROM audit_trail WHERE action = 'export' ORDER BY created_at DESC LIMIT 5;
```

---

## Rollback Plan

Alle Änderungen sind additiv (neue Spalte, neue Felder in JSONB). Rollback:

1. **request_id:** Column kann ignoriert werden (nullable)
2. **previous field:** Interceptor-Change rückgängig machen
3. **export action:** Suffix wieder zu SKIPPED_GET_SUFFIXES hinzufügen

---

## Timeline

| Phase | Task                  | Estimated | Status  | Completed  |
| ----- | --------------------- | --------- | ------- | ---------- |
| 1     | Request Correlation   | 2-4h      | ✅ Done | 2026-01-22 |
| 2     | Old Values for UPDATE | 3-4h      | ✅ Done | 2026-01-22 |
| 3     | Export Action Logging | 1h        | ✅ Done | 2026-01-22 |
| 4     | Documentation         | 1h        | ✅ Done | 2026-01-22 |

**Total: ~8-10h → Actual: ~2h**

---

## Success Metrics

- [x] Alle Audit-Einträge eines Requests haben dieselbe `request_id`
- [x] UPDATE-Aktionen zeigen `previous` und `updated` Werte (für gemappte Ressourcen)
- [x] Export-Aktionen erscheinen im Audit Trail
- [x] ADR-009 ist aktualisiert mit Implementierungsdetails
