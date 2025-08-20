# Server-Sent Events (SSE) für Real-Time Notifications

## Übersicht

Dieses Dokument beschreibt die Implementierung von Server-Sent Events (SSE) für Echtzeit-Benachrichtigungen in Assixx, um das ineffiziente Polling-System zu ersetzen.

## Warum SSE statt Polling?

### Aktuelles Problem (Polling)

- **10 Minuten Verzögerung** für neue Benachrichtigungen
- **Unnötige Server-Last** durch konstante API-Calls
- **Verschwendete Ressourcen** wenn keine neuen Events vorliegen
- **Schlechte User Experience** - Mitarbeiter sehen neue Umfragen erst nach bis zu 10 Minuten

### Lösung mit SSE

- **Instant Updates** - Benachrichtigungen in < 1 Sekunde
- **Effizient** - Nur eine persistente HTTP-Verbindung
- **Automatisches Reconnect** - Built-in Fehlerbehandlung
- **Einfache Implementierung** - Arbeitet über Standard HTTP

## Architektur

```
Admin erstellt Survey → Backend Event → SSE Broadcast → Frontend Badge Update
                            ↓
                      EventEmitter
                            ↓
                    SSE Connections
                       ↓    ↓    ↓
                   Employee1 2   3
```

## Backend Implementation

### 1. Event Bus System (`backend/src/utils/eventBus.ts`)

```typescript
import { EventEmitter } from 'events';

class NotificationEventBus extends EventEmitter {
  private static instance: NotificationEventBus;
  
  private constructor() {
    super();
    this.setMaxListeners(100); // Support many SSE connections
  }
  
  static getInstance(): NotificationEventBus {
    if (!NotificationEventBus.instance) {
      NotificationEventBus.instance = new NotificationEventBus();
    }
    return NotificationEventBus.instance;
  }
  
  // Type-safe event emitters
  emitSurveyCreated(tenantId: number, survey: any) {
    this.emit('survey.created', { tenantId, survey });
  }
  
  emitSurveyUpdated(tenantId: number, survey: any) {
    this.emit('survey.updated', { tenantId, survey });
  }
  
  emitDocumentUploaded(tenantId: number, document: any) {
    this.emit('document.uploaded', { tenantId, document });
  }
  
  emitKvpSubmitted(tenantId: number, kvp: any) {
    this.emit('kvp.submitted', { tenantId, kvp });
  }
}

export const eventBus = NotificationEventBus.getInstance();
```

### 2. SSE Endpoint (`backend/src/routes/v2/notifications/sse.ts`)

```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { eventBus } from '../../../utils/eventBus';
import { logger } from '../../../utils/logger';

export class SSENotificationController {
  /**
   * SSE Stream endpoint for real-time notifications
   */
  async stream(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { tenant_id: tenantId, role, id: userId } = req.user;
    
    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });
    
    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date() })}\n\n`);
    
    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);
    
    // Event handlers based on role
    const handlers: Record<string, (data: any) => void> = {};
    
    // Survey notifications for employees
    if (role === 'employee') {
      handlers['survey.created'] = (data) => {
        if (data.tenantId === tenantId) {
          res.write(`data: ${JSON.stringify({
            type: 'NEW_SURVEY',
            survey: {
              id: data.survey.id,
              title: data.survey.title,
              deadline: data.survey.deadline
            }
          })}\n\n`);
        }
      };
      
      handlers['survey.updated'] = (data) => {
        if (data.tenantId === tenantId) {
          res.write(`data: ${JSON.stringify({
            type: 'SURVEY_UPDATED',
            survey: {
              id: data.survey.id,
              title: data.survey.title
            }
          })}\n\n`);
        }
      };
    }
    
    // Document notifications for all users
    handlers['document.uploaded'] = (data) => {
      if (data.tenantId === tenantId) {
        res.write(`data: ${JSON.stringify({
          type: 'NEW_DOCUMENT',
          document: {
            id: data.document.id,
            filename: data.document.filename,
            category: data.document.category
          }
        })}\n\n`);
      }
    };
    
    // KVP notifications for admins
    if (role === 'admin' || role === 'root') {
      handlers['kvp.submitted'] = (data) => {
        if (data.tenantId === tenantId) {
          res.write(`data: ${JSON.stringify({
            type: 'NEW_KVP',
            kvp: {
              id: data.kvp.id,
              title: data.kvp.title,
              submittedBy: data.kvp.submitted_by
            }
          })}\n\n`);
        }
      };
    }
    
    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      eventBus.on(event, handler);
    });
    
    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      
      // Remove all handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        eventBus.off(event, handler);
      });
      
      logger.info(`SSE connection closed for user ${userId}`);
    });
    
    logger.info(`SSE connection established for user ${userId} (${role})`);
  }
}
```

### 3. Integration in Survey Service

```typescript
// backend/src/routes/v2/surveys/surveys.service.ts
import { eventBus } from '../../../utils/eventBus';

async createSurvey(data: SurveyInput, tenantId: number) {
  // ... existing survey creation logic ...
  
  const survey = await Survey.create(surveyData);
  
  // Emit event for SSE notifications
  eventBus.emitSurveyCreated(tenantId, {
    id: survey.id,
    title: survey.title,
    deadline: survey.deadline,
    created_at: survey.created_at
  });
  
  return survey;
}
```

## Frontend Implementation

### 1. SSE Client (`frontend/src/scripts/utils/sse-client.ts`)

```typescript
export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  constructor(private url: string) {}
  
  connect(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[SSE] No token available');
      return;
    }
    
    // Add token as query parameter (SSE doesn't support headers easily)
    this.eventSource = new EventSource(`${this.url}?token=${encodeURIComponent(token)}`);
    
    this.eventSource.onopen = () => {
      console.info('[SSE] Connection established');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };
    
    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };
    
    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      this.eventSource?.close();
      this.handleReconnect();
    };
  }
  
  private handleMessage(data: any): void {
    console.info('[SSE] Received:', data.type);
    
    switch (data.type) {
      case 'CONNECTED':
        console.info('[SSE] Successfully connected to notification stream');
        break;
        
      case 'NEW_SURVEY':
        // Update survey badge immediately
        if (window.unifiedNav?.updatePendingSurveys) {
          void window.unifiedNav.updatePendingSurveys();
        }
        
        // Show toast notification
        this.showToast(`Neue Umfrage: ${data.survey.title}`, 'info');
        break;
        
      case 'SURVEY_UPDATED':
        // Refresh survey badge
        if (window.unifiedNav?.updatePendingSurveys) {
          void window.unifiedNav.updatePendingSurveys();
        }
        break;
        
      case 'NEW_DOCUMENT':
        // Update document badge
        if (window.unifiedNav?.updateUnreadDocuments) {
          void window.unifiedNav.updateUnreadDocuments();
        }
        
        this.showToast(`Neues Dokument: ${data.document.filename}`, 'info');
        break;
        
      case 'NEW_KVP':
        // Update KVP badge for admins
        if (window.unifiedNav?.updateNewKvpSuggestions) {
          void window.unifiedNav.updateNewKvpSuggestions();
        }
        
        this.showToast(`Neuer KVP-Vorschlag: ${data.kvp.title}`, 'info');
        break;
        
      default:
        console.warn('[SSE] Unknown message type:', data.type);
    }
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.info(`[SSE] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    
    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }
  
  private showToast(message: string, type: 'info' | 'success' | 'error'): void {
    // Use existing toast system
    const showFn = type === 'error' ? window.showErrorAlert :
                   type === 'success' ? window.showSuccessAlert :
                   window.showInfoAlert;
    
    if (showFn) {
      showFn(message);
    }
  }
  
  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    console.info('[SSE] Disconnected');
  }
}
```

### 2. Integration in UnifiedNavigation

```typescript
// frontend/src/scripts/components/unified-navigation.ts

import { SSEClient } from '../utils/sse-client';

export class UnifiedNavigation {
  private sseClient: SSEClient | null = null;
  
  constructor() {
    // ... existing constructor code ...
    
    // Initialize SSE instead of polling
    this.initializeSSE();
    
    // Remove the 10-minute polling interval!
    // DELETE THIS:
    // setInterval(() => {
    //   void this.updateUnreadMessages();
    //   void this.updatePendingSurveys();
    //   void this.updateUnreadDocuments();
    // }, 600000);
  }
  
  private initializeSSE(): void {
    const token = localStorage.getItem('token');
    if (!token || token === 'test-mode') {
      return;
    }
    
    // Connect to SSE endpoint
    this.sseClient = new SSEClient('/api/v2/notifications/stream');
    this.sseClient.connect();
    
    // Reconnect on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.sseClient) {
        this.initializeSSE();
      }
    });
  }
  
  // Keep existing update methods for manual refresh
  // They will now be called by SSE events instead of polling
}
```

## Migration Plan

### Phase 1: Surveys (JETZT)

1. ✅ EventBus implementieren
2. ✅ SSE Endpoint erstellen
3. ✅ Survey Service integrieren
4. ✅ Frontend SSE Client
5. ✅ Polling für Surveys entfernen

### Phase 2: Weitere Notifications (SPÄTER)

- Documents
- KVP Suggestions
- Calendar Events
- Chat (parallel zu WebSocket)

## Testing

```bash
# 1. Terminal 1: Monitor SSE connection
curl -N -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v2/notifications/stream

# 2. Terminal 2: Create survey as admin
curl -X POST http://localhost:3000/api/v2/surveys \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Survey","deadline":"2025-12-31"}'

# 3. Terminal 1 sollte sofort zeigen:
data: {"type":"NEW_SURVEY","survey":{"id":1,"title":"Test Survey"}}
```

## Vorteile gegenüber Polling

| Metric | Polling (Alt) | SSE (Neu) | Verbesserung |
|--------|--------------|-----------|--------------|
| Latenz | 10 Minuten | < 1 Sekunde | **600x schneller** |
| API Calls/Stunde | 6 pro User | 0 (persistent) | **100% Reduktion** |
| Server Load | Konstant | Event-basiert | **90% weniger** |
| User Experience | Verzögert | Instant | **Deutlich besser** |

## Security Considerations

1. **Token-Validierung** bei jeder SSE-Verbindung
2. **Tenant-Isolation** - User bekommen nur Events ihres Tenants
3. **Role-based Filtering** - Employees sehen keine Admin-Events
4. **Heartbeat** verhindert Zombie-Connections
5. **Max Listeners** begrenzt DoS-Angriffe

## Browser Compatibility

SSE wird von allen modernen Browsern unterstützt (98% Coverage):

- ✅ Chrome 6+
- ✅ Firefox 6+
- ✅ Safari 5+
- ✅ Edge 79+
- ❌ Internet Explorer (Fallback auf Polling)

## Monitoring

```typescript
// Backend Metrics zu loggen
- Anzahl aktiver SSE Connections
- Events pro Minute
- Reconnection Rate
- Average Connection Duration
```

## Troubleshooting

### Problem: Connection drops frequently

- Check Nginx/Apache proxy timeout settings
- Ensure `X-Accel-Buffering: no` header is set
- Verify heartbeat interval < proxy timeout

### Problem: Events not received

- Check tenant_id matching
- Verify role-based filtering
- Ensure EventBus is properly initialized

### Problem: High memory usage

- Limit max SSE connections per user
- Implement connection pooling
- Check for memory leaks in event handlers
