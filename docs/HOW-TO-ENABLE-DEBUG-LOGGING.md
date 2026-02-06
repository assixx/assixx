# How to Enable DEBUG Logging

> **Default:** INFO level (significant events only)
> **DEBUG:** Opt-in when actively troubleshooting

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
