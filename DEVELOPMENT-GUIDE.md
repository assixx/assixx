# Assixx Development Guide

> **Letzte Aktualisierung:** 26.05.2025  
> **Version:** 1.0.0

## 🚨 WICHTIG: Vor dem Start

1. **TODO-Liste lesen**: `cat /home/scs/projects/Assixx/TODO.md`
2. **CLAUDE.md prüfen**: Enthält spezielle Anweisungen für AI-Assistenten
3. **Git Status**: Immer prüfen vor Änderungen

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

## 🏗️ Projekt-Struktur

```
server/
├── index.js              # Hauptserver-Datei
├── models/               # Datenmodelle (User, Document, etc.)
├── routes/               # API-Routes (auth.js, users.js, etc.)
├── middleware/           # Auth, Tenant, Security Middleware
├── utils/                # Hilfsfunktionen (emailService, logger)
├── public/               # Frontend-Dateien
│   ├── css/             # Stylesheets
│   ├── js/              # Client-Scripts
│   └── *.html           # HTML-Seiten
└── database/            # Migrations & Schema
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
    message: 'Operation successful'
});

// Fehler
res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: errors
});
```

## 🧪 Testing

### Lokales Testen
```bash
# Server starten
npm start

# In neuem Terminal - API testen
curl http://localhost:3000/api/health

# Frontend testen
# Browser: http://localhost:3000
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

### Entwicklung
```bash
npm run dev  # Mit nodemon
```

### Production
```bash
npm start    # Ohne nodemon
```

Siehe [DEPLOYMENT.md](./DEPLOYMENT.md) für Cloud-Deployment.

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
        .then(user => user)
        .catch(err => { throw err; });
}
```

## 🐛 Debugging

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

### Chrome DevTools
- Network Tab: API-Calls prüfen
- Console: JavaScript-Fehler
- Application: LocalStorage/Cookies
- Sources: Breakpoints setzen

## 📚 Weiterführende Dokumentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System-Architektur
- [API-TEST-README.md](./server/API-TEST-README.md) - API-Dokumentation
- [SECURITY-IMPROVEMENTS.md](./server/SECURITY-IMPROVEMENTS.md) - Sicherheit
- [CLAUDE.md](./CLAUDE.md) - AI-Assistant Instructions