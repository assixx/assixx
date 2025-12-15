# 📝 FEATURE FLAGS CODE TRANSFORMATION EXAMPLES

> Real examples from the codebase showing exactly how to transform each pattern

## Pattern 1: Simple useV2 Declaration

### ❌ BEFORE (with feature flag)
```typescript
// File: frontend/src/scripts/admin/dashboard/services.ts
const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
const endpoint = useV2 ? '/api/v2/users' : '/api/users';
const response = await fetch(endpoint, options);
```

### ✅ AFTER (v2 only)
```typescript
// File: frontend/src/scripts/admin/dashboard/services.ts
const endpoint = '/api/v2/users';
const response = await fetch(endpoint, options);
```

## Pattern 2: Conditional API Path Selection

### ❌ BEFORE
```typescript
// File: frontend/src/scripts/auth/index.ts
export async function login(credentials: LoginCredentials) {
  const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH === true;

  if (useV2) {
    return apiClient.post('/api/v2/auth/login', credentials);
  } else {
    return fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }
}
```

### ✅ AFTER
```typescript
// File: frontend/src/scripts/auth/index.ts
export async function login(credentials: LoginCredentials) {
  return apiClient.post('/api/v2/auth/login', credentials);
}
```

## Pattern 3: Response Structure Handling

### ❌ BEFORE
```typescript
// File: frontend/src/scripts/admin/dashboard/services.ts
const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;
const response = await fetch(endpoint);
const data = await response.json();

if (useV2) {
  // v2 returns { success: true, data: [...] }
  return data.data || [];
} else {
  // v1 returns array directly
  return data;
}
```

### ✅ AFTER
```typescript
// File: frontend/src/scripts/admin/dashboard/services.ts
const response = await fetch(endpoint);
const data = await response.json();
// Always v2 format
return data.data || [];
```

## Pattern 4: Field Name Mapping

### ❌ BEFORE
```typescript
// File: frontend/src/pages/admin-dashboard.html
const firstName = employee.firstName || employee.first_name || '';
const lastName = employee.lastName || employee.last_name || '';
const isActive = employee.isActive ?? employee.is_active;
```

### ✅ AFTER
```typescript
// File: frontend/src/pages/admin-dashboard.html
// v2 always uses camelCase
const firstName = employee.firstName || '';
const lastName = employee.lastName || '';
const isActive = employee.isActive;
```

## Pattern 5: Complex Conditional with Different Logic

### ❌ BEFORE
```typescript
// File: frontend/src/scripts/pages/kvp-api.ts
export class KvpApi {
  private useV2API: boolean;

  constructor() {
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_KVP?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_KVP !== false;
  }

  async getSuggestions() {
    if (this.useV2API) {
      const response = await this.apiClient.get('/api/v2/kvp/suggestions');
      return response.data;
    } else {
      const response = await fetch('/api/kvp');
      return response.json();
    }
  }
}
```

### ✅ AFTER
```typescript
// File: frontend/src/scripts/pages/kvp-api.ts
export class KvpApi {
  // No more useV2API property needed

  constructor() {
    // Constructor simplified
  }

  async getSuggestions() {
    const response = await this.apiClient.get('/api/v2/kvp/suggestions');
    return response.data;
  }
}
```

## Pattern 6: Token Handling

### ❌ BEFORE
```typescript
// File: frontend/src/utils/api-client.ts
const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH === true;
const token = useV2
  ? localStorage.getItem('accessToken')
  : localStorage.getItem('token');
```

### ✅ AFTER
```typescript
// File: frontend/src/utils/api-client.ts
// v2 uses accessToken
const token = localStorage.getItem('accessToken');
```

## Pattern 7: Error Message Handling

### ❌ BEFORE
```javascript
// File: frontend/src/pages/admin-dashboard.html
const errorMessage = window.FEATURE_FLAGS?.USE_API_V2_USERS
  ? errorData.error?.message || errorData.message || 'Status konnte nicht aktualisiert werden'
  : errorData.message || 'Status konnte nicht aktualisiert werden';
```

### ✅ AFTER
```javascript
// File: frontend/src/pages/admin-dashboard.html
// v2 error format
const errorMessage = errorData.error?.message || errorData.message || 'Status konnte nicht aktualisiert werden';
```

## Pattern 8: Removing Import Statements

### ❌ BEFORE
```typescript
// File: frontend/src/scripts/dashboard/common.ts
import { isFeatureEnabled } from '../utils/feature-flags';
import type { FeatureFlags } from '../utils/feature-flags';

export function initDashboard() {
  if (isFeatureEnabled('USE_API_V2_USERS')) {
    loadV2Dashboard();
  } else {
    loadV1Dashboard();
  }
}
```

### ✅ AFTER
```typescript
// File: frontend/src/scripts/dashboard/common.ts
// Remove feature flag imports completely

export function initDashboard() {
  loadV2Dashboard();
}
```

## Pattern 9: URL Construction

### ❌ BEFORE
```typescript
// File: frontend/src/scripts/documents/upload.ts
const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS;
const baseUrl = useV2 ? '/api/v2' : '/api';
const uploadUrl = `${baseUrl}/documents/upload`;
```

### ✅ AFTER
```typescript
// File: frontend/src/scripts/documents/upload.ts
const baseUrl = '/api/v2';
const uploadUrl = `${baseUrl}/documents/upload`;
```

## Pattern 10: HTML Script Tag

### ❌ BEFORE
```html
<!-- File: frontend/src/pages/admin-dashboard.html -->
<head>
  <meta charset="UTF-8">
  <title>Admin Dashboard</title>
  <!-- Feature Flags -->
  <script src="/feature-flags.js"></script>
  <!-- Rest of head -->
</head>
```

### ✅ AFTER
```html
<!-- File: frontend/src/pages/admin-dashboard.html -->
<head>
  <meta charset="UTF-8">
  <title>Admin Dashboard</title>
  <!-- Feature flags removed - all APIs use v2 -->
  <!-- Rest of head -->
</head>
```

## Pattern 11: Window Type Extensions

### ❌ BEFORE
```typescript
// File: frontend/src/types/global.d.ts
declare global {
  interface Window {
    FEATURE_FLAGS?: {
      USE_API_V2_AUTH?: boolean;
      USE_API_V2_USERS?: boolean;
      // ... more flags
    };
    migrationHelpers?: {
      enableApi: (name: string) => void;
      // ... more helpers
    };
  }
}
```

### ✅ AFTER
```typescript
// File: frontend/src/types/global.d.ts
declare global {
  interface Window {
    // Feature flags removed - all APIs use v2
    // Other window properties remain
  }
}
```

## Pattern 12: Test Files

### ❌ BEFORE
```typescript
// File: frontend/src/scripts/__tests__/api-client.test.ts
describe('ApiClient', () => {
  beforeEach(() => {
    window.FEATURE_FLAGS = {
      USE_API_V2_AUTH: true,
      USE_API_V2_USERS: false
    };
  });

  it('should use v2 endpoint when flag is enabled', () => {
    window.FEATURE_FLAGS.USE_API_V2_USERS = true;
    // test v2 behavior
  });

  it('should use v1 endpoint when flag is disabled', () => {
    window.FEATURE_FLAGS.USE_API_V2_USERS = false;
    // test v1 behavior
  });
});
```

### ✅ AFTER
```typescript
// File: frontend/src/scripts/__tests__/api-client.test.ts
describe('ApiClient', () => {
  // No feature flag setup needed

  it('should use v2 endpoint', () => {
    // test v2 behavior only
  });

  // Remove v1 tests completely
});
```

## Common Pitfalls to Avoid

### ⚠️ Don't Leave Empty Conditionals
```typescript
// BAD - Empty if block
if (true) {
  return apiClient.get('/api/v2/users');
}

// GOOD - Remove conditional entirely
return apiClient.get('/api/v2/users');
```

### ⚠️ Don't Forget to Remove Variables
```typescript
// BAD - Unused variable
const useV2 = true; // Always true now
const endpoint = '/api/v2/users';

// GOOD - Remove unused variable
const endpoint = '/api/v2/users';
```

### ⚠️ Don't Keep Fallback Logic
```typescript
// BAD - Keeping unnecessary fallback
const data = response.data || response;

// GOOD - v2 always has consistent structure
const data = response.data;
```

### ⚠️ Don't Mix v1 and v2 Field Names
```typescript
// BAD - Still checking both formats
const name = user.firstName || user.first_name;

// GOOD - v2 uses camelCase consistently
const name = user.firstName;
```

## Verification Checklist

After transforming each file:

- [ ] No references to `FEATURE_FLAGS`
- [ ] No references to `useV2` variables
- [ ] No `/api/` paths without `/v2/`
- [ ] No snake_case field fallbacks
- [ ] No feature-flags.js imports
- [ ] No conditional v1/v2 logic
- [ ] Tests updated to remove v1 scenarios
- [ ] Comments about feature flags removed

## Testing Each Transformation

For each modified file, test:

1. **Build:** `pnpm build` - No TypeScript errors
2. **Lint:** `pnpm lint` - No ESLint warnings
3. **Test:** `pnpm test <file>` - All tests pass
4. **Runtime:** Load the page/feature - Works correctly
5. **Network:** Check DevTools - Only v2 API calls