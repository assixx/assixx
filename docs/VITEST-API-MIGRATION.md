# Vitest API Test Migration

Migrate all Bruno CLI API tests to Vitest integration tests using native `fetch()`.

## Architecture

```text
api-tests/
  vitest/
    helpers.ts                # Shared: login, constants, types, authHeaders
    auth.api.test.ts          # Auth (setup + login + refresh + logout)
    users.api.test.ts         # Users CRUD
    departments.api.test.ts   # Departments CRUD
    teams.api.test.ts         # Teams CRUD
    roles.api.test.ts         # Roles
    notifications.api.test.ts # Notifications CRUD
    blackboard.api.test.ts    # Blackboard CRUD
    calendar.api.test.ts      # Calendar events
    kvp.api.test.ts           # KVP (continuous improvement)
    machines.api.test.ts      # Machines CRUD
    surveys.api.test.ts       # Surveys CRUD
    chat.api.test.ts          # Chat (needs 2nd user)
    documents.api.test.ts     # Documents
    shifts.api.test.ts        # Shifts
    logs.api.test.ts          # Audit logs
    settings.api.test.ts      # Tenant settings
    features.api.test.ts      # Feature flags
    areas.api.test.ts         # Areas
  environments/               # Bruno env files (kept for reference)
  auth/, users/, ...          # Bruno .bru files (kept until migration verified)
```

## How to Run

```bash
pnpm run test:api:vitest
```

Requires Docker backend running (`doppler run -- docker-compose up -d`).

## Config

- File: `vitest.config.api.ts`
- Pool: `forks`, `maxWorkers: 1`, `isolate: false` (sequential execution)
- Timeout: 30s per test / 30s per hook
- No setup file (no mocking -- real HTTP requests)

## Pattern Mapping: Bruno to Vitest

| Bruno                                   | Vitest                                   |
| --------------------------------------- | ---------------------------------------- |
| `bru.setVar("key", val)`                | `let key = val` (module-level)           |
| `{{variable}}`                          | `${variable}` (template literal)         |
| `res.getStatus()`                       | `res.status`                             |
| `res.getBody()`                         | `await res.json()`                       |
| `assert { res.status: eq 200 }`         | `expect(res.status).toBe(200)`           |
| `assert { res.body.X: isString }`       | `expect(body.X).toBeTypeOf('string')`    |
| `assert { res.body.X: isNumber }`       | `expect(body.X).toBeTypeOf('number')`    |
| `script:post-response`                  | Inline after assertions                  |
| Sequential `.bru` files (meta.seq)      | Sequential `it()` blocks in `describe()` |
| `auth:bearer { token: {{auth_token}} }` | `headers: authHeaders(auth.authToken)`   |
| `bru.sendRequest()` (re-login)          | `await loginBrunotest()`                 |

## Test File Template

```typescript
import { type AuthState, BASE_URL, type JsonBody, authHeaders, loginBrunotest } from './helpers';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginBrunotest();
});

describe('Module: List', () => {
  it('should list items', async () => {
    const res = await fetch(`${BASE_URL}/endpoint`, {
      headers: authHeaders(auth.authToken),
    });
    const body: JsonBody = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

## Definition of Done -- Per Module

- [ ] All `.bru` files migrated to a single `{module}.api.test.ts`
- [ ] Every `assert` block covered by `expect()` assertions
- [ ] Every `tests` block test case represented as `it()` block
- [ ] Every `script:post-response` state update handled via module-level variables
- [ ] `beforeAll` handles login via `loginBrunotest()`
- [ ] Prerequisite resources created in `beforeAll` (self-contained)
- [ ] Test passes with `pnpm run test:api:vitest`
- [ ] No `any` without eslint-disable + justification comment
- [ ] `body` typed as `JsonBody`
- [ ] Unused variables prefixed with `_`

## Definition of Done -- Overall Migration

- [ ] All 18 modules migrated
- [ ] `pnpm run test:api:vitest` -- all tests green
- [ ] No Vitest deprecation warnings
- [ ] `helpers.ts` provides shared utilities (DRY)
- [ ] Each test file self-contained (creates own prerequisites in beforeAll)
- [ ] Conditional expects have eslint-disable with justification
- [ ] This document updated with final status

## Migration Status

| Module        | .bru Files | Status  | Tests |
| ------------- | ---------- | ------- | ----- |
| auth (+setup) | 9          | DONE    | 9     |
| users         | 3          | pending | -     |
| departments   | 5          | pending | -     |
| teams         | 6          | pending | -     |
| roles         | 3          | pending | -     |
| notifications | 8          | pending | -     |
| blackboard    | 11         | pending | -     |
| calendar      | 6          | pending | -     |
| kvp           | 9          | pending | -     |
| machines      | 9          | pending | -     |
| surveys       | 7          | pending | -     |
| chat          | 3          | pending | -     |
| documents     | 2          | pending | -     |
| shifts        | 6          | pending | -     |
| logs          | 6          | pending | -     |
| settings      | 4          | pending | -     |
| features      | 3          | pending | -     |
| areas         | 2          | pending | -     |
