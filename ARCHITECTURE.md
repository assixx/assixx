# Assixx System-Architektur

> **Letzte Aktualisierung:** 26.05.2025  
> **Version:** 1.0.0

## 🏗️ System-Übersicht

Assixx ist eine Multi-Tenant SaaS-Plattform für Industrieunternehmen, entwickelt mit modernen Web-Technologien und Fokus auf Skalierbarkeit, Sicherheit und Benutzerfreundlichkeit.

## 🔧 Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript (Vanilla)**
  - Kein Framework-Overhead
  - Maximale Performance
  - Direkte DOM-Manipulation
  
- **CSS-Architektur**
  - Glassmorphismus Design-System
  - CSS Custom Properties (Variables)
  - Mobile-First Responsive Design
  - BEM-ähnliche Namenskonvention

- **JavaScript-Bibliotheken**
  - Socket.io Client (Echtzeit-Kommunikation)
  - FullCalendar.js (Kalender-Funktionalität)
  - Chart.js (Datenvisualisierung - geplant)

### Backend
- **Node.js v18+ & Express.js**
  - RESTful API Design
  - Middleware-basierte Architektur
  - Async/Await Pattern

- **Datenbank**
  - MySQL 8.0+
  - Multi-Tenant Architektur (Schema-Separation)
  - Connection Pooling
  - Prepared Statements

- **Echtzeit-Features**
  - Socket.io für WebSocket-Kommunikation
  - Event-basierte Architektur
  - Room-basierte Isolation

### Sicherheit
- **Authentifizierung**
  - JWT (JSON Web Tokens)
  - Bcrypt für Passwort-Hashing
  - 24-Stunden Token-Expiration

- **Autorisierung**
  - Role-Based Access Control (RBAC)
  - Tenant-Isolation
  - API-Rate-Limiting

## 📐 Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Browser)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   HTML/CSS  │  │  JavaScript  │  │  Socket.io Client│   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┴───────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Express.js │  │   REST API   │  │  Socket.io Server│   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Middleware Layer                        │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐ │    │
│  │  │  Auth  │ │ Tenant │ │Security│ │  Validation │ │    │
│  │  └────────┘ └────────┘ └────────┘ └─────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    Database Layer (MySQL)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ System DB   │  │  Tenant DB 1 │  │   Tenant DB 2   │   │
│  │ (Tenants,   │  │ (Users,Docs, │  │  (Users,Docs,   │   │
│  │  Features)  │  │  Chats, etc) │  │   Chats, etc)   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 💾 Datenbank-Design

### Multi-Tenant Strategie
- **Schema-per-Tenant**: Jeder Mandant hat eigene Datenbank
- **Shared System DB**: Zentrale Verwaltung von Tenants und Features
- **Connection Pool**: Optimierte Verbindungsverwaltung

### Haupt-Tabellen (39 insgesamt)

#### System-Datenbank
- `tenants` - Mandantenverwaltung
- `features` - Feature-Definitionen
- `feature_management` - Feature-Aktivierung pro Tenant

#### Tenant-Datenbanken
- `users` - Benutzerverwaltung
- `departments` - Abteilungen
- `teams` - Teams
- `documents` - Dokumentenverwaltung
- `blackboard_entries` - Schwarzes Brett
- `calendar_events` - Kalendereinträge
- `chat_conversations` - Chat-Konversationen
- `chat_messages` - Chat-Nachrichten
- `kvp_suggestions` - KVP-Vorschläge
- `shifts` - Schichtpläne
- `surveys` - Umfragen
- Und 28 weitere...

Vollständiges Schema siehe [DATABASE-SETUP-README.md](./DATABASE-SETUP-README.md#database-schema)

## 🔐 Sicherheitsarchitektur

### Schichten-Modell
1. **Frontend-Validierung** (Client-seitig)
2. **API-Gateway** (Rate-Limiting, CORS)
3. **Middleware-Security** (Auth, Tenant-Check)
4. **Business-Logic-Validation**
5. **Database-Constraints**

### Implementierte Maßnahmen
- SQL-Injection Schutz (Prepared Statements)
- XSS-Prävention (Input-Sanitization)
- CSRF-Token (geplant)
- Secure Headers (teilweise)
- Tenant-Isolation

Details siehe [SECURITY-IMPROVEMENTS.md](./server/SECURITY-IMPROVEMENTS.md)

## 🚀 Performance-Optimierungen

### Frontend
- Lazy Loading für Bilder
- CSS/JS Minification (Production)
- Browser-Caching
- CDN für statische Assets (geplant)

### Backend
- Connection Pooling
- Query-Optimierung mit Indizes
- Caching-Strategy (geplant)
- Horizontal Scaling Ready

### Database
- Optimierte Indizes
- Query-Performance-Monitoring
- Backup-Strategie
- Read-Replicas (geplant)

## 📁 Projekt-Struktur

```
Assixx/
├── server/
│   ├── index.js              # Hauptserver-Datei
│   ├── database.js           # DB-Verbindungsmanagement
│   ├── websocket.js          # Socket.io Setup
│   ├── models/               # Datenmodelle
│   ├── routes/               # API-Routen
│   ├── middleware/           # Express Middleware
│   ├── utils/                # Hilfsfunktionen
│   └── public/               # Statische Dateien
│       ├── css/              # Stylesheets
│       ├── js/               # Client-Scripts
│       └── *.html            # HTML-Seiten
├── database/                 # DB-Migrations & Schema
├── docs/                     # Dokumentation
└── scripts/                  # Setup & Utility Scripts
```

## 🔄 API-Design

### RESTful Endpoints
```
GET    /api/users          # Liste aller Benutzer
POST   /api/users          # Neuen Benutzer erstellen
GET    /api/users/:id      # Einzelnen Benutzer abrufen
PUT    /api/users/:id      # Benutzer aktualisieren
DELETE /api/users/:id      # Benutzer löschen
```

### WebSocket Events
```javascript
// Client → Server
socket.emit('join_conversation', conversationId)
socket.emit('send_message', messageData)
socket.emit('typing', { conversationId, isTyping })

// Server → Client
socket.emit('new_message', messageData)
socket.emit('user_typing', { userId, userName, isTyping })
socket.emit('conversation_updated', conversationData)
```

## 🚦 Deployment-Architektur

### Entwicklung
- Lokale MySQL-Instanz
- Node.js Development Server
- Hot-Reload für Frontend

### Production (Empfohlen)
- Cloud SQL (GCP) oder RDS (AWS)
- App Engine oder EC2/Compute Engine
- Load Balancer
- SSL/TLS Termination
- CDN für Assets

Details siehe [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📊 Monitoring & Logging

### Aktuell implementiert
- Console-basiertes Logging
- Error-Tracking
- Basic Performance-Metriken

### Geplant
- Structured Logging (Winston)
- APM Integration (New Relic/Datadog)
- Real User Monitoring
- Database Query Analytics

## 🔮 Zukünftige Architektur-Erweiterungen

### Microservices (Langfristig)
- Auth-Service
- Document-Service
- Notification-Service
- Analytics-Service

### Message Queue
- RabbitMQ/Redis für asynchrone Tasks
- Event-Sourcing für Audit-Trail
- CQRS für Read/Write Separation

### Caching Layer
- Redis für Session-Management
- Query-Result-Caching
- Static Asset Caching

## 📚 Weiterführende Dokumentation

- [Feature-Übersicht](./FEATURES.md)
- [Setup-Anleitung](./SETUP-QUICKSTART.md)
- [API-Dokumentation](./server/API-TEST-README.md)
- [Entwickler-Guide](./DEVELOPMENT-GUIDE.md)