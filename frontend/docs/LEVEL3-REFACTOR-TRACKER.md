# Level 3 SSR Refactor Tracker

> **Pattern**: `$derived` + URL params + `invalidateAll()`
> **Status**: ✅ COMPLETE (23/23 pages)
> **Last Updated**: 2026-01-04

---

## Progress Summary

| Status    | Count  | Percentage |
| --------- | ------ | ---------- |
| Completed | 23     | 100%       |
| **Total** | **23** | 100%       |

---

## Level 3 Pattern Summary

```typescript
// 1. SSR data via $derived (single source of truth)
const entries = $derived(data?.entries ?? []);

// 2. Filter/sort/page state from URL params
const currentPage = $derived(Number($page.url.searchParams.get('page') ?? '1'));

// 3. Navigation changes URL, triggers SSR reload
await goto('/page?filter=active&page=2');

// 4. Mutations trigger invalidateAll()
await apiClient.delete(`/items/${id}`);
await invalidateAll();
```

---

## Refactor Status

### ✅ Completed (22 pages)

| Page                   | Lines | Notes                                                                           |
| ---------------------- | ----- | ------------------------------------------------------------------------------- |
| blackboard             | 675   | Full Level 3 with URL params for filter/sort/page                               |
| root-dashboard         | 231   | Read-only stats, `invalidateAll()` after employee number save                   |
| admin-dashboard        | 363   | Read-only, already fully Level 3 compliant                                      |
| survey-results         | 393   | Removed external state, now `$derived` from SSR data                            |
| survey-admin           | 387   | CRUD with `$derived` + `invalidateAll()` after mutations                        |
| features               | 538   | Feature toggles with `$derived` + `invalidateAll()`                             |
| manage-admins          | 540   | CRUD with `$derived` + client-side filtering                                    |
| manage-root            | 544   | CRUD with `$derived` + `invalidateAll()` after mutations                        |
| manage-employees       | 559   | CRUD with `$derived` + `invalidateAll()` after mutations                        |
| manage-machines        | 565   | CRUD with `$derived` + `invalidateAll()`, uses external state store for UI      |
| manage-areas           | 573   | CRUD with `$derived` + `invalidateAll()` after mutations                        |
| manage-teams           | 598   | CRUD with `$derived` + `invalidateAll()` after mutations                        |
| manage-departments     | 581   | CRUD with `$derived` + `invalidateAll()` after mutations                        |
| survey-employee        | 561   | Survey responses with `$derived` + `invalidateAll()`, uses state store for UI   |
| kvp                    | 567   | Hybrid: `$derived` + `invalidateAll()` after mutations, client-side filtering   |
| account-settings       | 379   | SSR deletion status with `$derived` + `invalidateAll()`                         |
| root-profile           | 613   | SSR profile + approvals with `$derived` + `invalidateAll()`                     |
| shifts                 | 700   | Hybrid: favorites via `$derived` + `invalidateAll()`, dynamic shift client-side |
| tenant-deletion-status | 494   | `$derived` + `invalidateAll()` + auto-refresh via invalidateAll                 |
| kvp-detail             | 592   | `$derived` + `$effect` sync to store + `invalidateAll()` after mutations        |
| blackboard/[uuid]      | 530   | `$derived` + `invalidateAll()` after confirm/unconfirm/comment/archive          |
| calendar               | 577   | `$derived` + `$effect` sync to store + `invalidateAll()` after save/delete      |
| logs                   | 655   | Hybrid: SSR initial + client-side pagination/filtering                          |
| documents-explorer     | 655   | Hybrid: SSR initial + client-side filtering/sorting                             |
| chat                   | 584   | Hybrid: SSR initial + WebSocket real-time updates + `invalidateAll()`           |

---

## Recent Refactoring Session (2026-01-04)

| Page                   | Before | After | Change | Notes                              |
| ---------------------- | ------ | ----- | ------ | ---------------------------------- |
| tenant-deletion-status | 524    | 494   | -30    | Removed IIFE, loading/error states |
| kvp-detail             | 566    | 592   | +26    | Added $effect sync for child comps |
| blackboard/[uuid]      | 575    | 530   | -45    | Removed loadEntry(), loading/error |
| calendar               | 586    | 577   | -9     | Streamlined lifecycle with $effect |
| logs                   | 628    | 655   | +27    | Hybrid pattern with SSR init       |
| documents-explorer     | 642    | 655   | +13    | Hybrid pattern with SSR init       |
| chat                   | 576    | 584   | +8     | WebSocket hybrid + invalidateAll   |

---

## Refactor Checklist per Page

### +page.server.ts Changes

- [x] Read URL search params (`url.searchParams`)
- [x] Build dynamic API query from params
- [x] Return all needed data for page

### +page.svelte Changes

- [x] Remove IIFE patterns (`(() => data?.xxx)()`)
- [x] Change `$state` to `$derived` for SSR data
- [x] Read filter/sort/page from `$page.url.searchParams`
- [x] Replace `fetchXxx()` with `goto()` + URL params
- [x] Replace local state updates with `invalidateAll()` after mutations
- [x] Keep `$state` only for UI-only state (modals, form fields)
- [x] Remove unused client-side fetch functions

---

## File Reference

```
frontend-svelte/src/routes/(app)/
├── account-settings/         # 379 lines - ✅ DONE
├── admin-dashboard/          # 363 lines - ✅ DONE
├── blackboard/               # 675 lines - ✅ DONE
│   └── [uuid]/               # 530 lines - ✅ DONE
├── calendar/                 # 577 lines - ✅ DONE
├── chat/                     # 584 lines - ✅ DONE (WebSocket hybrid)
├── documents-explorer/       # 655 lines - ✅ DONE (hybrid)
├── features/                 # 538 lines - ✅ DONE
├── kvp/                      # 567 lines - ✅ DONE
├── kvp-detail/               # 592 lines - ✅ DONE
├── logs/                     # 655 lines - ✅ DONE (hybrid)
├── manage-admins/            # 540 lines - ✅ DONE
├── manage-areas/             # 573 lines - ✅ DONE
├── manage-departments/       # 581 lines - ✅ DONE
├── manage-employees/         # 559 lines - ✅ DONE
├── manage-machines/          # 565 lines - ✅ DONE
├── manage-root/              # 544 lines - ✅ DONE
├── manage-teams/             # 598 lines - ✅ DONE
├── root-dashboard/           # 231 lines - ✅ DONE
├── root-profile/             # 613 lines - ✅ DONE
├── shifts/                   # 700 lines - ✅ DONE (hybrid)
├── survey-admin/             # 387 lines - ✅ DONE
├── survey-employee/          # 561 lines - ✅ DONE
├── survey-results/           # 393 lines - ✅ DONE
└── tenant-deletion-status/   # 494 lines - ✅ DONE
```

---

## Notes

- **23/23 pages completed** (100%) ✅
- Simple read-only pages: `$state` → `$derived` conversion
- CRUD pages: `invalidateAll()` after mutations
- Hybrid pages (logs, documents, shifts): SSR initial + client updates
- WebSocket pages (chat): SSR initial + real-time updates + `invalidateAll()` for structural changes
- External state stores are still used for UI state in complex pages
