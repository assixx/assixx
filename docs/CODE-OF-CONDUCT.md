# Assixx Code of Conduct

**Version:** 1.0.0 | **Created:** 2025-12-16

> Write code as if the maintainer is a violent psychopath who knows where you live.

---

## References

- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) - Code standards, ESLint rules
- [POWER-OF-TEN-RULES.md](./POWER-OF-TEN-RULES.md) - NASA/JPL safety-critical rules
- [eslint.config.js](../eslint.config.js) - Enforced rules
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - PostgreSQL 17 + RLS

---

## Core Principles

**KISS** - Less code = fewer bugs. Explicit > implicit. Readability > cleverness.

**NO QUICK FIXES** - Fix root cause, not symptoms. Think long-term. Technical debt has interest.

**CLEAN CODE** - Self-documenting. Comments explain "why", not "what". One function = one task.

---

## Power of Ten (NASA/JPL) - Summary

| #   | Rule                      | Application                   |
| --- | ------------------------- | ----------------------------- |
| 1   | Simple control flow       | No recursion                  |
| 2   | Bounded loops             | `while` needs MAX_ITERATIONS  |
| 3   | No dynamic allocation     | Object pools in hot paths     |
| 4   | Max 60 lines/function     | ESLint enforced               |
| 5   | Min 2 assertions/function | Zod + business checks         |
| 6   | Smallest scope            | `const` > `let` > never `var` |
| 7   | Check return values       | No floating promises          |
| 8   | Minimal build config      | Max 2-3 env flags             |
| 9   | Max 3 reference levels    | No `a.b.c.d.e.f` chains       |
| 10  | Zero warnings             | All errors = blockers         |

---

## TypeScript Rules

### Forbidden

| Bad                 | Why                    | Good                   |
| ------------------- | ---------------------- | ---------------------- |
| `any`               | Destroys type-safety   | `unknown` + type guard |
| `\|\|` for defaults | `0` and `""` are falsy | `??`                   |
| `if (value)`        | Truthy check unsafe    | `if (value !== null)`  |
| `!` assertion       | Lies to compiler       | Explicit null checks   |
| Floating promises   | Errors disappear       | `await` or `void`      |
| `?` placeholders    | MySQL syntax           | `$1, $2, $3`           |
| `// TODO:`          | Never done             | Implement now          |
| `var`               | Scope chaos            | `const` or `let`       |

### Required

| Rule                  | Example                            |
| --------------------- | ---------------------------------- |
| Explicit return types | `function calc(x: number): number` |
| Zod validation        | `z.object({...})`                  |
| Strict booleans       | `if (arr.length > 0)`              |
| RETURNING clause      | `INSERT ... RETURNING id`          |

---

## Hard Limits (ESLint Enforced)

```
Lines per function:    60
Lines per file:       800 (backend), 400 (frontend)
Cognitive complexity:  10
Max nesting depth:      4
Max classes per file:   2
```

---

## Naming Conventions

```typescript
const userId = 42; // camelCase: variables, functions
interface UserProfile {} // PascalCase: types, interfaces
const MAX_RETRY = 3; // UPPER_SNAKE: constants
enum Status {
  ACTIVE = 1,
} // UPPER_SNAKE: enum members
// user-profile.ts                    // kebab-case: files
const isActive = true; // is/has/can: booleans
```

---

## Git Workflow

```bash
# Branch naming
feature/short-description
bugfix/issue-123-description
hotfix/critical-fix

# Commit format
<type>(<scope>): <description>
# Types: feat, fix, docs, refactor, test, chore

# Merge strategy - ALWAYS --no-ff
git merge --no-ff feature/xyz
```

---

## Database (PostgreSQL 17)

```typescript
// Parameterized queries - $1, $2, $3
await execute('SELECT * FROM users WHERE id = $1', [userId]);

// INSERT with RETURNING
await execute('INSERT INTO users (email) VALUES ($1) RETURNING id', [email]);

// NEVER string concatenation - SQL INJECTION RISK
```

**is_active codes:** `0`=inactive, `1`=active, `3`=archived, `4`=deleted

---

## Error Handling

```typescript
// Service: validate input + validate result (min 2 assertions)
async function getUserById(id: number): Promise<User> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ServiceError('INVALID_ID', `Invalid ID: ${id}`);
  }
  const rows = await execute('SELECT * FROM users WHERE id = $1', [id]);
  if (!rows[0]) {
    throw new ServiceError('NOT_FOUND', `User not found: ${id}`);
  }
  return rows[0];
}
```

---

## Code Review Checklist

**Quality:** `pnpm run lint` = 0 errors, `pnpm run type-check` = 0 errors, no `any`, no `// TODO:`

**Security:** SQL injection prevented ($1,$2,$3), tenant isolation (RLS), no secrets in code

**Performance:** No N+1 queries, indexes exist

---

## Testing

```bash
pnpm run test:api                              # All API tests
cd api-tests && npx bru run calendar --env local  # Single module
```

---

## Quick Reference

```
FORBIDDEN                      REQUIRED
--------------------------     --------------------------
any                            unknown + type guard
|| for defaults                ?? (nullish coalescing)
if (value)                     if (value !== null)
// TODO:                       Implement immediately
? placeholders                 $1, $2, $3
var                            const or let
Functions > 60 lines           Functions <= 60 lines
```

---

## Violations

| Violation                       | Consequence                 |
| ------------------------------- | --------------------------- |
| ESLint error                    | PR blocked                  |
| `any` without justification     | Code review reject          |
| Quick fix instead of root cause | Refactoring required        |
| Missing tests                   | PR blocked                  |
| SQL injection possible          | Immediate fix + post-mortem |

---

**This document is binding. Code violating these standards will not be merged.**
