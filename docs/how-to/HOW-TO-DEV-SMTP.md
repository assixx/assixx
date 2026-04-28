# HOW-TO — Dev SMTP via Maildev

> **Scope:** local development only. Profile `dev`. Never reaches CI / production.
> **Why:** Phase 2 of the email-2FA refactor needs a working SMTP target before any
> backend code is written. Maildev gives zero external deps and a Web-UI for visual
> verification that `email-service.ts` reaches an SMTP listener and serialises mail
> correctly. Production SMTP (SPF / DKIM / DMARC / sender reputation) is tested
> separately — see Steps 0.5.2 / 0.5.6 / 0.5.7 in `docs/FEAT_2FA_EMAIL_MASTERPLAN.md`.
> **References:** ADR-027 (Docker profile system) · DD-25 in
> [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) §0.4.

---

## 1. What you get

| Container        | Image                    | Profile | Host port | Internal port | Purpose          |
| ---------------- | ------------------------ | ------- | --------- | ------------- | ---------------- |
| `assixx-maildev` | `maildev/maildev:latest` | `dev`   | `1080`    | `1025` (SMTP) | Dev SMTP capture |

The SMTP port (1025) is **not** published to the host — only sibling containers on
`assixx-network` can submit mail. The Web-UI (1080) is published so you can browse
captured mail at <http://localhost:1080>.

---

## 2. Doppler dev secrets

Maildev needs no auth. Point the app at `maildev:1025`:

```bash
doppler secrets set --config dev SMTP_HOST=maildev
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
> Maildev — do **not** delete the keys.

---

## 3. Start the stack

```bash
cd /home/scs/projects/Assixx/docker

# After changing Doppler secrets, container env vars are stale. Recreate the
# affected services so the new SMTP_HOST/PORT propagate into process.env.
doppler run -- docker-compose up -d --force-recreate maildev backend deletion-worker

doppler run -- docker-compose ps maildev backend
# expected: both `Up (healthy)`
```

> **Why `--force-recreate`:** Doppler injects env vars at container start. Existing
> containers keep their old env until recreated. Without `--force-recreate` you'll
> chase a phantom "wrong SMTP host" bug for ten minutes.

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
    subject: 'Maildev smoke (Phase 0.5.5)',
    text: 'Smoke test from Assixx dev SMTP. If this lands in Maildev, plumbing is green.',
  });
  console.log(JSON.stringify(r));
  process.exit(r.success ? 0 : 1);
}).catch((e) => { console.error(e); process.exit(1); });
"
```

Expected stdout: `{"success":true,"messageId":"<...@assixx.de>"}` and exit 0.

### Verify in Maildev UI

1. Open <http://localhost:1080>.
2. The mail should appear within 1–2 s with:
   - **Subject:** `Maildev smoke (Phase 0.5.5)`
   - **From:** `Assixx <noreply@assixx.de>` (default fallback in `email-service.ts`
     when `SMTP_FROM` resolves to that value).
   - **To:** `test@scs-technik.de`.
   - **Body:** the plain-text line above.

Definition of done for Step 0.5.5: ✅ mail visible in Maildev within 30 s, this
HOW-TO merged to `main`, catalog updated.

---

## 5. Reset / cleanup

```bash
# Wipe captured mail without restarting the container (Maildev REST API):
curl -X DELETE http://localhost:1080/email/all

# OR full container reset (loses captured mail):
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose --profile dev rm -sf maildev
doppler run -- docker-compose --profile dev up -d maildev
```

---

## 6. Troubleshooting

| Symptom                                                       | Cause                                                                                   | Fix                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Smoke command exits 1 with `ECONNREFUSED 127.0.0.1:587`       | Container env still points at the old SMTP host (Doppler change stale).                 | `docker-compose up -d --force-recreate backend` after `doppler secrets set`.                    |
| Smoke exits 0 but Maildev UI is empty                         | Mail captured by a different transport / wrong port.                                    | `docker exec assixx-backend printenv SMTP_HOST SMTP_PORT` → must show `maildev` / `1025`.       |
| `assixx-maildev` keeps restarting                             | Port 1080 already bound on host (e.g. another tool).                                    | `lsof -i :1080`; stop the conflicting process or change the publish port.                       |
| `pnpm exec tsc` not yet emitted `dist/utils/email-service.js` | Backend is mid-cold-start (~60 s on first boot).                                        | Wait for `docker-compose ps backend` → `(healthy)`, then re-run smoke.                          |
| Mail arrives but body is HTML-empty                           | Caller passed `html: ''` and no `text`.                                                 | `sendEmail()` always needs at least `text` or `html` populated.                                 |
| Maildev UI shows mail but downstream test claims "no mail"    | Maildev keeps mail across restarts of OTHER services — but is wiped on its own restart. | Don't `docker-compose restart maildev` between tests; use `curl -X DELETE …/email/all` instead. |

---

## 7. Notes & follow-ups

- **Image pin:** `maildev/maildev:latest` is the only `:latest` image in
  `docker-compose.yml` — accepted because the container is dev-profile-only. If
  upstream tag movement breaks the smoke, pin to a specific release in
  `docker-compose.yml` and update this guide.
- **`sendTestEmail` in masterplan §0.5.5:** the smoke command in the masterplan
  references a function that doesn't exist in `email-service.ts`. Phase 2
  Step 2.9 will add `send2faCode()` (and may incidentally add a `sendTestEmail`
  helper). Until then, this HOW-TO uses the default-export `sendEmail()` — same
  code path, no scope creep into Phase 2.
- **Production SMTP:** never test production deliverability against Maildev. Use
  Steps 0.5.2 (SPF/DKIM/DMARC), 0.5.6 (real-mailbox smoke), 0.5.7 (sender
  reputation warmup) for that.

---

**Related guides**

- [HOW-TO-DOPPLER-GUIDE](./HOW-TO-DOPPLER-GUIDE.md) — managing dev/stg/prd configs.
- [HOW-TO-CURL](./HOW-TO-CURL.md) — when the smoke needs a token-authenticated request.
- [`FEAT_2FA_EMAIL_MASTERPLAN.md`](../FEAT_2FA_EMAIL_MASTERPLAN.md) — full plan
  context (DD-25, Step 0.5.5, Phase 2 dev cycle dependency).
