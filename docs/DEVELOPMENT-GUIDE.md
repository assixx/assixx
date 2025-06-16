# Assixx Development Guide

> **Letzte Aktualisierung:** 06.02.2025  
> **Version:** 2.0.0

## 🚨 WICHTIG: Vor dem Start

1. **TODO-Liste lesen**: `cat /home/scs/projects/Assixx/TODO.md`
2. **CLAUDE.md prüfen**: Enthält spezielle Anweisungen für AI-Assistenten
3. **Git Status**: Immer prüfen vor Änderungen
4. **Docker installiert?**: Docker Desktop oder Docker Engine benötigt

## 🐳 Docker Development Workflow (EMPFOHLEN)

Docker ist die empfohlene Entwicklungsmethode für Assixx, da es eine konsistente Umgebung für alle Entwickler bietet.

### 🚀 Development starten mit Docker

```bash
# 1. Vollständige Entwicklungsumgebung starten
docker-compose up

# 2. Im Hintergrund ausführen
docker-compose up -d

# 3. Nur bestimmte Services starten
docker-compose up backend frontend

# 4. Mit Live-Logs
docker-compose up --follow
```

### 🔄 Live-Reload Funktionen

- **Backend**: Nodemon überwacht automatisch alle TypeScript-Änderungen
- **Frontend**: Vite HMR (Hot Module Replacement) für sofortige Updates
- **Datenbank**: Persistent Volume, Änderungen bleiben erhalten

### 🧪 Tests in Docker ausführen

```bash
# Unit Tests im Backend Container
docker-compose exec backend pnpm test

# Integration Tests
docker-compose exec backend pnpm run test:integration

# Frontend Tests
docker-compose exec frontend pnpm test

# Alle Tests auf einmal
docker-compose run --rm backend pnpm run test:all
```

### 📊 Logs und Debugging

```bash
# Alle Logs anzeigen
docker-compose logs

# Logs eines bestimmten Services
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql

# Live-Logs folgen
docker-compose logs -f backend

# Letzte 100 Zeilen
docker-compose logs --tail=100 backend

# In Container einloggen für Debugging
docker-compose exec backend bash
docker-compose exec mysql mysql -u root -p
```

### 🛠️ Docker-spezifische Debugging Tipps

1. **Container neu bauen nach Dependency-Änderungen**:

   ```bash
   docker-compose build --no-cache backend
   docker-compose up
   ```

2. **Volumes prüfen**:

   ```bash
   docker volume ls
   docker volume inspect assixx_mysql_data
   ```

3. **Netzwerk-Debugging**:

   ```bash
   # Container IPs anzeigen
   docker network inspect assixx_default

   # Verbindung zwischen Containern testen
   docker-compose exec backend ping mysql
   ```

4. **Performance-Probleme**:

   ```bash
   # Resource-Nutzung anzeigen
   docker stats

   # Container-Prozesse
   docker-compose top
   ```

5. **Logs in Datei speichern**:
   ```bash
   docker-compose logs > debug.log
   ```

### 🔧 Häufige Docker-Befehle

```bash
# Alles stoppen und aufräumen
docker-compose down

# Mit Volumes löschen (VORSICHT: Löscht Datenbank!)
docker-compose down -v

# Einzelnen Container neustarten
docker-compose restart backend

# Status prüfen
docker-compose ps

# Environment-Variablen prüfen
docker-compose exec backend env

# Datenbank-Backup erstellen
docker-compose exec mysql mysqldump -u root -p assixx > backup.sql
```

## 🖥️ Alternative: Lokale Entwicklung (Fallback)

Falls Docker nicht verfügbar ist, kann auch lokal entwickelt werden:

```bash
# Backend starten
cd backend
pnpm dev  # Mit nodemon und TypeScript

# Frontend in neuem Terminal
cd frontend
pnpm dev  # Vite Dev Server
```

**Hinweis**: Die lokale Entwicklung erfordert:

- Node.js 18+
- MySQL 8.0+
- pnpm installiert (`npm install -g pnpm`)
- Korrekte .env Konfiguration
- Alle pnpm dependencies installiert

## 📝 Code-Kommentierung Standards

### JavaScript Funktionen

```javascript
// Validiert die Subdomain-Eingabe und zeigt Fehler an
// @param {string} value - Die eingegebene Subdomain
// @returns {boolean} - True wenn gültig, false wenn ungültig
function validateSubdomain(value) {
  // Regex für erlaubte Zeichen: a-z, 0-9, Bindestrich
  const regex = /^[a-z0-9-]+$/;
  return regex.test(value);
}
```

### CSS Strukturierung

```css
/* ========================================
   HEADER SECTION - Glassmorphismus Design
   ======================================== */
.header {
  /* Transparenter Hintergrund mit Blur für Glaseffekt */
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(20px) saturate(180%);
}
```

### HTML Bereiche

```html
<!-- Signup Form - 3 Spalten Layout für 16-Zoll Monitore -->
<!-- Erste Zeile: Firma, Subdomain, Email -->
<div class="form-grid">
  <!-- Form fields -->
</div>
```

## 🎨 Design Standards

Siehe [CLAUDE.md](./CLAUDE.md#-glassmorphismus-design-standards-immer-verwenden) für vollständige Glassmorphismus Design-Standards.

## 🏛️ MVC-Architektur

### Model-View-Controller Pattern

```typescript
// Model (backend/src/models/user.ts)
export class User {
  static async findById(id: number): Promise<User | null> {
    // Datenbanklogik
  }
}

// Controller (backend/src/controllers/user.controller.ts)
import { Request, Response } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await UserService.findById(parseInt(req.params.id));
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

// Service (backend/src/services/user.service.ts)
import { User } from '../models/user';

export class UserService {
  static async findById(id: number): Promise<User | null> {
    // Business Logic
    const user = await User.findById(id);
    return this.sanitizeUser(user);
  }
}

// Route (backend/src/routes/users.ts)
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { userController } from '../controllers/user.controller';

const router = Router();
router.get('/:id', authenticate, userController.getUser);
```

### Separation of Concerns

- **Models**: Datenbankzugriff und Datenstrukturen
- **Controllers**: HTTP Request/Response Handling
- **Services**: Business Logic und Datenverarbeitung
- **Routes**: URL-Mapping und Middleware-Konfiguration
- **Middleware**: Cross-cutting Concerns (Auth, Validation, etc.)

## 🏗️ Projekt-Struktur

```
backend/
├── src/                  # Source Code
│   ├── app.ts           # Express App Konfiguration
│   ├── server.ts        # Server Bootstrap
│   ├── controllers/     # MVC Controllers
│   ├── models/          # Datenmodelle (User, Document, etc.)
│   ├── routes/          # API-Routes (auth.js, users.js, etc.)
│   ├── middleware/      # Auth, Tenant, Security Middleware
│   ├── services/        # Business Logic Services
│   ├── utils/           # Hilfsfunktionen (emailService, logger)
│   └── database/        # Migrations & Schema
├── tests/                # Test-Dateien
│   ├── unit/           # Unit Tests
│   ├── integration/    # Integration Tests
│   └── e2e/            # End-to-End Tests
├── scripts/              # Utility Scripts
└── logs/                 # Log-Dateien

frontend/
├── src/                  # Frontend Source Code
│   ├── pages/          # HTML-Seiten
│   ├── scripts/        # JavaScript/TypeScript
│   ├── styles/         # CSS/SCSS
│   ├── assets/         # Bilder, Fonts
│   └── components/     # UI-Komponenten
└── dist/                 # Build Output
```

## 🔐 Sicherheits-Best-Practices

### Niemals im Code

- Passwörter oder Secrets hardcoden
- Console.log mit sensiblen Daten
- SQL-Queries ohne Prepared Statements
- User-Input ohne Validierung verwenden

### Immer implementieren

- JWT-Token Validierung
- Tenant-Isolation Checks
- Input-Sanitization
- Error-Handling ohne Info-Leaks

## 🌐 API-Entwicklung

### RESTful Endpoints

```javascript
// GET - Liste abrufen
router.get('/api/users', authenticate, tenantMiddleware, async (req, res) => {
  // Implementation
});

// POST - Ressource erstellen
router.post('/api/users', authenticate, validateInput, async (req, res) => {
  // Implementation
});
```

### Response-Format

```javascript
// Erfolg
res.json({
  success: true,
  data: result,
  message: 'Operation successful',
});

// Fehler
res.status(400).json({
  success: false,
  error: 'Validation failed',
  details: errors,
});
```

## 🧪 Testing

### Testen mit Docker (EMPFOHLEN)

```bash
# Gesamte Entwicklungsumgebung starten
docker-compose up

# API Health Check
curl http://localhost:3000/api/health

# Frontend im Browser
# http://localhost:3000 (Production Build)
# http://localhost:5173 (Vite Dev Server)

# Tests ausführen
docker-compose exec backend pnpm test
```

### Alternative: Lokales Testen

```bash
# Backend starten
cd backend
pnpm start

# In neuem Terminal - API testen
curl http://localhost:3000/api/health

# Frontend testen (falls separater Dev-Server)
cd frontend
pnpm dev
# Browser: http://localhost:5173 (Vite) oder http://localhost:3000 (Express)
```

### Test-Accounts

- **Root**: root@test.com / test123
- **Admin**: admin@test.com / test123
- **Employee**: employee@test.com / test123

## 📦 Dependencies

### Wichtige Packages

- `express`: Web-Framework
- `mysql2`: MySQL-Connector
- `jsonwebtoken`: JWT-Auth
- `bcrypt`: Password-Hashing
- `socket.io`: WebSocket
- `multer`: File-Upload
- `nodemailer`: E-Mail

### Dev-Dependencies

- `nodemon`: Auto-Restart
- `eslint`: Code-Linting
- `prettier`: Code-Formatting

## 🚀 Deployment

### Entwicklung mit Docker (EMPFOHLEN)

```bash
# Development Environment starten
docker-compose up

# Oder im Hintergrund
docker-compose up -d

# Logs prüfen
docker-compose logs -f
```

### Alternative: Lokale Entwicklung

```bash
cd backend
pnpm dev  # Mit nodemon und TypeScript

# Frontend in separatem Terminal
cd frontend
pnpm dev
```

### Production mit Docker

```bash
# Production Build erstellen
docker-compose -f docker-compose.yml build

# Production starten
docker-compose -f docker-compose.yml up -d

# Mit Monitoring Stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Alternative: Production ohne Docker

```bash
cd backend
pnpm build  # TypeScript kompilieren
pnpm start  # Production Server

cd frontend
pnpm build  # Production Build
# Static files werden von Express ausgeliefert
```

Siehe [DEPLOYMENT.md](./DEPLOYMENT.md) für Cloud-Deployment und [DOCKER-SETUP.md](./DOCKER-SETUP.md) für detaillierte Docker-Konfiguration.

## 📐 Code-Standards

### Naming Conventions

- **Variablen**: camelCase (`userName`, `isActive`)
- **Konstanten**: UPPER_SNAKE (`MAX_RETRIES`, `API_KEY`)
- **Klassen**: PascalCase (`UserModel`, `ChatService`)
- **Dateien**: kebab-case (`user-profile.js`, `admin-dashboard.html`)

### Async/Await Pattern

```javascript
// ✅ Gut
async function getUser(id) {
  try {
    const user = await UserModel.findById(id);
    return user;
  } catch (error) {
    logger.error('User fetch failed:', error);
    throw error;
  }
}

// ❌ Vermeiden
function getUser(id) {
  return UserModel.findById(id)
    .then((user) => user)
    .catch((err) => {
      throw err;
    });
}
```

## 🐛 Debugging

### Docker Container Debugging

```bash
# Live-Logs eines Services
docker-compose logs -f backend

# In Container Shell öffnen
docker-compose exec backend bash

# Node.js Debugger in Docker
# 1. In docker-compose.yml: command: ["node", "--inspect=0.0.0.0:9229", "dist/server.js"]
# 2. Port mapping: ports: ["9229:9229"]
# 3. Chrome: chrome://inspect

# MySQL Queries debuggen
docker-compose exec mysql mysql -u root -p -e "SHOW PROCESSLIST;"

# Environment prüfen
docker-compose exec backend printenv
```

### Console Logs

```javascript
// Entwicklung
console.log('🔍 Debug:', variable);
console.error('❌ Error:', error);
console.warn('⚠️ Warning:', message);

// Production - Nutze Logger
logger.info('User action', { userId, action });
logger.error('System error', { error, context });
```

### Logs in Docker finden

```bash
# Backend Logs
docker-compose exec backend tail -f logs/app.log
docker-compose exec backend tail -f logs/error.log

# Alle Logs exportieren
docker-compose logs > full-debug.log 2>&1
```

### Chrome DevTools

- Network Tab: API-Calls prüfen
- Console: JavaScript-Fehler
- Application: LocalStorage/Cookies
- Sources: Breakpoints setzen

### Docker-spezifische Probleme lösen

1. **"Cannot connect to MySQL"**:

   ```bash
   # Warten bis MySQL bereit ist
   docker-compose exec backend nc -zv mysql 3306
   ```

2. **"EADDRINUSE: Port already in use"**:

   ```bash
   # Prozess auf Port finden
   lsof -i :3000
   # Oder Docker bereinigen
   docker-compose down
   docker system prune
   ```

3. **"Module not found"**:
   ```bash
   # Container neu bauen
   docker-compose build --no-cache backend
   ```

## 📚 Weiterführende Dokumentation

- [DOCKER-SETUP.md](./DOCKER-SETUP.md) - Docker Konfiguration und Setup
- [DOCKER-BEGINNERS-GUIDE.md](./DOCKER-BEGINNERS-GUIDE.md) - Docker Einsteiger-Guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System-Architektur
- [API-TEST-README.md](./backend/API-TEST-README.md) - API-Dokumentation
- [SECURITY-IMPROVEMENTS.md](./backend/SECURITY-IMPROVEMENTS.md) - Sicherheit
- [CLAUDE.md](./CLAUDE.md) - AI-Assistant Instructions
