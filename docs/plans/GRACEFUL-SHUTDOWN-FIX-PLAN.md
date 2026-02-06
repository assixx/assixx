# Graceful Shutdown Fix Plan

> **Status:** ✅ IMPLEMENTED
> **Erstellt:** 13. Januar 2026
> **Implementiert:** 13. Januar 2026
> **Priorität:** HOCH (Production-Critical)

---

## Problem-Zusammenfassung

Die aktuelle Graceful Shutdown Implementierung ist **UNVOLLSTÄNDIG**. Kritische Cleanup-Hooks werden **NICHT** ausgeführt.

### Was funktioniert

| Component       | Status | Details                                  |
| --------------- | ------ | ---------------------------------------- |
| SIGTERM Handler | ✅     | `process.on('SIGTERM', ...)` in main.ts  |
| SIGINT Handler  | ✅     | `process.on('SIGINT', ...)` in main.ts   |
| SIGHUP Handler  | ✅     | `process.on('SIGHUP', ...)` in main.ts   |
| app.close()     | ✅     | Wird in gracefulShutdown() aufgerufen    |
| Deletion Worker | ✅     | Eigene Graceful Shutdown Implementierung |

### Was FEHLT (KRITISCH)

| Component                   | Status    | Konsequenz                                             |
| --------------------------- | --------- | ------------------------------------------------------ |
| `app.enableShutdownHooks()` | **FEHLT** | onModuleDestroy Hooks werden NICHT aufgerufen          |
| `Sentry.close(2000)`        | **FEHLT** | Pending Errors gehen bei Shutdown verloren             |
| ChatWebSocketServer Cleanup | **FEHLT** | Redis + WebSocket Connections werden nicht geschlossen |

---

## Betroffene Services

### 1. Services mit onModuleDestroy (werden NICHT aufgerufen!)

Diese Services haben korrekte Cleanup-Logik, aber sie wird **NIE ausgeführt** weil `enableShutdownHooks()` fehlt:

#### ConnectionTicketService (`backend/src/nest/auth/connection-ticket.service.ts:90`)

```typescript
async onModuleDestroy(): Promise<void> {
  await this.redis.quit();  // ← WIRD NICHT AUFGERUFEN!
  this.logger.log('Redis connection closed');
}
```

#### DatabaseModule (`backend/src/nest/database/database.module.ts:69`)

```typescript
async onModuleDestroy(): Promise<void> {
  this.logger.log('Closing PostgreSQL connection pool...');
  await this.databaseService.closePool();  // ← WIRD NICHT AUFGERUFEN!
  this.logger.log('PostgreSQL connection pool closed');
}
```

### 2. Services OHNE Cleanup (brauchen Implementierung)

#### ChatWebSocketServer (`backend/src/websocket.ts`)

```typescript
// Hat Redis Connection (Zeile 105):
this.redis = new Redis({ ... });

// Hat WebSocket Server (Zeile 91):
this.wss = new WebSocketServer({ ... });

// ABER: Keine shutdown() oder close() Methode!
```

**Konsequenzen:**

- Redis Connection bleibt offen → Connection Leak
- WebSocket Server bleibt offen → Clients werden nicht sauber disconnected
- Heartbeat Interval läuft weiter

#### ThrottlerModule (`backend/src/nest/throttler/throttler.module.ts`)

```typescript
// Redis Client erstellt in Factory (Zeile 27):
const redisClient = new Redis({ ... });

// Wird an ThrottlerStorageRedisService übergeben
// Cleanup vermutlich durch Library, aber nicht explizit garantiert
```

---

## Fix-Plan

### Phase 1: main.ts Fixes (KRITISCH)

**Datei:** `backend/src/nest/main.ts`

#### 1.1 Import Sentry

```typescript
// Zeile 2 (nach instrument.js import)
import { Sentry } from './instrument.js';
```

#### 1.2 enableShutdownHooks hinzufügen

```typescript
// In bootstrap(), nach app creation (ca. Zeile 371)
appInstance = app;
app.enableShutdownHooks(); // ← NEU
```

#### 1.3 Sentry.close in gracefulShutdown

```typescript
async function gracefulShutdown(signal: string): Promise<void> {
  const logger = new NestLogger('Shutdown');
  logger.log(`Received ${signal}. Starting graceful shutdown...`);

  // NEU: Flush pending Sentry events (max 2 seconds)
  try {
    await Sentry.close(2000);
    logger.log('Sentry events flushed');
  } catch (error) {
    logger.warn('Failed to flush Sentry events:', error);
  }

  if (appInstance) {
    try {
      await appInstance.close();
      logger.log('NestJS application closed successfully. Port released.');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  process.exit(0);
}
```

### Phase 2: ChatWebSocketServer Cleanup

**Datei:** `backend/src/websocket.ts`

#### 2.1 shutdown() Methode hinzufügen

```typescript
/**
 * Graceful shutdown - close all connections
 */
async shutdown(): Promise<void> {
  logger.info('ChatWebSocketServer shutting down...');

  // Stop heartbeat interval
  if (this.heartbeatInterval) {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  // Close all WebSocket connections
  this.wss.clients.forEach((ws: ExtendedWebSocket) => {
    ws.close(1001, 'Server shutting down');
  });

  // Close WebSocket server
  await new Promise<void>((resolve) => {
    this.wss.close(() => {
      logger.info('WebSocket server closed');
      resolve();
    });
  });

  // Close Redis connection
  await this.redis.quit();
  logger.info('Redis connection closed');

  logger.info('ChatWebSocketServer shutdown complete');
}
```

#### 2.2 main.ts Integration

```typescript
// In gracefulShutdown(), VOR app.close():
if (chatWsInstance) {
  await chatWsInstance.shutdown();
}
```

### Phase 3: Verify ThrottlerModule Cleanup

**Prüfen:** Ob `@nest-lab/throttler-storage-redis` automatisch cleanup macht.

Falls nicht, müsste ein custom Provider mit onModuleDestroy erstellt werden.

---

## Implementierungs-Reihenfolge

| Step | Datei          | Änderung                                 | Priorität |
| ---- | -------------- | ---------------------------------------- | --------- |
| 1    | `main.ts`      | `app.enableShutdownHooks()` hinzufügen   | KRITISCH  |
| 2    | `main.ts`      | `Sentry.close(2000)` in gracefulShutdown | KRITISCH  |
| 3    | `websocket.ts` | `shutdown()` Methode hinzufügen          | HOCH      |
| 4    | `main.ts`      | ChatWebSocketServer.shutdown() aufrufen  | HOCH      |
| 5    | Verify         | ThrottlerModule Cleanup prüfen           | MITTEL    |

---

## Erwartetes Verhalten nach Fix

```
[Shutdown] Received SIGTERM. Starting graceful shutdown...
[Sentry] Events flushed
[ChatWebSocketServer] Shutting down...
[ChatWebSocketServer] WebSocket server closed
[ChatWebSocketServer] Redis connection closed
[ConnectionTicketService] Redis connection closed    ← NEU (via enableShutdownHooks)
[DatabaseModule] Closing PostgreSQL connection pool...  ← NEU (via enableShutdownHooks)
[DatabaseModule] PostgreSQL connection pool closed   ← NEU (via enableShutdownHooks)
[Shutdown] NestJS application closed successfully. Port released.
```

---

## Testing

### Manueller Test

```bash
# 1. Backend starten
docker-compose up -d backend

# 2. Logs beobachten
docker logs -f assixx-backend

# 3. SIGTERM senden
docker stop assixx-backend

# 4. Erwartete Log-Ausgabe prüfen (siehe oben)
```

### Automatisierter Test (optional)

```typescript
// test/graceful-shutdown.e2e-spec.ts
describe('Graceful Shutdown', () => {
  it('should close all connections on SIGTERM', async () => {
    // Start app
    // Send SIGTERM
    // Verify all connections closed
  });
});
```

---

## Risiken

| Risiko                                   | Wahrscheinlichkeit | Impact  | Mitigation                     |
| ---------------------------------------- | ------------------ | ------- | ------------------------------ |
| enableShutdownHooks verlangsamt Shutdown | Niedrig            | Niedrig | Timeout in gracefulShutdown    |
| ChatWebSocketServer.shutdown() blockiert | Mittel             | Mittel  | Timeout für close() operations |
| Sentry.close() timeout                   | Niedrig            | Niedrig | try/catch mit Warnung          |

---

## Referenzen

- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [NestJS Application Shutdown](https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown)
- [Sentry Node SDK - Shutdown](https://docs.sentry.io/platforms/node/configuration/draining/)
- ADR-002: Alerting & Monitoring

---

## Approval

- [ ] Plan reviewed
- [ ] Ready for implementation
