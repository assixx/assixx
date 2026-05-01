# HOW-TO — Dev SMTP via Mailpit

> **Scope:** local development only. Profile `dev`. Never reaches CI / production.
> **Why:** Phase 2 of the email-2FA refactor needs a working SMTP target before any
> backend code is written. Mailpit gives zero external deps and a Web-UI for visual
> verification that `email-service.ts` reaches an SMTP listener and serialises mail
> correctly. Production SMTP (SPF / DKIM / DMARC / sender reputation) is tested
> separately — see Steps 0.5.2 / 0.5.6 / 0.5.7 in `docs/FEAT_2FA_EMAIL_MASTERPLAN.md`.
> **References:** ADR-027 (Docker profile system, image pinning) · DD-25 in
> [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) §0.4.
> **Migration note (2026-04-29):** replaces the previous Maildev-based setup
> (`maildev/maildev:2.2.1`, ports 1080/1025). Maildev is no longer actively
> maintained — last release 2024-12-12. Mailpit is the modern equivalent: lower
> memory, persistent SQLite store, faster Web-UI, active release cadence. The
> Doppler key `SMTP_HOST` changed from `maildev` to `mailpit`; the host port for
> the UI changed from `1080` to `8025`. SMTP port (1025) and SMTP auth posture
> (no AUTH required) are unchanged.

---

## 1. What you get

| Container        | Image                                                                                           | Profile | Host port | Internal port | Purpose          |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------- | --------- | ------------- | ---------------- |
| `assixx-mailpit` | `axllent/mailpit:v1.29@sha256:757f22b56c1da03570afdb3d259effe5091018008a81bbedc8158cee7e16fdbc` | `dev`   | `8025`    | `1025` (SMTP) | Dev SMTP capture |

The SMTP port (1025) is **not** published to the host — only sibling containers on
`assixx-network` can submit mail. The Web-UI + REST API (8025) is published so you
can browse captured mail at <http://localhost:8025> and tests can drive the API
(`GET /api/v1/messages`, `DELETE /api/v1/messages`).

Mail persists across `docker-compose restart` via the `assixx_mailpit_data`
named volume (mounted at `/data/mailpit.db`). Tests still wipe explicitly via
`clearMailpit()` (`backend/test/helpers.ts`) so cross-test state never bleeds.

---

## 2. Doppler dev secrets

Mailpit is configured with `MP_SMTP_AUTH_ACCEPT_ANY=1` + `MP_SMTP_AUTH_ALLOW_INSECURE=1`,
so it accepts SMTP connections without AUTH (matches the previous Maildev UX).
Point the app at `mailpit:1025`:

```bash
doppler secrets set --config dev SMTP_HOST=mailpit
doppler secrets set --config dev SMTP_PORT=1025
doppler secrets set --config dev SMTP_USER=""
doppler secrets set --config dev SMTP_PASS=""
doppler secrets set --config dev SMTP_FROM="noreply@assixx.de"
```

Verify:

```bash
doppler secrets get --config dev SMTP_HOST SMTP_PORT SMTP_FROM --plain
```

> **Hint:** `SMTP_USER` / `SMTP_PASS` MUST exist as keys (the backend's compose
> spec references `${SMTP_USER}` / `${SMTP_PASS}`). Empty values are correct for
> Mailpit — do **not** delete the keys.

> **Migration step (one-time):** if your Doppler `dev` config still has
> `SMTP_HOST=maildev`, run the `set` command above. The container hostname
> changed; without this update the backend will fail DNS resolution at first
> SMTP submit.

---

## 3. Start the stack

```bash
cd /home/scs/projects/Assixx/docker

# After changing Doppler secrets, container env vars are stale. Recreate the
# affected services so the new SMTP_HOST/PORT propagate into process.env.
doppler run -- docker-compose up -d --force-recreate mailpit backend deletion-worker

doppler run -- docker-compose ps mailpit backend
# expected: both `Up (healthy)`
```

> **Why `--force-recreate`:** Doppler injects env vars at container start. Existing
> containers keep their old env until recreated. Without `--force-recreate` you'll
> chase a phantom "wrong SMTP host" bug for ten minutes.

> **Cutover from maildev:** if `assixx-maildev` is still running, stop and remove
> it first — both services share `profile: [dev]` so you don't need a separate
> down command, just bring `mailpit` up:
>
> ```bash
> doppler run -- docker-compose --profile dev stop maildev
> doppler run -- docker-compose --profile dev rm -f maildev
> ```

---

## 4. Smoke test

The masterplan §0.5.5 lists a placeholder command using `m.sendTestEmail(...)`.
That export does **not** exist in `backend/src/utils/email-service.ts`; use the
existing default-export `sendEmail()` instead — same code path, same SMTP
plumbing, no scope creep into Phase 2.

```bash
cd /home/scs/projects/Assixx

doppler run -- docker exec assixx-backend node -e "
import('/app/backend/dist/utils/email-service.js').then(async (m) => {
  const r = await m.default.sendEmail({
    to: 'test@scs-technik.de',
    subject: 'Mailpit smoke (Phase 0.5.5)',
    text: 'Smoke test from Assixx dev SMTP. If this lands in Mailpit, plumbing is green.',
  });
  console.log(JSON.stringify(r));
  process.exit(r.success ? 0 : 1);
}).catch((e) => { console.error(e); process.exit(1); });
"
```

Expected stdout: `{"success":true,"messageId":"<...@assixx.de>"}` and exit 0.

### Verify in Mailpit UI

1. Open <http://localhost:8025>.
2. The mail should appear within 1–2 s with:
   - **Subject:** `Mailpit smoke (Phase 0.5.5)`
   - **From:** `Assixx <noreply@assixx.de>` (default fallback in `email-service.ts`
     when `SMTP_FROM` resolves to that value).
   - **To:** `test@scs-technik.de`.
   - **Body:** the plain-text line above.

### Verify via REST API

Mailpit's REST API replaces Maildev's old `GET /email` / `DELETE /email/all`:

```bash
# List captured messages (envelope shape: { total, messages: [...] })
curl -s http://localhost:8025/api/v1/messages | jq '.messages[0] | {ID, Subject, To, Snippet}'

# Read a single message body (Text + HTML fields)
ID=$(curl -s http://localhost:8025/api/v1/messages | jq -r '.messages[0].ID')
curl -s "http://localhost:8025/api/v1/message/$ID" | jq '{Subject, Text}'
```

Definition of done for Step 0.5.5: ✅ mail visible in Mailpit within 30 s, this
HOW-TO merged to `main`, catalog updated.

---

## 5. Reset / cleanup

```bash
# Wipe captured mail without restarting the container (Mailpit REST API):
curl -X DELETE http://localhost:8025/api/v1/messages
# → 200 OK, body "ok"

# OR full container reset (drops the SQLite store too):
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose --profile dev rm -sf mailpit
doppler run -- docker volume rm assixx_mailpit_data  # only if you want the DB gone
doppler run -- docker-compose --profile dev up -d mailpit
```

> **Note vs maildev:** Mailpit persists captured mail in `/data/mailpit.db`
> across container restarts (volume `assixx_mailpit_data`). Maildev was RAM-only.
> If a test depends on a clean mailbox, rely on `clearMailpit()` in
> `backend/test/helpers.ts` — it calls `DELETE /api/v1/messages` which is
> idempotent and survives restarts.

---

## 6. Troubleshooting

| Symptom                                                       | Cause                                                                           | Fix                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Smoke command exits 1 with `ECONNREFUSED 127.0.0.1:587`       | Container env still points at the old SMTP host (Doppler change stale).         | `docker-compose up -d --force-recreate backend` after `doppler secrets set`.                    |
| Smoke command exits 1 with `getaddrinfo ENOTFOUND maildev`    | Doppler `SMTP_HOST` still says `maildev` after the migration.                   | `doppler secrets set --config dev SMTP_HOST=mailpit` + `--force-recreate backend`.              |
| Smoke exits 0 but Mailpit UI is empty                         | Mail captured by a different transport / wrong port.                            | `docker exec assixx-backend printenv SMTP_HOST SMTP_PORT` → must show `mailpit` / `1025`.       |
| `assixx-mailpit` keeps restarting                             | Port 8025 already bound on host (e.g. another tool).                            | `lsof -i :8025`; stop the conflicting process or change the publish port.                       |
| `pnpm exec tsc` not yet emitted `dist/utils/email-service.js` | Backend is mid-cold-start (~60 s on first boot).                                | Wait for `docker-compose ps backend` → `(healthy)`, then re-run smoke.                          |
| Mail arrives but body is HTML-empty                           | Caller passed `html: ''` and no `text`.                                         | `sendEmail()` always needs at least `text` or `html` populated.                                 |
| Mailpit UI shows mail but downstream test claims "no mail"    | Stale state from a prior test run.                                              | Tests already call `clearMailpit()` in `beforeEach`. If still failing, recheck `SMTP_HOST` env. |
| SMTP submit fails with `535 Authentication failed`            | A test/client is sending AUTH credentials but Mailpit rejects mismatched creds. | Either disable AUTH on the client OR rely on `MP_SMTP_AUTH_ACCEPT_ANY=1` (default in compose).  |

---

## 7. Notes & follow-ups

- **Image pin:** Stage-2-pinned to
  `axllent/mailpit:v1.29@sha256:757f22b56c1da03570afdb3d259effe5091018008a81bbedc8158cee7e16fdbc`
  (ADR-027 §"Image Pinning Discipline"). The CI lint
  (`.github/workflows/code-quality-checks.yml`) rejects rolling `:latest` tags;
  the digest captures the v1.29 manifest deterministically. To bump:
  pull the new tag, copy the new `RepoDigests` entry from
  `docker image inspect axllent/mailpit:<new-tag>`, replace tag + digest in
  `docker-compose.yml` AND `FEAT_2FA_EMAIL_MASTERPLAN.md` §0.5.5 AND this table.
- **`sendTestEmail` in masterplan §0.5.5:** the smoke command in the masterplan
  references a function that doesn't exist in `email-service.ts`. Phase 2
  Step 2.9 will add `send2faCode()` (and may incidentally add a `sendTestEmail`
  helper). Until then, this HOW-TO uses the default-export `sendEmail()` — same
  code path, no scope creep into Phase 2.
- **Test helpers:** `backend/test/helpers.ts` exports `clearMailpit()` and
  `fetchLatest2faCode(recipient, timeoutMs)`. The poll cycle: list messages
  via `GET /api/v1/messages` → filter by `To[].Address` → fetch full body via
  `GET /api/v1/message/{ID}` → regex `Ihr Bestätigungscode: (CODE)` against
  `Text`. One extra round-trip per match vs Maildev (which returned bodies
  inline) but negligible at test-suite scale.
- **Production SMTP:** never test production deliverability against Mailpit. Use
  Steps 0.5.2 (SPF/DKIM/DMARC), 0.5.6 (real-mailbox smoke), 0.5.7 (sender
  reputation warmup) for that.

---

**Related guides**

- [HOW-TO-DOPPLER-GUIDE](./HOW-TO-DOPPLER-GUIDE.md) — managing dev/stg/prd configs.
- [HOW-TO-CURL](./HOW-TO-CURL.md) — when the smoke needs a token-authenticated request.
- [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) — full plan
  context (DD-25, Step 0.5.5, Phase 2 dev cycle dependency).
