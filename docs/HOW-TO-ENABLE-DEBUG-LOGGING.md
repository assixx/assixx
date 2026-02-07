# How to Enable DEBUG & Performance Logging

> **Default:** INFO level (significant events only)
> **DEBUG:** Opt-in when actively troubleshooting
> **PERF:** Opt-in for frontend performance metrics

## Quick Reference

```bash
# Enable DEBUG for current session
LOG_LEVEL=debug docker-compose restart backend

# Or add to docker/.env for persistent DEBUG
echo "LOG_LEVEL=debug" >> docker/.env
docker-compose restart backend

# Disable DEBUG (back to default)
# Remove LOG_LEVEL from .env or set:
LOG_LEVEL=info docker-compose restart backend
```

## Log Levels Explained

| Level     | When to Use                                     | Examples                                        |
| --------- | ----------------------------------------------- | ----------------------------------------------- |
| **ERROR** | Something broke, needs immediate attention      | Database connection failed, unhandled exception |
| **WARN**  | Something concerning, might need attention      | Deprecated API usage, approaching limits        |
| **INFO**  | Significant business events                     | Login, Create, Update, Delete, Startup          |
| **DEBUG** | Routine operations, active troubleshooting only | Fetching data, listing entries, GET requests    |

## What Changed (2026-01)

### Before (noisy)

```
INFO: Fetching departments for tenant 2     ← Every page load
INFO: Fetching teams for tenant 2           ← Every page load
INFO: Fetching areas for tenant 2           ← Every page load
DEBUG: Audit logged: list blackboard...     ← Every request
```

### After (clean)

```
INFO: Creating department: Engineering      ← Significant event
INFO: Updating department 5                 ← Significant event
INFO: Deleting department 3                 ← Significant event
```

**Routine GETs are now DEBUG level** - only visible when explicitly enabled.

## When to Enable DEBUG

1. **Investigating a bug** - need to trace request flow
2. **Performance issues** - need to see what's being called
3. **Integration problems** - need to verify data fetching
4. **New feature development** - need to see detailed logs

## Architecture

```
docker/.env
    └── LOG_LEVEL=debug|info|warn|error

backend/src/nest/common/logger/logger.constants.ts
    └── LOG_LEVELS = { production: 'info', development: 'info', test: 'silent' }

backend/src/nest/common/logger/logger.module.ts
    └── level: process.env['LOG_LEVEL'] ?? getLogLevel()

backend/src/nest/main.ts
    └── level: process.env['LOG_LEVEL'] ?? 'info'
```

## Best Practices for Service Logging

```typescript
// DEBUG - Routine operations (GET, List, Fetch)
this.logger.debug(`Fetching departments for tenant ${tenantId}`);

// INFO - Significant events (Create, Update, Delete)
this.logger.log(`Creating department: ${dto.name}`);

// WARN - Concerning situations
this.logger.warn(`Extended query failed, using fallback`);

// ERROR - Something broke
this.logger.error(`Failed to create department: ${error.message}`);
```

## Verifying Log Level

```bash
# Check current logs
docker-compose logs backend --tail 50

# If you see DEBUG lines like:
#   DEBUG: Fetching departments...
# Then DEBUG is enabled.

# If you only see INFO/WARN/ERROR:
#   INFO: Creating department...
# Then default INFO level is active.
```

---

## Frontend Performance Logging (PERF_LOG)

> **Default:** OFF (zero overhead)
> **When enabled:** Logs TTFB, DOM timing, API call durations, layout mount timing

### Quick Reference (Browser Console)

```js
// Enable perf logging
localStorage.setItem('PERF_LOG', 'true');
location.reload();

// Disable perf logging
localStorage.removeItem('PERF_LOG');
location.reload();

// Or use the helper functions:
window.__perf.enable();   // → sets localStorage + tells you to reload
window.__perf.disable();  // → removes localStorage + tells you to reload
window.__perf.status();   // → shows current ON/OFF state
```

### What Gets Logged

When `PERF_LOG=true`:

| Category | Examples |
| --- | --- |
| **Page Load Timing** | TTFB, DOM Parsing, DOM Ready, Page Load Complete |
| **API Calls** | `api:GET:/users` 45ms, `api:POST:/auth/login` 120ms |
| **Layout Mount** | `layout:mount:total` 8ms, `layout:tokenManager:init` 0ms |
| **Notifications** | `notifications:fetchInitialCounts:total` 35ms |
| **Resource Timing** | Which `/api/` fetches took how long |

Slow operations (>500ms) are logged as `console.info`, very slow (>1s) as `console.warn`.

### When to Enable PERF_LOG

1. **Page feels slow** - check TTFB and SSR timing
2. **API call investigation** - see which endpoints are slow
3. **After performance changes** - verify improvements
4. **Client-side bottleneck** - check layout mount breakdown

### Architecture

```
Browser localStorage
    └── PERF_LOG=true|<absent>

frontend/src/lib/utils/perf-logger.ts
    └── isEnabled() checks localStorage on each call
    └── perf.start() / perf.time() / perf.timeSync()
    └── logPageLoadTiming() / logResourceTiming()

Instrumented files:
    └── +layout.svelte (mount timing)
    └── api-client.ts (every API call)
    └── notification.store.svelte.ts (initial counts fetch)
```

### Zero Overhead When Disabled

When `PERF_LOG` is not set:

- `perf.start()` returns a no-op function
- `perf.time()` / `perf.timeSync()` just execute the wrapped function directly
- `logPageLoadTiming()` / `logResourceTiming()` return immediately
- No `console.*` calls, no `performance.now()` calls, no string formatting
