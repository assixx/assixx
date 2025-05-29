# 🔄 TypeScript Migration - Praktisches Beispiel

## Beispiel: auth.service.js → auth.service.ts

### Original (CommonJS + JavaScript):

```javascript
// backend/src/services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const AdminLog = require('../models/adminLog');

class AuthService {
  async authenticateUser(username, password, subdomain = null) {
    try {
      const user = await User.findByUsername(username, subdomain);
      
      if (!user || !user.is_active) {
        return { success: false, user: null };
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        return { success: false, user: null };
      }

      return { 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          tenantId: user.tenant_id
        }
      };
    } catch (error) {
      console.error('Auth error:', error);
      return { success: false, user: null, error: error.message };
    }
  }

  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();
```

### Schritt 1: Type Definitions erstellen

```typescript
// backend/src/types/auth.types.ts
export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'employee' | 'root';
  tenantId: number | null;
}

export interface AuthResult {
  success: boolean;
  user: AuthUser | null;
  error?: string;
}

export interface DatabaseUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  tenant_id: number | null;
  is_active: boolean;
  created_at: Date;
}
```

### Schritt 2: Migrierte TypeScript Version:

```typescript
// backend/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user';
import { AdminLog } from '../models/adminLog';
import { AuthUser, AuthResult, DatabaseUser } from '../types/auth.types';

class AuthService {
  /**
   * Authentifiziert einen Benutzer mit Username und Passwort
   */
  async authenticateUser(
    username: string, 
    password: string, 
    subdomain: string | null = null
  ): Promise<AuthResult> {
    try {
      const user: DatabaseUser | null = await User.findByUsername(username, subdomain);
      
      if (!user || !user.is_active) {
        return { success: false, user: null };
      }

      const isValid: boolean = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        await this.logFailedAttempt(username, subdomain);
        return { success: false, user: null };
      }

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        role: user.role as AuthUser['role'],
        tenantId: user.tenant_id
      };

      return { 
        success: true, 
        user: authUser
      };
    } catch (error) {
      console.error('Auth error:', error);
      return { 
        success: false, 
        user: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generiert ein JWT Token für den authentifizierten Benutzer
   */
  generateToken(user: AuthUser): string {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    return jwt.sign(
      { 
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      },
      secret,
      { expiresIn: '24h' }
    );
  }

  /**
   * Protokolliert fehlgeschlagene Login-Versuche
   */
  private async logFailedAttempt(
    username: string, 
    subdomain: string | null
  ): Promise<void> {
    try {
      await AdminLog.create({
        action: 'LOGIN_FAILED',
        details: { username, subdomain },
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log attempt:', error);
    }
  }

  /**
   * Verifiziert ein JWT Token
   */
  verifyToken(token: string): AuthUser | null {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    try {
      const decoded = jwt.verify(token, secret) as AuthUser;
      return decoded;
    } catch {
      return null;
    }
  }
}

// Singleton Export (wie vorher)
export default new AuthService();

// Named Export für Testing
export { AuthService };
```

### Schritt 3: Tests anpassen

```typescript
// backend/tests/unit/services/auth.service.test.ts
import { AuthService } from '../../../src/services/auth.service';
import { AuthUser, AuthResult } from '../../../src/types/auth.types';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('authenticateUser', () => {
    it('should authenticate valid user', async () => {
      const result: AuthResult = await authService.authenticateUser(
        'testuser',
        'password123',
        'test-tenant'
      );

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.role).toMatch(/^(admin|employee|root)$/);
    });
  });
});
```

## 🎯 Migration Checkliste für JEDE Datei:

1. **Types definieren**
   - [ ] Input Parameter Types
   - [ ] Return Types  
   - [ ] Interface für Datenbank-Objekte

2. **Code migrieren**
   - [ ] require → import
   - [ ] Type Annotations hinzufügen
   - [ ] Error Handling typisieren
   - [ ] any vermeiden

3. **Verbesserungen**
   - [ ] Null-Checks mit TypeScript
   - [ ] Enum statt String-Literale
   - [ ] Private Methods kennzeichnen

4. **Testing**
   - [ ] Unit Tests laufen
   - [ ] Type Coverage prüfen
   - [ ] Build erfolgreich

## 🚀 Erste Schritte:

```bash
# 1. Feature Branch erstellen
git checkout -b feature/typescript-migration

# 2. TypeScript installieren
npm install --save-dev typescript @types/node

# 3. tsconfig.json erstellen
npx tsc --init

# 4. Erste Datei migrieren
mv backend/src/services/auth.service.js backend/src/services/auth.service.ts

# 5. Types hinzufügen und anpassen

# 6. Testen
npm run dev:ts
```