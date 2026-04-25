#!/usr/bin/env bash
# =============================================================================
# Sentry Alert-Rule Provisioning (idempotent)
# =============================================================================
# Creates (or updates) the canonical Assixx Sentry Issue-Alert rules for both
# backend and frontend projects. Run once after Sentry project creation, then
# re-run any time these rule definitions change. Existing rules are matched by
# NAME (see RULE_NAME_PREFIX); anything with that prefix is overwritten.
#
# Required env (inject via `doppler run -- ./scripts/sentry-setup-alerts.sh`):
#   SENTRY_ALERTS_TOKEN            User Auth Token with scope `alerts:write`.
#                                  Create: https://sentry.io/settings/account/api/auth-tokens/
#                                  NOTE: Org Auth Tokens (sntrys_ prefix, used
#                                  for source-map uploads) CANNOT create alert
#                                  rules — their scope set does not include
#                                  alerts:write. Must be a User Auth Token.
#                                  Falls back to SENTRY_AUTH_TOKEN for backward
#                                  compat — will fail loudly with 403 if that
#                                  token lacks alert scopes.
#   SENTRY_ORG_SLUG                Org slug (e.g. "acme-inc")
#   SENTRY_PROJECT_SLUG_BACKEND    Project slug for NestJS backend
#   SENTRY_PROJECT_SLUG_FRONTEND   Project slug for SvelteKit frontend
#
# References:
#   https://docs.sentry.io/api/alerts/create-an-issue-alert-rule-for-a-project/
#   https://docs.sentry.io/api/alerts/list-a-projects-issue-alert-rules/
#   https://docs.sentry.io/product/alerts/
#   docs/how-to/HOW-TO-ALERTING.md  (runbook, threshold rationale)
# =============================================================================

set -euo pipefail

readonly API_BASE="https://sentry.io/api/0"
readonly RULE_NAME_PREFIX="Assixx:"

# ---------------------------------------------------------------------------
# Validate required env vars — fail fast with a clear message, not a silent
# curl 401 later.
# ---------------------------------------------------------------------------
require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    printf >&2 'ERROR: %s is not set. Inject via doppler run or export manually.\n' "$var_name"
    exit 1
  fi
}

# Prefer a dedicated alerts token over the generic SENTRY_AUTH_TOKEN.
# The generic token is typically an Org Auth Token (sntrys_) used for source
# map uploads — it has project:releases scope but NOT alerts:write, so POST to
# /rules/ returns 403. Keeping a separate SENTRY_ALERTS_TOKEN lets each token
# carry the minimum scope for its job.
SENTRY_TOKEN="${SENTRY_ALERTS_TOKEN:-${SENTRY_AUTH_TOKEN:-}}"
if [[ -z "$SENTRY_TOKEN" ]]; then
  printf >&2 'ERROR: Neither SENTRY_ALERTS_TOKEN nor SENTRY_AUTH_TOKEN is set.\n'
  printf >&2 'Create a User Auth Token with scope alerts:write at:\n'
  printf >&2 '  https://sentry.io/settings/account/api/auth-tokens/\n'
  printf >&2 'Store it in Doppler as SENTRY_ALERTS_TOKEN.\n'
  exit 1
fi

require_env SENTRY_ORG_SLUG
require_env SENTRY_PROJECT_SLUG_BACKEND
require_env SENTRY_PROJECT_SLUG_FRONTEND

command -v jq >/dev/null || { echo >&2 "ERROR: jq is required."; exit 1; }
command -v curl >/dev/null || { echo >&2 "ERROR: curl is required."; exit 1; }

# ---------------------------------------------------------------------------
# Rule definitions — three rules per project.
#
# frequency (minutes): minimum delay between re-notifications for the SAME
# issue. 1440 = once per day for new-issue floods from a single bug.
#
# targetType "IssueOwners" + fallthroughType "AllMembers" means Sentry routes
# via the project's configured ownership rules; if none match, fall through
# to all project members. No numeric user/team IDs baked into this script.
# ---------------------------------------------------------------------------
build_new_issue_rule() {
  jq -n '{
    name: "Assixx: New Issue",
    frequency: 1440,
    actionMatch: "any",
    filterMatch: "all",
    conditions: [
      { id: "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition" }
    ],
    filters: [],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "AllMembers"
      }
    ]
  }'
}

build_regression_rule() {
  jq -n '{
    name: "Assixx: Regression",
    frequency: 60,
    actionMatch: "any",
    filterMatch: "all",
    conditions: [
      { id: "sentry.rules.conditions.regression_event.RegressionEventCondition" }
    ],
    filters: [],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "AllMembers"
      }
    ]
  }'
}

# Event-Frequency condition: 100 events for ONE issue in 1h.
# Sentry already groups by fingerprint, so this catches a single loud bug
# (not total project error rate — Grafana covers that).
build_frequency_rule() {
  jq -n '{
    name: "Assixx: Error Frequency Spike",
    frequency: 60,
    actionMatch: "all",
    filterMatch: "all",
    conditions: [
      {
        id: "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
        value: 100,
        interval: "1h",
        comparisonType: "count"
      }
    ],
    filters: [],
    actions: [
      {
        id: "sentry.mail.actions.NotifyEmailAction",
        targetType: "IssueOwners",
        fallthroughType: "AllMembers"
      }
    ]
  }'
}

# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
api_call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(
    -sS -X "$method"
    -H "Authorization: Bearer ${SENTRY_TOKEN}"
    -H "Content-Type: application/json"
    "${API_BASE}${path}"
  )
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi
  curl "${args[@]}"
}

# Find existing rule ID by name (returns empty string if not found).
find_rule_id() {
  local project_slug="$1" rule_name="$2"
  api_call GET "/projects/${SENTRY_ORG_SLUG}/${project_slug}/rules/" \
    | jq -r --arg name "$rule_name" '.[] | select(.name == $name) | .id' \
    | head -n1
}

# Upsert a single rule: PUT if name exists, POST otherwise.
upsert_rule() {
  local project_slug="$1" rule_json="$2"
  local rule_name existing_id response http_status

  rule_name=$(printf '%s' "$rule_json" | jq -r '.name')

  existing_id=$(find_rule_id "$project_slug" "$rule_name")

  if [[ -n "$existing_id" ]]; then
    printf '  [UPDATE] %-45s (id=%s)\n' "$rule_name" "$existing_id"
    response=$(api_call PUT \
      "/projects/${SENTRY_ORG_SLUG}/${project_slug}/rules/${existing_id}/" \
      "$rule_json")
  else
    printf '  [CREATE] %-45s\n' "$rule_name"
    response=$(api_call POST \
      "/projects/${SENTRY_ORG_SLUG}/${project_slug}/rules/" \
      "$rule_json")
  fi

  # Sentry returns the full rule object on success; an error returns
  # { "detail": "..." } or similar. Detect and surface it.
  if printf '%s' "$response" | jq -e '.detail // .error // .nonFieldErrors' >/dev/null 2>&1; then
    printf >&2 '  ERROR response from Sentry:\n%s\n' "$response"
    return 1
  fi
}

sync_project() {
  local project_slug="$1"
  printf '\n=== Project: %s ===\n' "$project_slug"
  upsert_rule "$project_slug" "$(build_new_issue_rule)"
  upsert_rule "$project_slug" "$(build_regression_rule)"
  upsert_rule "$project_slug" "$(build_frequency_rule)"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
printf 'Sentry alert-rule sync — org=%s\n' "$SENTRY_ORG_SLUG"
printf 'Rules managed by this script carry the prefix "%s"\n' "$RULE_NAME_PREFIX"

sync_project "$SENTRY_PROJECT_SLUG_BACKEND"
sync_project "$SENTRY_PROJECT_SLUG_FRONTEND"

printf '\nDone. Re-run any time these definitions change — script is idempotent.\n'
