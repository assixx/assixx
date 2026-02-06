# Assixx Database Structure

**Last Updated:** 2026-02-06
**Database:** PostgreSQL 17.7
**Status:** Synchronized with Production

## Current Structure

```
database/
├── docker-init.sql                  # Main schema file (PostgreSQL)
├── database-setup.sql               # Setup script
├── migrations/                      # node-pg-migrate TypeScript migrations (ADR-014)
│   ├── 20260127000000_baseline.ts
│   ├── 20260127000001_drop-unused-tables.ts
│   ├── ...
│   ├── 20260202000018_fix-position-umlauts.ts
│   └── archive/                     # Old SQL migrations (pre node-pg-migrate)
├── seeds/                           # Seed data
│   └── 001_global-seed-data.sql
├── backups/                         # Database backups (.gitignored)
└── README.md
```

## Database Statistics

- **Tables:** 170
- **Views:** 2
- **Migrations Applied:** 19 (TypeScript, via node-pg-migrate)

## Usage

### Fresh Installation

```bash
docker cp database/docker-init.sql assixx-postgres:/tmp/
docker exec assixx-postgres psql -U assixx_user -d assixx -f /tmp/docker-init.sql
```

### Apply Migration

```bash
# Migrations run via node-pg-migrate (see ADR-014)
docker exec assixx-backend pnpm run migrate:up
```

### Check Current Schema

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt"
```

### Backup Current State

```bash
docker exec assixx-postgres pg_dump -U assixx_user -d assixx > backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

## Important Notes

1. **PostgreSQL 17** with Row Level Security (RLS) for tenant isolation
2. **Always Backup First** before any schema changes
3. **Test Migrations** on development environment first
4. **Foreign Keys**: Check constraints before dropping tables
5. **Placeholders**: Use `$1, $2, $3` (NOT `?` — that's MySQL syntax)
6. **IDs**: Use `RETURNING id` (NOT `LAST_INSERT_ID()`)
7. **Multi-Tenant**: Every table with user data MUST have `tenant_id`

## Maintenance Schedule

- **Daily**: Automatic backups at 02:00 AM
- **Weekly**: Schema validation check
- **Monthly**: Archive old backups
- **On Change**: Update docker-init.sql after major migrations
