# How to Write Tests for Assixx API v2

## 🚨 Critical Testing Patterns - MUST READ

This guide documents the CORRECT way to write tests for the Assixx API v2. These patterns have been discovered through extensive debugging and are essential for successful test implementation.

## Key Testing Principles

### 1. **Use Real Database Integration Tests**

❌ **DON'T** mock services or use jest.mock()
✅ **DO** use real database with test utilities

```typescript
// CORRECT - Use real app with real database
import app from '../../../../app.js';
import { createTestDatabase, createTestUser } from '../../../mocks/database.js';

// WRONG - Don't mock services
jest.mock('./plans.service');
const mockPlansService = PlansService as jest.Mocked<typeof PlansService>;
```

### 2. **Test File Location**

All v2 API tests MUST be placed in `__tests__` folders:

```
backend/src/routes/v2/
├── plans/
│   ├── __tests__/
│   │   └── plans-v2.test.ts    ✅ CORRECT
│   ├── plans.controller.ts
│   └── plans.service.ts
```

### 3. **Console Logging in Jest Tests**

Standard console.info doesn't work in Jest. Use direct imports:

```typescript
// CORRECT - Import console functions directly
import { log, error as logError } from 'console';

// WRONG - Won't show in test output
console.info('Debug message');
console.error('Error message');

log('Debug message');
logError('Error message');
```

### 4. **Always Run Tests with --runInBand**

Prevent race conditions by running tests sequentially:

```bash
# WRONG - Can cause race conditions
npm test -- backend/src/routes/v2/plans/__tests__/plans-v2.test.ts

# CORRECT - Sequential execution
npm test -- backend/src/routes/v2/plans/__tests__/plans-v2.test.ts --runInBand
```

### 5. **Use Generated Test User Credentials**

The `createTestUser` function adds prefixes and suffixes for safe cleanup:

```typescript
// WRONG - Using hardcoded email
const user = await createTestUser(testDb, {
  email: "test@example.com",
  password: "Test123!",
});
// Login will fail!
await request(app).post("/api/v2/auth/login").send({
  email: "test@example.com", // ❌ WRONG!
  password: "Test123!",
});

// CORRECT - Use returned values
const user = await createTestUser(testDb, {
  email: "test@example.com",
  password: "Test123!",
});
// Use the actual generated email
await request(app).post("/api/v2/auth/login").send({
  email: user.email, // ✅ CORRECT! (e.g., __AUTOTEST__test_1234567890_123@example.com)
  password: "Test123!",
});
```

## Complete Test Template

```typescript
/**
 * Tests for [Feature] API v2
 * [Description of what's being tested]
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
// For debugging if needed
import { log, error as logError } from 'console';
import { Pool } from 'mysql2/promise';
import request from 'supertest';

import app from '../../../../app.js';
import {
  cleanupTestData,
  closeTestDatabase,
  createTestDatabase,
  createTestTenant,
  createTestUser,
} from '../../../mocks/database.js';

describe('[Feature] API v2', () => {
  let testDb: Pool;
  let tenantId: number;
  let adminToken: string;
  let userToken: string;
  let adminUserId: number;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await cleanupTestData();

    // Create test tenant
    tenantId = await createTestTenant(testDb, 'feature-test', 'Test Feature Tenant');

    // Create admin user
    const adminUser = await createTestUser(testDb, {
      username: 'feature_admin_v2',
      email: 'admin@feature.test',
      password: 'Admin123!',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      tenant_id: tenantId,
    });
    adminUserId = adminUser.id;

    // Create regular user
    const regularUser = await createTestUser(testDb, {
      username: 'feature_user_v2',
      email: 'user@feature.test',
      password: 'User123!',
      first_name: 'Regular',
      last_name: 'User',
      role: 'employee',
      tenant_id: tenantId,
    });

    // Login to get tokens - USE RETURNED EMAILS!
    const adminLogin = await request(app).post('/api/v2/auth/login').send({
      email: adminUser.email, // ✅ Use returned email
      password: 'Admin123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    const userLogin = await request(app).post('/api/v2/auth/login').send({
      email: regularUser.email, // ✅ Use returned email
      password: 'User123!',
    });
    userToken = userLogin.body.data.accessToken;

    // Create any test data needed
  });

  afterAll(async () => {
    // Clean up test data in reverse order of creation
    await cleanupTestData();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Reset specific data between tests if needed
    // But DON'T delete users or tenants created in beforeAll
  });

  describe('GET /api/v2/[feature]', () => {
    it('should return data for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v2/[feature]')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        meta: {
          timestamp: expect.any(String),
          version: '2.0',
        },
      });
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v2/[feature]').expect(401);
    });
  });
});
```

## Common Database Schema Issues

### tenant_plans Table

```sql
-- WRONG column names
start_date, is_active

-- CORRECT column names
started_at, status
```

### Foreign Key Constraints

Always create data in the correct order:

1. Tenants first
2. Departments (needs tenant_id)
3. Teams (needs tenant_id and department_id)
4. Users (needs tenant_id)

### Test Data Cleanup

```typescript
// Check for leftover test data
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT COUNT(*) FROM users WHERE email LIKE \"%__AUTOTEST__%\";"'

// Manual cleanup if needed
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "DELETE FROM users WHERE email LIKE \"%__AUTOTEST__%\";"'
```

## Debugging Tips

### 1. Enable Console Output

```typescript
import { log, error as logError } from 'console';

// In your test or service
log('Debug info:', someVariable);
logError('Error occurred:', error);
```

### 2. Run Single Test

```bash
# Run specific test file
docker exec assixx-backend npm test -- backend/src/routes/v2/plans/__tests__/plans-v2.test.ts --runInBand

# Run specific test by name
docker exec assixx-backend npm test -- --testNamePattern="should return all active plans" --runInBand
```

### 3. Check Database State During Tests

```bash
# Check what's in the database
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT * FROM plans;"'

# Check table structure
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "DESCRIBE tenant_plans;"'
```

## Known Issues and Solutions

### TypeScript Test Errors

From CLAUDE.md: "TypeScript Test-Fehler (56 errors) - ignorieren, betrifft nur Tests"

- These are often due to test-specific type issues
- Focus on runtime test success, not TypeScript errors in tests

### Test Timeout Issues

- Increase timeout for complex tests: `jest.setTimeout(10000);`
- Use `--runInBand --forceExit` flags

### Validation Middleware Issues

- Check if using `handleValidationErrors` instead of `validate`
- See Settings v2 fix in API-V2-KNOWN-ISSUES.md

## Best Practices Summary

1. **ALWAYS** use real database tests, not mocks
2. **ALWAYS** place tests in `__tests__` folders
3. **ALWAYS** run with `--runInBand` flag
4. **ALWAYS** use returned values from `createTestUser()`
5. **NEVER** hardcode test emails or usernames
6. **NEVER** mock services or controllers
7. **IMPORT** console functions for debugging
8. **CHECK** database schema matches production

## Example Commands

```bash
# Run all v2 tests
docker exec assixx-backend npm test -- backend/src/routes/v2 --runInBand

# Run specific API tests
docker exec assixx-backend npm test -- backend/src/routes/v2/plans/__tests__ --runInBand

# Run with coverage
docker exec assixx-backend npm test -- backend/src/routes/v2/plans/__tests__ --runInBand --coverage

# Debug a hanging test
docker exec assixx-backend npm test -- backend/src/routes/v2/plans/__tests__ --runInBand --forceExit --detectOpenHandles
```

## General Debugging and Error Resolution Patterns

### 1. **Systematic Error Analysis**

When tests fail, follow this systematic approach:

- Read the ENTIRE error message carefully
- Identify the error location (file path and line number)
- Check if it's a compile-time or runtime error
- Look for patterns in multiple errors

### 2. **Import and Module Resolution Issues**

Common patterns and solutions:

```typescript
// Error: Cannot find module './service' from 'test.ts'
// Solution: Check if mocking syntax matches actual import path

// Error: Module has no exported member 'X'
// Solution: Verify exact export names and import syntax

// Error: jest is not defined
// Solution: Import jest from "@jest/globals"
```

### 3. **Middleware Chain Debugging**

When requests hang or timeout:

- Add logging at the START of each route handler
- Check middleware order (auth → validation → handler)
- Verify middleware is calling next() properly
- Look for infinite loops in validation

### 4. **Type Mismatch Debugging**

```typescript
// Common pattern: Database returns different types than expected
// Solution: Always parse/convert database values
parseFloat(dbValue); // for decimals
Boolean(dbValue); // for tinyint to boolean
```

### 5. **Response Format Consistency**

When tests fail on response structure:

- Check if using correct response helper (successResponse vs custom)
- Verify metadata/meta naming conventions
- Ensure consistent field naming (camelCase vs snake_case)

### 6. **Database State Issues**

```bash
# Always check actual DB values when tests fail
docker exec assixx-mysql sh -c 'mysql -u user -ppass db -e "SELECT * FROM table"'

# Compare test expectations with real data
# Don't assume test data matches your insert statements
```

### 7. **Async/Promise Debugging**

- Tests hanging often indicate unresolved promises
- Use --detectOpenHandles to find open connections
- Add explicit timeouts to identify stuck operations
- Check for missing await keywords

### 8. **Environment-Specific Issues**

```typescript
// Common issue: Test environment differs from dev
// Solution: Always check process.env values
// Use test-specific configurations
```

### 9. **Incremental Problem Solving**

- Fix one error at a time
- Re-run tests after each fix
- Don't assume fixing one error fixes all
- Keep track of changes (TodoWrite)

### 10. **Common Anti-Patterns to Avoid**

```typescript
// ❌ DON'T ignore "minor" errors - they cascade
// ❌ DON'T assume hardcoded values match DB
// ❌ DON'T skip reading full stack traces
// ❌ DON'T change multiple things at once
```

### 11. **Effective Logging Strategy**

```typescript
// Add strategic logging points:
console.info('[Controller] Method entry:', { params, body });
console.info('[Service] Before DB call:', query);
console.info('[Service] After DB call:', result);
console.info('[Controller] Sending response:', responseData);
```

### 12. **Version and Dependency Conflicts**

- Check if all imports use consistent file extensions (.js)
- Verify package versions match between environments
- Look for circular dependencies

### 13. **Test Isolation Problems**

```typescript
// Use beforeEach to reset state
// Check if tests are truly independent
// Look for shared global state
// Verify cleanup actually runs
```

### 14. **The "Works in Dev but Fails in Test" Pattern**

Common causes:

- Different database state
- Missing environment variables
- Hardcoded values vs dynamic data
- Timing/race conditions

### 15. **Strategic Use of Test Utilities**

```bash
# Run progressively narrower test scopes
npm test                           # Everything
npm test -- path/to/file          # Single file
npm test -- --testNamePattern=X   # Single test
```

---

**Last Updated:** 2025-07-31
**Created by:** Claude AI
**Based on:** Real debugging experience from Plans API v2 implementation
