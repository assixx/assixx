# Grafana Cloud Alert Rules — Production Provisioning

Single-source-of-truth for Assixx production alert rules.
Each `*.json` is a Grafana Provisioning-API payload, applied to
**Grafana Cloud** (`https://assixx.grafana.net`) via `apply.sh`.

> **Why JSON files in Git, not UI-clicks?**
> UI-created rules are invisible to Code Review and disappear if a Grafana
> stack is recreated. Git-tracked JSONs are reproducible, reviewable, and
> survive Cloud-account migrations.

---

## Rules (current set)

### Prometheus-based (infrastructure health)

| File                          | Severity | Trigger                                                   | Why                                          |
| ----------------------------- | -------- | --------------------------------------------------------- | -------------------------------------------- |
| `01-backend-down.json`        | critical | `up{job="assixx-backend"} < 1` for 2 min                  | Backend nicht erreichbar — Service-Outage    |
| `02-postgres-down.json`       | critical | `up{job="postgres"} < 1` for 2 min                        | DB nicht erreichbar — Multi-Tenant SaaS dead |
| `03-backend-memory-high.json` | warning  | `assixx_process_resident_memory_bytes > 800 MB` for 5 min | OOM-Frueh-Warnung (Container-Limit: 4 GB)    |

### Loki-based (log-rate + service-silence)

Datasource: `grafanacloud-logs`. Queries use `env="production"` filter (outside of silent-check)
damit Dev-Noise keine Alerts feuert.

| File                                  | Severity | Trigger                                                   | Why                                                       |
| ------------------------------------- | -------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `04-backend-error-rate-warning.json`  | warning  | `count_over_time({…level="error"…}[10m]) > 10` for 10 min | 1 Error/min sustained = systemic                          |
| `05-backend-error-rate-critical.json` | critical | `count_over_time({…level="error"…}[5m]) > 50` for 5 min   | 10 Errors/min = real incident                             |
| `06-backend-logs-silent.json`         | critical | `absent_over_time({…service="backend"}[10m])` for 5 min   | Process dead / transport broken — bewusst KEIN env-Filter |

### Grafana Cloud billing/usage (observability-cost protection)

Datasource: `grafanacloud-usage` (Grafana Cloud's own Billing Prometheus). Self-adapting — queries the `_included_usage` metric that auto-reflects the active plan tier.

| File                             | Severity | Trigger                                                                                   | Why                                                                                                                                                                                |
| -------------------------------- | -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `07-tempo-cloud-quota-high.json` | warning  | `grafanacloud_org_traces_usage / grafanacloud_org_traces_included_usage > 0.8` for 10 min | Free Tier 50 GB/month — 100 % triggers rate-limiting on new Cloud-side traces (Phase 5 / ADR-048 fan-out path). Warn at 80 % so tail-sampling can be tightened before the cut-off. |

All rules live in folder **`assixx-prod-alerts`** under group `assixx-critical`
(or `assixx-warning` for non-paging severity).

---

## Apply

```bash
# from repo root
doppler run -- ./docker/grafana/alerts/apply.sh
```

The script is **idempotent**: PUT-based with deterministic UIDs.
Re-run after any JSON change to sync.

---

## Add a new alert rule

1. Copy an existing JSON as template
2. Change:
   - `uid` (must be unique, format: `assixx-<descriptor>`)
   - `title`
   - `data[0].model.expr` (the PromQL query)
   - `data[2].model.conditions[0].evaluator` (threshold + operator: `lt`/`gt`)
   - `for` (debounce period)
   - `annotations.summary` + `description`
   - `labels.severity` (`critical` or `warning`)
3. Run `apply.sh`
4. Commit JSON to Git

---

## Edit an existing rule

Edit the JSON, run `apply.sh`. **Never edit in the Grafana UI** — your changes
will be overwritten on the next `apply.sh` run.

`X-Disable-Provenance: true` header keeps rules editable in UI for emergency
hot-fixes, but the JSON in Git remains the source of truth.

---

## Notification routing

Alerts fire into Grafana Cloud's default notification channel.
To wire up Email/Slack/PagerDuty:
**Grafana Cloud → Alerts & IRM → Alerting → Notification configuration**.

Routing by `severity` label is recommended:

- `severity=critical` → PagerDuty / SMS / on-call rotation
- `severity=warning` → Slack / email digest

---

## Token rotation

The provisioning token (`GRAFANA_CLOUD_ADMIN_TOKEN` in Doppler) should be
rotated every 90 days:

1. Create new token in Grafana Cloud → Service Accounts
2. `doppler secrets set GRAFANA_CLOUD_ADMIN_TOKEN` (interactive, never paste in shell)
3. Revoke old token in Grafana Cloud
4. Re-run `apply.sh` to verify new token works

---

## References

- [ADR-002 Alerting & Monitoring Stack](../../../docs/infrastructure/adr/ADR-002-alerting-monitoring.md)
- [Grafana Provisioning API](https://grafana.com/docs/grafana/latest/developers/http_api/alerting_provisioning/)
