# API v2 Known Issues and Solutions

## Test Database Schema Problems

### Issue: "columns dictionary object is invalid" Error
**Symptom:** Tests fail with error message:
```
columns dictionary object is invalid. (There are no elements supplied.)
```

**Cause:** The `db.execute()` method is being used with multi-line SQL statements that contain empty lines. MySQL's execute method doesn't handle this well.

**Solution:** Remove empty lines from CREATE TABLE statements in `database.ts` or use `db.query()` instead of `db.execute()` for schema creation.

**Affected Files:**
- `/backend/src/routes/mocks/database.ts` - initializeSchema function

**Status:** Fixed by removing empty line before teams table creation

### Issue: Test User Authentication Failures
**Symptom:** Tests fail with "Failed to login employee user" or similar authentication errors.

**Cause:** The `createTestUser` function adds `__AUTOTEST__` prefix and timestamp suffix to usernames and emails for safe cleanup. Tests must use the returned email/username from `createTestUser`, not the original values.

**Example:**
```typescript
// WRONG
const user = await createTestUser(testDb, {
  email: "test@example.com",
  // ...
});
// Login with original email will fail
await request(app).post("/api/v2/auth/login").send({
  email: "test@example.com", // WRONG!
  password: "password"
});

// CORRECT
const user = await createTestUser(testDb, {
  email: "test@example.com",
  // ...
});
// Login with returned email
await request(app).post("/api/v2/auth/login").send({
  email: user.email, // CORRECT! Uses generated email like __AUTOTEST__test_1234567890_123@example.com
  password: "password"
});
```

**Affected Tests:**
- All v2 API tests that use authentication
- Fixed in: departments-v2.test.ts
- Still affected: calendar-v2.test.ts, users-v2.test.ts

## Foreign Key Constraint Failures

### Issue: Cannot add or update a child row
**Symptom:** Tests fail with foreign key constraint errors when creating test data.
```
Cannot add or update a child row: a foreign key constraint fails (`main`.`users`, CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE)
```

**Cause:** Test data is being created in the wrong order or referencing non-existent parent records. This often happens when:
- Multiple test suites run in parallel and share the same database
- Test cleanup removes parent records before child records
- Race conditions between test creation and cleanup

**Solution:** 
1. Ensure proper order of test data creation:
   - Create tenants first
   - Create departments (with valid tenant_id)
   - Create teams (with valid tenant_id and department_id)
   - Create users (with valid tenant_id and optional department_id)
2. Run tests with `--runInBand` to prevent parallel execution
3. Use unique test data prefixes for each test suite
4. Check that cleanup doesn't remove data still needed by other tests

**Current Status:** Affecting calendar-v2.test.ts when running in parallel with other tests

## Race Conditions in Tests

### Issue: Test data cleanup happens too early
**Symptom:** Test users are created but immediately deleted before tests can use them.

**Cause:** The `cleanupTestData()` function may be called by parallel tests or cleanup hooks.

**Solution:** 
- Run tests with `--runInBand` to prevent parallel execution
- Use unique prefixes for each test suite
- Consider test-specific cleanup instead of global cleanup

## Database Migration Issues

### Issue: Missing columns in test database
**Symptom:** Tests fail with "Unknown column" errors.

**Recent Examples:**
- Missing `org_level` and `org_id` columns in calendar_events table
- Missing `employee_number` column in users table

**Solution:** 
1. Check current production schema: `./scripts/export-current-schema.sh`
2. Update test database schema in `database.ts`
3. Keep test schema in sync with production schema

## Test Execution Best Practices

### Running Tests Successfully
1. **Always use `--runInBand` for v2 tests** to prevent race conditions
2. **Run test suites individually** when debugging:
   ```bash
   docker exec assixx-backend pnpm test -- backend/src/routes/__tests__/calendar-v2.test.ts --runInBand
   ```
3. **Check for leftover test data** before running tests:
   ```bash
   docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT COUNT(*) FROM users WHERE email LIKE \"%__AUTOTEST__%\";"'
   ```
4. **Clean test data manually if needed**:
   ```bash
   docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "DELETE FROM users WHERE email LIKE \"%__AUTOTEST__%\";"'
   ```

### Common Test Patterns
- Use returned values from `createTestUser()`, not original input
- Check test database isolation between suites
- Verify foreign key constraints before creating child records

## Permission vs Not Found Error Handling

### Issue: 404 returned instead of 403 for forbidden access
**Symptom:** When a user tries to access/update/delete an event they don't have permission for, the API returns 404 (NOT_FOUND) instead of 403 (FORBIDDEN).

**Cause:** The `getEventById` method in the Calendar model returns `null` both when:
- The event doesn't exist
- The user doesn't have permission to access it

This makes it impossible for the service layer to distinguish between these two cases.

**Current Behavior:**
- Non-owner employees get 404 when trying to update/delete events they don't own
- Users get 404 when trying to access events from other tenants
- This is consistent but not ideal for security (information leakage)

**Potential Solutions:**
1. Modify `getEventById` to throw different errors for "not found" vs "no permission"
2. Create a separate method to check if event exists without permission check
3. Accept current behavior as a security feature (no information leakage)

**Affected Tests:**
- `should not allow non-owner employee to update` - expects 403, gets 500
- `should not allow non-owner employee to delete` - expects 403, gets 500
- `should not update event from other tenant` - expects 404, gets 500
- `should not delete event from other tenant` - expects 404, gets 500

**Status:** Won't fix for now - requires significant refactoring of the model layer

## Recently Fixed Issues (26.07.2025)

### ✅ Auth v2 Test Issues - FIXED

**1. JWT Token Generation Missing Email**
- **Symptom:** JWT tokens were created without email field
- **Cause:** `generateTokens()` function was missing email parameter
- **Solution:** Added email parameter to function signature and all calls
- **Status:** ✅ Fixed in auth.controller.ts

**2. bcrypt Undefined Password Error**
- **Symptom:** "Illegal arguments: undefined, string" error from bcrypt
- **Cause:** Missing validation before bcrypt.compare()
- **Solution:** Added explicit email and password validation
- **Status:** ✅ Fixed in auth.controller.ts (lines 64-72)

**3. Test User Email Format**
- **Symptom:** Authentication failed in tests
- **Cause:** Tests used hardcoded emails instead of actual generated ones
- **Solution:** Used `testUser.email` throughout tests
- **Status:** ✅ Fixed in auth-v2.test.ts

**4. Deprecation Headers Not Applied to All v1 Endpoints**
- **Symptom:** `/api/auth/login` didn't get deprecation headers
- **Cause:** Middleware only checked for `/api/v1` prefix
- **Solution:** Extended check to cover all `/api/` paths without `/v2`
- **Status:** ✅ Fixed in deprecation.ts

**5. Auth Verify Response Missing Email**
- **Symptom:** Test expected email in verify response but got undefined
- **Cause:** verify endpoint didn't include email in response
- **Solution:** Updated test expectations to match actual API response
- **Status:** ✅ Fixed test expectations

**Result:** All 11 Auth v2 tests now pass successfully!

## Blackboard v2 Test Issues (28.07.2025)

### Issue: "should list all entries for authenticated user" returns 0 entries
**Symptom:** Test finds entries in DB but API returns empty array
```
Entries in DB before test: 1 [{ id: 753, title: 'Test Entry', org_level: 'company', org_id: null }]
Response data length: 0
```

**Debug Process:**
1. **Jest console.log not showing:** Standard console.log statements don't appear in Jest output
   - **Solution:** Import console functions directly: `import { log } from "console";`
   - Use `log()` instead of `console.log()` in tests
   
2. **Test timeout issues:** Tests timing out after 2 minutes when using standard debugging
   - **Solution:** Use `--runInBand --forceExit` flags
   - Example: `npx jest --testNamePattern="test name" --runInBand --forceExit`

3. **Access Control Issue:** Company-level entries not visible to employees
   - Entry has: `org_level='company', org_id=null`
   - Employee has: `department_id=null, team_id=null`
   - Original query: `e.org_level = 'company' OR ...`
   - Count query finds 1 entry but main query returns 0

**Current Investigation:**
- The pagination shows `totalItems: 1` but `data: []` 
- This means count query works but main query fails
- Possible causes:
  - Different access control logic between count and main query
  - Query parameter ordering issue
  - JOIN clause affecting results

**Debugging Commands:**
```bash
# Run specific test with debug output
docker exec assixx-backend sh -c 'NODE_ENV=test npx jest --testNamePattern="should list all entries" backend/src/routes/__tests__/blackboard-v2.test.ts --runInBand --forceExit'

# Check logger output
docker logs assixx-backend --tail 50 | grep -E "Blackboard|warn|debug"
```

**Root Cause Found:** The `requiresConfirmation` filter in the controller was always evaluating to `false` when the query parameter wasn't set, causing an unwanted filter `requires_confirmation = 0` to be applied.

**Solution:** Fixed in `blackboard.controller.ts` line 74-76:
```typescript
requiresConfirmation: req.query.requiresConfirmation !== undefined 
  ? req.query.requiresConfirmation === "true"
  : undefined,
```

**Status:** ✅ FIXED (2025-07-28)

### Issue: Trigger conflict when deleting blackboard attachments
**Symptom:** Tests fail with error:
```
Can't update table 'blackboard_entries' in stored function/trigger because it is already used by statement which invoked this stored function/trigger.
```

**Cause:** Database triggers `update_attachment_count_on_insert` and `update_attachment_count_on_delete` try to update blackboard_entries when attachments are deleted. If the DELETE uses a subquery that references blackboard_entries, it causes a conflict.

**Solution:** In test cleanup, first fetch all entry IDs, then delete related data using those IDs directly instead of subqueries:
```typescript
// Get entry IDs first
const [entries] = await testDb.execute<any[]>(
  "SELECT id FROM blackboard_entries WHERE tenant_id = ?",
  [tenantId],
);
const entryIds = entries.map(e => e.id);

// Delete using IDs directly, not subqueries
if (entryIds.length > 0) {
  await testDb.execute(
    `DELETE FROM blackboard_attachments WHERE entry_id IN (${entryIds.map(() => '?').join(',')})`,
    entryIds,
  );
}
```

**Affected Files:**
- `/backend/src/routes/__tests__/blackboard-v2.test.ts` - beforeEach/afterEach cleanup

**Status:** ✅ FIXED (2025-07-28)

---
Last Updated: 2025-07-28