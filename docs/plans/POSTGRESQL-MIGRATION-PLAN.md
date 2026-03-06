# PostgreSQL Migration Plan - Assixx

# MySQL Verbindung testen

docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pAssixxP@ss2025! main -e "SELECT 1;"'

```

## Executive Summary

**Ziel:** Migration von MySQL zu PostgreSQL mit Row Level Security (RLS) für wasserdichte Multi-Tenant-Isolation.

**Zeitrahmen:** ~1 Woche (Dev-DB ohne Tenant-Daten)

**Risiko:** MINIMAL (nur Schema + globale Tabellen)

**Migration Scope:**
| Quelle | Tabellen | RLS |
|--------|----------|-----|
| `main` DB | 117 (95 mit tenant_id, 22 global) | 95 mit RLS |
| `global` DB | 2 (kvp_categories, machine_categories) | Kein RLS |
| **Total** | **119 Tabellen** | **95 mit RLS** |

---

## WICHTIG: Parallel-Betrieb Strategie

```

┌─────────────────────────────────────────────────────────────┐
│ PHASE 1-5: Parallel-Betrieb (MySQL + PostgreSQL) │
│ │
│ MySQL Container PostgreSQL Container │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ assixx-mysql│ │assixx-postgres│ ◄── Aktiv │
│ │ Port: 3307 │ │ Port: 5432 │ │
│ │ (Backup) │ │ (Primary) │ │
│ └─────────────┘ └───────────────┘ │
│ │ │ │
│ ▼ ▼ │
│ phpMyAdmin DBeaver │
│ (noch da) (neu) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: Nach erfolgreichem Test (frühestens 2-4 Wochen) │
│ │
│ MySQL Container PostgreSQL Container │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ LÖSCHEN │ ──► │assixx-postgres│ ◄── Einzig │
│ │ (später) │ │ Port: 5432 │ │
│ └─────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────────────┘

````

**Regeln für Parallel-Betrieb:**
1. MySQL bleibt **mindestens 2-4 Wochen** nach Migration laufen
2. Backend nutzt **nur PostgreSQL** (kein Dual-Write)
3. MySQL dient als **Fallback** falls Probleme auftreten
4. Erst löschen wenn: Alle Features getestet, keine Bugs, Team confident

---

## Tools Übersicht

| Tool | Ersetzt | Installation |
|------|---------|--------------|
| **PostgreSQL 17** | MySQL 8 | Docker Container |
| **DBeaver** | phpMyAdmin | Windows (nicht WSL!) |
| **pgloader** | - | Docker oder WSL |

### DBeaver Installation (Windows)

```powershell
# Option 1: Download von https://dbeaver.io/download/
# Option 2: Via Chocolatey (PowerShell als Admin)
choco install dbeaver

# Option 3: Via winget
winget install dbeaver.dbeaver
````

**DBeaver Verbindung zu PostgreSQL in Docker:**

- Host: `localhost`
- Port: `5432`
- Database: `assixx`
- User: `app_user`
- Password: `AppUserP@ss2025!`

> **Wichtig:** DBeaver auf Windows installieren, NICHT in WSL!
> Docker exposed automatisch Ports zu Windows localhost.

---

## Datenbank-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│ MySQL Datenbanken (Stand: 2025-11-30)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  main (117 Tabellen)                                        │
│  ├── 95 Tabellen MIT tenant_id → RLS aktivieren            │
│  └── 22 Tabellen OHNE tenant_id → Global (kein RLS)        │
│                                                             │
│  global (2 Tabellen)                                        │
│  ├── kvp_categories (KVP Kategorien)                       │
│  └── machine_categories (Anlagenkategorien)              │
│                                                             │
│  [main_db] → GELÖSCHT (war leer/legacy)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

PostgreSQL Zielstruktur:
┌─────────────────────────────────────────────────────────────┐
│ assixx (PostgreSQL Datenbank)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  public Schema                                              │
│  ├── 95 Tabellen MIT tenant_id → RLS AKTIVIERT             │
│  ├── 22 Tabellen OHNE tenant_id → Kein RLS (global)        │
│  ├── kvp_categories (aus global DB) → Kein RLS             │
│  └── machine_categories (aus global DB) → Kein RLS         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tabellen in `global` DB

| Tabelle              | Spalten                                            | Beschreibung                        |
| -------------------- | -------------------------------------------------- | ----------------------------------- |
| `kvp_categories`     | id, name, description, color, icon, created_at     | KVP Kategorien                      |
| `machine_categories` | id, name, description, icon, sort_order, is_active | Anlagenkategorien (seit 2025-11-30) |

---

## Phase 0: Vorbereitung (Tag 1)

### 0.1 Aktueller Docker Stack

```
┌─────────────────────────────────────────────────────────────┐
│ AKTUELL                                                     │
│                                                             │
│  assixx-mysql ─────► assixx-backend ◄───── assixx-redis    │
│  (Port 3307)         (Port 3000)           (Port 6379)     │
│       │                   │                     │          │
│       │              assixx-deletion-worker     │          │
│       │              (Port 3001)                │          │
│       ▼                                         │          │
│  assixx-phpmyadmin                              │          │
│  (Port 8080)                                    │          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NACH MIGRATION                                              │
│                                                             │
│  assixx-postgres ───► assixx-backend ◄───── assixx-redis   │
│  (Port 5432)          (Port 3000)           (Port 6379)    │
│       │                   │                     │          │
│       │              assixx-deletion-worker     │          │
│       │              (Port 3001)                │          │
│       │                                         │          │
│  [assixx-mysql]     DBeaver (Windows)           │          │
│  (Parallel-Backup)                              │          │
└─────────────────────────────────────────────────────────────┘
```

### 0.2 Backup erstellen

```bash
# MySQL Backup (Sicherheitsnetz)
docker exec assixx-mysql mysqldump -u assixx_user -p'AssixxP@ss2025!' main > backup_before_migration.sql
```

### 0.3 PostgreSQL zu docker-compose.yml hinzufügen

```yaml
# docker/docker-compose.yml - PostgreSQL Service HINZUFÜGEN (MySQL bleibt!)

services:
  # =============================================
  # PostgreSQL (NEU) - Primary Database
  # =============================================
  postgres:
    image: postgres:17-alpine
    container_name: assixx-postgres
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 1G
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-assixx_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-AssixxP@ss2025!}
      POSTGRES_DB: ${POSTGRES_DB:-assixx}
      TZ: Europe/Berlin
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-init:/docker-entrypoint-initdb.d
    networks:
      - assixx-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U assixx_user -d assixx']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # =============================================
  # MySQL (BLEIBT für Parallel-Betrieb!)
  # =============================================
  mysql:
    image: mysql:8.0
    # ... (unverändert lassen!)

  # =============================================
  # Redis (BLEIBT unverändert!)
  # =============================================
  redis:
    image: redis:7-alpine
    # ... (unverändert - unabhängig von DB-Migration!)

  # =============================================
  # Backend - DB-Verbindung ändern
  # =============================================
  backend:
    # ...
    environment:
      # ALT (MySQL):
      # DB_HOST: mysql
      # DB_PORT: 3306

      # NEU (PostgreSQL):
      DB_TYPE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${POSTGRES_USER:-assixx_user}
      DB_PASSWORD: ${POSTGRES_PASSWORD:-AssixxP@ss2025!}
      DB_NAME: ${POSTGRES_DB:-assixx}
      # Rest bleibt gleich...
    depends_on:
      postgres: # Statt mysql
        condition: service_healthy
      redis:
        condition: service_healthy

  # =============================================
  # Deletion Worker - DB-Verbindung ändern
  # =============================================
  deletion-worker:
    # ...
    environment:
      DB_TYPE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${POSTGRES_USER:-assixx_user}
      DB_PASSWORD: ${POSTGRES_PASSWORD:-AssixxP@ss2025!}
      DB_NAME: ${POSTGRES_DB:-assixx}
      # Redis bleibt gleich!
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      postgres: # Statt mysql
        condition: service_healthy

  # =============================================
  # phpMyAdmin - AUSKOMMENTIEREN (nicht löschen!)
  # =============================================
  # phpmyadmin:
  #   image: phpmyadmin:5.2.2
  #   ... (später entfernen)

# =============================================
# Volumes
# =============================================
volumes:
  mysql_data:
    name: assixx_mysql_data
    external: true # Bleibt für Parallel-Betrieb!
  postgres_data:
    name: assixx_postgres_data
    # external: true  # Erst später, wenn Volume erstellt
  redis_data:
    name: assixx_redis_data
    external: true # Bleibt unverändert!
```

### 0.4 PostgreSQL Volume erstellen

```bash
# Neues Volume für PostgreSQL
docker volume create assixx_postgres_data

# postgres-init Ordner erstellen
mkdir -p /home/scs/projects/Assixx/docker/postgres-init
```

### 0.5 pgloader installieren

```bash
# Option 1: Via apt (Debian/Ubuntu)
apt-get install pgloader

# Option 2: Via Docker (EMPFOHLEN für 2025)
docker pull ghcr.io/dimitri/pgloader:latest
docker run --rm -it ghcr.io/dimitri/pgloader:latest pgloader --version

# Option 3: Im Docker Network (für Container-zu-Container Migration)
docker run --rm --network assixx-network \
  ghcr.io/dimitri/pgloader:latest \
  pgloader --version
```

---

## Phase 1: Schema Migration (Tag 2-3)

### 1.1 Datentyp-Mapping MySQL → PostgreSQL

| MySQL                | PostgreSQL                                               | Notiz                          |
| -------------------- | -------------------------------------------------------- | ------------------------------ |
| `INT AUTO_INCREMENT` | `SERIAL` oder `INT GENERATED ALWAYS AS IDENTITY`         |                                |
| `TINYINT(1)`         | `BOOLEAN`                                                | pgloader macht das automatisch |
| `ENUM('a','b','c')`  | `TEXT CHECK (col IN ('a','b','c'))` oder PostgreSQL ENUM |                                |
| `JSON`               | `JSONB`                                                  | Besser! Native Indexierung     |
| `LONGBLOB`           | `BYTEA`                                                  |                                |
| `DATETIME`           | `TIMESTAMP`                                              |                                |
| `VARCHAR(n)`         | `VARCHAR(n)`                                             | Identisch                      |
| `TEXT`               | `TEXT`                                                   | Identisch                      |

### 1.2 pgloader Konfiguration

**Schritt 1:** Erstelle `migration/mysql-to-postgres-main.load` (Haupt-DB):

```lisp
-- ============================================
-- PGLOADER KONFIGURATION: main DB → PostgreSQL
-- Basiert auf pgloader Docs 2025
-- ============================================

LOAD DATABASE
    FROM mysql://assixx_user:AssixxP@ss2025!@assixx-mysql/main
    INTO postgresql://assixx_user:AssixxP@ss2025!@assixx-postgres/assixx

WITH
    -- Schema & Daten Optionen
    include drop,                    -- DROP + CREATE tables
    create tables,                   -- Tabellen erstellen
    create indexes,                  -- Indexes erstellen
    foreign keys,                    -- Foreign Keys erstellen
    reset sequences,                 -- Sequences auf MAX(id) setzen
    uniquify index names,            -- Index Namen eindeutig machen (PostgreSQL Requirement)

    -- Performance Optionen
    drop indexes,                    -- Indexes vor COPY droppen, danach parallel recreaten
    disable triggers,                -- Triggers während Load deaktivieren (FK-Fehler vermeiden)

    -- Parallelisierung
    workers = 4,                     -- Anzahl parallel Workers
    concurrency = 2,                 -- Queries pro Worker
    batch rows = 10000,              -- Rows pro Batch
    batch size = 100MB               -- Max Batch Size

SET
    maintenance_work_mem to '512MB',
    work_mem to '64MB',
    search_path to 'public'

CAST
    -- Boolean: MySQL TINYINT(1) → PostgreSQL BOOLEAN
    type tinyint when (= 1 precision) to boolean using tinyint-to-boolean,

    -- JSON → JSONB (native PostgreSQL JSON mit Indexierung)
    type json to jsonb,

    -- DateTime mit Zero-Dates Handler (MySQL '0000-00-00' → NULL)
    type datetime when default "0000-00-00 00:00:00" and not null
        to timestamptz drop not null drop default using zero-dates-to-null,
    type datetime when default "0000-00-00 00:00:00"
        to timestamptz drop default using zero-dates-to-null,
    type datetime to timestamptz,

    -- Date mit Zero-Dates Handler
    type date when default "0000-00-00"
        to date drop default using zero-dates-to-null,
    type date to date,

    -- Timestamp
    type timestamp when default "0000-00-00 00:00:00"
        to timestamptz drop default using zero-dates-to-null,
    type timestamp to timestamptz,

    -- Text Types (NULL characters entfernen)
    type text to text using remove-null-characters,
    type mediumtext to text using remove-null-characters,
    type longtext to text using remove-null-characters

MATERIALIZE VIEWS

-- System-Tabellen ausschließen
EXCLUDING TABLE NAMES MATCHING 'migration_log', 'schema_migrations'

BEFORE LOAD DO
    $$ DROP SCHEMA IF EXISTS public CASCADE; $$,
    $$ CREATE SCHEMA public; $$

AFTER LOAD DO
    $$ GRANT ALL ON SCHEMA public TO assixx_user; $$,
    $$ GRANT ALL ON ALL TABLES IN SCHEMA public TO assixx_user; $$,
    $$ GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO assixx_user; $$;
```

**Schritt 2:** Erstelle `migration/mysql-to-postgres-global.load` (Global-DB):

```lisp
-- ============================================
-- PGLOADER KONFIGURATION: global DB → PostgreSQL
-- Tabellen: kvp_categories, machine_categories
-- Diese Tabellen haben KEIN tenant_id (global shared)
-- ============================================

LOAD DATABASE
    FROM mysql://assixx_user:AssixxP@ss2025!@assixx-mysql/global
    INTO postgresql://assixx_user:Assixx_Pass2025!@assixx-postgres/assixx

WITH
    -- KEIN include drop (Schema bereits von main erstellt!)
    create tables,
    create indexes,
    reset sequences,
    uniquify index names

SET
    maintenance_work_mem to '128MB',
    search_path to 'public'

CAST
    type tinyint when (= 1 precision) to boolean using tinyint-to-boolean,
    type datetime to timestamptz using zero-dates-to-null,
    type text to text using remove-null-characters

-- Keine BEFORE LOAD (Schema bereits von main erstellt)
AFTER LOAD DO
    $$ GRANT ALL ON TABLE kvp_categories TO assixx_user; $$,
    $$ GRANT ALL ON TABLE machine_categories TO assixx_user; $$,
    $$ COMMENT ON TABLE kvp_categories IS 'Global KVP categories - NO RLS (shared across all tenants)'; $$,
    $$ COMMENT ON TABLE machine_categories IS 'Global asset categories - NO RLS (shared across all tenants)'; $$;
```

### 1.3 Migration ausführen

```bash
# ============================================
# VORBEREITUNG: pgloader Config-Dateien erstellen
# ============================================

# Ordner für Migration erstellen
mkdir -p /home/scs/projects/Assixx/migration

# Config-Dateien erstellen (Inhalt wie oben)
# → migration/mysql-to-postgres-main.load
# → migration/mysql-to-postgres-global.load

# ============================================
# SCHRITT 1: Main DB migrieren (117 Tabellen)
# ============================================

# Test-Migration (Dry Run) - prüft Verbindung und Schema
docker run --rm --network assixx-network \
  -v /home/scs/projects/Assixx/migration:/migration \
  ghcr.io/dimitri/pgloader:latest \
  pgloader --dry-run /migration/mysql-to-postgres-main.load

# Echte Migration ausführen
docker run --rm --network assixx-network \
  -v /home/scs/projects/Assixx/migration:/migration \
  ghcr.io/dimitri/pgloader:latest \
  pgloader /migration/mysql-to-postgres-main.load

# Verifizieren (sollte 117 Tabellen zeigen)
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt" | wc -l

# ============================================
# SCHRITT 2: Global DB migrieren (2 Tabellen)
# ============================================

# Test-Migration
docker run --rm --network assixx-network \
  -v /home/scs/projects/Assixx/migration:/migration \
  ghcr.io/dimitri/pgloader:latest \
  pgloader --dry-run /migration/mysql-to-postgres-global.load

# Echte Migration
docker run --rm --network assixx-network \
  -v /home/scs/projects/Assixx/migration:/migration \
  ghcr.io/dimitri/pgloader:latest \
  pgloader /migration/mysql-to-postgres-global.load

# Verifizieren
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM kvp_categories;"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM machine_categories;"

# ============================================
# SCHRITT 3: Alle Tabellen prüfen (119 total)
# ============================================
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\dt public.*" | wc -l

# Detaillierte Übersicht
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
SELECT
  schemaname,
  COUNT(*) as tables
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY schemaname;
"
```

### 1.4 ENUM-Typen manuell konvertieren

PostgreSQL ENUM ist strenger. Erstelle `migration/create-enums.sql`:

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('root', 'admin', 'employee');

-- Tenant status
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- Shift status
CREATE TYPE shift_status AS ENUM ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Shift types
CREATE TYPE shift_type AS ENUM ('regular', 'overtime', 'standby', 'vacation', 'sick', 'holiday', 'early', 'late', 'night', 'day', 'flexible', 'F', 'S', 'N');

-- Document access scope
CREATE TYPE access_scope AS ENUM ('personal', 'team', 'department', 'company', 'payroll', 'blackboard');

-- Document storage type
CREATE TYPE storage_type AS ENUM ('database', 'filesystem', 's3');

-- Availability status
CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'vacation', 'sick');

-- Deletion status
CREATE TYPE deletion_status AS ENUM ('active', 'marked_for_deletion', 'suspended', 'deleting');

-- Tenant plan
CREATE TYPE tenant_plan AS ENUM ('basic', 'premium', 'enterprise');
```

---

## Phase 2: Row Level Security Setup (Tag 4-5)

### 2.1 RLS Basis-Setup

Erstelle `migration/setup-rls.sql`:

```sql
-- ============================================
-- ROW LEVEL SECURITY CONFIGURATION
-- ============================================

-- Create application user (NOT superuser!)
CREATE ROLE app_user WITH LOGIN PASSWORD 'AppUserP@ss2025!';
GRANT CONNECT ON DATABASE assixx TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

### 2.2 RLS Policies für alle Tenant-Tabellen

```sql
-- ============================================
-- GENERIC RLS POLICY FUNCTION
-- ============================================

-- Function to create RLS policy for any table with tenant_id
CREATE OR REPLACE FUNCTION create_tenant_rls_policy(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

    -- Force RLS for table owner too (important!)
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);

    -- Drop existing policy if exists
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);

    -- Create tenant isolation policy
    EXECUTE format('
        CREATE POLICY tenant_isolation ON %I
        FOR ALL
        USING (tenant_id = current_setting(''app.tenant_id'')::int)
        WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::int)
    ', table_name);

    RAISE NOTICE 'RLS enabled for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- APPLY RLS TO ALL TENANT TABLES (95 tables)
-- ============================================

DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'tenant_id'
        AND table_name NOT IN ('tenants') -- tenants table is special
    LOOP
        PERFORM create_tenant_rls_policy(tbl.table_name);
    END LOOP;
END $$;

-- ============================================
-- SPECIAL POLICIES
-- ============================================

-- Tenants table: Users can only see their own tenant
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_isolation ON tenants
    FOR ALL
    USING (id = current_setting('app.tenant_id')::int)
    WITH CHECK (id = current_setting('app.tenant_id')::int);

-- ============================================
-- GLOBAL TABLES (no RLS needed)
-- ============================================
-- These tables are shared across all tenants:
-- - plans (subscription plans)
-- - features (available features)
-- - plan_features (which features in which plan)
-- - machine_categories (global categories)
-- - system_settings (system-wide settings)
-- - system_logs (system-wide logs)
-- - kvp_categories (from 'global' DB - KVP Kategorien)

-- Explizit KEINE RLS für globale Tabellen:
-- (Diese haben kein tenant_id und werden automatisch übersprungen,
--  aber zur Sicherheit hier dokumentiert)
```

### 2.3 RLS Test-Script

```sql
-- ============================================
-- TEST RLS ISOLATION
-- ============================================

-- As superuser, insert test data
INSERT INTO tenants (id, company_name, subdomain, email) VALUES
(1, 'Tenant A', 'tenant-a', 'a@test.com'),
(2, 'Tenant B', 'tenant-b', 'b@test.com');

INSERT INTO users (tenant_id, username, email, password, role) VALUES
(1, 'user_a', 'user@a.com', 'hash', 'admin'),
(2, 'user_b', 'user@b.com', 'hash', 'admin');

-- Switch to app_user and test isolation
SET ROLE app_user;

-- Set tenant context to Tenant A
SET app.tenant_id = '1';

-- Should return ONLY user_a
SELECT * FROM users;  -- ✅ Only tenant 1 data

-- Try to access Tenant B data (should fail!)
SELECT * FROM users WHERE tenant_id = 2;  -- ✅ Returns empty!

-- Try to insert for wrong tenant (should fail!)
INSERT INTO users (tenant_id, username, email, password, role)
VALUES (2, 'hacker', 'hack@evil.com', 'x', 'admin');  -- ❌ BLOCKED!

-- Reset
RESET ROLE;
```

---

## Phase 3: Backend Anpassung (Tag 6-10)

### 3.1 Dependencies ändern

```bash
# Im backend Verzeichnis
pnpm remove mysql2
pnpm add pg @types/pg
```

### 3.2 Database Connection Pool

Erstelle `backend/src/utils/db-postgres.ts`:

```typescript
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { logger } from './logger.js';

// Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST || 'assixx-postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'assixx',
  user: process.env.DB_USER || 'app_user', // NOT superuser!
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware: Set tenant context for EVERY query
export async function setTenantContext(client: PoolClient, tenantId: number): Promise<void> {
  await client.query(`SET app.tenant_id = $1`, [tenantId.toString()]);
}

// Execute query with automatic tenant isolation
export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
  tenantId?: number,
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    if (tenantId !== undefined) {
      await setTenantContext(client, tenantId);
    }
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Transaction with tenant context
export async function transaction<T>(tenantId: number, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setTenantContext(client, tenantId);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
}

export { pool };
```

### 3.3 Express Middleware für Tenant Context

```typescript
// backend/src/middleware/tenant-context.ts
import { NextFunction, Request, Response } from 'express';

import { pool, setTenantContext } from '../utils/db-postgres.js';

declare global {
  namespace Express {
    interface Request {
      tenantId: number;
      dbClient?: import('pg').PoolClient;
    }
  }
}

export async function tenantContextMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // tenantId should already be set by auth middleware
  if (!req.tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return;
  }

  try {
    // Get a client from pool and set tenant context
    const client = await pool.connect();
    await setTenantContext(client, req.tenantId);

    // Attach to request for use in route handlers
    req.dbClient = client;

    // Release client after response
    res.on('finish', () => {
      client.release();
    });

    next();
  } catch (error) {
    next(error);
  }
}
```

### 3.4 Query Syntax Änderungen

| MySQL            | PostgreSQL             | Beispiel            |
| ---------------- | ---------------------- | ------------------- |
| `?` placeholder  | `$1, $2, $3`           | `WHERE id = $1`     |
| `LIMIT ?, ?`     | `LIMIT $1 OFFSET $2`   | `LIMIT 10 OFFSET 0` |
| `` `column` ``   | `"column"`             | `SELECT "user"`     |
| `NOW()`          | `NOW()`                | Identisch           |
| `IFNULL()`       | `COALESCE()`           |                     |
| `AUTO_INCREMENT` | `SERIAL` / `GENERATED` |                     |

### 3.5 Beispiel Query Migration

```typescript
// VORHER (MySQL)
const [rows] = await execute<UserResult[]>(
  'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
  [userId, tenantId]
);

// NACHHER (PostgreSQL mit RLS)
const result = await query<UserResult>(
  'SELECT * FROM users WHERE id = $1',  // tenant_id nicht mehr nötig!
  [userId],
  tenantId  // Wird automatisch via RLS enforced
);
const rows = result.rows;
```

**WICHTIG:** Mit RLS brauchst du `AND tenant_id = ?` NICHT mehr in Queries!

---

## Phase 4: Trigger & Views Migration (Tag 11)

### 4.1 Protected Tables - DELETE Schutz

Diese Tabellen sind systemkritisch und dürfen NICHT gelöscht werden:

- `plans` - Subscription Pläne
- `features` - Verfügbare Features
- `plan_features` - Plan-Feature Zuordnung

**MySQL Trigger (bereits aktiv seit 2025-11-30):**

```sql
-- Bereits in MySQL erstellt!
-- prevent_plans_delete
-- prevent_features_delete
-- prevent_plan_features_delete
```

**PostgreSQL Äquivalent:** Erstelle `migration/protect-tables.sql`:

```sql
-- ============================================
-- PROTECTED TABLES: Prevent accidental deletion
-- ============================================

-- Generic function for delete protection
CREATE OR REPLACE FUNCTION prevent_delete_protected_table()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'PROTECTED TABLE: DELETE not allowed on % - system critical data', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Apply to protected tables
CREATE TRIGGER prevent_plans_delete
    BEFORE DELETE ON plans
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_protected_table();

CREATE TRIGGER prevent_features_delete
    BEFORE DELETE ON features
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_protected_table();

CREATE TRIGGER prevent_plan_features_delete
    BEFORE DELETE ON plan_features
    FOR EACH ROW
    EXECUTE FUNCTION prevent_delete_protected_table();
```

### 4.2 MySQL Triggers → PostgreSQL Functions

```sql
-- Beispiel: Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Repeat for other tables...
```

### 4.2 Views migrieren

```sql
-- Views sollten automatisch von pgloader migriert werden
-- Manuell prüfen und ggf. anpassen für PostgreSQL Syntax
```

---

## Phase 5: Testing & Validation (Tag 12-14)

### 5.1 Automatisierte Tests

```bash
# Type-Check
pnpm run type-check

# Unit Tests
pnpm run test

# Integration Tests
pnpm run test:integration
```

### 5.2 RLS Penetration Test

```typescript
// tests/rls-security.test.ts
describe('RLS Security', () => {
  it('should not allow access to other tenant data', async () => {
    // Set context to tenant 1
    await query('SET app.tenant_id = $1', ['1']);

    // Try to read tenant 2 data
    const result = await query('SELECT * FROM users WHERE tenant_id = $1', [2]);

    // Should return empty (RLS blocks it)
    expect(result.rows.length).toBe(0);
  });

  it('should not allow INSERT for wrong tenant', async () => {
    await query('SET app.tenant_id = $1', ['1']);

    // Try to insert for tenant 2
    await expect(
      query('INSERT INTO users (tenant_id, ...) VALUES ($1, ...)', [2, ...])
    ).rejects.toThrow();
  });
});
```

### 5.3 Performance Vergleich

```sql
-- Vor Migration (MySQL)
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 1;

-- Nach Migration (PostgreSQL mit RLS)
SET app.tenant_id = '1';
EXPLAIN ANALYZE SELECT * FROM users;

-- Sollte ähnlich sein - RLS nutzt Index auf tenant_id
```

---

## Phase 6: Deployment (Tag 15)

### 6.1 Docker Compose Update

```yaml
# docker/docker-compose.yml
services:
  backend:
    environment:
      - DB_TYPE=postgres
      - DB_HOST=assixx-postgres
      - DB_PORT=5432
      - DB_NAME=assixx
      - DB_USER=app_user
      - DB_PASSWORD=${POSTGRES_APP_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy

  # MySQL kann später entfernt werden
  # mysql:
  #   ...

  postgres:
    image: postgres:17-alpine
    # ... (wie oben)
```

### 6.2 Environment Variables

```bash
# .env
DB_TYPE=postgres
DB_HOST=assixx-postgres
DB_PORT=5432
DB_NAME=assixx
DB_USER=app_user
DB_PASSWORD=AppUserP@ss2025!

# Superuser nur für Migrations
POSTGRES_ADMIN_USER=assixx_user
POSTGRES_ADMIN_PASSWORD=AssixxP@ss2025!
```

### 6.3 Cleanup (NICHT SOFORT!)

```bash
# ⚠️ ERST NACH 2-4 WOCHEN ERFOLGREICHEM POSTGRESQL-BETRIEB!

# Checkliste vor MySQL-Löschung:
# [ ] Alle API-Endpoints getestet
# [ ] RLS funktioniert korrekt
# [ ] Keine Produktions-Bugs
# [ ] Team ist confident
# [ ] Finales MySQL-Backup erstellt

# Dann erst:
# 1. Finales Backup
docker exec assixx-mysql mysqldump -u assixx_user -p main > final_mysql_backup_before_delete.sql

# 2. MySQL Container stoppen
docker-compose stop mysql

# 3. MySQL aus docker-compose.yml auskommentieren (noch nicht löschen!)
# mysql:
#   image: mysql:8
#   ...

# 4. Nach weiteren 2 Wochen ohne Probleme: Volume löschen
docker volume rm assixx_mysql_data

# 5. phpMyAdmin Container entfernen
docker-compose stop phpmyadmin
# Dann aus docker-compose.yml entfernen
```

**Timeline:**

```
Tag 0          Tag 7           Tag 21-28        Tag 42+
  │              │                 │               │
  ▼              ▼                 ▼               ▼
Migration    PostgreSQL       MySQL stoppen    MySQL Volume
 starten      läuft            (Backup!)        löschen
              stabil
```

---

## Checkliste

### Pre-Migration

- [x] MySQL Backup erstellt ✅ (2025-11-30)
- [x] PostgreSQL Container läuft ✅ (2025-11-30)
- [x] pgloader installiert ✅ (2025-11-30)
- [x] Test-Environment bereit ✅ (2025-11-30)

### Schema Migration

- [x] pgloader Konfiguration für `main` DB erstellt ✅ (2025-11-30)
- [x] pgloader Konfiguration für `global` DB erstellt ✅ (2025-11-30)
- [x] Dry-run main DB erfolgreich ✅ (2025-11-30)
- [x] Dry-run global DB erfolgreich ✅ (2025-11-30)
- [x] Main DB migriert (117 Tabellen) ✅ (2025-11-30)
- [x] Global DB migriert (kvp_categories, machine_categories) ✅ (2025-11-30)
- [x] ENUM-Typen erstellt (pgloader auto-created 81 SQL types) ✅ (2025-11-30)
- [x] Foreign Keys intakt (285 FK) ✅ (2025-11-30)
- [x] Total: 119 Tabellen in PostgreSQL ✅ (2025-11-30)

### RLS Setup

- [x] app_user erstellt (kein Superuser!) ✅ (2025-11-30)
- [x] RLS auf allen 90 Tenant-Tabellen aktiviert ✅ (2025-11-30)
- [x] Policies getestet ✅ (2025-11-30)
- [x] Penetration Tests bestanden ✅ (2025-11-30)

### Protected Tables (DELETE-Schutz)

- [x] MySQL Trigger: prevent_plans_delete ✅ (2025-11-30)
- [x] MySQL Trigger: prevent_features_delete ✅ (2025-11-30)
- [x] MySQL Trigger: prevent_plan_features_delete ✅ (2025-11-30)
- [x] PostgreSQL Trigger: prevent_plans_delete ✅ (2025-11-30)
- [x] PostgreSQL Trigger: prevent_features_delete ✅ (2025-11-30)
- [x] PostgreSQL Trigger: prevent_plan_features_delete ✅ (2025-11-30)

### Backend

- [x] pg Package installiert ✅ (2025-11-30)
- [x] Connection Pool implementiert ✅ (2025-11-30)
- [x] Tenant Context Middleware ✅ (2025-11-30)
- [x] Alle Queries auf $1, $2... umgestellt (auto-convert in db.ts) ✅ (2025-11-30)
- [x] Type-Check passed (0 errors) ✅ (2025-11-30)
- [x] Lint passed (0 errors) ✅ (2025-11-30)

### Deployment

- [x] Docker Compose aktualisiert ✅ (2025-11-30)
- [x] Environment Variables gesetzt ✅ (2025-11-30)
- [x] Health Checks funktionieren ✅ (2025-11-30)
- [x] MySQL & phpMyAdmin disabled (als Backup) ✅ (2025-11-30)

---

## Rollback Plan

Falls etwas schief geht:

```bash
# 1. Backend auf MySQL zurückschalten
git checkout -- backend/src/utils/db.ts

# 2. docker-compose.yml zurücksetzen
git checkout -- docker/docker-compose.yml

# 3. MySQL Backup wiederherstellen
docker exec -i assixx-mysql mysql -u assixx_user -p'AssixxP@ss2025!' main < backup_before_migration.sql

# 4. Backend neu starten
docker-compose restart backend
```

---

## Fazit

**PostgreSQL + RLS ist die richtige Entscheidung weil:**

1. **Wasserdichte Isolation** - DB blockt automatisch, selbst bei Code-Bugs
2. **Weniger Code** - Kein `AND tenant_id = ?` mehr in jeder Query
3. **Zukunftssicher** - Enterprise-Feature für SaaS
4. **Performance** - RLS nutzt Indexes effizient
5. **Audit-freundlich** - Compliance wird einfacher

**Der perfekte Zeitpunkt ist JETZT** - mit ~0 Produktionsdaten ist das Risiko minimal.
