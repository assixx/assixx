# KVP Migration Context - Complete Reference

## 📚 Gelesene Dokumente für Kontext

### 1. TODO.md (Hauptdokument)

- **Aktuelle Phase:** API-V2-MIGRATION
- **Workflow:**
  1. ZUERST: API-V2-MASTERPLAN-CHECKLIST.md abarbeiten
  2. DANACH: DEAL-BREAKER Features
- **Status:** Bei Phase 7 - KVP System

### 2. API-V2-FRONTEND-MIGRATION-DETAILS.md

#### Key Components

- **API Client:** `/frontend/src/utils/api-client.ts`
- **Feature Flags:** `window.FEATURE_FLAGS.USE_API_V2_KVP`
- **Response Format:** `{ success: true, data: T, meta?: {...} }`
- **Authentication:** JWT Bearer Token in localStorage
- **Error Handling:** ApiError class mit code, message, status

#### Migration Pattern

```typescript
// v1 (alt)
fetch('/api/kvp', { credentials: 'include' })

// v2 (neu)
apiClient.get<KvpData[]>('/kvp')
```

### 3. API-V2-MASTERPLAN-CHECKLIST.md

#### Status

- **Gesamt:** 45.3% abgeschlossen (29/64 Files)
- **Phase 7 - KVP TODO:**
  - [ ] kvp.ts
  - [ ] kvp.html
  - [ ] kvp-detail.ts
  - [ ] kvp-detail.html
- **Kritisch:** NIEMALS abhaken ohne vollständigen Test!

### 4. API-V2-MIGRATION-EXECUTIVE-SUMMARY.md

#### Key Facts

- **Backend:** 27/27 APIs ✅ implementiert
- **KVP API v2:** `/api/v2/kvp/*` READY
- **Breaking Changes:**
  - Cookie-based → JWT Bearer Token
  - snake_case → camelCase
  - Neue Response Struktur

### 5. API-V2-MIGRATION-MASTERPLAN.md

#### KVP Specific

- **v1 Route:** `/api/kvp/*`
- **v2 Route:** `/api/v2/kvp/*`
- **Status:** ✅ Ready
- **Breaking Change:** ROI Tracking hinzugefügt

#### API Response v2 Format

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    version: string;
    pagination?: {...};
  };
}
```

### 6. TYPESCRIPT-STANDARDS.md (KRITISCH!)

#### Absolute Rules

- **NIEMALS** `any` types → use `unknown` + type guards
- **NIEMALS** `||` für defaults → use `??` (nullish coalescing)
- **NIEMALS** Non-null assertions `!`
- **NIEMALS** snake_case → IMMER camelCase
- **NIEMALS** truthy checks → explizit `!== null && !== ""`
- **IMMER** explizite Return Types
- **IMMER** `unknown` in catch callbacks
- **IMMER** typed.auth/body/params wrapper

#### localStorage Pattern

```typescript
// ❌ FALSCH
const token = localStorage.getItem("token");
if (token) { // truthy check

// ✅ RICHTIG
const token = localStorage.getItem("token");
if (token !== null && token !== "") {
```

### 7. CLAUDE.md & CLAUDE.local.md

#### Critical Requirements

- Think step-by-step
- Use TodoWrite for tracking
- Never use `any` or `||`
- Always explicit checks
- Follow TYPESCRIPT-STANDARDS.md 100%
- Use pnpm, camelCase
- Docker for development

## 🎯 KVP Migration Tasks

### Files to Migrate

1. `/frontend/src/scripts/kvp.ts`
2. `/frontend/src/pages/kvp.html`
3. `/frontend/src/scripts/kvp-detail.ts`
4. `/frontend/src/pages/kvp-detail.html`

### Migration Checklist per File

- [ ] Import apiClient
- [ ] Replace all `/api/kvp` with `/api/v2/kvp`
- [ ] Update response handling (v2 format)
- [ ] Convert snake_case to camelCase
- [ ] Add proper TypeScript types (no any!)
- [ ] Fix all `||` to `??`
- [ ] Fix localStorage checks
- [ ] Add error handling with ApiError
- [ ] Test with feature flag
- [ ] Run type-check, lint, format

### Feature Flag

```javascript
window.FEATURE_FLAGS = {
  USE_API_V2_KVP: true  // Enable for testing
};
```

### Testing Commands

```bash
# Type Check
docker exec assixx-backend pnpm run type-check

# Lint
docker exec assixx-backend pnpm run lint

# Format
docker exec assixx-backend pnpm run format

# Build
docker exec assixx-backend pnpm run build
```

## 🔥 Critical Success Factors

1. **NO ANY TYPES** - Use proper interfaces
2. **NO SNAKE_CASE** - All fields must be camelCase
3. **PROPER NULL CHECKS** - Never truthy, always explicit
4. **ERROR HANDLING** - Every API call in try/catch
5. **TYPE SAFETY** - Run type-check before commit
6. **FEATURE FLAGS** - Test incrementally
7. **BACKWARDS COMPATIBILITY** - Fallback to v1 if needed

## 📝 Expected KVP Data Structure (v2)

```typescript
interface KvpSuggestion {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  category: string;
  createdBy: number;
  createdAt: string;  // ISO 8601
  updatedAt: string;
  savings?: number;
  implementationCost?: number;
  roi?: number;  // NEW in v2!
  attachments?: string[];
  comments?: KvpComment[];
  votes?: number;
  isAnonymous?: boolean;
  tenantId: number;
}

interface KvpComment {
  id: number;
  suggestionId: number;
  userId: number;
  content: string;
  createdAt: string;
  userName?: string;
}
```

## 🚨 Common Pitfalls to Avoid

1. **Forgetting Bearer Token**

   ```typescript
   // Always check token exists
   const token = getAuthToken();
   if (token === null || token === "") {
     window.location.href = "/login";
     return;
   }
   ```

2. **Wrong Response Access**

   ```typescript
   // v1: response.suggestions
   // v2: response.data.suggestions or just response (if using apiClient)
   ```

3. **Missing Error Types**

   ```typescript
   catch (error: unknown) {  // NOT any!
     if (error instanceof ApiError) {
       showError(error.message);
     }
   }
   ```

4. **Mixing v1 and v2 Calls**

   ```typescript
   // Use feature flag consistently
   const endpoint = isV2Enabled('USE_API_V2_KVP')
     ? '/kvp'
     : '/kvp';
   ```

## ✅ Definition of Done

- [ ] All 4 files migrated
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] All tests pass
- [ ] Feature flag works
- [ ] Fallback to v1 works
- [ ] Manual test: Create, Read, Update, Delete KVP
- [ ] Manual test: Comments, Votes, Attachments
- [ ] Performance equal or better than v1
- [ ] No console.log statements
- [ ] User approval received

---

**Created:** 2025-08-28
**Purpose:** Complete context for KVP API v2 Migration
**Status:** READY FOR IMPLEMENTATION
