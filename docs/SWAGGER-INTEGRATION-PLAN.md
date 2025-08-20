# 📚 Swagger/OpenAPI Integration Plan für Assixx

## 🎯 Übersicht

Dieser Plan beschreibt die schrittweise Integration von Swagger/OpenAPI in das Assixx-Projekt zur automatischen API-Dokumentation.

## 🚀 Ziele

1. **Automatische API-Dokumentation** - Immer aktuell mit dem Code
2. **Interaktives Testing** - Direkt im Browser ohne Postman
3. **TypeScript Integration** - Gemeinsame Types für Frontend/Backend
4. **Bessere Entwickler-Experience** - Neue Entwickler verstehen API sofort

## 📋 Voraussetzungen

- ✅ Express + TypeScript Backend
- ✅ pnpm als Package Manager
- ✅ Docker Development Environment
- ✅ JWT Authentication bereits implementiert

## 🛠️ Implementierungsplan

### Phase 1: Installation & Basic Setup (30 Min)

#### 1.1 Dependencies installieren

```bash
cd /home/scs/projects/Assixx
pnpm add swagger-jsdoc swagger-ui-express
pnpm add -D @types/swagger-jsdoc @types/swagger-ui-express
```

#### 1.2 Swagger-Konfiguration erstellen

**Neue Datei:** `backend/src/config/swagger.ts`

```typescript
import swaggerJsdoc from "swagger-jsdoc";
import { version } from "../../package.json";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Assixx API Documentation",
      version,
      description: "Multi-Tenant SaaS Platform für Industrieunternehmen",
      contact: {
        name: "SCS-Technik",
        email: "support@scs-technik.de",
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production" ? "https://api.assixx.com/api" : "http://localhost:3000/api",
        description: process.env.NODE_ENV === "production" ? "Production" : "Development",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {}, // Wird mit Model-Definitionen gefüllt
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./backend/src/routes/*.ts",
    "./backend/src/routes/**/*.ts",
    "./backend/src/models/*.ts",
    "./backend/src/types/*.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
```

#### 1.3 Swagger UI in app.ts einbinden

```typescript
// backend/src/app.ts
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

// Nach Security-Middleware, vor Routes
app.use(
  "/api-docs",
  (req, res, next) => {
    // Nur in Development oder für Admins
    if (process.env.NODE_ENV === "development" || req.user?.role === "admin" || req.user?.role === "root") {
      next();
    } else {
      res.status(403).json({ error: "Access denied" });
    }
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Assixx API Docs",
    customfavIcon: "/favicon.ico",
  }),
);
```

### Phase 2: Core Routes dokumentieren (1-2 Std)

#### 2.1 Authentication Routes

```typescript
// backend/src/routes/auth.ts

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePassword123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post("/login", authLimiter, authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */
router.post("/logout", authenticateToken, authController.logout);
```

#### 2.2 Model Schemas definieren

```typescript
// backend/src/models/user.ts

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique user ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         first_name:
 *           type: string
 *           description: User's first name
 *         last_name:
 *           type: string
 *           description: User's last name
 *         role:
 *           type: string
 *           enum: [root, admin, employee]
 *           description: User role in the system
 *         tenant_id:
 *           type: integer
 *           description: Associated tenant ID
 *         department_id:
 *           type: integer
 *           nullable: true
 *           description: Associated department ID
 *         is_active:
 *           type: boolean
 *           description: Whether the user account is active
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */
```

### Phase 3: Feature-Routes dokumentieren (2-3 Std)

#### Priorität nach Nutzungshäufigkeit

1. **Dashboard/Stats Routes**

```typescript
/**
 * @swagger
 * /admin/dashboard-stats:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalEmployees:
 *                   type: integer
 *                 totalDocuments:
 *                   type: integer
 *                 totalDepartments:
 *                   type: integer
 *                 totalTeams:
 *                   type: integer
 */
```

2. **Employee Management**
3. **Documents API**
4. **Blackboard/Schwarzes Brett**
5. **KVP System**
6. **Calendar**
7. **Chat**
8. **Shift Planning**

### Phase 4: Advanced Features (1 Std)

#### 4.1 Request/Response Examples

```typescript
/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Upload a new document
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 enum: [company, personal, department, team]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               id: 123
 *               filename: "example.pdf"
 *               size: 1024000
 *               uploaded_at: "2025-06-23T10:00:00Z"
 */
```

#### 4.2 Error Response Schemas

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         code:
 *           type: string
 *           description: Error code
 *         details:
 *           type: object
 *           description: Additional error details
 */
```

### Phase 5: Testing & Optimierung (1 Std)

#### 5.1 Docker Integration testen

```bash
# Backend neu starten
cd docker && docker-compose restart backend

# Swagger UI öffnen
open http://localhost:3000/api-docs

# Health Check
curl http://localhost:3000/api-docs/swagger.json
```

#### 5.2 Swagger UI Anpassungen

```typescript
// Erweiterte Konfiguration
const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin-bottom: 20px }
    .swagger-ui .scheme-container { display: none }
  `,
  customSiteTitle: "Assixx API Documentation",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    docExpansion: "none",
    filter: true,
    showRequestDuration: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
  },
};
```

### Phase 6: Automatisierung (Optional)

#### 6.1 TypeScript Types Generation

```json
// package.json
{
  "scripts": {
    "swagger:generate": "tsx backend/src/config/swagger.ts",
    "swagger:types": "openapi-typescript http://localhost:3000/api-docs/swagger.json --output frontend/src/types/api.d.ts",
    "swagger:validate": "swagger-cli validate http://localhost:3000/api-docs/swagger.json"
  }
}
```

#### 6.2 CI/CD Integration

```yaml
# .github/workflows/swagger.yml
name: Swagger Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate OpenAPI spec
        run: |
          pnpm install
          pnpm run swagger:validate
```

## 📊 Zeitplan & Meilensteine

| Phase   | Zeitaufwand | Meilenstein                               | Status           |
| ------- | ----------- | ----------------------------------------- | ---------------- |
| Phase 1 | 30 Min      | Basic Setup fertig, Swagger UI erreichbar | ✅ Abgeschlossen |
| Phase 2 | 1-2 Std     | Auth & Core Models dokumentiert           | 🔄 In Arbeit     |
| Phase 3 | 2-3 Std     | Alle Feature-Routes dokumentiert          | ⏳ Ausstehend    |
| Phase 4 | 1 Std       | Examples & Error Handling komplett        | ⏳ Ausstehend    |
| Phase 5 | 1 Std       | Testing & UI-Optimierungen                | ⏳ Ausstehend    |
| Phase 6 | Optional    | Automatisierung implementiert             | ⏳ Optional      |

**Gesamt: 1-2 Tage für vollständige Integration**

### ✅ Bisher abgeschlossen

#### Phase 1 (Komplett)

- ✅ Dependencies installiert (swagger-jsdoc, swagger-ui-express)
- ✅ Swagger-Konfiguration erstellt (`backend/src/config/swagger.ts`)
- ✅ Swagger UI in app.ts eingebunden
- ✅ Swagger UI erreichbar unter <http://localhost:3000/api-docs>
- ✅ JSON Spec erreichbar unter <http://localhost:3000/api-docs/swagger.json>

#### Phase 2 (Teilweise)

- ✅ Authentication Routes dokumentiert:
  - `/auth/login` - User login mit Fingerprint-Support
  - `/auth/logout` - User logout
  - `/auth/register` - User registration
  - `/auth/validate` - Token validation
- ✅ User Schema definiert
- ✅ Error Schema definiert
- ✅ LoginRequest & LoginResponse Schemas hinzugefügt
- 🔄 Weitere Core Routes ausstehend...

## ✅ Erwartete Ergebnisse

1. **Swagger UI** unter `http://localhost:3000/api-docs`
2. **50+ Endpoints** vollständig dokumentiert
3. **Interaktives Testing** direkt im Browser
4. **Automatische Type-Generation** für Frontend
5. **Bessere Entwickler-Experience** für neue Team-Mitglieder

## 🔒 Sicherheit

- Swagger UI nur für Development oder authentifizierte Admins/Root
- Keine sensiblen Daten in Examples
- Production-Server URLs nur in Production-Build

## 📝 Best Practices

1. **Konsistente Namensgebung** - REST-konform
2. **Aussagekräftige Descriptions** - Nicht nur technisch
3. **Realistische Examples** - Mit echten Datenformaten
4. **Versionierung beachten** - API-Version in URL oder Header
5. **Tags sinnvoll gruppieren** - Nach Features, nicht nach Routes

## 🚨 Wichtige Hinweise

- Swagger-Kommentare direkt über den Route-Definitionen
- Bei Model-Änderungen auch Swagger-Schema anpassen
- Regelmäßig `swagger.json` validieren
- In Production Swagger UI absichern oder deaktivieren

---

**Erstellt:** 23.06.2025  
**Status:** Bereit zur Implementierung  
**Verantwortlich:** Development Team
