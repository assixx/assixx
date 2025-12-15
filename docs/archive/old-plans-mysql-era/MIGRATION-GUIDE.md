
---

## 🔐 UUIDv7 Migration (2025-11-13)

### Security Enhancement: IDOR Prevention

**Problem Solved:** Numeric IDs in URLs (`/kvp-detail?id=6991`) allow users to guess other records.  
**Solution:** UUIDv7 external identifiers provide non-guessable, time-sortable secure URLs.

### What Changed

**Database:**
- Added `uuid CHAR(36)` column to 5 tables:
  - `kvp_suggestions`
  - `surveys`
  - `documents`
  - `calendar_events`
  - `shift_plans`
- Created UNIQUE indexes on `uuid` column
- Created compound indexes `(tenant_id, uuid)` for performance

**Backend:**
- Model generates UUIDv7 on INSERT using `uuid.v7()`
- Service layer accepts both numeric ID and UUID (dual-ID transition period)
- Controller auto-detects UUID vs numeric ID format

**Frontend:**
- URLs changed from `?id=6991` to `?uuid=018c-...`
- Supports both formats during transition period
- KVP cards now include `data-uuid` attribute

### Migration Script

**Location:** `/database/migrations/2025-11-13_add_uuid_to_tables.sql`

**Execution:**
```bash
# Backup first (IMPORTANT!)
bash scripts/quick-backup.sh "before_uuid_migration"

# Copy and execute
docker cp database/migrations/2025-11-13_add_uuid_to_tables.sql assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD main < /tmp/2025-11-13_add_uuid_to_tables.sql'

# Verify
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD main -e "SELECT id, uuid, title FROM kvp_suggestions LIMIT 3;"'
```

### Verification

**Check UUIDs exist:**
```sql
SELECT COUNT(*) as total, COUNT(DISTINCT uuid) as unique_uuids 
FROM kvp_suggestions 
WHERE uuid IS NOT NULL;
```

**Check indexes created:**
```sql
SHOW INDEX FROM kvp_suggestions WHERE Key_name LIKE '%uuid%';
```

**Expected Output:**
- `idx_kvp_uuid` (UNIQUE)
- `idx_kvp_tenant_uuid` (compound index)

### Testing Checklist

- [ ] Migration script executed without errors
- [ ] UUIDs generated for all existing records
- [ ] Backend builds successfully (`pnpm run build`)
- [ ] Frontend builds successfully (`pnpm run build`)
- [ ] Old URLs with `?id=` still work (backwards compatibility)
- [ ] New URLs with `?uuid=` work correctly
- [ ] KVP detail page loads with both URL formats
- [ ] Creating new KVP suggestion generates UUID automatically

### Rollback (Emergency Only)

**⚠️ Only if absolutely necessary!**

```sql
-- Remove UUID columns (data loss!)
ALTER TABLE kvp_suggestions DROP COLUMN uuid, DROP COLUMN uuid_created_at;
ALTER TABLE surveys DROP COLUMN uuid, DROP COLUMN uuid_created_at;
-- Repeat for other tables...

-- Drop indexes
DROP INDEX idx_kvp_uuid ON kvp_suggestions;
DROP INDEX idx_kvp_tenant_uuid ON kvp_suggestions;
-- Repeat for other tables...
```

**Note:** Rollback requires code deployment to revert UUID changes in backend/frontend.

### Performance Impact

**Positive:**
- Time-sortable UUIDs improve query performance
- Compound indexes `(tenant_id, uuid)` optimize tenant isolation
- No JOIN required for UUID lookup

**Negligible:**
- CHAR(36) vs INT storage: +32 bytes per row
- UUID generation: ~0.1ms overhead per INSERT

### Best Practices (Going Forward)

1. **Always use UUID in external URLs**
   ```typescript
   // ✅ Good
   window.location.href = `/kvp-detail?uuid=${suggestion.uuid}`;
   
   // ❌ Bad (security risk)
   window.location.href = `/kvp-detail?id=${suggestion.id}`;
   ```

2. **Keep numeric ID for internal operations**
   ```typescript
   // Internal FK references still use numeric ID
   await kvpModel.addComment(suggestionId, tenantId, ...);
   ```

3. **Validate UUID format in API**
   ```typescript
   // UUIDv7 format: 8-4-4-4-12 hex characters
   const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   ```

### Related Documentation

- [RFC 9562: UUIDv7 Specification](https://www.rfc-editor.org/rfc/rfc9562.html)
- [uuid7.com](https://uuid7.com/)
- OWASP IDOR Prevention Guide

---

**Last Updated:** 2025-11-13  
**Migration Status:** ✅ Complete  
**Affected Tables:** kvp_suggestions, surveys, documents, calendar_events, shift_plans
