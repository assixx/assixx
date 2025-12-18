# Assixx System Architecture

**Version:** 3.0.0 | **Updated:** 2025-12-16

Multi-Tenant SaaS platform for industrial companies.

---

## Technology Stack

### Backend

| Technology | Version | Purpose                 |
| ---------- | ------- | ----------------------- |
| Node.js    | 24.x    | Runtime                 |
| TypeScript | 5.x     | Language                |
| Express.js | 4.x     | Web framework           |
| PostgreSQL | 17.x    | Database                |
| Redis      | 7.x     | Sessions, rate limiting |
| Socket.io  | 4.x     | WebSocket               |
| Zod        | 3.x     | Validation              |
| pnpm       | 10.x    | Package manager         |

### Frontend

| Technology       | Version | Purpose    |
| ---------------- | ------- | ---------- |
| TypeScript       | 5.x     | Language   |
| Vite             | 7.x     | Build tool |
| Tailwind CSS     | 4.x     | Styling    |
| FullCalendar     | 6.x     | Calendar   |
| Socket.io Client | 4.x     | WebSocket  |

### Infrastructure

| Technology     | Purpose                    |
| -------------- | -------------------------- |
| Docker         | Containerization           |
| Docker Compose | Orchestration              |
| Nginx          | Reverse proxy (production) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                       │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │  TypeScript   │  │  Vite Build   │  │  Design System │  │
│  │  Modules      │  │  (HTML/CSS)   │  │  (29 components)│  │
│  └───────────────┘  └───────────────┘  └────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────┴────────────────────────────────┐
│                    Backend (Node.js 24)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Express.js + TypeScript              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │   │
│  │  │ Routes  │  │ Services│  │ Models  │  │  Zod   │ │   │
│  │  │ /api/v2 │  │ (Logic) │  │ (Data)  │  │(Valid.)│ │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Middleware Layer                    │   │
│  │  ┌──────┐ ┌────────┐ ┌─────┐ ┌──────┐ ┌──────────┐ │   │
│  │  │ Auth │ │ Tenant │ │ RLS │ │ Rate │ │ Security │ │   │
│  │  │ JWT  │ │ Check  │ │ Set │ │Limit │ │ Helmet   │ │   │
│  │  └──────┘ └────────┘ └─────┘ └──────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────┴───────┐    ┌───────┴───────┐    ┌──────┴──────┐
│  PostgreSQL   │    │     Redis     │    │   Uploads   │
│     17.x      │    │      7.x      │    │   (Files)   │
│               │    │               │    │             │
│  - RLS        │    │  - Sessions   │    │  - UUIDv7   │
│  - tenant_id  │    │  - Rate limit │    │  - Isolated │
│  - 119 tables │    │  - Cache      │    │             │
└───────────────┘    └───────────────┘    └─────────────┘
```

---

## Multi-Tenant Architecture

### Strategy: Single Database with Row Level Security

All tenants share one PostgreSQL database. Isolation via:

1. **tenant_id column** - Every tenant-specific table has `tenant_id`
2. **RLS Policies** - PostgreSQL enforces isolation at database level
3. **App Context** - `SET app.tenant_id = X` before each request

```sql
-- RLS Policy (applied to 95/119 tables)
CREATE POLICY tenant_isolation ON users
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );
```

### Database Users

| User          | Purpose          | Access       |
| ------------- | ---------------- | ------------ |
| `assixx_user` | Admin/migrations | Full access  |
| `app_user`    | Application      | RLS enforced |

---

## API Structure

### Versioning

- **Current:** `/api/v2/` (only version)
- **No v1 fallback**

### Route Pattern

```
/api/v2/{resource}
/api/v2/{resource}/:id
/api/v2/{resource}/:id/{sub-resource}
```

### Modules

| Module        | Endpoint                | Description            |
| ------------- | ----------------------- | ---------------------- |
| Auth          | `/api/v2/auth`          | Login, logout, refresh |
| Users         | `/api/v2/users`         | User management        |
| Departments   | `/api/v2/departments`   | Department CRUD        |
| Teams         | `/api/v2/teams`         | Team management        |
| Documents     | `/api/v2/documents`     | Document storage       |
| Calendar      | `/api/v2/calendar`      | Events, scheduling     |
| Chat          | `/api/v2/chat`          | Real-time messaging    |
| Blackboard    | `/api/v2/blackboard`    | Announcements          |
| KVP           | `/api/v2/kvp`           | Suggestions system     |
| Shifts        | `/api/v2/shifts`        | Shift planning         |
| Surveys       | `/api/v2/surveys`       | Survey system          |
| Notifications | `/api/v2/notifications` | Push, SSE              |

---

## Authentication & Authorization

### Authentication Flow

```
1. POST /api/v2/auth/login
   ├── Validate credentials
   ├── Generate JWT (access + refresh)
   └── Return tokens

2. Request with token
   ├── Authorization: Bearer <access_token>
   ├── Middleware validates JWT
   ├── Sets req.user
   └── Sets app.tenant_id (RLS)

3. Token refresh
   ├── POST /api/v2/auth/refresh
   ├── Validate refresh token
   └── Return new access token
```

### JWT Structure

```typescript
{
  id: number,        // User ID
  email: string,
  role: 'root' | 'admin' | 'employee',
  tenantId: number,
  type: 'access' | 'refresh',
  iat: number,
  exp: number
}
```

### Role Hierarchy

```
root     → Full system access (super admin)
  │
admin    → Full tenant access
  │
employee → Limited access (own data + shared)
```

---

## Project Structure

```
Assixx/
├── backend/
│   └── src/
│       ├── app.ts                 # Express setup
│       ├── server.ts              # Entry point
│       ├── websocket.ts           # Socket.io
│       ├── config/                # DB, Redis config
│       ├── middleware/            # Auth, RLS, security
│       ├── routes/v2/             # API endpoints
│       │   ├── auth/
│       │   ├── users/
│       │   ├── calendar/
│       │   └── ...
│       ├── models/                # Database models
│       ├── services/              # Business logic
│       ├── types/                 # TypeScript types
│       └── utils/                 # Helpers
├── frontend/
│   └── src/
│       ├── pages/                 # HTML pages
│       ├── scripts/               # TypeScript modules
│       ├── styles/                # CSS + Tailwind
│       ├── design-system/         # Component library
│       └── utils/                 # Client helpers
├── docker/
│   ├── docker-compose.yml         # Main orchestration
│   ├── Dockerfile.dev             # Dev container
│   └── .env                       # Environment vars
├── api-tests/                     # Bruno API tests
├── database/
│   └── migrations/                # SQL migrations
└── docs/                          # Documentation
```

---

## Database Schema

### Tables: 119 total

**System tables (no RLS):**

- `tenants` - Tenant registry
- `features` - Feature definitions
- `plans` - Subscription plans

**Tenant tables (RLS enabled, 95 tables):**

- `users` - User accounts
- `departments` - Organization structure
- `teams` - Team assignments
- `documents` - File metadata
- `calendar_events` - Scheduling
- `chat_conversations` / `chat_messages`
- `blackboard_entries` - Announcements
- `kvp_suggestions` - Improvement ideas
- `shifts` / `shift_assignments`
- `surveys` / `survey_responses`
- And 80+ more...

### Key Fields

| Field        | Type        | Description                                 |
| ------------ | ----------- | ------------------------------------------- |
| `id`         | SERIAL      | Primary key                                 |
| `tenant_id`  | INTEGER     | Tenant reference                            |
| `is_active`  | SMALLINT    | 0=inactive, 1=active, 3=archived, 4=deleted |
| `created_at` | TIMESTAMPTZ | Creation timestamp                          |
| `updated_at` | TIMESTAMPTZ | Last modification                           |

---

## Security Architecture

### Layers

```
1. Network      → HTTPS, CORS, Rate limiting
2. Gateway      → Helmet headers, request size limits
3. Auth         → JWT validation, role check
4. Tenant       → RLS policy enforcement
5. Validation   → Zod schema validation
6. Database     → Parameterized queries ($1, $2, $3)
```

### Implemented Measures

| Measure           | Implementation                  |
| ----------------- | ------------------------------- |
| SQL Injection     | Parameterized queries           |
| XSS               | Input sanitization, CSP headers |
| CSRF              | SameSite cookies                |
| Tenant Isolation  | PostgreSQL RLS                  |
| Rate Limiting     | Redis-based per IP/user         |
| Password Security | bcrypt (cost 12)                |

---

## Docker Setup

### Containers

| Container       | Image          | Port | Purpose            |
| --------------- | -------------- | ---- | ------------------ |
| assixx-backend  | Node 24 Alpine | 3000 | API + static files |
| assixx-postgres | PostgreSQL 17  | 5432 | Database           |
| assixx-redis    | Redis 7 Alpine | 6379 | Sessions, cache    |

### Development

```bash
cd docker
docker-compose up -d
docker-compose ps
curl http://localhost:3000/health
```

### Volumes

```yaml
volumes:
  postgres_data: # Database files
  redis_data: # Redis persistence
  uploads: # User uploads
```

---

## Performance

### Current Optimizations

- Connection pooling (PostgreSQL)
- Redis caching for sessions
- Vite build optimization
- Lazy loading in frontend
- Database indexes

### Database Indexes

All foreign keys and commonly queried fields are indexed:

- `tenant_id` on all tenant tables
- `user_id` on user-related tables
- `created_at` for time-based queries
- Composite indexes for common joins

---

## References

- [CODE-OF-CONDUCT.md](./CODE-OF-CONDUCT.md) - Development standards
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md) - Code standards
- [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md) - PostgreSQL + RLS
- [PROJEKTSTRUKTUR.md](./PROJEKTSTRUKTUR.md) - Detailed structure
