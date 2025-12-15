# Auth Token Security Refactor Plan

**Datum:** 2025-11-26
**Branch:** `lint/refactoring`
**Status:** PLANNING
**Typ:** Security Enhancement

---

## Executive Summary

Dieses Dokument beschreibt den Plan zur Implementierung von **Refresh Token Rotation** und weiteren Security-Enhancements für das Assixx Auth-System.

### Ziel
- Refresh Token Rotation implementieren (Phase 1)
- Token Blacklisting bei Logout (Phase 2)
- Optional: HttpOnly Cookie für Refresh Token (Phase 3)

### Kritische Anforderung
**DAS BESTEHENDE UX-SYSTEM DARF NICHT BESCHÄDIGT WERDEN!**

Folgende Features müssen 100% funktionsfähig bleiben:
- Clock Skew Protection (`tokenReceivedAt`)
- 30-Minuten Token Lifetime
- Proaktiver Refresh bei API-Calls (< 10 min)
- Warning Modal bei < 5 min
- Inaktivitäts-Tracking (25 min Warning, 30 min Logout)
- 1-Sekunden Timer Updates
- Background Polling Blacklist
- Cross-Tab Synchronisation

---

## Phase 1: Refresh Token Rotation

### 1.1 Problem

**Aktuell (`auth.controller.ts:364-369`):**
```typescript
res.json(successResponse({
  accessToken,
  refreshToken,  // ← GLEICHER Token wird zurückgegeben!
}));
```

**Risiko:**
- Gestohlener Refresh Token = 7 Tage uneingeschränkter Zugang
- Keine Möglichkeit, Token-Diebstahl zu erkennen
- Keine Möglichkeit, gestohlene Tokens zu invalidieren

### 1.2 Lösung: Token Family mit Rotation

**Konzept:**
```
Login:
  └─> Neuer Refresh Token (Family: abc-123)
  └─> In DB speichern: {hash: "xxx", family: "abc-123", used: false}

Refresh #1:
  └─> Alten Token als "used" markieren
  └─> NEUEN Refresh Token generieren (Family: abc-123)
  └─> In DB speichern: {hash: "yyy", family: "abc-123", used: false}

Refresh #2:
  └─> Token "yyy" als "used" markieren
  └─> NEUEN Token generieren: {hash: "zzz", family: "abc-123"}

REUSE DETECTION:
  └─> Angreifer versucht Token "xxx" (bereits used!)
  └─> Server erkennt: Token wurde schon benutzt!
  └─> ALLE Tokens der Family "abc-123" werden REVOKED
  └─> Legitimer User muss neu einloggen
  └─> Angreifer ist draußen
```

### 1.3 Datenbank-Schema

**Neue Tabelle: `refresh_tokens`**

```sql
-- =====================================================
-- Migration: Add refresh_tokens table for token rotation
-- Date: 2025-11-26
-- Author: Claude Code
-- Purpose: Enable refresh token rotation with reuse detection
-- =====================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- User & Tenant (Multi-Tenant Isolation!)
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,

    -- Token Identity
    token_hash VARCHAR(64) NOT NULL,           -- SHA-256 Hash (nicht Token selbst!)
    token_family VARCHAR(36) NOT NULL,          -- UUID für Token-Kette

    -- Lifecycle
    expires_at DATETIME NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,

    -- Rotation Tracking
    used_at DATETIME DEFAULT NULL,              -- Wann wurde Token für Refresh benutzt
    replaced_by_hash VARCHAR(64) DEFAULT NULL,  -- Hash des Nachfolger-Tokens

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL,        -- IPv4 oder IPv6
    user_agent VARCHAR(512) DEFAULT NULL,

    -- Indexes
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_tenant (user_id, tenant_id),
    INDEX idx_family (token_family),
    INDEX idx_expires (expires_at),
    INDEX idx_revoked (is_revoked),

    -- Foreign Keys
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cleanup Job: Alte/Abgelaufene Tokens löschen (optional, via Cron)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = TRUE;
```

### 1.4 Backend-Änderungen

#### 1.4.1 Neue Datei: `backend/src/services/refreshToken.service.ts`

```typescript
/**
 * Refresh Token Service
 * Handles token rotation, storage, and reuse detection
 */

import crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { query } from '../utils/db.js';

interface StoredRefreshToken {
  id: number;
  user_id: number;
  tenant_id: number;
  token_hash: string;
  token_family: string;
  expires_at: Date;
  is_revoked: boolean;
  used_at: Date | null;
  replaced_by_hash: string | null;
}

/**
 * Hash a token using SHA-256
 * NEVER store the raw token!
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a new token family UUID
 */
export function generateTokenFamily(): string {
  return uuidv7();
}

/**
 * Store a new refresh token in the database
 */
export async function storeRefreshToken(
  tokenHash: string,
  userId: number,
  tenantId: number,
  tokenFamily: string,
  expiresAt: Date,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens
     (token_hash, user_id, tenant_id, token_family, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tokenHash, userId, tenantId, tokenFamily, expiresAt, ipAddress ?? null, userAgent ?? null]
  );
}

/**
 * Find a refresh token by its hash
 * Returns null if not found, expired, or revoked
 */
export async function findValidRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
  const [rows] = await query<StoredRefreshToken[]>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ?
     AND is_revoked = FALSE
     AND expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

/**
 * Check if a token was already used (REUSE DETECTION!)
 */
export async function isTokenAlreadyUsed(tokenHash: string): Promise<boolean> {
  const [rows] = await query<{ used_at: Date | null }[]>(
    `SELECT used_at FROM refresh_tokens WHERE token_hash = ?`,
    [tokenHash]
  );
  const token = rows[0];
  return token?.used_at !== null;
}

/**
 * Mark a token as used and link to its replacement
 */
export async function markTokenAsUsed(
  tokenHash: string,
  replacementHash: string
): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET used_at = NOW(), replaced_by_hash = ?
     WHERE token_hash = ?`,
    [replacementHash, tokenHash]
  );
}

/**
 * SECURITY: Revoke ALL tokens in a family (on reuse detection)
 */
export async function revokeTokenFamily(tokenFamily: string): Promise<number> {
  const [result] = await query(
    `UPDATE refresh_tokens
     SET is_revoked = TRUE
     WHERE token_family = ?`,
    [tokenFamily]
  );
  return (result as { affectedRows: number }).affectedRows;
}

/**
 * Revoke all tokens for a user (on logout, password change, etc.)
 */
export async function revokeAllUserTokens(userId: number, tenantId: number): Promise<number> {
  const [result] = await query(
    `UPDATE refresh_tokens
     SET is_revoked = TRUE
     WHERE user_id = ? AND tenant_id = ?`,
    [userId, tenantId]
  );
  return (result as { affectedRows: number }).affectedRows;
}

/**
 * Cleanup: Delete expired/revoked tokens older than X days
 * Call this via cron job or scheduled task
 */
export async function cleanupExpiredTokens(olderThanDays: number = 30): Promise<number> {
  const [result] = await query(
    `DELETE FROM refresh_tokens
     WHERE (expires_at < NOW() OR is_revoked = TRUE)
     AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [olderThanDays]
  );
  return (result as { affectedRows: number }).affectedRows;
}
```

#### 1.4.2 Änderungen in `auth.controller.ts`

**VORHER:**
```typescript
function generateTokens(userId, tenantId, role, email) {
  const accessToken = jwt.sign({...}, JWT_SECRET, { expiresIn: '30m' });
  const refreshToken = jwt.sign({...}, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

function refresh(req, res) {
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  const accessToken = jwt.sign({...}, JWT_SECRET, { expiresIn: '30m' });
  res.json({ accessToken, refreshToken }); // GLEICHER refreshToken!
}
```

**NACHHER:**
```typescript
import * as refreshTokenService from '../../../services/refreshToken.service.js';

async function generateTokensWithRotation(
  userId: number,
  tenantId: number,
  role: string,
  email: string,
  tokenFamily?: string,  // Bei Refresh: existierende Family
  ipAddress?: string,
  userAgent?: string
) {
  // Access Token (unverändert)
  const accessToken = jwt.sign(
    { id: userId, email, role, tenantId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );

  // Refresh Token MIT Family
  const family = tokenFamily ?? refreshTokenService.generateTokenFamily();
  const refreshToken = jwt.sign(
    { id: userId, email, role, tenantId, type: 'refresh', family },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

  // Token Hash in DB speichern (NICHT den Token selbst!)
  const tokenHash = refreshTokenService.hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await refreshTokenService.storeRefreshToken(
    tokenHash, userId, tenantId, family, expiresAt, ipAddress, userAgent
  );

  return { accessToken, refreshToken };
}

async function refresh(req, res) {
  const { refreshToken } = req.body;

  // 1. Token verifizieren (Signatur)
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  if (decoded.type !== 'refresh') {
    return res.status(401).json(errorResponse('INVALID_TOKEN', 'Not a refresh token'));
  }

  // 2. Token Hash berechnen
  const tokenHash = refreshTokenService.hashToken(refreshToken);

  // 3. REUSE DETECTION: Wurde Token schon benutzt?
  if (await refreshTokenService.isTokenAlreadyUsed(tokenHash)) {
    // SECURITY ALERT: Token Reuse detected!
    // Jemand hat einen alten Token benutzt = wahrscheinlich gestohlen!
    logger.warn(`[AUTH] Token reuse detected for user ${decoded.id}! Revoking family.`);
    await refreshTokenService.revokeTokenFamily(decoded.family);
    return res.status(401).json(errorResponse('TOKEN_REUSE', 'Token reuse detected - all sessions revoked'));
  }

  // 4. Token in DB validieren (nicht revoked, nicht expired)
  const storedToken = await refreshTokenService.findValidRefreshToken(tokenHash);
  if (!storedToken) {
    return res.status(401).json(errorResponse('INVALID_TOKEN', 'Token not found or expired'));
  }

  // 5. NEUEN Token generieren (Rotation!)
  const { accessToken, refreshToken: newRefreshToken } = await generateTokensWithRotation(
    decoded.id,
    decoded.tenantId,
    decoded.role,
    decoded.email,
    decoded.family,  // Familie beibehalten
    req.ip,
    req.get('user-agent')
  );

  // 6. Alten Token als "used" markieren
  const newTokenHash = refreshTokenService.hashToken(newRefreshToken);
  await refreshTokenService.markTokenAsUsed(tokenHash, newTokenHash);

  // 7. Response mit NEUEM Refresh Token
  res.json(successResponse({
    accessToken,
    refreshToken: newRefreshToken,  // ← NEUER Token!
  }));
}

async function logout(req, res) {
  // Alle Tokens des Users revoken
  const revokedCount = await refreshTokenService.revokeAllUserTokens(
    req.user.id,
    req.user.tenant_id
  );

  logger.info(`[AUTH] Logout: Revoked ${revokedCount} tokens for user ${req.user.id}`);

  // Audit Log
  await rootLog.create({...});

  res.json(successResponse({ message: 'Logged out successfully' }));
}
```

### 1.5 Frontend-Änderungen

**KEINE!**

Das Frontend speichert bereits jeden neuen Token:
```typescript
// token-manager.ts:264
this.setTokens(data.data.accessToken, data.data.refreshToken);
```

Der neue `refreshToken` wird automatisch gespeichert.

### 1.6 JWT Payload Änderung

**VORHER:**
```typescript
{
  id: number,
  email: string,
  role: string,
  tenantId: number,
  type: 'refresh'
}
```

**NACHHER:**
```typescript
{
  id: number,
  email: string,
  role: string,
  tenantId: number,
  type: 'refresh',
  family: string  // ← NEU: Token Family UUID
}
```

---

## Phase 2: Token Blacklisting (Optional, Backend-Only)

### 2.1 Problem
Logout invalidiert Token nicht wirklich - Token bleibt gültig bis Ablauf.

### 2.2 Lösung
Mit Phase 1 ist dies bereits gelöst:
- `logout()` ruft `revokeAllUserTokens()` auf
- Alle Tokens in `refresh_tokens` werden `is_revoked = TRUE`
- Nächster Refresh-Versuch schlägt fehl

### 2.3 Für Access Token Blacklisting (Optional)
Redis-basierte Blacklist für sofortige Access Token Invalidierung:

```typescript
// Bei Logout:
const tokenHash = hashToken(accessToken);
const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
await redis.setex(`blacklist:${tokenHash}`, remainingSeconds, '1');

// In Auth Middleware:
const tokenHash = hashToken(token);
if (await redis.get(`blacklist:${tokenHash}`)) {
  return res.status(401).json({ error: 'Token revoked' });
}
```

---

## Phase 3: HttpOnly Cookie (Optional, Größerer Change)

### 3.1 Entscheidung
Diese Phase ist **OPTIONAL** und sollte nur implementiert werden, wenn XSS ein echtes Risiko ist.

### 3.2 Änderungen (falls implementiert)

**Backend:**
```typescript
// Login Response
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v2/auth/refresh'
});

res.json({ accessToken, user });  // Kein refreshToken im Body!
```

**Frontend:**
```typescript
// token-manager.ts - refresh()
const response = await fetch('/api/v2/auth/refresh', {
  method: 'POST',
  credentials: 'include',  // Cookie wird automatisch gesendet
});
```

---

## Implementierungs-Reihenfolge

### Schritt 1: Migration erstellen
```bash
# File: database/migrations/20251126_add_refresh_tokens_table.sql
```

### Schritt 2: Migration ausführen
```bash
bash scripts/quick-backup.sh "before_refresh_token_rotation"
docker cp database/migrations/20251126_add_refresh_tokens_table.sql assixx-mysql:/tmp/
docker exec assixx-mysql sh -c 'mysql -h localhost -u assixx_user -pYOUR_PASSWORD main < /tmp/20251126_add_refresh_tokens_table.sql'
```

### Schritt 3: Service erstellen
```bash
# File: backend/src/services/refreshToken.service.ts
```

### Schritt 4: Controller anpassen
```bash
# File: backend/src/routes/v2/auth/auth.controller.ts
```

### Schritt 5: Testen
```bash
# 1. Login
curl -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.de","password":"test123"}'

# 2. Refresh (sollte NEUEN refreshToken zurückgeben)
curl -X POST http://localhost:3000/api/v2/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<token_from_step_1>"}'

# 3. Nochmal Refresh mit ALTEM Token (sollte FEHLSCHLAGEN - Reuse Detection!)
curl -X POST http://localhost:3000/api/v2/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<token_from_step_1>"}'
# Expected: 401 "Token reuse detected"
```

### Schritt 6: Backend neustarten
```bash
cd docker && docker-compose restart backend
```

---

## Risiko-Assessment

| Änderung | Risiko | Mitigation |
|----------|--------|------------|
| Neue DB Tabelle | LOW | Keine bestehenden Tabellen betroffen |
| JWT Payload Änderung | LOW | Nur `family` Feld hinzugefügt |
| Refresh Logic | MEDIUM | Ausführliche Tests vor Deploy |
| Frontend | NONE | Keine Änderungen nötig |

## Rollback-Plan

1. **DB:** `DROP TABLE refresh_tokens;`
2. **Code:** Git revert der Controller-Änderungen
3. **Verhalten:** System funktioniert wie vorher (ohne Rotation)

---

## Checkliste vor Implementierung

- [ ] Backup erstellt
- [ ] Migration SQL reviewed
- [ ] Service Code reviewed
- [ ] Controller Änderungen reviewed
- [ ] Test-Plan erstellt
- [ ] Rollback-Plan verstanden

---

## Nach Implementierung

- [ ] Migration erfolgreich
- [ ] Login funktioniert
- [ ] Refresh gibt NEUEN Token zurück
- [ ] Reuse Detection funktioniert
- [ ] Logout revoked Tokens
- [ ] Frontend UX unverändert (Timer, Modal, etc.)
- [ ] TOKEN-MANAGER-REFACTORING.md aktualisiert

---

**Dokumentation erstellt von:** Claude Code
**Review Status:** PENDING USER APPROVAL
