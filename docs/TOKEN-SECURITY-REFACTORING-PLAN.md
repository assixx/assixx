# Token Security Refactoring Plan

> **Status:** PLANNED
> **Priority:** HIGH (Security)
> **Erstellt:** 2026-01-13
> **Branch:** `security/token-url-fix`

---

## Executive Summary

JWT-Tokens werden aktuell in URLs exponiert (`?token=...`), was ein Sicherheitsrisiko darstellt. Tokens werden in Logs (Nginx, Grafana Cloud), Browser History und DevTools sichtbar. Dieser Plan beschreibt die Best-Practice-Lösung in 4 Phasen.

---

## Inhaltsverzeichnis

1. [Problem-Analyse](#1-problem-analyse)
2. [Architektur-Übersicht](#2-architektur-übersicht)
3. [Phase 1: Cookie-Auth Fix](#3-phase-1-cookie-auth-fix)
4. [Phase 2: Connection Ticket System](#4-phase-2-connection-ticket-system)
5. [Phase 3: Signed URLs für Downloads](#5-phase-3-signed-urls-für-downloads)
6. [Phase 4: Log Redaction](#6-phase-4-log-redaction)
7. [Testing-Strategie](#7-testing-strategie)
8. [Rollback-Plan](#8-rollback-plan)
9. [Checkliste](#9-checkliste)

---

## 1. Problem-Analyse

### 1.1 Betroffene Stellen

| Datei                                                                   | Zeile    | Verwendung  | Risiko   |
| ----------------------------------------------------------------------- | -------- | ----------- | -------- |
| `frontend/src/lib/utils/notification-sse.ts`                            | 120      | SSE Stream  | **HOCH** |
| `frontend/src/routes/(app)/chat/_lib/websocket.ts`                      | 29       | WebSocket   | **HOCH** |
| `frontend/src/routes/(app)/documents-explorer/+page.svelte`             | 266      | Downloads   | MITTEL   |
| `frontend/src/routes/(app)/documents-explorer/_lib/PreviewModal.svelte` | 26       | Preview     | MITTEL   |
| `frontend/src/routes/(app)/kvp-detail/_lib/api.ts`                      | 210, 219 | Attachments | MITTEL   |
| `frontend/src/routes/(app)/blackboard/[uuid]/_lib/api.ts`               | 160      | Attachments | MITTEL   |

### 1.2 Warum Token in URLs?

```
EventSource API        → Keine Custom Headers möglich
WebSocket Handshake    → Keine Custom Headers im Upgrade Request
HTML <a href="...">    → Keine Headers bei Downloads
window.location.href   → Keine Headers bei Redirects
```

### 1.3 Sicherheitsrisiken

```
Token in URL wird geloggt in:
├── Nginx access.log           ← Admins können sehen
├── Browser History            ← Lokal gespeichert
├── DevTools Network Tab       ← Sichtbar für jeden am Bildschirm
├── Grafana Cloud Logs         ← Ihr sendet Logs an Grafana Cloud!
├── Referer Header             ← Bei externen Links weitergegeben
└── Server Logs                ← Backend Request Logging
```

### 1.4 Entdeckter Bug: Cookie-Name Mismatch

```typescript
// frontend/src/lib/utils/token-manager.ts:141
document.cookie = `token=${access}; path=/; max-age=86400; SameSite=Lax`;
//                 ^^^^^ Frontend setzt "token"

// backend/src/nest/common/guards/jwt-auth.guard.ts:174
const cookieToken = cookies?.['accessToken'];
//                            ^^^^^^^^^^^^^ Backend erwartet "accessToken"
```

**Konsequenz:** Cookie-basierte Auth ist bereits implementiert, aber durch Namens-Mismatch nicht funktional!

---

## 2. Architektur-Übersicht

### 2.1 Ziel-Architektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZIEL-ARCHITEKTUR                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐                                                       │
│   │   Browser    │                                                       │
│   └──────┬───────┘                                                       │
│          │                                                               │
│   ┌──────┴───────────────────────────────────────────────────────┐      │
│   │                                                               │      │
│   │  SSE Requests ──────────► Cookie-Auth (accessToken Cookie)   │      │
│   │                           Kein Token in URL!                  │      │
│   │                                                               │      │
│   │  WebSocket ─────────────► Connection Ticket (30s TTL)        │      │
│   │                           /chat-ws?ticket=abc123              │      │
│   │                           Ticket ist random UUID, kein JWT    │      │
│   │                                                               │      │
│   │  Downloads ─────────────► Signed URLs (5 min TTL)            │      │
│   │                           ?expires=...&sig=HMAC(...)          │      │
│   │                           Kein Token, nur Signatur            │      │
│   │                                                               │      │
│   │  API Calls ─────────────► Authorization Header (unverändert) │      │
│   │                           Bearer ${accessToken}               │      │
│   │                                                               │      │
│   └───────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Phasen-Übersicht

| Phase | Beschreibung      | Aufwand | Sicherheitsgewinn |
| ----- | ----------------- | ------- | ----------------- |
| 1     | Cookie-Auth Fix   | 30 min  | HOCH              |
| 2     | Connection Ticket | 3-4h    | HOCH              |
| 3     | Signed URLs       | 2-3h    | MITTEL            |
| 4     | Log Redaction     | 1h      | MITTEL            |

---

## 3. Phase 1: Cookie-Auth Fix

### 3.1 Ziel

Cookie-Namen angleichen, damit SSE und Downloads automatisch über Cookies authentifiziert werden.

### 3.2 Änderungen

#### 3.2.1 Frontend: token-manager.ts

```typescript
// DATEI: frontend/src/lib/utils/token-manager.ts
// ZEILE: 141 (in setTokens Methode)

// VORHER:
document.cookie = `token=${access}; path=/; max-age=86400; SameSite=Lax`;

// NACHHER:
document.cookie = `accessToken=${access}; path=/; max-age=86400; SameSite=Lax; Secure`;
```

#### 3.2.2 Frontend: notification-sse.ts

```typescript
// DATEI: frontend/src/lib/utils/notification-sse.ts
// ZEILE: 119-120

// VORHER:
const url = `/api/v2/notifications/stream?token=${encodeURIComponent(token)}`;
this.eventSource = new EventSource(url);

// NACHHER:
// Cookie wird automatisch gesendet (same-origin), kein Token in URL nötig
const url = `/api/v2/notifications/stream`;
this.eventSource = new EventSource(url, { withCredentials: true });
```

#### 3.2.3 Frontend: Downloads ohne Token

```typescript
// DATEI: frontend/src/routes/(app)/documents-explorer/+page.svelte
// ZEILE: 266

// VORHER:
const downloadUrl = token !== null
  ? `${doc.downloadUrl}?token=${encodeURIComponent(token)}`
  : doc.downloadUrl;

// NACHHER:
// Cookie wird automatisch gesendet
const downloadUrl = doc.downloadUrl;
```

Analog für:

- `frontend/src/routes/(app)/documents-explorer/_lib/PreviewModal.svelte:26`
- `frontend/src/routes/(app)/kvp-detail/_lib/api.ts:210, 219`
- `frontend/src/routes/(app)/blackboard/[uuid]/_lib/api.ts:160`

### 3.3 Backend: Keine Änderungen nötig

Backend prüft bereits Cookies in `jwt-auth.guard.ts:172-177`:

```typescript
// Bereits implementiert - funktioniert nach Cookie-Name-Fix!
const cookies = request.cookies as Record<string, string> | undefined;
const cookieToken = cookies?.['accessToken'];
if (cookieToken !== undefined) {
  return cookieToken;
}
```

### 3.4 Test-Szenario Phase 1

```bash
# 1. Login durchführen (setzt Cookie)
# 2. DevTools → Application → Cookies prüfen
#    - accessToken sollte gesetzt sein

# 3. SSE testen
curl -v http://localhost:3000/api/v2/notifications/stream \
  -H "Cookie: accessToken=<JWT_TOKEN>"
# Erwartung: 200 OK, SSE Events empfangen

# 4. Download testen
curl -v http://localhost:3000/api/v2/documents/1/download \
  -H "Cookie: accessToken=<JWT_TOKEN>"
# Erwartung: 200 OK, Datei wird geliefert
```

---

## 4. Phase 2: Connection Ticket System

### 4.1 Research-Ergebnisse (Best Practices)

**Quellen:**

- [websockets.readthedocs.io - Authentication](https://websockets.readthedocs.io/en/stable/topics/authentication.html)
- [Ably Blog - WebSocket Authentication](https://ably.com/blog/websocket-authentication)
- [NestJS WebSocket Auth Best Practices](https://preetmishra.com/blog/the-best-way-to-authenticate-websockets-in-nestjs)

**Methoden-Vergleich:**

| Methode             | Logging-Risiko            | Komplexität       | Empfehlung         |
| ------------------- | ------------------------- | ----------------- | ------------------ |
| JWT in Query Param  | **HOCH** - 30 min gültig  | Niedrig           | VERMEIDEN          |
| Ephemeral Ticket    | Niedrig - 30s, single-use | Mittel            | **EMPFOHLEN**      |
| Token First Message | Keins                     | Hoch (DOS-Risiko) | Alternative        |
| Cookie-based        | Niedrig                   | Niedrig           | CSRF-Risiko bei WS |

**Warum Ticket statt JWT in URL?**

```
JWT in URL:
├── Enthält: userId, email, role, tenantId (SENSIBEL!)
├── Gültig: 30 Minuten
└── Wenn geloggt: Angreifer kann 30 min impersonieren

Ticket in URL:
├── Enthält: Random UUID (KEINE sensiblen Daten)
├── Gültig: 30 SEKUNDEN
├── Single-Use: Nach Validierung gelöscht
└── Wenn geloggt: Nutzlos (bereits verwendet oder abgelaufen)
```

**NestJS-spezifisch:** Guards funktionieren NICHT bei `handleConnection`, nur bei `@SubscribeMessage`. Da Assixx raw WebSocket (ws library) verwendet, ist Connection Ticket die beste Lösung.

### 4.2 Ziel

WebSocket-Verbindungen über kurzlebige, einmalig verwendbare Tickets statt JWT in URL authentifizieren.

### 4.3 Konzept

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONNECTION TICKET FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. Client: POST /api/v2/auth/connection-ticket                        │
│      Header: Authorization: Bearer <JWT>                                 │
│      Body: { purpose: "websocket" }                                      │
│                                                                          │
│   2. Server generiert Ticket:                                            │
│      - ticketId = crypto.randomUUID()                                    │
│      - Redis SET connection_ticket:{ticketId}                            │
│        VALUE: { userId, tenantId, role, purpose, createdAt }             │
│        TTL: 30 seconds                                                   │
│                                                                          │
│   3. Response: { ticket: "abc123-def456-...", expiresIn: 30 }           │
│                                                                          │
│   4. Client verbindet: wss://host/chat-ws?ticket=abc123-def456-...      │
│                                                                          │
│   5. Server validiert:                                                   │
│      - Redis GET connection_ticket:{ticket}                              │
│      - Wenn vorhanden: User-Daten extrahieren, Ticket LÖSCHEN           │
│      - Wenn nicht vorhanden: Connection reject (401)                     │
│                                                                          │
│   SICHERHEIT:                                                            │
│   - Ticket ist random UUID, enthält keine User-Info                      │
│   - 30 Sekunden TTL: Selbst wenn geloggt, schnell ungültig              │
│   - Single-Use: Nach Validierung gelöscht, kein Replay möglich          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Backend-Implementierung

#### 4.3.1 Redis Service erweitern

```typescript
// DATEI: backend/src/nest/common/services/redis.service.ts (NEU oder erweitern)
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

interface ConnectionTicketData {
  userId: number;
  tenantId: number;
  role: string;
  purpose: 'websocket' | 'sse';
  createdAt: number;
}

@Injectable()
export class RedisService {
  private readonly redis: Redis;
  private readonly TICKET_PREFIX = 'connection_ticket:';
  private readonly TICKET_TTL_SECONDS = 30;

  constructor() {
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number(process.env['REDIS_PORT']) ?? 6379,
    });
  }

  /**
   * Create a connection ticket
   * @returns Ticket ID (random UUID)
   */
  async createConnectionTicket(data: ConnectionTicketData): Promise<string> {
    const ticketId = crypto.randomUUID();
    const key = `${this.TICKET_PREFIX}${ticketId}`;

    await this.redis.setex(key, this.TICKET_TTL_SECONDS, JSON.stringify(data));

    return ticketId;
  }

  /**
   * Validate and consume a connection ticket (single-use)
   * @returns Ticket data or null if invalid/expired/already used
   */
  async consumeConnectionTicket(ticketId: string): Promise<ConnectionTicketData | null> {
    const key = `${this.TICKET_PREFIX}${ticketId}`;

    // GET and DELETE atomically using Lua script
    const luaScript = `
      local value = redis.call('GET', KEYS[1])
      if value then
        redis.call('DEL', KEYS[1])
      end
      return value
    `;

    const result = (await this.redis.eval(luaScript, 1, key)) as string | null;

    if (result === null) {
      return null;
    }

    return JSON.parse(result) as ConnectionTicketData;
  }
}
```

#### 4.3.2 Auth Controller erweitern

```typescript
// DATEI: backend/src/nest/auth/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
// DTO
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { RedisService } from '../common/services/redis.service.js';

const ConnectionTicketSchema = z.object({
  purpose: z.enum(['websocket', 'sse']),
});

class ConnectionTicketDto extends createZodDto(ConnectionTicketSchema) {}

@Controller('auth')
export class AuthController {
  constructor(
    // ... existing dependencies
    private readonly redisService: RedisService,
  ) {}

  /**
   * POST /api/v2/auth/connection-ticket
   * Generate a short-lived ticket for WebSocket/SSE connections
   */
  @Post('connection-ticket')
  async createConnectionTicket(
    @Body() dto: ConnectionTicketDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ ticket: string; expiresIn: number }> {
    const ticket = await this.redisService.createConnectionTicket({
      userId: user.id,
      tenantId,
      role: user.activeRole,
      purpose: dto.purpose,
      createdAt: Date.now(),
    });

    return {
      ticket,
      expiresIn: 30,
    };
  }
}
```

#### 4.3.3 WebSocket Server anpassen

```typescript
// DATEI: backend/src/websocket.ts

// Neue Methode hinzufügen
private async validateTicket(ticketId: string): Promise<{
  userId: number;
  tenantId: number;
  role: string;
} | null> {
  // RedisService injizieren oder direkt Redis verwenden
  const ticketData = await this.redisService.consumeConnectionTicket(ticketId);

  if (ticketData === null) {
    return null;
  }

  // Zusätzlich: User in DB prüfen (is_active)
  if (!(await this.isUserActive(ticketData.userId, ticketData.tenantId))) {
    return null;
  }

  return {
    userId: ticketData.userId,
    tenantId: ticketData.tenantId,
    role: ticketData.role,
  };
}

// extractTokenFromRequest anpassen
private extractTicketFromRequest(request: {
  url: string | undefined;
  headers: { host: string | undefined };
}): string | null {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const ticket = url.searchParams.get('ticket');
  return ticket !== null && ticket !== '' ? ticket : null;
}

// handleConnection anpassen
private async handleConnection(ws: ExtendedWebSocket, request: ...): Promise<void> {
  try {
    const ticket = this.extractTicketFromRequest(request);

    if (ticket === null) {
      ws.close(1008, 'Ticket required');
      return;
    }

    const userData = await this.validateTicket(ticket);

    if (userData === null) {
      ws.close(1008, 'Invalid or expired ticket');
      return;
    }

    this.setupWebSocketClient(ws, userData.userId, userData.tenantId, userData.role);
    // ... rest of connection setup
  } catch (error) {
    logger.error({ err: error }, 'WebSocket authentication failed');
    ws.close(1008, 'Authentication failed');
  }
}
```

### 4.5 Frontend-Implementierung

#### 4.4.1 Ticket-Service erstellen

```typescript
// DATEI: frontend/src/lib/utils/connection-ticket.ts (NEU)
import { getTokenManager } from './token-manager';

interface ConnectionTicketResponse {
  ticket: string;
  expiresIn: number;
}

/**
 * Request a short-lived connection ticket for WebSocket/SSE
 */
export async function getConnectionTicket(purpose: 'websocket' | 'sse'): Promise<string> {
  const tokenManager = getTokenManager();
  const accessToken = tokenManager.getAccessToken();

  if (accessToken === null) {
    throw new Error('No access token available');
  }

  const response = await fetch('/api/v2/auth/connection-ticket', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ purpose }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get connection ticket: ${response.status}`);
  }

  const data = (await response.json()) as ConnectionTicketResponse;
  return data.ticket;
}
```

#### 4.4.2 WebSocket anpassen

```typescript
// DATEI: frontend/src/routes/(app)/chat/_lib/websocket.ts
import { getConnectionTicket } from '$lib/utils/connection-ticket';

/**
 * Build WebSocket URL with connection ticket
 */
export async function buildWebSocketUrl(): Promise<string> {
  // Get short-lived ticket instead of JWT
  const ticket = await getConnectionTicket('websocket');

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/chat-ws?ticket=${encodeURIComponent(ticket)}`;
}

// Caller muss angepasst werden (async):
// VORHER: const url = buildWebSocketUrl(token);
// NACHHER: const url = await buildWebSocketUrl();
```

### 4.6 Test-Szenario Phase 2

```bash
# 1. Connection Ticket anfordern
curl -X POST http://localhost:3000/api/v2/auth/connection-ticket \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"purpose": "websocket"}'
# Response: { "ticket": "abc123-...", "expiresIn": 30 }

# 2. WebSocket mit Ticket verbinden (innerhalb 30s)
wscat -c "ws://localhost:3000/chat-ws?ticket=abc123-..."
# Erwartung: Connection established

# 3. Gleiches Ticket erneut verwenden
wscat -c "ws://localhost:3000/chat-ws?ticket=abc123-..."
# Erwartung: Connection rejected (ticket already consumed)

# 4. Nach 30s versuchen
# Erwartung: Connection rejected (ticket expired)
```

---

## 5. Phase 3: Signed URLs für Downloads

### 5.1 Ziel

Download-URLs ohne Token, stattdessen mit kryptographischer Signatur.

### 5.2 Konzept

```
URL-Format:
/api/v2/documents/{id}/download?expires={timestamp}&userId={id}&sig={signature}

Signatur:
sig = HMAC-SHA256(
  key: process.env.URL_SIGNING_SECRET,
  message: `${documentId}:${userId}:${tenantId}:${expires}`
)
```

### 5.3 Backend-Implementierung

#### 5.3.1 URL Signing Service

```typescript
// DATEI: backend/src/nest/common/services/url-signing.service.ts (NEU)
import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

interface SignedUrlParams {
  documentId: number;
  userId: number;
  tenantId: number;
  expiresIn?: number; // seconds, default 300 (5 min)
}

interface SignedUrlComponents {
  expires: number;
  userId: number;
  sig: string;
}

@Injectable()
export class UrlSigningService {
  private readonly secret: string;
  private readonly DEFAULT_EXPIRY = 300; // 5 minutes

  constructor() {
    const secret = process.env['URL_SIGNING_SECRET'];
    if (secret === undefined || secret.length < 32) {
      throw new Error('URL_SIGNING_SECRET must be set and at least 32 characters');
    }
    this.secret = secret;
  }

  /**
   * Generate signed URL components for a document download
   */
  generateSignedComponents(params: SignedUrlParams): SignedUrlComponents {
    const expires = Math.floor(Date.now() / 1000) + (params.expiresIn ?? this.DEFAULT_EXPIRY);
    const message = `${params.documentId}:${params.userId}:${params.tenantId}:${expires}`;

    const sig = createHmac('sha256', this.secret).update(message).digest('hex');

    return {
      expires,
      userId: params.userId,
      sig,
    };
  }

  /**
   * Validate a signed URL
   */
  validateSignature(
    documentId: number,
    userId: number,
    tenantId: number,
    expires: number,
    signature: string,
  ): { valid: boolean; reason?: string } {
    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (expires < now) {
      return { valid: false, reason: 'URL expired' };
    }

    // Verify signature
    const message = `${documentId}:${userId}:${tenantId}:${expires}`;
    const expectedSig = createHmac('sha256', this.secret).update(message).digest('hex');

    // Timing-safe comparison
    if (!this.timingSafeEqual(signature, expectedSig)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    return require('crypto').timingSafeEqual(bufA, bufB);
  }
}
```

#### 5.3.2 Documents Controller erweitern

```typescript
// DATEI: backend/src/nest/documents/documents.controller.ts

// Neuer Endpoint für signierte Download-URL
@Get(':id/signed-url')
async getSignedDownloadUrl(
  @Param('id') id: string,
  @CurrentUser() user: NestAuthUser,
  @TenantId() tenantId: number,
): Promise<{ url: string; expiresIn: number }> {
  const documentId = Number.parseInt(id, 10);

  // Verify user has access to document
  await this.documentsService.verifyAccess(documentId, user.id, tenantId);

  const components = this.urlSigningService.generateSignedComponents({
    documentId,
    userId: user.id,
    tenantId,
  });

  const url = `/api/v2/documents/${documentId}/download` +
    `?expires=${components.expires}` +
    `&userId=${components.userId}` +
    `&sig=${components.sig}`;

  return { url, expiresIn: 300 };
}

// Download Endpoint anpassen
@Get(':id/download')
@Public() // Jetzt public, da Signatur statt JWT
async downloadDocument(
  @Param('id') id: string,
  @Query('expires') expires: string,
  @Query('userId') userId: string,
  @Query('sig') sig: string,
  @Res() res: FastifyReply,
): Promise<void> {
  const documentId = Number.parseInt(id, 10);

  // Validate signed URL
  const validation = this.urlSigningService.validateSignature(
    documentId,
    Number.parseInt(userId, 10),
    // tenantId muss aus Document geladen werden
    await this.documentsService.getTenantId(documentId),
    Number.parseInt(expires, 10),
    sig,
  );

  if (!validation.valid) {
    throw new UnauthorizedException(validation.reason);
  }

  // Proceed with download
  await this.documentsService.streamDownload(documentId, res);
}
```

### 5.4 Frontend-Implementierung

```typescript
// DATEI: frontend/src/routes/(app)/documents-explorer/_lib/api.ts

/**
 * Get signed download URL for a document
 */
export async function getSignedDownloadUrl(documentId: number): Promise<string> {
  const response = await apiClient.get<{ url: string; expiresIn: number }>(`/documents/${documentId}/signed-url`);
  return response.url;
}

// Verwendung in Component:
async function handleDownload(doc: Document) {
  const url = await getSignedDownloadUrl(doc.id);
  window.location.href = url;
}
```

### 5.5 Umgebungsvariable

```bash
# docker/.env
URL_SIGNING_SECRET=your-32-character-or-longer-random-secret-here
```

---

## 6. Phase 4: Log Redaction

### 6.1 Ziel

Fallback-Schutz: Falls irgendwo doch noch Tokens in URLs landen, werden sie aus Logs entfernt.

### 6.2 Nginx Log Redaction

```nginx
# DATEI: docker/nginx/nginx.conf

# Custom log format that redacts tokens
log_format main_redacted '$remote_addr - $remote_user [$time_local] '
                         '"$request_redacted" $status $body_bytes_sent '
                         '"$http_referer" "$http_user_agent"';

# Map to redact token from request
map $request $request_redacted {
    ~^(.+\?.*)(token=[^&\s]+)(.*)$ "$1token=REDACTED$3";
    ~^(.+\?.*)(ticket=[^&\s]+)(.*)$ "$1ticket=REDACTED$3";
    default $request;
}

server {
    access_log /var/log/nginx/access.log main_redacted;
    # ...
}
```

### 6.3 Loki/Promtail Scrubbing

```yaml
# DATEI: docker/loki/promtail-config.yml

scrape_configs:
  - job_name: nginx
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          __path__: /var/log/nginx/*.log
    pipeline_stages:
      - regex:
          expression: '(?P<content>.*)(token=)[^&\s]+'
      - template:
          source: content
          template: '{{ .content }}token=REDACTED'
```

### 6.4 Backend Logger Redaction

```typescript
// DATEI: backend/src/utils/logger.ts

// Redact sensitive data from logs
const redactPatterns = [/token=[^&\s]+/gi, /ticket=[^&\s]+/gi, /password['":\s]*[^,}\s]+/gi];

function redactSensitiveData(message: string): string {
  let redacted = message;
  for (const pattern of redactPatterns) {
    redacted = redacted.replace(pattern, (match) => {
      const key = match.split(/[=:]/)[0];
      return `${key}=REDACTED`;
    });
  }
  return redacted;
}
```

---

## 7. Testing-Strategie

### 7.1 Unit Tests

```typescript
// Redis Service
describe('RedisService', () => {
  it('should create and consume ticket', async () => {
    const ticket = await service.createConnectionTicket({
      userId: 1,
      tenantId: 1,
      role: 'admin',
      purpose: 'websocket',
      createdAt: Date.now(),
    });
    expect(ticket).toMatch(/^[a-f0-9-]{36}$/);

    const data = await service.consumeConnectionTicket(ticket);
    expect(data?.userId).toBe(1);

    // Second consume should fail
    const data2 = await service.consumeConnectionTicket(ticket);
    expect(data2).toBeNull();
  });
});

// URL Signing
describe('UrlSigningService', () => {
  it('should generate and validate signature', () => {
    const components = service.generateSignedComponents({
      documentId: 1,
      userId: 1,
      tenantId: 1,
    });

    const validation = service.validateSignature(1, 1, 1, components.expires, components.sig);
    expect(validation.valid).toBe(true);
  });

  it('should reject expired URL', () => {
    const validation = service.validateSignature(1, 1, 1, 0, 'invalid');
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe('URL expired');
  });
});
```

### 7.2 Integration Tests (Bruno)

```bru
# api-tests/auth/connection-ticket.bru
meta {
  name: Get Connection Ticket
  type: http
  seq: 1
}

post {
  url: {{base_url}}/auth/connection-ticket
  body: json
  auth: bearer
}

body:json {
  {
    "purpose": "websocket"
  }
}

auth:bearer {
  token: {{auth_token}}
}

assert {
  res.status: eq 200
  res.body.ticket: isString
  res.body.expiresIn: eq 30
}

script:post-response {
  bru.setVar("connection_ticket", res.body.ticket);
}
```

### 7.3 E2E Tests

```typescript
// Playwright Test
test('WebSocket connects with ticket', async ({ page }) => {
  await page.goto('/chat');

  // Check no token in WebSocket URL
  const wsUrl = await page.evaluate(() => {
    return (window as any).__lastWebSocketUrl;
  });

  expect(wsUrl).not.toContain('token=');
  expect(wsUrl).toContain('ticket=');
});

test('SSE connects without URL token', async ({ page }) => {
  await page.goto('/dashboard');

  // Check network requests
  const sseRequest = await page.waitForRequest((request) => request.url().includes('/notifications/stream'));

  expect(sseRequest.url()).not.toContain('token=');
});
```

### 7.4 Security Audit Checklist

```markdown
- [ ] Keine JWT Tokens in Nginx access.log
- [ ] Keine JWT Tokens in Browser Network Tab URLs
- [ ] Keine JWT Tokens in Browser History
- [ ] Connection Tickets sind nach 30s ungültig
- [ ] Connection Tickets sind nach einmaliger Nutzung ungültig
- [ ] Signed URLs sind nach 5 min ungültig
- [ ] Signed URLs können nicht manipuliert werden (Signatur-Check)
```

---

## 8. Rollback-Plan

### Phase 1 Rollback

```typescript
// Revert cookie name
document.cookie = `token=${access}; path=/; ...`; // Back to 'token'

// Revert SSE
const url = `/api/v2/notifications/stream?token=${encodeURIComponent(token)}`;
```

### Phase 2 Rollback

```typescript
// WebSocket: Back to JWT in URL
// Backend: Re-enable JWT validation in websocket.ts
// Frontend: Remove connection-ticket.ts usage
```

### Phase 3 Rollback

```typescript
// Downloads: Back to token in URL
// Backend: Re-enable JWT validation in download endpoint
// Frontend: Add token back to download URLs
```

---

## 9. Checkliste

### Pre-Implementation

- [ ] URL_SIGNING_SECRET in docker/.env definieren (32+ Zeichen)
- [ ] Redis-Verbindung testen
- [ ] Backup der betroffenen Dateien

### Phase 1

- [ ] `token-manager.ts`: Cookie-Name ändern
- [ ] `notification-sse.ts`: URL-Token entfernen
- [ ] `documents-explorer/+page.svelte`: Token entfernen
- [ ] `PreviewModal.svelte`: Token entfernen
- [ ] `kvp-detail/_lib/api.ts`: Token entfernen
- [ ] `blackboard/[uuid]/_lib/api.ts`: Token entfernen
- [ ] Manueller Test: SSE funktioniert
- [ ] Manueller Test: Downloads funktionieren

### Phase 2

- [ ] `redis.service.ts` erstellen
- [ ] `auth.controller.ts` erweitern
- [ ] `websocket.ts` anpassen
- [ ] `connection-ticket.ts` erstellen
- [ ] `chat/_lib/websocket.ts` anpassen
- [ ] Bruno Tests erstellen
- [ ] Manueller Test: WebSocket mit Ticket

### Phase 3

- [ ] `url-signing.service.ts` erstellen
- [ ] `documents.controller.ts` erweitern
- [ ] Frontend Download-Logik anpassen
- [ ] Manueller Test: Signed Downloads

### Phase 4

- [ ] Nginx Log Format anpassen
- [ ] Loki Scrubbing konfigurieren
- [ ] Backend Logger Redaction
- [ ] Verify: Keine Tokens in Logs

### Post-Implementation

- [ ] Security Audit durchführen
- [ ] DAILY-PROGRESS.md aktualisieren
- [ ] CLAUDE-KAIZEN-MANIFEST.md aktualisieren (falls Learnings)

---

## Anhang: Umgebungsvariablen

```bash
# docker/.env - Neue Variablen

# URL Signing (Phase 3)
URL_SIGNING_SECRET=your-very-long-random-secret-minimum-32-characters

# Redis (bereits vorhanden, für Phase 2)
REDIS_HOST=redis
REDIS_PORT=6379
```

---

**Autor:** Claude Code
**Review:** Pending
**Genehmigung:** Pending
