# HOW-TO: Grafana CLI (`grafanactl`)

> Assixx — Observability-as-Code with `grafanactl`

**As of:** 2026-04-18 (v0.1.9 installed + verified on devhost)
**Tool version:** `grafanactl` v0.1.9 (Pre-1.0, by Grafana Labs)
**Binary path:** `~/.local/bin/grafanactl`
**Active context:** `assixx-cloud` (`~/.config/grafanactl/config.yaml`, chmod 600)
**Target stack:** Grafana Cloud `https://assixx.grafana.net` (Grafana 13.0.0)
**Related:** [ADR-002](../infrastructure/adr/ADR-002-alerting-monitoring.md) Phase 5g, [HOW-TO-DOPPLER-GUIDE](./HOW-TO-DOPPLER-GUIDE.md)

---

## Table of Contents

1. [What is `grafanactl` — and what it isn't](#1-what-is-grafanactl--and-what-it-isnt)
2. [When to use — Decision Table](#2-when-to-use--decision-table)
3. [Installation](#3-installation)
4. [Setup for Grafana Cloud (Assixx)](#4-setup-for-grafana-cloud-assixx)
5. [Verification](#5-verification)
6. [Common Workflows](#6-common-workflows)
7. [Current Assixx State (Brutal Truth)](#7-current-assixx-state-brutal-truth)
8. [Troubleshooting](#8-troubleshooting)
9. [References](#9-references)

---

## 1. What is `grafanactl` — and what it isn't

> **IMPORTANT:** There are **two** tools with "CLI" in the name — they are constantly confused.

| Tool                    | What it is                                               | What it can do                                               | Path                                 |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------ |
| **`grafana-cli`** (old) | Bundled with `grafana-server` binary, admin helper       | Plugin install, admin password reset, data migration         | `/usr/share/grafana/bin/grafana cli` |
| **`grafanactl`** (new)  | Standalone CLI by Grafana Labs for Observability-as-Code | REST API wrapper for resources (dashboards, folders, alerts) | Separately installed (binary)        |

`grafana-cli` (old) **CANNOT** manage dashboards / alert rules / datasources — only plugins + admin tasks.
`grafanactl` (new) is the **modern tool** for IaC workflows.

---

## 2. When to use — Decision Table

| Use case                             | Recommendation                                                          | Reasoning                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Alert rules (whether 1 or 100)       | **`curl` + Provisioning API/v1** (see `docker/grafana/alerts/apply.sh`) | grafanactl offers `alertrules/v0alpha1` — **alpha**, API may break. Provisioning API/v1 is stable. |
| Dashboards versioning / Cloud export | `grafanactl resources pull --kind dashboard`                            | `dashboard.grafana.app/v1` is stable, perfect IaC tool                                             |
| Folder structure replication         | `grafanactl resources push` (Folders)                                   | `folder.grafana.app/v1` stable                                                                     |
| Migrating datasources between stacks | `grafanactl resources pull/push`                                        | Multi-stack workflow (dev → stg → prd)                                                             |
| Plugin management                    | **`grafana-cli`** (old, in OSS container)                               | `grafanactl` cannot do this                                                                        |
| Admin password reset (Self-Hosted)   | **`grafana-cli admin reset-admin-password`** (old)                      | Not relevant for Cloud                                                                             |
| Quick test of a single API call      | `curl` directly                                                         | `grafanactl` is overhead for one-off calls                                                         |

**Brutal recommendation for Assixx (today):**

- **Alerts**: `curl` + `apply.sh` (v1 stable) — do not migrate until `alertrules` reaches v1.
- **Dashboards**: `grafanactl resources pull` for Cloud export → commit to repo → `grafanactl resources push` as apply path.

---

## 3. Installation

### Prerequisites

`grafanactl` is a **standalone binary** — no runtime dependencies. It is
**not** part of the Grafana server container, **not** preinstalled in any Doppler/Docker setup,
**not** available on the Assixx devhost by default (verified 2026-04-18 with
`command -v grafanactl` → empty).

### Path A — Binary download (recommended, fast)

```bash
# 1. Determine latest version + platform (Linux x86_64)
LATEST=$(curl -fsSL https://api.github.com/repos/grafana/grafanactl/releases/latest \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])")
echo "Latest: $LATEST"

# 2. Download + extract to ~/.local/bin (no sudo needed)
mkdir -p ~/.local/bin
curl -fsSL "https://github.com/grafana/grafanactl/releases/download/${LATEST}/grafanactl_Linux_x86_64.tar.gz" \
  -o /tmp/grafanactl.tar.gz
tar -xzf /tmp/grafanactl.tar.gz -C ~/.local/bin grafanactl
chmod +x ~/.local/bin/grafanactl

# 3. PATH check (Bash):
grep -q "~/.local/bin" ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 4. Verify
grafanactl --version
# Expected: grafanactl version 0.1.9 (or newer)
```

### Path B — Build from source (only if binary unavailable)

```bash
# Requires Go v1.24+ (NOT installed in Assixx devsetup)
go install github.com/grafana/grafanactl/cmd/grafanactl@latest
```

### Path C — Inside Docker (for CI/CD)

```dockerfile
FROM alpine:3.20
ARG GRAFANACTL_VERSION=v0.1.9
RUN apk add --no-cache curl tar \
 && curl -fsSL "https://github.com/grafana/grafanactl/releases/download/${GRAFANACTL_VERSION}/grafanactl_Linux_x86_64.tar.gz" \
    | tar -xz -C /usr/local/bin grafanactl
```

---

## 4. Setup for Grafana Cloud (Assixx)

### 4.1 Stack ID — when needed

`grafanactl` works against Grafana Cloud **without** a stack ID for most operations
(verified — `config check` and `resources pull/push` connect successfully with just
`GRAFANA_SERVER` + `GRAFANA_TOKEN`).

If a future operation requires the stack ID, find it via:

- **UI:** https://grafana.com → Login → My Account → Stacks → assixx
- Stack ID appears in the URL: `https://grafana.com/orgs/<org>/stacks/<STACK_ID>`

Store in Doppler if needed:

```bash
doppler secrets set GRAFANA_CLOUD_STACK_ID="<STACK_ID>" --project assixx --config dev
```

### 4.2 Token (already present in Assixx)

We already have **`GRAFANA_CLOUD_ADMIN_TOKEN`** in Doppler (see ADR-002 Phase 5g).
This token is used by `grafanactl` as well. If none exists yet:

```bash
# Browser: https://assixx.grafana.net/org/serviceaccounts → Add → Admin → Generate token
# Then store securely in Doppler (NEVER paste in shell history!):
read -rs GRAFANA_TOKEN && \
  doppler secrets set GRAFANA_CLOUD_ADMIN_TOKEN="$GRAFANA_TOKEN" --project assixx --config dev && \
  unset GRAFANA_TOKEN
```

### 4.3 Configure grafanactl context for Cloud

**Variant 1 — Env vars per run (KISS, no persistent state):**

```bash
doppler run --project assixx --config dev -- bash -c '
  GRAFANA_SERVER="https://assixx.grafana.net" \
  GRAFANA_TOKEN="$GRAFANA_CLOUD_ADMIN_TOKEN" \
  grafanactl config check
'
```

**Variant 2 — Persistent context (recommended for regular use, already configured):**

```bash
doppler run --project assixx --config dev -- bash -c '
  grafanactl config set contexts.assixx-cloud.grafana.server https://assixx.grafana.net
  grafanactl config set contexts.assixx-cloud.grafana.token "$GRAFANA_CLOUD_ADMIN_TOKEN"
'
grafanactl config use-context assixx-cloud

# Lock down the config file (token is stored as plaintext)
chmod 600 ~/.config/grafanactl/config.yaml
```

> **Warning:** Variant 2 writes the token to `~/.config/grafanactl/config.yaml` as
> plaintext. On multi-user machines, set `chmod 600`. The Assixx devhost setup
> already has this in place.

---

## 5. Verification

```bash
# Config valid?
grafanactl config check
# Expected: Configuration valid + Connectivity online + Grafana version

# Active context?
grafanactl config view

# All available resource types in this Grafana stack?
grafanactl resources list

# What our 3 alert rules look like through grafanactl
grafanactl resources get alertrules --namespace assixx-prod-alerts
# (Returns rules — but uses v0alpha1 schema, NOT what apply.sh uses)
```

---

## 6. Common Workflows

### 6.1 Pull dashboards from Cloud into the repo

```bash
# Export all dashboards from Cloud to ./resources/ (JSON default)
grafanactl resources pull --kind dashboard

# Specific output path + YAML format
grafanactl resources pull --kind dashboard --path ./docker/grafana/dashboards/cloud --format yaml
```

### 6.2 Push local resource definitions

```bash
# Push all YAML/JSON files from ./resources/ to the active stack
grafanactl resources push

# Push only dashboards from a specific path
grafanactl resources push --path ./docker/grafana/dashboards/cloud --kind dashboard
```

### 6.3 Migrate between stacks (e.g. Dev → Prod)

```bash
grafanactl config use-context assixx-dev
grafanactl resources pull --kind dashboard --path /tmp/dash-export

grafanactl config use-context assixx-prod
grafanactl resources push --path /tmp/dash-export
```

### 6.4 Preview a dashboard locally (before push)

```bash
grafanactl resources serve --path ./docker/grafana/dashboards/cloud
# Opens local browser preview — works only for dashboards (not alerts)
```

---

## 7. Current Assixx State (Brutal Truth)

| Aspect                           | State as of 2026-04-18                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `grafanactl` installed?          | ✅ Yes — v0.1.9 at `~/.local/bin/grafanactl`                                                                           |
| Context configured?              | ✅ `assixx-cloud` active (`~/.config/grafanactl/config.yaml`, chmod 600)                                               |
| Connectivity                     | ✅ Verified — `grafanactl config check` → online, Grafana 13.0.0                                                       |
| Tool for **alerts**              | **`curl` + Provisioning API/v1** (`docker/grafana/alerts/apply.sh`, 6 rules live)                                      |
| Why alerts → curl                | grafanactl offers `alertrules/v0alpha1` — **alpha**, no API stability guarantee. v1 Provisioning API is battle-tested. |
| Tool for **dashboards**          | ✅ `grafanactl resources push` — 1 dashboard live (`assixx-logs-by-level` in folder `assixx-dashboards`)               |
| Tool for **folders/datasources** | `grafanactl resources pull/push` (`v1` stable for both)                                                                |

**Concrete commands that work today (verified 2026-04-18):**

```bash
# Alerts (curl, v1 stable) — 3 Prometheus + 3 Loki rules, 6 total
doppler run -- ./docker/grafana/alerts/apply.sh

# Push dashboards (Cloud folder + Loki dashboard)
doppler run -- grafanactl resources push --path ./docker/grafana/dashboards/cloud

# Pull resources from Cloud for inspection
doppler run -- grafanactl resources pull --path /tmp/cloud-export

# Connectivity check
grafanactl config check

# List resource types (shows what is manageable)
grafanactl resources list
```

**Live in Cloud (2026-04-18):**

- Folder `assixx-dashboards` (dashboards), folder `assixx-prod-alerts` (alerts)
- Dashboard `assixx-logs-by-level` → <https://assixx.grafana.net/d/assixx-logs-by-level>
- 6 alert rules (3 Prometheus + 3 Loki) in folder `assixx-prod-alerts`
- Cloud datasource UIDs (needed for any new Cloud-facing rules/dashboards):
  - Loki: `grafanacloud-logs`
  - Prometheus: `grafanacloud-prom`

**Migration pattern for alerts (ONLY when `alertrules` reaches v1):**

```bash
# Today (curl, v1 stable):
doppler run -- ./docker/grafana/alerts/apply.sh

# Future (grafanactl, once v1):
grafanactl resources push --path ./docker/grafana/alerts --kind alertrule
```

The JSON files in `docker/grafana/alerts/` would then need to be rewritten to
the Kubernetes-style YAML format used by grafanactl (~30 min effort per rule).

---

## 8. Troubleshooting

### `grafanactl: command not found`

Binary not in PATH. Verify with `ls -la ~/.local/bin/grafanactl`. If missing → see Path A in [Section 3](#3-installation).

### `Error: server returned 401 Unauthorized`

Token invalid or empty. Verify:

```bash
doppler secrets get GRAFANA_CLOUD_ADMIN_TOKEN --project assixx --config dev --plain | head -c 12 && echo "..."
# Should show glsa_xxxxxx...
```

If empty → token setup in [Section 4.2](#42-token-already-present-in-assixx).

### `Error: stack-id is required for Grafana Cloud`

You set `GRAFANA_ORG_ID` instead of `GRAFANA_STACK_ID`. Cloud uses **stack ID**, on-prem uses org ID.
For most operations stack ID is not even required — only set it if a specific command demands it.

### Config file lookup order

`grafanactl` searches in this order:

1. `--config <path>` flag
2. `$XDG_CONFIG_HOME/grafanactl/config.yaml`
3. `$HOME/.config/grafanactl/config.yaml`
4. `$XDG_CONFIG_DIRS/grafanactl/config.yaml`

### List contexts

```bash
grafanactl config list-contexts
grafanactl config view
```

### `unknown shorthand flag: 'n' in -n`

Some grafanactl subcommands don't accept `-n` for namespace; use the long form `--namespace` instead.

---

## 9. References

- [grafanactl GitHub](https://github.com/grafana/grafanactl) — Source + Releases
- [Grafana CLI Docs (Overview)](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/)
- [Install Guide](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/install-grafana-cli/)
- [Setup Guide](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/set-up-grafana-cli/)
- [Workflows](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/grafanacli-workflows/)
- [Old `grafana-cli` Reference](https://grafana.com/docs/grafana/latest/administration/cli/) — NOT to be confused!
- [ADR-002 Alerting & Monitoring](../infrastructure/adr/ADR-002-alerting-monitoring.md) — Phase 5g explains why we use `curl` instead of `grafanactl` for alerts
- [HOW-TO-DOPPLER-GUIDE](./HOW-TO-DOPPLER-GUIDE.md) — Token management
- Current Assixx implementation: `docker/grafana/alerts/apply.sh` + `docker/grafana/alerts/README.md`

---

**Last updated:** 2026-04-18
