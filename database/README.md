# Assixx Database Structure

**Last Updated:** 2026-02-06
**Database:** PostgreSQL 18.3
**Status:** Synchronized with Production

## Current Structure

```
database/
├── database-setup.sql               # Setup script
├── migrations/                      # node-pg-migrate TypeScript migrations (ADR-014) — SOURCE OF TRUTH
│   ├── 20260127000000_baseline.ts
│   ├── 20260127000001_drop-unused-tables.ts
│   ├── ...
│   ├── 20260211000025_rename-chat-tables.ts
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
# Migrations are the source of truth (ADR-014).
# The baseline migration creates all tables from scratch.
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

1. **PostgreSQL 18** with Row Level Security (RLS) for tenant isolation
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
- **On Change**: Create new TypeScript migration via node-pg-migrate (ADR-014)
