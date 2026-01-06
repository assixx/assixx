# ADR: tRPC Implementation Decision

**Status:** REJECTED
**Date:** 2025-01-06
**Decision:** Do not implement tRPC for Assixx

---

## Context

tRPC packages installed but unused: `@trpc/client@11.8.1`, `@trpc/server@11.8.1` [^1]

## Decision Drivers

| Factor | Current State | With tRPC |
|--------|---------------|-----------|
| Type Safety | Zod + TypeScript | Equivalent [^2] |
| API Client | 684 LOC, production-tested [^3] | Requires rewrite |
| Controllers | 20+ REST endpoints [^4] | Duplicate as tRPC routers |
| Mobile Support | REST native | REST required anyway |

## Arguments Against Implementation

### 1. No Native Framework Support
- NestJS: Requires third-party `nestjs-trpc` [^5]
- SvelteKit: No official adapter, community-only [^6]
- Risk: External dependency maintenance burden

### 2. Existing Type Safety Chain
```
Zod Schema → NestJS DTO → API Response → api-client.ts → SvelteKit
```
End-to-end types already enforced. tRPC adds zero value here.

### 3. REST Requirement Persists
External integrations and mobile clients require REST endpoints.
Result: Maintaining dual API surface (REST + tRPC) = 2x complexity.

### 4. Migration Cost vs. Benefit
- Estimated effort: 40-80 hours
- Benefit: None (type safety exists)
- ROI: Negative

## Decision

**Remove unused tRPC packages. Focus on Phase 4-5 migration.**

## References

[^1]: `frontend-svelte/package.json` - installed dependencies
[^2]: `backend/docs/ZOD-INTEGRATION-GUIDE.md` - existing validation
[^3]: `frontend-svelte/src/lib/api-client.ts` - 684 lines with cache, token refresh
[^4]: `backend/src/modules/*/` - 20+ controller files
[^5]: https://github.com/trpc/trpc - no NestJS in built-in adapters
[^6]: https://github.com/trpc/trpc - SvelteKit not listed as official adapter
