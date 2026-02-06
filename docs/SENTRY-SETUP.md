# Sentry Setup Guide

## Quick Start

### 1. Get Your Sentry DSN

1. Go to https://sentry.io/signup/
2. Create account (GitHub login available)
3. Create new project → Select "NestJS"
4. Copy your DSN (looks like `https://abc123@o123456.ingest.sentry.io/789`)

### 2. Configure Environment

Add to `docker/.env`:

```bash
# Sentry Error Tracking
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/your-project-id

# Optional: Release tracking (for source maps)
SENTRY_RELEASE=assixx-backend@1.0.0
```

### 3. Restart Docker

```bash
cd /home/scs/projects/Assixx/docker
docker-compose restart backend deletion-worker
```

### 4. Verify Integration

```bash
# Check logs for Sentry initialization
docker logs assixx-backend 2>&1 | grep -i sentry

# Should show:
# [Sentry] Initialized for environment: development

# Test error capture (dev only):
curl http://localhost:3000/debug-sentry
# This triggers a test error → Check Sentry dashboard
```

---

## What Gets Reported

| Error Type        | Reported to Sentry | Reason                           |
| ----------------- | ------------------ | -------------------------------- |
| 5xx Server Errors | ✅ Yes             | Bugs we need to fix              |
| 4xx Client Errors | ❌ No              | User mistakes, not bugs          |
| Validation Errors | ❌ No              | Expected, filtered in beforeSend |
| Network Errors    | ❌ No              | Infrastructure, not code         |

## Configuration Details

### Environment Variables

| Variable         | Required | Default                    | Description                     |
| ---------------- | -------- | -------------------------- | ------------------------------- |
| `SENTRY_DSN`     | Yes      | -                          | Your Sentry project DSN         |
| `SENTRY_RELEASE` | No       | `assixx-backend@{version}` | Release version for source maps |
| `NODE_ENV`       | No       | `development`              | Controls sample rates           |

### Sample Rates by Environment

| Environment | Traces | Profiles | Notes                           |
| ----------- | ------ | -------- | ------------------------------- |
| Production  | 10%    | 10%      | Cost-effective for high traffic |
| Development | 100%   | 100%     | Full visibility for debugging   |
| Test        | 0%     | 0%       | No reports in tests             |

---

## Sentry Dashboard Tips

### Useful Filters

```
# Find all 500 errors
is:unresolved level:error

# Find errors from specific endpoint
is:unresolved url:*/api/v2/users*

# Find errors from today
is:unresolved firstSeen:-24h
```

### Alert Rules (Recommended)

1. **High Error Rate**: Alert when >10 errors in 5 minutes
2. **New Error Type**: Alert on first occurrence of new error
3. **Critical Path**: Alert immediately for auth/payment errors

---

## Files Reference

```
backend/src/nest/
├── instrument.ts              # Sentry init (imported FIRST)
├── main.ts                    # Imports instrument.js first
├── app.module.ts              # SentryModule.forRoot()
└── common/filters/
    └── all-exceptions.filter.ts  # Sentry.captureException()
```

---

## Troubleshooting

### "Sentry DSN not configured"

Expected in development without DSN. Add DSN to enable.

### Errors not appearing in Sentry

1. Check DSN is correct
2. Check NODE_ENV (test environment blocks all)
3. Check if error is 4xx (not reported)
4. Check Sentry dashboard filters

### Source maps not working

Source maps require:

1. `SENTRY_RELEASE` environment variable
2. Upload during CI/CD build (Phase 4)

---

## Next Steps

- [ ] Configure production DSN
- [ ] Add @sentry/sveltekit to frontend (Phase 3)
- [ ] Setup source map upload in CI/CD (Phase 4)
- [ ] Configure Slack/Email alerts in Sentry dashboard
