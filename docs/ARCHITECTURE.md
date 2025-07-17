# Assixx System-Architektur

> **Letzte Aktualisierung:** 06.01.2025  
> **Version:** 2.1.0 - Docker-Architektur hinzugefügt

## 🏗️ System-Übersicht

Assixx ist eine Multi-Tenant SaaS-Plattform für Industrieunternehmen, entwickelt mit modernen Web-Technologien und Fokus auf Skalierbarkeit, Sicherheit und Benutzerfreundlichkeit. Die Anwendung ist vollständig containerisiert und kann sowohl für Entwicklung als auch Produktion mit Docker bereitgestellt werden.

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

- **Node.js v18+ & Express.js mit TypeScript**
  - TypeScript für Type-Safety und bessere Entwicklererfahrung
  - MVC-Architektur (Model-View-Controller)
  - RESTful API Design
  - Service Layer für Business Logic
  - Middleware-basierte Architektur
  - Async/Await Pattern
  - Strict TypeScript Konfiguration für maximale Sicherheit

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

## 🐳 Docker Architecture

### Container-Setup

Assixx nutzt eine Multi-Container Docker-Architektur für konsistente Entwicklungs- und Produktionsumgebungen:

#### Container-Übersicht

1. **MySQL Container** (`assixx-db`)
   - MySQL 8.0 Server
   - Persistente Volumes für Datenspeicherung
   - Automatisches Schema-Setup beim ersten Start
   - Health-Checks für Verfügbarkeit

2. **Backend Container** (`assixx-backend`)
   - Node.js 18 Alpine Linux
   - Express.js TypeScript Anwendung
   - Abhängig vom MySQL Container
   - Auto-Restart bei Fehlern

3. **Frontend Container** (`assixx-frontend`)
   - Nginx Alpine Linux
   - Statische Asset-Bereitstellung
   - Reverse Proxy für API-Requests
   - Optimierte Caching-Headers

#### Entwicklung vs. Produktion

**Entwicklungsumgebung** (`docker-compose.dev.yml`):

- Volume-Mounts für Hot-Reload
- Nodemon für automatische Backend-Neustarts
- Vite Dev-Server für Frontend
- Erweiterte Logging-Ausgaben
- Ports: 3000 (Frontend), 3001 (Backend), 3306 (MySQL)

**Produktionsumgebung** (`docker-compose.yml`):

- Optimierte Multi-Stage Builds
- Minimale Alpine Images
- Production-optimierte Konfigurationen
- Gesundheitsprüfungen für alle Services
- Automatische Restart-Policies

#### Volume-Management

```yaml
volumes:
  mysql_data: # Persistente MySQL-Daten
  mysql_config: # MySQL-Konfiguration
  uploads: # Benutzer-Uploads
  logs: # Anwendungs-Logs
```

#### Netzwerk-Konfiguration

```yaml
networks:
  assixx-network:
    driver: bridge
    # Isoliertes Netzwerk für Container-Kommunikation
    # Frontend → Backend: http://backend:3001
    # Backend → MySQL: mysql://assixx-db:3306
```

### Monitoring Stack (Optional)

Für Produktionsumgebungen steht ein vollständiger Monitoring-Stack zur Verfügung (`docker-compose.monitoring.yml`):

- **Prometheus**: Metriken-Sammlung und -Speicherung
- **Grafana**: Visualisierung und Dashboards
- **Loki**: Log-Aggregation und -Analyse
- **Promtail**: Log-Sammlung von Containern
- **Alertmanager**: Alert-Verwaltung und -Routing

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
│  │                   MVC Architecture                   │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────┐  │    │
│  │  │Controllers │ │  Services  │ │     Models     │  │    │
│  │  └────────────┘ └────────────┘ └────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
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
├── backend/
│   ├── src/
│   │   ├── server.ts         # Server-Starter (TypeScript)
│   │   ├── app.ts           # Express App Konfiguration
│   │   ├── database.ts      # DB-Verbindungsmanagement
│   │   ├── websocket.ts     # Socket.io Setup
│   │   ├── controllers/     # MVC Controllers
│   │   ├── services/        # Business Logic Layer
│   │   ├── models/          # Datenmodelle
│   │   ├── routes/          # API-Routen
│   │   ├── middleware/      # Express Middleware
│   │   └── utils/           # Hilfsfunktionen
│   ├── tests/               # Test-Suite
│   └── scripts/             # Backend-Scripts
├── frontend/
│   ├── src/
│   │   ├── pages/           # HTML-Seiten
│   │   ├── scripts/         # Client-Scripts
│   │   ├── styles/          # CSS/Stylesheets
│   │   ├── assets/          # Bilder, Fonts
│   │   └── components/      # UI-Komponenten
│   └── dist/                # Build-Output
├── database/
│   ├── schema/              # Strukturierte SQL-Schemas
│   ├── migrations/          # Datenbank-Migrationen
│   └── docker-init.sql      # Docker DB-Initialisierung
├── infrastructure/
│   ├── docker/              # Docker-Dokumentation
│   ├── monitoring/          # Monitoring-Konfigurationen
│   └── nginx/               # Nginx-Konfigurationen
├── uploads/                 # User-Uploads
├── tools/                   # Entwickler-Tools
├── docker-compose.yml       # Production Docker Setup
├── docker-compose.dev.yml   # Development Docker Setup
├── docker-compose.monitoring.yml  # Monitoring Stack
├── Dockerfile               # Production Container
└── Dockerfile.dev           # Development Container
```

Details siehe [PROJEKTSTRUKTUR.md](./PROJEKTSTRUKTUR.md)

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
socket.emit("join_conversation", conversationId);
socket.emit("send_message", messageData);
socket.emit("typing", { conversationId, isTyping });

// Server → Client
socket.emit("new_message", messageData);
socket.emit("user_typing", { userId, userName, isTyping });
socket.emit("conversation_updated", conversationData);
```

## 🚦 Deployment-Architektur

### Docker-basiertes Deployment (Primäre Methode)

Docker ist die empfohlene Deployment-Methode für Assixx, sowohl für Entwicklung als auch Produktion:

#### Entwicklung

```bash
# Entwicklungsumgebung starten
docker-compose -f docker-compose.dev.yml up

# Mit Monitoring-Stack
docker-compose -f docker-compose.dev.yml -f docker-compose.monitoring.yml up
```

- Volume-Mounts für Live-Code-Änderungen
- Automatisches Neuladen bei Änderungen
- Vollständige Entwicklungsumgebung in Minuten

#### Production

```bash
# Produktionsumgebung starten
docker-compose up -d

# Mit Monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

- Optimierte Container-Images
- Automatische Gesundheitsprüfungen
- Restart-Policies für Hochverfügbarkeit
- Integrierte Backup-Strategien

### Cloud-Deployment Optionen

- **Docker Swarm**: Für kleine bis mittlere Deployments
- **Kubernetes**: Für Enterprise-Skalierung
- **AWS ECS/Fargate**: Serverless Container-Hosting
- **Google Cloud Run**: Automatische Skalierung
- **Azure Container Instances**: Einfaches Container-Hosting

### Traditionelles Deployment (Alternative)

- Cloud SQL (GCP) oder RDS (AWS)
- App Engine oder EC2/Compute Engine
- Load Balancer
- SSL/TLS Termination
- CDN für Assets

Details siehe [DEPLOYMENT.md](./DEPLOYMENT.md) und [DOCKER-SETUP.md](./DOCKER-SETUP.md)

## 📊 Monitoring & Logging

### Aktuell implementiert

- Console-basiertes Logging
- Error-Tracking
- Basic Performance-Metriken
- **Docker Monitoring Stack** (Optional):
  - **Prometheus**: Sammelt Metriken von allen Containern
  - **Grafana**: Vorkonfigurierte Dashboards für System- und Anwendungsmetriken
  - **Loki**: Zentralisierte Log-Sammlung und -Suche
  - **Promtail**: Automatische Log-Erfassung von Docker-Containern
  - **Alertmanager**: Konfigurierbare Alerts für kritische Ereignisse

### Monitoring-Stack Features

- **System-Metriken**: CPU, Memory, Disk, Network
- **Container-Metriken**: Ressourcennutzung pro Container
- **Anwendungs-Metriken**: Response-Zeiten, Request-Raten, Fehlerquoten
- **Log-Aggregation**: Zentrale Sammlung aller Container-Logs
- **Alert-Rules**: Vordefinierte Regeln für häufige Probleme

### Geplant

- Structured Logging (Winston) Integration
- Custom Application Metrics
- Real User Monitoring
- Database Query Analytics
- Distributed Tracing (Jaeger/Zipkin)

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
