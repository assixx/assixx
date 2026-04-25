# HOW-TO: Alerting (Grafana + Sentry)

> Production-ready alerting for Assixx. All rules are provisioned as code —
> no UI clicking, no drift.
>
> **Stack:** Sentry (errors) + Grafana Alerting on Loki (log-rate and service-silence).
> **Reference ADR:** [ADR-002](../infrastructure/adr/ADR-002-alerting-monitoring.md)

---

## 1. What Gets Alerted and Why

Two complementary systems. Neither replaces the other.

| Signal                                    | Detected by                        | Channel       | Severity                    |
| ----------------------------------------- | ---------------------------------- | ------------- | --------------------------- |
| Backend crashed / uncaught exception      | Sentry (new issue)                 | Email         | Per Sentry project settings |
| Resolved error re-occurred                | Sentry (regression)                | Email         | Per Sentry project settings |
| One bug floods the app (>100 events/hour) | Sentry (event frequency)           | Email         | Per Sentry project settings |
| Error log rate > 10 in 10 min             | Grafana on Loki                    | Email         | warning                     |
| Error log rate > 50 in 5 min              | Grafana on Loki                    | Email + Slack | critical                    |
| Backend has no logs for 10 min            | Grafana on Loki (absent_over_time) | Email + Slack | critical                    |

Rationale: Sentry handles captured exceptions with stacktrace, grouping, and
session replay. It does NOT see warnings, business-rule rejections, or
"service completely dead". Grafana fills that gap via Loki log aggregation.

---

## 2. Required Doppler Secrets

All secrets live in Doppler (see [HOW-TO-DOPPLER-GUIDE.md](./HOW-TO-DOPPLER-GUIDE.md)).
Set these **once per environment** (dev / stg / prd).

```bash
# Mandatory for any email alerts to reach anyone:
doppler secrets set ALERT_EMAIL_TO="oncall@example.com" --project assixx --config prd

# Optional — falls back to SMTP_FROM if unset:
doppler secrets set ALERT_EMAIL_FROM="alerts@example.com" --project assixx --config prd

# Optional — leaves slack-critical contact point provisioned but silent:
doppler secrets set SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz" --project assixx --config prd

# For the Sentry setup script (one-time setup):
# SENTRY_ALERTS_TOKEN must be a USER AUTH TOKEN (sntryu_ prefix) with scope
# alerts:write. The existing SENTRY_AUTH_TOKEN is usually an Org Auth Token
# (sntrys_ prefix) for source-map uploads — that one CANNOT create alert
# rules (scope set does not include alerts:write). Keep them separate.
doppler secrets set SENTRY_ALERTS_TOKEN="sntryu_..." --project assixx --config prd
doppler secrets set SENTRY_ORG_SLUG="assixx" --project assixx --config prd
doppler secrets set SENTRY_PROJECT_SLUG_BACKEND="node-nestjs" --project assixx --config prd
doppler secrets set SENTRY_PROJECT_SLUG_FRONTEND="javascript-sveltekit" --project assixx --config prd
```

SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) are
already in Doppler — Grafana reuses them via docker-compose env pass-through.

Sentry User Auth Token creation:
<https://sentry.io/settings/account/api/auth-tokens/> → "Create New Token"
→ Scopes: `alerts:write` + `project:read` (for listing existing rules).

---

## 3. Apply Grafana Alert Rules

Rules are provisioned from `docker/grafana/provisioning/alerting/`:

- `contact-points.yml` — email (default) + slack (critical tier)
- `notification-policies.yml` — routing by `severity` label
- `rules.yml` — three rules in group `backend-health`

To apply after a change:

```bash
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose restart grafana
```

Verify the rules loaded:

```bash
doppler run -- sh -c 'curl -s -u "$GF_ADMIN_USER:$GF_ADMIN_PASSWORD" \
  http://localhost:3050/api/v1/provisioning/alert-rules | jq ".[].title"'
```

Expected output:

```
"Backend error rate elevated"
"Backend error rate critical"
"Backend logs silent"
```

---

## 4. Apply Sentry Alert Rules

One-time (idempotent) — re-run whenever the definitions in the script change.

```bash
cd /home/scs/projects/Assixx
doppler run --project assixx --config prd -- ./scripts/sentry-setup-alerts.sh
```

The script prints `[CREATE]` or `[UPDATE]` per rule per project. Rules are
matched by name (prefix `Assixx:`) so re-runs never create duplicates.

Verify in the Sentry UI: `Projects → {project} → Alerts`.

---

## 5. Runbooks

### error-rate-elevated

Loki shows > 10 errors in 10 min, sustained 10 min.

1. Open Grafana dashboard `Assixx Logs by Level` and narrow time range.
2. Group by a common label (request path, tenant, user) to find the pattern.
3. Check Sentry for corresponding grouped issues — often a single bug.
4. If noise: tune threshold or add a Loki-side drop rule (not a silence).

### error-rate-critical

Loki shows > 50 errors in 5 min. Real incident.

1. Page has already fired to Slack + Email.
2. Check the Grafana `ERROR` log panel for the most recent stream.
3. Cross-check Sentry for the dominant issue fingerprint.
4. Check `/health`, `docker-compose ps`, Postgres/Redis status.
5. If rollback-appropriate: revert last release; otherwise hotfix.

### backend-logs-silent

`absent_over_time` matched — no backend logs for 10 min.

1. `docker ps | grep assixx-backend` — container running?
2. `docker logs --tail 50 assixx-backend` — crashed? OOM?
3. `curl http://localhost:3000/health` — HTTP responsive?
4. If healthy but silent: check pino-loki transport
   (Loki reachable from the backend container, LOKI_LOCAL_URL set).
5. If backend is healthy AND Loki is receiving other services, suspect
   the pino transport — restart backend: `docker-compose restart backend`.

---

## 6. Threshold Tuning

All thresholds are conservative first-pass values. After two weeks of
production data, revisit in `docker/grafana/provisioning/alerting/rules.yml`:

- If `error-rate-elevated` fires more than once/week without action needed →
  raise the threshold.
- If `error-rate-critical` never fires during real incidents → lower it.
- If `backend-logs-silent` fires spuriously during deploys → extend `for:`
  from 5 m to 10 m, or use a deploy-time mute timing (see Grafana
  mute-timings docs).

Change the YAML, commit, `docker-compose restart grafana`. UIDs are stable
so updates merge in place — no duplicate rules.

---

## 7. Why Not Clicking in the Grafana UI?

Grafana lets you edit alert rules and contact points in the UI. Do not.

1. UI edits persist in `grafana_data` volume, not in Git.
2. `docker-compose down -v` or a fresh host wipes them.
3. There is no review trail — no one knows why a rule changed.
4. Provisioned rules and UI rules can diverge silently.

Every change to alerting lives in the YAML files under version control.

---

## 8. Files Touched by This Setup

```
docker/
├── docker-compose.yml                                  # Grafana SMTP + alert env
├── .env.example                                        # documents required secrets
└── grafana/
    ├── dashboards/
    │   └── assixx-logs-by-level.json                   # minimized for prod
    └── provisioning/
        └── alerting/
            ├── contact-points.yml                      # email + slack
            ├── notification-policies.yml               # routing by severity
            └── rules.yml                               # three Loki rules

scripts/
└── sentry-setup-alerts.sh                              # idempotent Sentry API

docs/
└── how-to/
    └── HOW-TO-ALERTING.md                              # this file
```

---

## 9. References

- [ADR-002: Alerting and Monitoring Stack](../infrastructure/adr/ADR-002-alerting-monitoring.md)
- [Grafana — File Provisioning for Alerting](https://grafana.com/docs/grafana/latest/alerting/set-up/provision-alerting-resources/file-provisioning/)
- [Grafana — Notification Policies](https://grafana.com/docs/grafana/latest/alerting/fundamentals/notification-policies/)
- [Sentry — Alerts Product Docs](https://docs.sentry.io/product/alerts/)
- [Sentry API — Create Issue Alert Rule](https://docs.sentry.io/api/alerts/create-an-issue-alert-rule-for-a-project/)
