# API v2 Frontend Migration - Detailed Implementation Guide

## 🎯 Overview

Schritt-für-Schritt Anleitung für die sichere Migration aller Frontend API-Aufrufe von v1 zu v2.

## ⚡ TL;DR - Migration in 5 Minuten

```bash
# 1. API Client erstellen
cp docs/api/api-client.ts frontend/src/utils/

# 2. Feature Flags aktivieren
echo 'window.FEATURE_FLAGS = { USE_API_V2_AUTH: true };' > frontend/public/feature-flags.js

# 3. Auth.ts anpassen (siehe Beispiel unten)
# 4. Testen
# 5. Nächste API
```

## 📁 Migration Reihenfolge (NEUE LOGIK!)

### 🔴 Phase 1: Signup (VOR ALLEM ANDEREN!)

1. **signup.html** - Tenant Registration
   ```
   WARUM ZUERST: Ohne Signup keine neuen Tenants!
   ZEITAUFWAND: 1-2 Stunden
   RISIKO: Mittel - Nur für neue Registrierungen
   TEST: Neuen Tenant anlegen und verifizieren
   ```

### 🔴 Phase 2: Authentication Core

1. **api.service.ts** - Zentraler API Client
   ```
   WARUM: Basis für ALLE anderen API Calls
   ZEITAUFWAND: 1-2 Stunden
   RISIKO: Sehr hoch - Fehler = Nichts funktioniert
   ```

2. **common.ts** - Shared Utilities
   ```
   WARUM: Wird von fast allen Files verwendet
   ZEITAUFWAND: 1-2 Stunden
   RISIKO: Hoch
   ```

3. **auth.ts** - Login/Logout/Token Management
   ```
   WARUM: Ohne Auth kommt niemand rein
   ZEITAUFWAND: 2-3 Stunden
   RISIKO: Kritisch - Fehler = Niemand kann sich einloggen
   ```

4. **login.html** - Login Page
   ```
   WARUM: Login UI muss mit neuem auth.ts funktionieren
   ZEITAUFWAND: 1 Stunde
   RISIKO: Mittel
   ```

### 🟡 Phase 2: Feature APIs (Nach Phase 1 stabil)

4. **documents.ts** - File Management
5. **blackboard.ts** - Announcements  
6. **calendar.ts** - Event Management
7. **chat.ts** - Messaging System
8. **shifts.ts** - Shift Planning

### 🟢 Phase 3: Admin APIs (Zuletzt)

9. **admin-dashboard.ts**
10. **manage-admins.ts**
11. **department-groups.ts**
12. **reports.ts**

## 🔧 Implementation Details

### 1. VEREINFACHTER API Client (Copy & Paste ready!)

**WICHTIG:** Dieser Client macht automatisches Fallback zu v1 bei Fehlern!

Create `frontend/src/utils/api-client.ts`:

```typescript
interface ApiConfig {
  version: 'v1' | 'v2';
  useAuth?: boolean;
  contentType?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

export class ApiClient {
  private static instance: ApiClient;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private version: 'v1' | 'v2' = 'v2';

  private constructor() {
    this.loadTokens();
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private loadTokens() {
    this.token = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setVersion(version: 'v1' | 'v2') {
    this.version = version;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    config: ApiConfig = {}
  ): Promise<T> {
    const version = config.version || this.version;
    const baseUrl = version === 'v2' ? '/api/v2' : '/api';
    const url = `${baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': config.contentType || 'application/json',
      ...options.headers,
    };

    // Add auth header for v2
    if (version === 'v2' && config.useAuth !== false && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: version === 'v1' ? 'include' : 'omit',
      });

      // Handle token refresh for v2
      if (version === 'v2' && response.status === 401 && this.refreshToken) {
        await this.refreshAccessToken();
        // Retry request with new token
        headers['Authorization'] = `Bearer ${this.token}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
          credentials: 'omit',
        });
        return this.handleResponse<T>(retryResponse, version);
      }

      return this.handleResponse<T>(response, version);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async handleResponse<T>(
    response: Response,
    version: 'v1' | 'v2'
  ): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      
      if (version === 'v2') {
        const apiResponse = data as ApiResponse<T>;
        if (!apiResponse.success) {
          throw new ApiError(
            apiResponse.error?.message || 'Unknown error',
            apiResponse.error?.code || 'UNKNOWN_ERROR',
            response.status
          );
        }
        return apiResponse.data as T;
      }
      
      // v1 response
      if (!response.ok) {
        throw new ApiError(
          data.message || 'Request failed',
          data.error || 'API_ERROR',
          response.status
        );
      }
      return data as T;
    }

    // Non-JSON response (e.g., file download)
    if (!response.ok) {
      throw new ApiError('Request failed', 'API_ERROR', response.status);
    }
    
    return response as unknown as T;
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await fetch('/api/v2/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.token = data.data.accessToken;
      this.refreshToken = data.data.refreshToken;
      
      localStorage.setItem('accessToken', this.token);
      localStorage.setItem('refreshToken', this.refreshToken);
    } catch (error) {
      // Refresh failed, redirect to login
      this.clearTokens();
      window.location.href = '/login';
    }
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private handleError(error: any): Error {
    if (error instanceof ApiError) {
      return error;
    }
    return new ApiError(
      error.message || 'Network error',
      'NETWORK_ERROR',
      0
    );
  }

  // Convenience methods
  async get<T = any>(endpoint: string, config?: ApiConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, config);
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: ApiConfig
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: ApiConfig
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async delete<T = any>(endpoint: string, config?: ApiConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, config);
  }

  async upload<T = any>(
    endpoint: string,
    formData: FormData,
    config?: ApiConfig
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: formData,
      },
      { ...config, contentType: undefined } // Let browser set content-type
    );
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();
```

### 2. Response Adapter Implementation

Create `frontend/src/utils/response-adapter.ts`:

```typescript
// Maps v1 snake_case to v2 camelCase
export class ResponseAdapter {
  static toV2Format(v1Data: any): any {
    if (Array.isArray(v1Data)) {
      return v1Data.map(item => this.toV2Format(item));
    }
    
    if (v1Data !== null && typeof v1Data === 'object') {
      const converted: any = {};
      
      for (const [key, value] of Object.entries(v1Data)) {
        const camelKey = this.snakeToCamel(key);
        converted[camelKey] = this.toV2Format(value);
      }
      
      return converted;
    }
    
    return v1Data;
  }

  static toV1Format(v2Data: any): any {
    if (Array.isArray(v2Data)) {
      return v2Data.map(item => this.toV1Format(item));
    }
    
    if (v2Data !== null && typeof v2Data === 'object') {
      const converted: any = {};
      
      for (const [key, value] of Object.entries(v2Data)) {
        const snakeKey = this.camelToSnake(key);
        converted[snakeKey] = this.toV1Format(value);
      }
      
      return converted;
    }
    
    return v2Data;
  }

  private static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
```

### 3. Feature Flag System

Create `frontend/src/utils/feature-flags.ts`:

```typescript
export const FEATURE_FLAGS = {
  // API Version Flags
  USE_API_V2_AUTH: false,
  USE_API_V2_USERS: false,
  USE_API_V2_CALENDAR: false,
  USE_API_V2_CHAT: false,
  USE_API_V2_DOCUMENTS: false,
  USE_API_V2_BLACKBOARD: false,
  USE_API_V2_SHIFTS: false,
  USE_API_V2_KVP: false,
  USE_API_V2_DEPARTMENTS: false,
  USE_API_V2_TEAMS: false,
  USE_API_V2_SURVEYS: false,
  USE_API_V2_ADMIN: false,
  USE_API_V2_REPORTS: false,

  // Global flag to enable all v2 APIs
  USE_API_V2_GLOBAL: false,
};

export function isV2Enabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS.USE_API_V2_GLOBAL || FEATURE_FLAGS[feature];
}

// Load feature flags from server or localStorage
export async function loadFeatureFlags() {
  try {
    // Try to load from server
    const response = await fetch('/api/v2/features/my-features');
    if (response.ok) {
      const data = await response.json();
      // Update flags based on server response
      data.data?.forEach((feature: any) => {
        const flagKey = `USE_API_V2_${feature.code.toUpperCase()}`;
        if (flagKey in FEATURE_FLAGS) {
          (FEATURE_FLAGS as any)[flagKey] = feature.isActive;
        }
      });
    }
  } catch (error) {
    // Fallback to localStorage
    const savedFlags = localStorage.getItem('featureFlags');
    if (savedFlags) {
      Object.assign(FEATURE_FLAGS, JSON.parse(savedFlags));
    }
  }
}

// Save flags to localStorage for offline access
export function saveFeatureFlags() {
  localStorage.setItem('featureFlags', JSON.stringify(FEATURE_FLAGS));
}
```

### 4. KONKRETE Migration Examples

#### 🔴 KRITISCH: auth.ts Migration (GENAU SO MACHEN!)

```typescript
// frontend/src/utils/auth.ts

// SCHRITT 1: Import hinzufügen (ganz oben)
import { apiClient } from './api-client';

// SCHRITT 2: Login Function ersetzen
export async function login(email: string, password: string) {
  try {
    const response = await apiClient.post('/auth/login', {
      email,
      password
    });
    
    // WICHTIG: v2 Response Format ist anders!
    if (window.FEATURE_FLAGS?.USE_API_V2_AUTH) {
      // v2: Tokens speichern
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    // WICHTIG: Fehlermeldung anzeigen
    alert('Login fehlgeschlagen: ' + error.message);
    throw error;
  }
}

// SCHRITT 3: Logout Function ersetzen  
export async function logout() {
  try {
    await apiClient.post('/auth/logout');
    
    // Tokens löschen bei v2
    if (window.FEATURE_FLAGS?.USE_API_V2_AUTH) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
    
    window.location.href = '/login';
  } catch (error) {
    // Bei Logout-Fehler trotzdem ausloggen
    console.error('Logout error:', error);
    window.location.href = '/login';
  }
}

// SCHRITT 4: Auth Check Function
export function isAuthenticated() {
  if (window.FEATURE_FLAGS?.USE_API_V2_AUTH) {
    // v2: Token prüfen
    return !!localStorage.getItem('accessToken');
  } else {
    // v1: Cookie wird vom Browser gehandelt
    return true; // Muss server-seitig geprüft werden
  }
}

// SCHRITT 5: Get Current User
export function getCurrentUser() {
  if (window.FEATURE_FLAGS?.USE_API_V2_AUTH) {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } else {
    // v1: Muss vom Server geholt werden
    return apiClient.get('/auth/me');
  }
}
```

#### ✅ TEST CHECKLIST für Auth Migration:

```javascript
// Browser Console Tests:

// 1. Login Test
await login('admin@test.com', 'password');
// Prüfen: localStorage.getItem('accessToken') // sollte Token zeigen

// 2. API Call Test  
await apiClient.get('/users/me');
// Prüfen: Network Tab -> Authorization Header vorhanden?

// 3. Logout Test
await logout();
// Prüfen: localStorage.getItem('accessToken') // sollte null sein

// 4. Protected Route Test
// Navigiere zu geschützter Seite - sollte funktionieren
```

#### blackboard.ts Migration

```typescript
// Before (v1)
async function loadAnnouncements() {
  const response = await fetch('/api/blackboard', {
    credentials: 'include'
  });
  const announcements = await response.json();
  displayAnnouncements(announcements);
}

// After (v2)
import { apiClient } from '../utils/api-client';
import { isV2Enabled } from '../utils/feature-flags';
import { ResponseAdapter } from '../utils/response-adapter';

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  attachments: any[];
  createdAt: string;
  updatedAt: string;
}

async function loadAnnouncements() {
  try {
    let announcements: Announcement[];
    
    if (isV2Enabled('USE_API_V2_BLACKBOARD')) {
      // v2 API with typing
      announcements = await apiClient.get<Announcement[]>('/blackboard');
    } else {
      // v1 API with adaptation
      const response = await fetch('/api/blackboard', {
        credentials: 'include'
      });
      const v1Data = await response.json();
      announcements = ResponseAdapter.toV2Format(v1Data);
    }
    
    displayAnnouncements(announcements);
  } catch (error) {
    console.error('Failed to load announcements:', error);
    showErrorMessage('Ankündigungen konnten nicht geladen werden');
  }
}

async function createAnnouncement(data: Partial<Announcement>) {
  try {
    if (isV2Enabled('USE_API_V2_BLACKBOARD')) {
      const announcement = await apiClient.post<Announcement>(
        '/blackboard',
        data
      );
      showSuccessMessage('Ankündigung erstellt');
      return announcement;
    } else {
      // v1 API
      const v1Data = ResponseAdapter.toV1Format(data);
      const response = await fetch('/api/blackboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(v1Data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create announcement');
      }
      
      const result = await response.json();
      return ResponseAdapter.toV2Format(result);
    }
  } catch (error) {
    console.error('Failed to create announcement:', error);
    throw error;
  }
}
```

### 5. Progressive Migration Strategy

```typescript
// frontend/src/utils/migration-helper.ts

export class MigrationHelper {
  private static migrationStatus: Record<string, boolean> = {};

  static async checkMigrationStatus() {
    try {
      const response = await fetch('/api/v2/features/my-features');
      if (response.ok) {
        const data = await response.json();
        data.data?.forEach((feature: any) => {
          if (feature.code.startsWith('API_V2_')) {
            this.migrationStatus[feature.code] = feature.isActive;
          }
        });
      }
    } catch (error) {
      console.warn('Could not check migration status:', error);
    }
  }

  static isApiMigrated(apiName: string): boolean {
    return this.migrationStatus[`API_V2_${apiName.toUpperCase()}`] || false;
  }

  static async migrateApiCall<T>(
    v1Call: () => Promise<T>,
    v2Call: () => Promise<T>,
    apiName: string
  ): Promise<T> {
    if (this.isApiMigrated(apiName)) {
      try {
        return await v2Call();
      } catch (error) {
        console.error(`v2 API call failed, falling back to v1:`, error);
        return await v1Call();
      }
    }
    return await v1Call();
  }
}
```

## 📋 Migration Checklist per File

### auth.ts
- [ ] Import API client
- [ ] Update login endpoint
- [ ] Update logout endpoint  
- [ ] Add token management
- [ ] Update refresh logic
- [ ] Add error handling
- [ ] Test with feature flag

### common.ts
- [ ] Replace base fetch calls
- [ ] Add API version detection
- [ ] Update error handling
- [ ] Add response adaptation
- [ ] Update type definitions

### admin-dashboard.ts
- [ ] Update stats endpoints
- [ ] Adapt response format
- [ ] Update chart data mapping
- [ ] Add pagination support
- [ ] Update filters

### blackboard.ts
- [ ] Update CRUD endpoints
- [ ] Add priority support
- [ ] Implement tag filtering
- [ ] Update attachment handling
- [ ] Add confirmation tracking

### calendar.ts
- [ ] Update event endpoints
- [ ] Add recurrence support
- [ ] Update RSVP handling
- [ ] Implement ICS export
- [ ] Add visibility scopes

### chat.ts
- [ ] Update message endpoints
- [ ] Implement WebSocket v2
- [ ] Update file attachments
- [ ] Add presence status
- [ ] Update typing indicators

### documents.ts
- [ ] Update upload endpoint
- [ ] Add tag support
- [ ] Update download logic
- [ ] Implement preview
- [ ] Add quota tracking

### shifts.ts
- [ ] Update shift endpoints
- [ ] Add template support
- [ ] Update swap requests
- [ ] Add overtime tracking
- [ ] Implement CSV export

## 🧪 Testing Strategy

### Unit Tests
```typescript
// frontend/src/__tests__/api-client.test.ts
describe('ApiClient', () => {
  it('should handle v2 responses correctly', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 1, name: 'Test' }
      })
    });

    const result = await apiClient.get('/test');
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  it('should handle v2 errors correctly', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found'
        }
      })
    });

    await expect(apiClient.get('/test')).rejects.toThrow(ApiError);
  });
});
```

### Integration Tests
```typescript
// frontend/src/__tests__/auth.integration.test.ts
describe('Auth Integration', () => {
  beforeEach(() => {
    // Reset feature flags
    FEATURE_FLAGS.USE_API_V2_AUTH = true;
  });

  it('should login with v2 API', async () => {
    const mockResponse = {
      accessToken: 'token123',
      refreshToken: 'refresh123',
      user: { id: 1, email: 'test@example.com' }
    };

    // Mock API call
    jest.spyOn(apiClient, 'post').mockResolvedValue(mockResponse);

    const result = await login('test@example.com', 'password');
    
    expect(result).toEqual(mockResponse);
    expect(localStorage.getItem('accessToken')).toBe('token123');
  });
});
```

## 🚀 Deployment Considerations

### Environment Variables
```javascript
// frontend/src/config/environment.ts
export const config = {
  API_VERSION: process.env.REACT_APP_API_VERSION || 'v2',
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '/api',
  ENABLE_V2_MIGRATION: process.env.REACT_APP_ENABLE_V2_MIGRATION === 'true',
  MIGRATION_ROLLOUT_PERCENTAGE: parseInt(
    process.env.REACT_APP_MIGRATION_ROLLOUT_PERCENTAGE || '0'
  ),
};
```

### Build Configuration
```json
// package.json
{
  "scripts": {
    "build:v1": "REACT_APP_API_VERSION=v1 npm run build",
    "build:v2": "REACT_APP_API_VERSION=v2 npm run build",
    "build:hybrid": "REACT_APP_ENABLE_V2_MIGRATION=true npm run build"
  }
}
```

## 🚨 Troubleshooting Guide

### Die 5 häufigsten Fehler und ihre Lösungen:

#### 1. ❌ "401 Unauthorized" nach Login

```javascript
// PROBLEM: Token wird nicht mitgesendet
// LÖSUNG 1: Prüfe Feature Flag
console.log(window.FEATURE_FLAGS); // USE_API_V2_AUTH sollte true sein

// LÖSUNG 2: Prüfe Token
console.log(localStorage.getItem('accessToken')); // Sollte Token zeigen

// LÖSUNG 3: Prüfe API Client
// In Network Tab: Authorization Header sollte da sein
```

#### 2. ❌ "Cannot read property 'data' of undefined"

```javascript
// PROBLEM: v1 und v2 haben unterschiedliche Response Formate
// v1: { users: [...] }
// v2: { success: true, data: { users: [...] } }

// LÖSUNG: API Client nutzen (macht das automatisch!)
const users = await apiClient.get('/users'); // Funktioniert für beide
```

#### 3. ❌ "CORS blocked"

```javascript
// PROBLEM: Falsche credentials Policy
// LÖSUNG: 
// v1 braucht: credentials: 'include' (für Cookies)
// v2 braucht: credentials: 'omit' (nutzt Bearer Token)
// API Client handelt das automatisch!
```

#### 4. ❌ "Login funktioniert, aber andere APIs nicht"

```javascript
// PROBLEM: Feature Flag nur für Auth aktiviert
// LÖSUNG: Auch andere APIs aktivieren
window.FEATURE_FLAGS.USE_API_V2_USERS = true;
window.FEATURE_FLAGS.USE_API_V2_DOCUMENTS = true;
// etc.
```

#### 5. ❌ "Refresh Token funktioniert nicht"

```javascript
// PROBLEM: Refresh Endpoint falsch
// LÖSUNG: Manuell testen
fetch('/api/v2/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
}).then(r => r.json()).then(console.log);
```

## 🛠️ Debug Utilities

```javascript
// In Browser Console einfügen für Debug Info:

window.debugMigration = {
  // Zeige aktuelle Config
  showConfig() {
    console.log('Feature Flags:', window.FEATURE_FLAGS);
    console.log('Access Token:', localStorage.getItem('accessToken'));
    console.log('User:', localStorage.getItem('user'));
  },
  
  // Test API Call
  async testApi(endpoint) {
    try {
      const result = await apiClient.get(endpoint);
      console.log('Success:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  },
  
  // Force v1
  forceV1() {
    Object.keys(window.FEATURE_FLAGS).forEach(key => {
      window.FEATURE_FLAGS[key] = false;
    });
    location.reload();
  },
  
  // Force v2
  forceV2() {
    Object.keys(window.FEATURE_FLAGS).forEach(key => {
      window.FEATURE_FLAGS[key] = true;
    });
    location.reload();
  }
};

console.log('Debug utilities loaded! Try: debugMigration.showConfig()');
```

## 📞 Support & Hilfe

### Bei Problemen:

1. **Zuerst:** `debugMigration.showConfig()` in Console
2. **Dann:** Network Tab prüfen (401? 500? CORS?)
3. **Notfall:** `window.emergencyRollback()` ausführen

### Slack Channel: #api-v2-migration

---

**Document Version:** 2.0  
**Last Updated:** 03.08.2025  
**Author:** Frontend Migration Team  
**Status:** READY FOR IMPLEMENTATION