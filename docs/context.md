# Tech Stack Context

**NOW USING:**

- API V2 (no V1 fallback)
- PostgreSQL 17.7 + `pg` library v8.16.3
- `uuid` v13.0.0 (UUIDv7 everywhere - DB records AND files)
- `is_active` INTEGER status: `0`=inactive, `1`=active, `3`=archive, `4`=deleted (soft delete)

---

## Development Commands

```bash
# Frontend Development (HMR)
pnpm run dev:svelte           # http://localhost:5173

# Production Build + Docker
cd docker && docker-compose --profile production up -d  # http://localhost

# Rebuild Frontend Container
docker-compose --profile production build frontend
docker-compose --profile production up -d --build frontend

# Validate Frontend
cd frontend && pnpm run validate
```

## Docker Containers

| Container              | Port | Purpose             |
| ---------------------- | ---- | ------------------- |
| assixx-postgres        | 5432 | PostgreSQL Database |
| assixx-redis           | 6379 | Cache/Sessions      |
| assixx-backend         | 3000 | NestJS API          |
| assixx-frontend        | 3001 | SvelteKit SSR       |
| assixx-nginx           | 80   | Reverse Proxy       |
| assixx-deletion-worker | -    | Background Jobs     |

---

## BACKEND API (NestJS)

### Controllers (API Endpoints)

| Controller                      | Path                      | Purpose                  |
| ------------------------------- | ------------------------- | ------------------------ |
| auth.controller.ts              | /api/v2/auth              | Login, Logout, Refresh   |
| users.controller.ts             | /api/v2/users             | User CRUD                |
| root.controller.ts              | /api/v2/root              | Root User Management     |
| signup.controller.ts            | /api/v2/signup            | Registration             |
| departments.controller.ts       | /api/v2/departments       | Department CRUD          |
| teams.controller.ts             | /api/v2/teams             | Team CRUD                |
| areas.controller.ts             | /api/v2/areas             | Area CRUD                |
| machines.controller.ts          | /api/v2/machines          | Machine CRUD             |
| roles.controller.ts             | /api/v2/roles             | Role Management          |
| role-switch.controller.ts       | /api/v2/role-switch       | Role Switching           |
| blackboard.controller.ts        | /api/v2/blackboard        | Blackboard Entries       |
| calendar.controller.ts          | /api/v2/calendar          | Calendar Events          |
| chat.controller.ts              | /api/v2/chat              | Chat/Messages            |
| documents.controller.ts         | /api/v2/documents         | Document Upload/Download |
| kvp.controller.ts               | /api/v2/kvp               | KVP Suggestions          |
| shifts.controller.ts            | /api/v2/shifts            | Shift Plans              |
| rotation.controller.ts          | /api/v2/rotation          | Shift Rotations          |
| surveys.controller.ts           | /api/v2/surveys           | Survey CRUD              |
| features.controller.ts          | /api/v2/features          | Feature Flags            |
| plans.controller.ts             | /api/v2/plans             | Subscription Plans       |
| settings.controller.ts          | /api/v2/settings          | App Settings             |
| logs.controller.ts              | /api/v2/logs              | Audit Logs               |
| reports.controller.ts           | /api/v2/reports           | Report Generation        |
| notifications.controller.ts     | /api/v2/notifications     | Push Notifications       |
| admin-permissions.controller.ts | /api/v2/admin-permissions | Permission Management    |
| audit-trail.controller.ts       | /api/v2/audit-trail       | Audit Trail              |

### Services (Business Logic)

```
backend/src/nest/
  auth/auth.service.ts              # JWT, Login Logic
  users/users.service.ts            # User CRUD
  root/root.service.ts              # Root User Logic
  signup/signup.service.ts          # Registration Logic
  departments/departments.service.ts
  teams/teams.service.ts
  areas/areas.service.ts
  machines/machines.service.ts
  roles/roles.service.ts
  role-switch/role-switch.service.ts
  blackboard/blackboard.service.ts
  calendar/calendar.service.ts
  chat/chat.service.ts              # + WebSocket
  documents/documents.service.ts
  kvp/kvp.service.ts
  shifts/shifts.service.ts
  shifts/rotation.service.ts
  surveys/surveys.service.ts
  features/features.service.ts
  plans/plans.service.ts
  settings/settings.service.ts
  logs/logs.service.ts
  reports/reports.service.ts
  notifications/notifications.service.ts
  admin-permissions/admin-permissions.service.ts
  audit-trail/audit-trail.service.ts
  config/config.service.ts          # Environment Config
  database/database.service.ts      # DB Connection
```

### Common Code

```
backend/src/nest/common/
  decorators/
    public.decorator.ts     # @Public() - skip auth
    roles.decorator.ts      # @Roles('admin')
  guards/
    jwt-auth.guard.ts       # JWT Validation
    roles.guard.ts          # Role-based Access
  filters/
    http-exception.filter.ts
  interceptors/
    logging.interceptor.ts
  pipes/
    zod-validation.pipe.ts  # Zod Schema Validation
  interfaces/
    multer.interface.ts     # File Upload Types
```

---

## FRONTEND (SvelteKit)

### Pages (routes)

| Route       | Page                    | Purpose               |
| ----------- | ----------------------- | --------------------- |
| /           | +page.svelte            | Redirect to Dashboard |
| /login      | login/+page.svelte      | Login Form            |
| /signup     | signup/+page.svelte     | Registration          |
| /rate-limit | rate-limit/+page.svelte | Rate Limit Error      |

### App Routes (authenticated)

| Route                   | Purpose           | Components               |
| ----------------------- | ----------------- | ------------------------ |
| /admin-dashboard        | Admin Home        | Stats, Quick Actions     |
| /employee-dashboard     | Employee Home     | Tasks, Notifications     |
| /root-dashboard         | Root Home         | Tenant Overview          |
| /admin-profile          | Admin Profile     | Edit Profile             |
| /employee-profile       | Employee Profile  | Edit Profile             |
| /root-profile           | Root Profile      | Edit Profile             |
| /account-settings       | Settings          | Password, Preferences    |
| /manage-employees       | Employee CRUD     | Table, Form Modal        |
| /manage-admins          | Admin CRUD        | Table, Form Modal        |
| /manage-teams           | Team CRUD         | Table, Form Modal        |
| /manage-departments     | Dept CRUD         | Table, Form Modal        |
| /manage-areas           | Area CRUD         | Table, Form Modal        |
| /manage-machines        | Machine CRUD      | Table, Form Modal        |
| /manage-root            | Root User CRUD    | Table, Form Modal        |
| /blackboard             | Announcements     | List, Entry Modal        |
| /blackboard/[uuid]      | Entry Detail      | Comments, Reactions      |
| /calendar               | Calendar          | FullCalendar, Events     |
| /chat                   | Messaging         | Conversations, WebSocket |
| /documents-explorer     | File Manager      | Upload, Preview          |
| /kvp                    | KVP List          | Suggestions              |
| /kvp-detail             | KVP Detail        | Comments, Status         |
| /shifts                 | Shift Planning    | Grid, Drag-Drop          |
| /survey-admin           | Survey Management | Create, Edit             |
| /survey-employee        | Answer Surveys    | Survey Form              |
| /survey-results         | Survey Results    | Charts                   |
| /features               | Feature Toggle    | Enable/Disable           |
| /logs                   | Audit Logs        | Filter, Search           |
| /storage-upgrade        | Storage Plans     | Upgrade Options          |
| /tenant-deletion-status | Deletion Status   | Progress                 |

### Page Module Structure (\_lib/)

Each page has a `_lib/` folder with:

```
_lib/
  api.ts          # API calls for this page
  types.ts        # TypeScript interfaces
  constants.ts    # Constants, enums
  utils.ts        # Helper functions
  filters.ts      # Filter/search logic (if needed)
  handlers.ts     # Event handlers (if complex)
  state.svelte.ts # Svelte 5 state ($state)
  *.svelte        # Sub-components (Modals, etc.)
```

### Shared Code (lib/)

```
frontend/src/lib/
  utils/
    api-client.ts       # Fetch wrapper with auth
    token-manager.ts    # JWT storage/refresh
    session-manager.ts  # Session handling
    auth.ts             # Auth utilities
    alerts.ts           # Alert/notification helpers
    avatar-helpers.ts   # Avatar URL generation
    date-helpers.ts     # Date formatting
    jwt-utils.ts        # JWT decode
    password-strength.ts # Password validation
    sanitize-html.ts    # XSS prevention
    user-service.ts     # User data helpers
  types/
    api.types.ts        # API response types
    utils.types.ts      # Utility types
  stores/
    toast.js            # Toast notifications
  components/
    Breadcrumb.svelte   # Navigation breadcrumb
    RoleSwitch.svelte   # Role switcher
    ToastContainer.svelte # Toast display
```

### Design System

```
frontend/src/design-system/
  tokens/
    colors.css, shadows.css, animations.css, gradients.css
  primitives/
    buttons/      # btn-primary, btn-danger, etc.
    badges/       # badge-status, badge-role, etc.
    cards/        # card-base, card-stat, card-accent
    forms/        # form-base, multi-select
    modals/       # modal-base
    feedback/     # alert, toast, spinner, skeleton
    navigation/   # tabs, breadcrumb, pagination
    data-display/ # tables, empty-state
    toggles/      # toggle-switch, button-group
    dropdowns/    # custom-dropdown
    file-upload/  # upload-zone, upload-list
    pickers/      # date-picker, time-picker
    tooltip/      # tooltip
```

### Page Styles

```
frontend/src/styles/
  admin-dashboard.css
  employee-dashboard.css
  root-dashboard.css
  *-profile.css
  manage-*.css
  blackboard.css
  calendar.css
  chat.css
  documents-explorer.css
  kvp.css, kvp-detail.css
  shifts.css
  survey-*.css
  features.css
  logs.css
  login.css
  signup.css
```

---

## User Roles

| Role     | Scope         | Access                          |
| -------- | ------------- | ------------------------------- |
| root     | System-wide   | All tenants, system config      |
| admin    | Tenant-scoped | Manage tenant users/data        |
| employee | Tenant-scoped | Self-service, assigned features |

## Multi-Tenant Architecture

- Every DB table has `tenant_id` column
- User isolation: employees see only their tenant's data
- Admins manage their own tenant
- Root users can access all tenants

---

## Key Files

### Configuration

- `docker/docker-compose.yml` - Docker services
- `docker/.env` - Environment variables
- `backend/src/nest/config/config.service.ts` - Config access
- `frontend/svelte.config.js` - SvelteKit config
- `frontend/vite.config.ts` - Vite config
- `eslint.config.js` - ESLint rules

### Entry Points

- `backend/src/main.ts` - NestJS bootstrap
- `frontend/src/app.html` - HTML template
- `frontend/src/hooks.server.ts` - Server hooks (auth)
- `frontend/src/routes/(app)/+layout.server.ts` - Auth check
- `frontend/src/routes/(app)/+layout.svelte` - App shell (sidebar, header)

### Database

- `database/migrations/` - SQL migrations
- `database/schema/` - Schema definitions
