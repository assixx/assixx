# FEAT: Beta Hosting on Hetzner — Execution Masterplan

> **Plan type:** FEATURE (infrastructure setup, not optimization)
> **Created:** 2026-04-29
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (planning)
> **Branch:** `feat/beta-hosting`
> **Spec:** This document.
> **Author:** Simon Öztürk (Staff-Engineer assist)
> **Estimated sessions:** 8
> **Actual sessions:** 0 / 8

---

## Goal in one paragraph

Move Assixx from "runs on my dev box" to "runs in production for 1–3 closed-beta
tenants on a single Hetzner VPS in Falkenstein, with daily backups to Hetzner
Object Storage, and a documented manual disaster-recovery procedure that brings
the system back within 4 hours after a total VPS loss." Everything stays in
Germany. Everything has a signed AVV. No US providers in the data path.

**What this plan does NOT cover** (Alpha/Production work, explicitly out of scope):

- Postgres streaming replication / hot-standby (Alpha)
- Kubernetes (Production, ≥50 tenants)
- Auto-failover (Alpha — Patroni + etcd)
- Multi-region (Production)
- Custom-customer-domain TLS (ADR-050 Modus B, V2+)

---

## Changelog

| Version | Date       | Change                                          |
| ------- | ---------- | ----------------------------------------------- |
| 0.1.0   | 2026-04-29 | Initial draft — phases outlined                 |

> Versioning: 0.x = planning, 1.x = execution per phase, 2.0 = shipped.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must be true before starting

- [ ] Domain `assixx.de` registered (user: confirmed — also has .com/.net/.org/.dev)
- [ ] Hetzner Cloud account created + payment method active
- [ ] Hetzner Object Storage AVV / DPA signed and stored
- [ ] Cloudflare Free account (authoritative DNS, per ADR-050 pattern)
- [ ] Doppler Service Token for prod environment generated (read-only on VPS)
- [ ] DB backup of current local state taken (pg_dump custom format)
- [ ] Branch `feat/beta-hosting` checked out
- [ ] `docs/PRODUCTION-AND-DEVELOPMENT-TESTING.md` re-read by author
- [ ] ADR-050 §"Deployment Context: Greenfield Launch" re-read

### 0.2 Risk register

| #   | Risk                                                  | Impact | Probability | Mitigation                                                                  | Verification                                                |
| --- | ----------------------------------------------------- | ------ | ----------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R1  | Total VPS loss (hardware, account suspension)         | High   | Low         | Daily `pg_dump` to Object Storage (separate bucket) + daily VPS snapshot    | Probe-restore once per month from latest backup file        |
| R2  | Backup files exist but are corrupt / not restorable   | High   | Low         | Probe-restore monthly + restore-time SLO ≤ 4 h documented                   | Calendar reminder; restore log committed to repo            |
| R3  | TLS cert expiry → site down                           | High   | Low         | `certbot renew` cron + Grafana alert on cert expiry < 14 days               | Manual `certbot certificates` after first renewal cycle     |
| R4  | SSH compromise → VPS rooted                           | High   | Low         | Public-key-only, fail2ban, ufw, Hetzner Cloud Firewall, port 22 IP-allowlist | `ssh -p 22 root@vps` from non-allowlisted IP must time out  |
| R5  | Object Storage outage → uploads fail                  | Medium | Low         | Backend retries with exp-backoff; degraded-mode banner; backups on a 2nd bucket | Chaos test: block egress to `*.your-objectstorage.com` for 5 min |
| R6  | DSGVO-violation by data leaving EU                    | High   | Low         | Hetzner-only (Falkenstein/Nürnberg); no US SDKs; AVV signed                 | Verarbeitungsverzeichnis lists every processor (DE only)    |
| R7  | Beta tenant unhappy after 24 h data loss              | Medium | Medium      | Beta T&C explicitly states RTO 4 h / RPO 24 h; modal acceptance on signup   | T&C URL stored in `tenants.beta_terms_accepted_at`          |
| R8  | Hardcoded `assixx.com` in code blocks `assixx.de` use | Medium | Medium      | Audit ADR-050 implementation for env-driven apex                            | Grep `assixx\.com` returns only docs / comments             |
| R9  | Postgres data lost when VPS volume detaches           | High   | Low         | Postgres data on Hetzner Volume (separate from boot disk)                   | `df -h /var/lib/postgresql/data` shows volume mount         |

> Rule: every risk has a concrete mitigation AND a verification. "Be careful"
> is not a mitigation.

### 0.3 Ecosystem integration points

| Existing system                                | Integration                                                       | Phase |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----- |
| Documents module (ADR-042)                     | Switch upload pipeline from local FS to S3 pre-signed URLs        | 3     |
| Audit-log (ADR-009)                            | Log every S3 upload/delete + every backup run                     | 3, 4  |
| Doppler                                        | Production environment + Service-Token on VPS                     | 2     |
| Grafana Cloud (Loki/Tempo, ADR-002, ADR-048)   | Promtail/OTel-Collector on VPS ship logs+traces to existing stack | 5     |
| ADR-050 tenant-host-resolver                   | Wildcard `*.beta.assixx.de` resolves subdomain → tenant slug      | 6     |
| `docker-compose.yml` (existing prod profile)   | Reuse `--profile production` from PRODUCTION-AND-DEVELOPMENT      | 5     |

---

## Phase 1: Hetzner Infrastructure Provisioning

> **Goal:** All cloud resources exist and are reachable. No code yet.
> **Estimate:** 1 session.

### Step 1.1: Cloud Project & Networking

- Create Hetzner Cloud project: `assixx-beta`
- Generate API token (read-write) → store in Doppler as `HCLOUD_TOKEN`
- Create Cloud Firewall `assixx-beta-fw`:
  - Inbound 22/tcp: only from author's home IP (allowlist)
  - Inbound 80/tcp: 0.0.0.0/0
  - Inbound 443/tcp: 0.0.0.0/0
  - Inbound ICMP: 0.0.0.0/0 (ping for monitoring)
  - All other inbound: deny
  - Outbound: allow all (Object Storage, Doppler, Cloudflare, Let's Encrypt)

### Step 1.2: VPS + Volume

- Order VPS: **CX41** (4 vCPU shared, 16 GB RAM, 160 GB SSD) in **Falkenstein (fsn1)**, Ubuntu 24.04 LTS
  - Upgrade path: CCX23 (4 vCPU dedicated, 16 GB) if performance not enough — later, not now
- Order Volume: **50 GB** in `fsn1`, attach to VPS, mount at `/mnt/postgres-data`
- Assign firewall to VPS

### Step 1.3: Object Storage Buckets

- Create 2 buckets in **Falkenstein (fsn1)**:
  - `assixx-prod-uploads` — tenant uploads (avatars, documents, attachments)
  - `assixx-prod-backups` — daily DB dumps (separate bucket = separate failure domain)
- Generate Object Storage credentials (Access Key + Secret) → Doppler
- Default bucket policy: **private** (no public reads, only pre-signed URLs)
- Enable versioning on `assixx-prod-backups` (accidental delete protection)

### Phase 1 — Definition of Done

- [ ] Hetzner project `assixx-beta` exists, billing active
- [ ] VPS `assixx-beta-1` reachable via SSH with author's key only
- [ ] Volume mounted at `/mnt/postgres-data`, ext4-formatted, in `fstab`
- [ ] Cloud Firewall attached and tested (port 22 closed from non-allowlisted IP)
- [ ] Both Object Storage buckets exist, private, accessible via S3 API with credentials
- [ ] All tokens/secrets stored in Doppler (NOT in repo, NOT in `.env` files)
- [ ] AVV / DPA documents stored in `docs/legal/avv-hetzner-2026.pdf` (gitignored)

---

## Phase 2: Server Setup & Hardening

> **Goal:** VPS is production-ready Ubuntu host running Docker. No app yet.
> **Estimate:** 1 session.

### Step 2.1: Ubuntu hardening

- Disable root SSH login (`PermitRootLogin no`); create `assixx` sudo user with SSH key
- Disable password auth (`PasswordAuthentication no`)
- Enable `unattended-upgrades` for security updates only
- Install + configure `ufw`: deny incoming default, allow 22/80/443
- Install + configure `fail2ban`: SSH jail with 5-attempt ban for 1 h
- Install `jq`, `curl`, `htop`, `ncdu`, `net-tools` (operator basics)

### Step 2.2: Docker + Docker Compose

- Install Docker Engine via official `get.docker.com` script
- Install Docker Compose v2 (plugin form, comes with Docker)
- Add `assixx` user to `docker` group
- Move `/var/lib/docker` to a directory on the volume mount? **No** for beta — boot disk is 160 GB, plenty.
  Postgres data on volume is what matters.

### Step 2.3: Doppler CLI on VPS

- Install Doppler CLI on VPS
- `doppler login` with the Service Token (production environment, read-only)
- Verify: `doppler secrets get POSTGRES_USER --plain` returns the right value

### Step 2.4: Postgres data directory on volume

- Stop any local Postgres if installed (host-level — should be none)
- Postgres runs in Docker — bind mount `/mnt/postgres-data:/var/lib/postgresql/data` in `docker-compose.yml`
- Initial directory creation: chown `postgres:postgres` on host? **No** — Docker manages this on first start.
- Verify after first start: `du -sh /mnt/postgres-data` shows the cluster lives on the volume

### Phase 2 — Definition of Done

- [ ] Author cannot SSH as root; can SSH as `assixx` user with key
- [ ] `ufw status` shows only 22/80/443 open
- [ ] `fail2ban-client status sshd` shows the jail active
- [ ] `docker version` and `docker compose version` work as `assixx` user
- [ ] `doppler secrets` lists production secrets
- [ ] `/mnt/postgres-data` mount survives `reboot`

---

## Phase 3: Object Storage Backend Integration

> **Goal:** Documents/uploads use Hetzner Object Storage via pre-signed URLs.
> No more local-filesystem uploads in the codebase path that beta uses.
> **Estimate:** 2 sessions.

### Step 3.1: Dependencies & wrapper service

- Install: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Create `backend/src/utils/object-storage.service.ts`:
  - `getUploadUrl(tenantId, key, mimeType, sizeLimit)` → 5-min pre-signed PUT URL
  - `getDownloadUrl(tenantId, key, expiresIn)` → pre-signed GET URL (default 5 min)
  - `deleteObject(tenantId, key)` → server-side DELETE (used by tenant deletion)
  - `getObjectStream(tenantId, key)` → for backend-controlled downloads (PDF watermarking, etc.)
- All methods enforce path prefix: `tenants/${tenantUuid}/...` — forbid keys outside that prefix at the wrapper level (defense in depth on top of bucket-policy)

### Step 3.2: Documents module migration (ADR-042 update)

- Add column `documents.storage_backend ENUM('local', 's3')` (default `'s3'` for new rows)
- Existing local files in dev: leave as `'local'` — beta starts fresh, no migration needed (greenfield)
- DocumentsController: replace `MultipartHandler` upload-to-FS path with pre-signed-URL flow:
  1. Client POSTs metadata → backend returns `{documentId, uploadUrl, expiresAt}`
  2. Client PUTs file directly to `uploadUrl`
  3. Client POSTs `/documents/:id/confirm` → backend verifies object exists in S3, marks `is_uploaded=true`
- Audit-log every step (`upload_initiated`, `upload_confirmed`, `upload_failed`)

### Step 3.3: Avatar/Chat-attachment migration

- Same pattern as Documents: pre-signed URL → confirm endpoint
- Path conventions:
  - Avatars: `tenants/{tenant_uuid}/avatars/{user_uuid}.jpg`
  - Documents: `tenants/{tenant_uuid}/documents/{doc_uuid}/{filename}`
  - Chat: `tenants/{tenant_uuid}/chat/{conversation_uuid}/{file_uuid}/{filename}`

### Step 3.4: Frontend

- Install `@uppy/core` + `@uppy/aws-s3` (or roll a thin custom uploader if Uppy footprint is too big — decide in session)
- Replace `<input type="file">` flow in Documents/Avatar pages with pre-signed-URL upload
- Show upload progress (Uppy provides this out of the box)

### Step 3.5: Tenant deletion (ADR existing)

- On tenant deletion, list all `tenants/{tenant_uuid}/*` keys, batch-delete from S3
- Mark in `tenants.deleted_at`; deletion-worker handles S3 cleanup async

### Phase 3 — Definition of Done

- [ ] `object-storage.service.ts` exists, has unit tests for path-prefix enforcement
- [ ] Documents upload via pre-signed URLs in dev (local Hetzner test bucket)
- [ ] Avatars upload via pre-signed URLs in dev
- [ ] Chat attachments upload via pre-signed URLs in dev
- [ ] Direct local-FS upload paths removed from controllers (or feature-flagged off)
- [ ] Audit-log entries appear for every upload/download/delete
- [ ] ESLint 0 errors, type-check 0 errors
- [ ] Existing API integration tests still green (`pnpm run test:api`)

---

## Phase 4: Backup & Restore

> **Goal:** Daily DB dump in S3; documented procedure to restore from zero VPS;
> procedure is tested, not theoretical.
> **Estimate:** 1 session.

### Step 4.1: Daily backup cron

- Script `scripts/backup-postgres-to-s3.sh`:
  1. `pg_dump --format=custom --compress=9` from inside Docker
  2. Encrypt at rest? **Skip for beta** (Hetzner Object Storage already encrypts at rest server-side; SSE is on by default per Hetzner docs)
  3. Upload to `s3://assixx-prod-backups/daily/$(date +%Y%m%d)_assixx.dump`
  4. Delete local dump file
  5. Send a heartbeat to Grafana Cloud (or Healthchecks.io free tier)
- Cron on host: daily at 03:00 Europe/Berlin
- Retention: 14 daily + 12 weekly (separate weekly script Sundays)

### Step 4.2: Hetzner VPS snapshots

- Enable Hetzner's automated daily snapshots (free, 7-day retention, 20% of VPS cost)
- Verify after 24 h that the first snapshot exists

### Step 4.3: Restore runbook

- Write `docs/RUNBOOK-BETA-DR.md`:
  - Step-by-step: provision new VPS → install Docker+Doppler → pull latest backup → `pg_restore` → start app
  - Exact commands, no guesswork
  - Target time: ≤ 4 h
- Include rollback paths: snapshot-based restore (faster, ≤30 min) vs. backup-file restore (full, ≤4 h)

### Step 4.4: Probe restore

- Spin up a temporary "DR-test" VPS (CX22, ~5 EUR for 1 day)
- Restore from latest backup
- Verify: backend boots, login works, one document downloads, tenant data correct
- Document the actual time taken in the runbook
- Destroy the DR-test VPS

### Phase 4 — Definition of Done

- [ ] First successful daily backup visible in `assixx-prod-backups`
- [ ] Heartbeat alert configured (alerts on missed backup within 6 h of expected time)
- [ ] Hetzner automated snapshots enabled, first snapshot exists
- [ ] `docs/RUNBOOK-BETA-DR.md` committed
- [ ] Probe-restore completed successfully on a separate VPS, time recorded in runbook
- [ ] Calendar reminder set for monthly probe-restore

---

## Phase 5: CI/CD & Observability

> **Goal:** Push to `main` → image built → deployed to VPS via SSH.
> Logs and traces flow to existing Grafana Cloud.
> **Estimate:** 1 session.

### Step 5.1: Image build & registry

- GitHub Action `build-images.yml`:
  - Trigger: push to `main` + manual `workflow_dispatch`
  - Build `assixx-backend:prod` + `assixx-frontend:prod` (existing Dockerfiles)
  - Push to GitHub Container Registry (`ghcr.io/scs-technik/assixx-{backend,frontend}:${{ github.sha }}` + `:latest`)
  - Free for private repos up to a generous limit
- VPS pulls from `ghcr.io` with a read-only PAT (stored in Doppler)

### Step 5.2: Deploy job

- GitHub Action `deploy-beta.yml`:
  - Trigger: manual `workflow_dispatch` only (NO auto-deploy in beta — author must approve every release)
  - SSH to VPS, run:
    ```
    cd /opt/assixx
    docker compose pull
    docker compose --profile production up -d
    docker system prune -f --filter "until=72h"
    ```
  - Health check after deploy: `curl https://beta.assixx.de/health` must return 200 within 60 s; otherwise auto-rollback to previous image tag

### Step 5.3: Logs & traces to Grafana Cloud

- Install Promtail on VPS, ship `/var/log/syslog` + `docker logs` to Loki (Grafana Cloud free tier)
- OTel-Collector on VPS: same config as local, exports to `grafanacloud-traces`
- Dashboards: reuse the ones from `docker/grafana/`
- Alerts: reuse the 7 alerts already provisioned (ADR-002 Phase 5g)

### Phase 5 — Definition of Done

- [ ] Push to `main` produces images in `ghcr.io`
- [ ] Manual deploy via GitHub Actions completes in ≤ 5 min
- [ ] Health-check failure triggers rollback (test by deploying a deliberately broken image once)
- [ ] Backend logs visible in Grafana Cloud Loki within 30 s of emission
- [ ] One trace from a real request resolvable in Grafana Cloud Tempo

---

## Phase 6: Domain, DNS, TLS, Tenant Routing

> **Goal:** `https://beta.assixx.de` shows the login page; `https://acme.beta.assixx.de` resolves to tenant `acme`.
> **Estimate:** 1 session.

### Step 6.1: DNS via Cloudflare (per ADR-050 pattern)

- Move `assixx.de` nameservers from IONOS to Cloudflare (free plan)
- Create records:
  - `A    beta.assixx.de       → VPS-IP`           (Beta apex)
  - `A    *.beta.assixx.de     → VPS-IP`           (Wildcard for tenants)
  - `MX/SPF/DMARC` for transactional mail (later — not blocking)
- DNS-only mode (grey cloud, NOT proxied) per ADR-050 §"DNS & TLS Provider Decision"

### Step 6.2: Wildcard TLS via Let's Encrypt DNS-01

- Generate Cloudflare API token: scoped to "DNS-edit on assixx.de zone only"
- Install `certbot` + `python3-certbot-dns-cloudflare` on VPS
- Issue cert for `beta.assixx.de` + `*.beta.assixx.de`
- Auto-renew via systemd timer (certbot default), reload Nginx in post-hook

### Step 6.3: Nginx config

- Two server blocks per ADR-050 §"Decision":
  - `server_name beta.assixx.de;` → reverse proxy to SvelteKit:3001 (login + signup hub)
  - `server_name ~^(?<slug>[a-z0-9-]+)\.beta\.assixx\.de$;` → reverse proxy to SvelteKit:3001, sets `X-Tenant-Slug: $slug` header
- Default catch-all `default_server { return 444; }` (closes the connection on bad SNI/Host)
- Add HSTS, security headers per ADR-044

### Step 6.4: Backend tenant-host-resolver

- Verify `tenant-host-resolver.middleware.ts` reads from `X-Tenant-Slug` (Nginx-injected) OR `Host` header
- Audit code for hardcoded `assixx.com` strings (R8 risk) — replace with env-driven `APEX_DOMAIN`
- Test: visit `acme.beta.assixx.de` → middleware resolves to tenant slug `acme` → CLS context populated

### Step 6.5: First tenant created

- Via signup or manual SQL: create `tenants` row with `subdomain='acme'` (placeholder beta tenant)
- Verify subdomain login works end-to-end

### Phase 6 — Definition of Done

- [ ] `dig +short beta.assixx.de` returns VPS IP
- [ ] `dig +short test.beta.assixx.de` returns VPS IP (wildcard works)
- [ ] `https://beta.assixx.de/login` shows the login page with a green padlock
- [ ] `https://acme.beta.assixx.de/login` shows the login page (same cert covers it)
- [ ] Backend logs `hostTenantId=<id>` for the `acme` subdomain
- [ ] No hardcoded `assixx.com` strings in code (grep clean)
- [ ] Cert auto-renewal cron exists, dry-run succeeds: `certbot renew --dry-run`

---

## Phase 7: Beta Disclaimer + Smoke Test + Go-Live

> **Goal:** First real beta user signs the disclaimer and completes a full
> upload/download flow. System runs unattended for 72 h.
> **Estimate:** 1 session.

### Step 7.1: Beta T&C / disclaimer

- Add column: `tenants.beta_terms_accepted_at TIMESTAMPTZ NULL`
- Frontend: post-login modal blocking access until terms accepted (text in German):
  - "Beta-Phase: RTO ≤ 4 h, RPO ≤ 24 h"
  - "Datenverlust bis zu 24 h möglich; tägliche Backups"
  - "Keine SLA-Zusagen während Beta"
  - "Daten ausschließlich in Deutschland (Hetzner Falkenstein)"
- Modal returns user to `/permission-denied` if declined
- Acceptance writes `beta_terms_accepted_at = NOW()`, audit-logged

### Step 7.2: Smoke test

- Author registers as a real user on a beta tenant
- Upload a 5 MB document → succeeds, visible in document list
- Download the document → succeeds, content matches
- Logout, log back in → session restored
- Wait 24 h → next morning, verify backup ran (alert silent = OK)

### Step 7.3: Probe restore (gate before go-live)

- Run a fresh probe restore from yesterday's backup on a temp VPS
- Verify the smoke-test document is in the restored DB and S3
- Document time-to-recovery in `RUNBOOK-BETA-DR.md`

### Step 7.4: Go-live

- Send invitation to first 1–3 beta tenants
- Monitor Grafana dashboards for 72 h
- Standby for any issues

### Phase 7 — Definition of Done

- [ ] Beta T&C modal blocks access until accepted
- [ ] Smoke-test document upload + download successful
- [ ] Backup ran overnight, file visible in `assixx-prod-backups`
- [ ] Probe-restore verified the smoke-test data
- [ ] First beta tenant invited
- [ ] No P1 incidents in first 72 h post-go-live

---

## Session Tracking

| Session | Phase | Description                                       | Status  | Date       |
| ------- | ----- | ------------------------------------------------- | ------- | ---------- |
| 1       | 1     | Hetzner project, VPS, Volume, Object Storage      | pending |            |
| 2       | 2     | Ubuntu hardening, Docker, Doppler, volume mount   | pending |            |
| 3       | 3     | Object-storage service + Documents migration      | pending |            |
| 4       | 3     | Avatars + Chat attachments + frontend Uppy        | pending |            |
| 5       | 4     | Backup cron + restore runbook + probe restore     | pending |            |
| 6       | 5     | GitHub Actions build/deploy + Grafana logs/traces | pending |            |
| 7       | 6     | Cloudflare DNS, wildcard TLS, Nginx, ADR-050      | pending |            |
| 8       | 7     | Beta T&C + smoke test + go-live                   | pending |            |

### Session log template

```markdown
### Session N — YYYY-MM-DD

**Goal:** ...
**Result:** ...
**New files:** ...
**Changed files:** ...
**Verification:** ESLint 0, type-check 0, tests N/N
**Deviations:** ...
**Next session:** ...
```

---

## Quick Reference

### Hetzner sizing baseline (Beta, 1–3 tenants)

| Resource              | Spec                              | Monthly cost (approx.) |
| --------------------- | --------------------------------- | ---------------------- |
| VPS (CX41)            | 4 vCPU shared, 16 GB RAM, 160 GB  | ~16 €                  |
| Volume (50 GB)        | SSD, attached to VPS              | ~2 €                   |
| Snapshots (auto)      | 7-day retention                   | ~3 €                   |
| Object Storage        | 2 buckets (uploads + backups), je ~5,99 € Grundpauschale (1 TB Storage + 1 TB Traffic je Bucket inkl., über Inklusiv hinaus ~5 €/TB) | ~12 €                  |
| Cloudflare Free       | DNS only                          | 0 €                    |
| Grafana Cloud Free    | Logs + traces (existing)          | 0 €                    |
| **Total**             |                                   | **~30–35 €/Monat**     |

### Recovery objectives (Beta — written in T&C)

- RTO (Recovery Time Objective): ≤ 4 hours
- RPO (Recovery Point Objective): ≤ 24 hours

### File / path conventions

| Path on VPS                  | Purpose                         |
| ---------------------------- | ------------------------------- |
| `/opt/assixx/`               | App checkout (compose file)     |
| `/mnt/postgres-data/`        | Postgres data (on volume)       |
| `/var/log/assixx/`           | Application logs (Promtail)    |
| `/etc/letsencrypt/live/...`  | TLS certs                       |

### S3 key conventions

```
tenants/{tenant_uuid}/avatars/{user_uuid}.jpg
tenants/{tenant_uuid}/documents/{doc_uuid}/{filename}
tenants/{tenant_uuid}/chat/{conv_uuid}/{file_uuid}/{filename}
```

---

## Spec Deviations

> Document any case where the existing code/ADR contradicts the plan. Resolve
> in code review, not in this document.

| #   | Spec / ADR says                          | Reality                | Decision               |
| --- | ---------------------------------------- | ---------------------- | ---------------------- |
| D1  | _(empty until we hit one)_                |                        |                        |

---

## Known Limitations (Beta — deliberately excluded)

1. **No streaming replication / hot-standby.** Single Postgres instance. Acceptable per RTO 4 h.
2. **No Kubernetes / orchestration.** Plain Docker Compose, manual deploys. Will revisit at ≥50 tenants.
3. **No multi-region.** Falkenstein only. Hetzner outage = downtime; communicated in T&C.
4. **No customer custom domains** (`app.scs-technik.de` via CNAME). ADR-050 Modus B, V2+.
5. **No automated DSGVO data-export.** Manual `pg_dump` per tenant on request. Automated in Alpha.
6. **No virus scan on uploads.** Beta scope. ClamAV sidecar planned for Alpha.
7. **No image-processing pipeline** (thumbnails, EXIF strip). Beta uses originals; processing in Alpha.
8. **Manual deploy approval.** No auto-deploy on push. Beta scope; CD-on-merge in Alpha.

---

## Post-Mortem (fill after go-live)

### What went well

- ...

### What went badly

- ...

### Metrics

| Metric                                    | Planned | Actual |
| ----------------------------------------- | ------- | ------ |
| Sessions                                  | 8       |        |
| Migration files                           | ~2      |        |
| New backend files                         | ~5      |        |
| New frontend files                        | ~3      |        |
| Changed files                             | ~30     |        |
| ESLint errors at release                  | 0       |        |
| First time-to-restore (probe)             | ≤ 4 h   |        |
| First-week beta-user issues (P1)          | 0       |        |

---

## Related

- [ADR-027: Dockerfile Hardening](./infrastructure/adr/ADR-027-dockerfile-hardening.md)
- [ADR-042: Multipart File Upload Pipeline](./infrastructure/adr/ADR-042-multipart-file-upload-pipeline.md)
- [ADR-044: Security Headers](./infrastructure/adr/ADR-044-security-headers.md)
- [ADR-050: Tenant Subdomain Routing](./infrastructure/adr/ADR-050-tenant-subdomain-routing.md)
- [PRODUCTION-AND-DEVELOPMENT-TESTING.md](./PRODUCTION-AND-DEVELOPMENT-TESTING.md)
- [HOW-TO-DOPPLER-GUIDE.md](./how-to/HOW-TO-DOPPLER-GUIDE.md)

---

**This is the execution plan. Every session starts here, takes the next
unchecked DoD item, and marks it done. No coding starts before Phase 0 is
green. No phase starts before the previous one's DoD is complete.**
