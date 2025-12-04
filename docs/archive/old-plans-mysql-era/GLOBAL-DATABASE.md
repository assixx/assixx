# 🌍 Global Database - System-Wide Settings

> **Created:** 2025-11-13
> **Purpose:** Separate database for system-wide settings that should NOT be deleted during customer database resets

## 📚 Overview

The `global` database contains system-wide configuration and settings that are shared across all tenants and should persist even when the `main` database is reset/migrated.

## 🎯 Why Separate Database?

### Problem Solved
When deploying Assixx to customer servers, we need to distinguish between:
- **Customer Data** (main DB) - Can be reset/migrated/deleted
- **System Settings** (global DB) - MUST NOT be deleted

### Benefits
1. ✅ **Safety** - Prevents accidental deletion of system settings
2. ✅ **Clear Intent** - Database name signals "DO NOT DELETE"
3. ✅ **Backup Strategy** - Global DB backed up less frequently
4. ✅ **Permissions** - Can be read-only for app user in production

## 📊 Tables in Global Database

### `global.kvp_categories`
KVP (Continuous Improvement) categories - shared across all tenants.

**Schema:**
```sql
CREATE TABLE kvp_categories (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3498db',
    icon VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '💡',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Default Categories:**
- 🛡️ Sicherheit (Safety improvements)
- ⚡ Effizienz (Efficiency/process optimizations)
- ⭐ Qualität (Quality improvements)
- 🌱 Umwelt (Environmental improvements)
- 💤 Ergonomie (Workplace ergonomics)
- 💰 Kosteneinsparung (Cost reduction)

**Cross-Database Reference:**
```sql
-- main.kvp_suggestions references global.kvp_categories
ALTER TABLE main.kvp_suggestions
  ADD CONSTRAINT fk_kvp_category
  FOREIGN KEY (category_id)
  REFERENCES global.kvp_categories(id)
  ON DELETE SET NULL;
```

## 🔧 Database Setup

### Permissions
```sql
-- Grant access to assixx_user
GRANT ALL PRIVILEGES ON global.* TO 'assixx_user'@'%';
FLUSH PRIVILEGES;
```

### Querying Global Tables
```sql
-- From backend code:
SELECT * FROM global.kvp_categories ORDER BY name ASC;

-- Cross-database JOIN:
SELECT
  s.title,
  c.name as category_name,
  c.icon
FROM main.kvp_suggestions s
JOIN global.kvp_categories c ON s.category_id = c.id;
```

## 📝 Migration History

### 2025-11-13: Initial Creation
- Created `global` database
- Moved `kvp_categories` from `main` to `global`
- Updated all backend queries to use `global.kvp_categories`
- Fixed encoding issues (UTF-8) for emojis and umlauts

**Files Changed:**
- `/backend/src/models/kvp.ts` - Updated query
- `/backend/src/routes/v2/reports/reports-kvp.service.ts` - Updated JOIN
- `/backend/src/routes/v2/__tests__/*.test.ts` - Updated test queries (2 files)

**Migration Script:**
- `/database/migrations/2025-11-13_create_global_database_kvp_categories.sql`

## 🚀 Future Global Tables

Candidates for moving to `global` database:
- System feature flags
- Global notification templates
- System-wide settings (e.g., default shift patterns)
- License/plan configurations

## ⚠️ Important Notes

### For Developers
1. **NEVER** reference `main.kvp_categories` - use `global.kvp_categories`
2. **ALWAYS** use `global.` prefix in queries
3. **TEST** cross-database queries in local environment

### For Deployment
1. **BACKUP** global database separately
2. **DO NOT** drop global database during main DB reset
3. **VERIFY** permissions for assixx_user on global DB

### For Root Users
In future: Root users will be able to manage global settings via UI:
- Add/edit/delete KVP categories
- Configure system-wide templates
- Manage global feature flags

## 📚 Related Documentation
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - How to run migrations
- [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md) - Main database schema
- [KVP System](../backend/src/routes/v2/kvp/README.md) - KVP implementation details

---

**Remember:** Global DB = System Settings = DO NOT DELETE! 🔒
