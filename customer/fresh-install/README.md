# Assixx Fresh Database Installation

> **Version:** 1.1.0 | **Updated:** 2026-01-14 | **PostgreSQL:** 17.7

---

## Overview

This folder contains everything needed to set up a fresh Assixx database for a new customer deployment.

## Files

| File | Description |
|------|-------------|
| `000_users.sql` | Application user creation (app_user) |
| `001_schema.sql` | Complete database schema (432K) |
| `002_seed_data.sql` | Seed data - plans, features, categories (9.7K) |
| `003_extensions.sql` | PostgreSQL extensions (pg_stat_statements) |
| `install.sh` | Automated installation script |
| `README.md` | This documentation |

---

## PostgreSQL Users

### Two-User Architecture

| User | Role | RLS | Purpose |
|------|------|-----|---------|
| `assixx_user` | Superuser | **BYPASSED** | Migrations, Admin tasks |
| `app_user` | Application | **ENFORCED** | Backend application (multi-tenant safe) |

**IMPORTANT:** The backend application must use `app_user` to ensure Row Level Security is enforced for multi-tenant data isolation.

### Where Users Are Defined

| Location | User | When Created |
|----------|------|--------------|
| Docker `POSTGRES_USER` env | `assixx_user` | Container first start |
| `000_users.sql` | `app_user` | During install.sh |

---

## Password Management

### Changing Passwords

#### For Development (docker/.env)

```bash
# 1. Edit docker/.env
nano docker/.env

# Change these values:
POSTGRES_PASSWORD=YourNewSuperuserPassword
DB_PASSWORD=YourNewAppUserPassword

# 2. If using Doppler, also update there:
doppler secrets set POSTGRES_PASSWORD="YourNewSuperuserPassword" --project assixx --config dev
doppler secrets set DB_PASSWORD="YourNewAppUserPassword" --project assixx --config dev
```

#### For Production (Customer Deployment)

```bash
# Option 1: Set environment variable before install
export APP_USER_PASSWORD="CustomerSecurePassword123"
./install.sh

# Option 2: Interactive prompt (install.sh will ask)
./install.sh

# Option 3: Change password after installation
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
    "ALTER ROLE app_user WITH PASSWORD 'NewSecurePassword';"
```

#### Changing Superuser Password (POSTGRES_USER)

```bash
# 1. Update docker/.env
POSTGRES_PASSWORD=NewSuperuserPassword

# 2. Recreate container (password is set on first start only)
cd docker
docker-compose down
docker volume rm assixx_postgres_data  # WARNING: Deletes all data!
docker-compose up -d

# Alternative: Change without data loss
docker exec assixx-postgres psql -U assixx_user -c \
    "ALTER ROLE assixx_user WITH PASSWORD 'NewSuperuserPassword';"
```

### Password Requirements

- Minimum 16 characters
- Alphanumeric recommended (avoid special chars like `@`, `!`, `$` for shell compatibility)
- Generate secure password:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

---

## Quick Start

### Prerequisites

1. Docker is running
2. PostgreSQL container (`assixx-postgres`) is healthy
3. Volumes created:
   ```bash
   docker volume create assixx_postgres_data
   docker volume create assixx_redis_data
   ```

### Installation

```bash
# Navigate to this folder
cd customer/fresh-install

# Run full installation (will prompt for app_user password)
./install.sh

# Or with password from environment
export APP_USER_PASSWORD="YourSecurePassword123456"
./install.sh
```

### Install Options

```bash
./install.sh                # Full install (users + schema + seed)
./install.sh --schema-only  # Only schema, no users or seed data
./install.sh --seed-only    # Only seed data (schema must exist)
./install.sh --users-only   # Only create/update app_user
```

---

## What's Included

### Schema (001_schema.sql)

| Component | Count | Description |
|-----------|-------|-------------|
| Tables | 109 | All application tables |
| Sequences | 108 | Auto-increment sequences |
| Indexes | 474 | Performance indexes |
| RLS Policies | 89 | Row Level Security for multi-tenant isolation |
| Triggers | 68 | Automatic timestamps, protection, etc. |
| Foreign Keys | 260 | Referential integrity constraints |

### Seed Data (002_seed_data.sql)

| Table | Rows | Description |
|-------|------|-------------|
| `plans` | 3 | Basic (49), Professional (149), Enterprise (299) |
| `features` | 12 | Dashboard, Employees, Departments, Teams, etc. |
| `plan_features` | 36 | Which features are included in which plan |
| `kvp_categories` | 6 | Sicherheit, Effizienz, Qualitaet, Umwelt, Ergonomie, Kosteneinsparung |
| `machine_categories` | 11 | CNC, Spritzguss, Pressen, Schweissanlagen, etc. |

---

## Customer Deployment Workflow

### New Server Setup

```bash
# 1. Clone repository
git clone https://github.com/SCS-Technik/Assixx.git
cd Assixx

# 2. Configure environment
cp docker/.env.example docker/.env
nano docker/.env  # Set customer-specific passwords!

# 3. Create volumes
docker volume create assixx_postgres_data
docker volume create assixx_redis_data

# 4. Start Docker
cd docker
docker-compose up -d postgres redis

# 5. Wait for PostgreSQL to be healthy
sleep 30
docker-compose ps

# 6. Install fresh database
cd ../customer/fresh-install
export APP_USER_PASSWORD="CustomerSecurePassword"
./install.sh

# 7. Update docker/.env with the app_user password
nano ../docker/.env  # Set DB_PASSWORD=CustomerSecurePassword

# 8. Start full stack
cd ../docker
docker-compose up -d

# 9. Verify
curl http://localhost:3000/health
```

---

## Files to Update After Installation

| File | Variable | Purpose |
|------|----------|---------|
| `docker/.env` | `DB_PASSWORD` | Backend uses this to connect as app_user |
| `docker/.env` | `POSTGRES_PASSWORD` | Admin access (migrations) |
| Doppler (if used) | `DB_PASSWORD` | Secrets management |

---

## Verification

After installation, verify with:

```bash
# Check tables and users
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT 'Tables', COUNT(*)::text FROM pg_tables WHERE schemaname = 'public'
UNION ALL SELECT 'Users', COUNT(*)::text FROM pg_roles WHERE rolname IN ('assixx_user', 'app_user')
UNION ALL SELECT 'Plans', COUNT(*)::text FROM plans
UNION ALL SELECT 'Features', COUNT(*)::text FROM features;
"

# Expected output:
# Tables   | 109
# Users    | 2
# Plans    | 3
# Features | 12
```

---

## RLS (Row Level Security)

The schema includes 89 RLS policies for multi-tenant isolation:

```sql
-- Example policy pattern
CREATE POLICY tenant_isolation ON table_name
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

**CRITICAL:** Only `app_user` enforces RLS. Never use `assixx_user` for the application - it bypasses all security policies!

---

## Troubleshooting

### Error: "Container not running"
```bash
cd docker && docker-compose up -d postgres redis
```

### Error: "app_user already exists"
This is fine - the script updates the password if the user exists.

### Error: "Permission denied"
Ensure you're using `assixx_user` (superuser) for installation.

### Error: "Password authentication failed"
Update `docker/.env` with the correct `DB_PASSWORD` and restart:
```bash
docker-compose restart backend
```

---

## Encoding

All files use **UTF-8 encoding** with correct German umlauts:
- ae, oe, ue, ss (Uebersicht, Qualitaet, etc.)

---

## PostgreSQL Extensions

### pg_stat_statements (Automatically Enabled)

Query performance monitoring is automatically enabled via `docker-compose.yml`:

```yaml
command:
  - "postgres"
  - "-c"
  - "shared_preload_libraries=pg_stat_statements"
  - "-c"
  - "pg_stat_statements.track=all"
```

**Benefits:**
- Track slow queries
- Identify N+1 problems
- Monitor query frequency

**Verify installation:**
```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';"
```

**View slow queries:**
```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT left(query, 60), calls, round(total_exec_time::numeric, 2) as total_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC LIMIT 10;"
```

See `DATABASE-MIGRATION-GUIDE.md` for more details.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-01-14 | Added pg_stat_statements documentation |
| 1.1.0 | 2026-01-14 | Added app_user creation, password management docs |
| 1.0.0 | 2026-01-14 | Initial release with 109 tables, 89 RLS policies |

---

**Maintained by:** Assixx Development Team
