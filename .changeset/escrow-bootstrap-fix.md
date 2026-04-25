---
'assixx-backend': patch
'assixx-frontend': patch
---

fix: cross-origin first-escrow bootstrap (ADR-022 §"New-user scenario")

The apex-login → subdomain-handoff flow now creates the user's first escrow
blob automatically via a bootstrap-variant of the unlock ticket. Previously
documented as deferred in the ADR-022 Amendment 2026-04-22, but every new
user (and every database restore without escrow rows) hit a non-recoverable
fail-closed state on the second cross-origin login. The unlock ticket payload
now optionally carries `argon2Salt + argon2Params` derived on apex; the
subdomain generates the X25519 key, registers it, and stores the first
escrow blob — all without re-prompting for the password and without a second
Argon2id round-trip. Pre-flight check on apex (`GET /e2e/keys/me`) skips
the bootstrap when the server already holds an active key for that user
(existing-user-without-escrow case → admin reset remains the recovery).
