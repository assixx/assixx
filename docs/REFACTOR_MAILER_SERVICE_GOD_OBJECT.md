# Refactor: Move root-self-termination email methods out of `MailerService`

**Status:** Pending — separate session **·** **Created:** 2026-04-28 **·** **Effort:** ~20 min

---

## Why

`backend/src/nest/common/services/mailer.service.ts` is becoming a god object.
It currently mixes 4 unrelated domains: password-reset (auth), bug-report
(feedback), and root-self-termination lifecycle (root). Every new feature
adds 2–3 methods → unbounded growth, cross-domain coupling.

The masterplan **already rejected this pattern for `notifications.service.ts`**
(Spec Deviation D7, `FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md` v1.0.6):

> "concentrating per-domain handler logic there would create a god object
> that knows about every feature."

The same logic applies to MailerService. This refactor brings the email
fan-out for root-self-termination in line with that established pattern
(co-locate with producer / `*-notification.service.ts`).

**Out of scope:** password-reset + bug-report stay in `MailerService` for
now — they have their own consumers (`AuthService`, `FeedbackService`)
and are pre-existing. A bigger MailerService split is a future cleanup.

---

## What

Move 6 methods from `MailerService` into `RootSelfTerminationNotificationService`:

- `sendRootSelfTerminationRequested()`
- `sendRootSelfTerminationApproved()`
- `sendRootSelfTerminationRejected()`
- `buildSelfTerminationRequestedText()` (private helper)
- `buildSelfTerminationApprovedText()` (private helper)
- `buildSelfTerminationRejectedText()` (private helper)

Inside the new home, use `emailService` (the legacy module wrapped by
MailerService) **directly** for `loadBrandedTemplate()` + `sendEmail()`.
This drops the `MailerService` dependency from `RootModule` entirely.

**Outcome:** `RootSelfTerminationNotificationService` becomes the single
owner of all post-event fan-out for the 3 lifecycle events:

1. Typed `eventBus.emit*()` — SSE (already there)
2. Persistent `INSERT INTO notifications` (already there)
3. Branded email send (was in MailerService, moves here)

---

## Files to touch

| File                                                                       | Change                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/nest/common/services/mailer.service.ts`                       | DELETE the 3 `sendRootSelfTermination*()` methods + 3 `buildSelfTermination*Text()` helpers. The 2 module-level constants `DEFAULT_APP_URL` + `UNKNOWN_ERROR` STAY (still used by password-reset paths).                                                                                                                                                                        |
| `backend/src/nest/root/root-self-termination-notification.service.ts`      | DROP `import MailerService` + `private readonly mailer` constructor param. ADD `import emailService from '../../utils/email-service.js'`. Replace each `await this.mailer.sendRootSelfTermination*(...)` call with an inline branded-template + sendEmail block (copy logic verbatim from current MailerService). The 3 text-builder helpers move in too — keep them `private`. |
| `backend/src/nest/root/root.module.ts`                                     | DROP `MailerService` from imports + `providers` array. The Phase-8 comment-block stays as historical context but rewrite to point at the new in-NotificationService location.                                                                                                                                                                                                   |
| `backend/src/nest/root/root-self-termination-notification.service.test.ts` | DROP `MockMailer` factory + `mockMailer` constructor arg. ADD `vi.mock('../../utils/email-service.js', ...)` at top with `loadBrandedTemplate` + `sendEmail` mocks. Replace `expect(mockMailer.send*)` assertions with `expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(N)` + payload checks.                                                                          |
| `backend/src/nest/common/services/mailer.service.test.ts`                  | DROP tests for the 3 removed `sendRootSelfTermination*` methods (whatever exists there). Keep password-reset + bug-report tests.                                                                                                                                                                                                                                                |

---

## Definition of Done

- [ ] `pnpm exec eslint backend/src/nest/root/ backend/src/nest/common/services/mailer.service.ts` → 0 errors
- [ ] `docker exec assixx-backend pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm exec vitest run --project unit backend/src/nest/root/` → all green (≥10 tests in notification service)
- [ ] `pnpm exec vitest run --project unit backend/src/nest/common/services/mailer.service.test.ts` → all green
- [ ] `grep -rn "MailerService" backend/src/nest/root/` → 0 hits (root domain no longer depends on the wrapper)
- [ ] Live smoke: post a self-termination request, observe backend log line `E-Mail gesendet: <...@assixx.com>` (3 times for a 2-peer tenant)
- [ ] Masterplan changelog entry `v2.0.x` added: "MailerService god-object refactor — root-self-termination emails moved to NotificationService"
- [ ] D7 row in deviations table updated to note the consistency win (optional)

---

## Prompt for the next session

```
Read docs/REFACTOR_MAILER_SERVICE_GOD_OBJECT.md, then execute the refactor
exactly as specified. ULTRATHINK before edits. Keep changes mechanical:

1. Move 6 methods (3 send + 3 text-builder) from
   backend/src/nest/common/services/mailer.service.ts
   into
   backend/src/nest/root/root-self-termination-notification.service.ts

2. Inside the new home, swap MailerService transport calls for direct
   emailService.loadBrandedTemplate() + emailService.sendEmail() calls.
   Logic stays IDENTICAL (subject, body, error swallowing).

3. Drop the MailerService constructor dependency from
   RootSelfTerminationNotificationService + drop MailerService from
   RootModule providers + imports.

4. Update the paired test:
   - Drop MockMailer factory.
   - Add vi.mock('../../utils/email-service.js', ...) with loadBrandedTemplate
     + sendEmail mocks.
   - Replace mailer assertions with sendEmail assertions (same call counts).

5. Drop the 3 self-termination-specific tests from mailer.service.test.ts
   (if any).

DoD checklist in the doc must all pass before commit. Suggested commit
message: refactor(root-protection): move self-termination emails into
NotificationService (god-object cleanup).

DO NOT touch password-reset, bug-report, or anything else in MailerService.
DO NOT add new templates. DO NOT introduce new abstractions. KISS.
```

---

## References

- `docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md` Spec Deviation D7
  (notifications.service.ts god-object rejection — same logic)
- `backend/src/nest/vacation/vacation-notification.service.ts` (gold-standard
  per-domain notification service — should also own its emails when added)
- `docs/infrastructure/adr/ADR-003-notification-system.md` §"NestJS MailerService Wrapper"
- Current implementation we're refactoring: commit shipping Phase 8 (search:
  `feat(root-protection): email integration for self-termination (Phase 8)`)
