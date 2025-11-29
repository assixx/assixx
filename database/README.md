# 📊 Assixx Database Structure

**Last Updated:** 2025-06-16  
**Status:** Synchronized with Production

## 🗂️ Current Structure

```
database/
├── docker-init.sql              # Main schema file (updated 2025-06-16)
├── current-schema-20250616.sql  # Today's production snapshot
├── migrations/                  # All applied migrations
│   ├── 001-tenant-isolation-fixes.sql
│   ├── 002-add-is-primary-to-tenant-admins.sql
│   ├── 003-add-plans-system.sql
│   ├── 004-add-document-multi-recipients.sql
│   └── ... (18 migration files total)
├── archive/                     # Old schema versions
│   └── pre-20250616/
│       ├── docker-init.sql     # Original schema
│       ├── complete-schema.sql  # Old complete schema
│       └── docker-init-simple.sql
├── seeds/                       # Test data
├── schema/                      # Individual table definitions
└── build/                       # Build scripts
```

## 📋 Database Statistics

- **Tables:** 92
- **Views:** 2
- **Total Migrations Applied:** 18

## 🚀 Usage

### Fresh Installation

```bash
docker exec assixx-mysql sh -c 'mysql -h localhost -u root -p"YOUR_ROOT_PASSWORD" < /docker-entrypoint-initdb.d/01-schema.sql'
```

### Apply Migration

```bash
MIGRATION_FILE="database/migrations/XXX-your-migration.sql"
docker cp $MIGRATION_FILE assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD assixx < /tmp/'$(basename $MIGRATION_FILE)
```

### Backup Current State

```bash
bash scripts/quick-backup.sh "manual_backup_$(date +%Y%m%d_%H%M%S)"
```

## ⚠️ Important Notes

1. **Production is Source of Truth**: The `docker-init.sql` is now synchronized with production
2. **Always Backup First**: Use `scripts/quick-backup.sh` before any changes
3. **Test Migrations**: Test on development environment first
4. **Foreign Keys**: Always check foreign key constraints before dropping tables

## 🔄 Maintenance Schedule

- **Daily**: Automatic backups at 02:00 AM
- **Weekly**: Schema validation check
- **Monthly**: Archive old backups
- **On Change**: Update docker-init.sql after major migrations
