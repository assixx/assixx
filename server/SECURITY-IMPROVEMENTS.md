# Assixx Security Improvements - PRIORISIERT

## KRITISCH - Sofort umsetzen

### 1. HTTPS/TLS erzwingen
```javascript
// In server.js hinzufügen
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
});
```

### 2. Security Headers aktivieren
```javascript
// In server.js nach den Imports
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS mit Whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://*.assixx.com'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.some(allowed => 
            origin.match(new RegExp(allowed.replace(/\*/g, '.*'))))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

### 3. Token-Logging entfernen
```javascript
// In middleware/auth.js - diese Zeile entfernen:
// console.log('Token:', token);
```

### 4. Tenant-Kontext-Validierung
```javascript
// Neue Middleware für Tenant-Validierung
function validateTenantContext(req, res, next) {
    const userTenant = req.user?.tenantId;
    const requestTenant = req.tenant?.id;
    
    if (userTenant && requestTenant && userTenant !== requestTenant) {
        return res.status(403).json({ error: 'Tenant access violation' });
    }
    next();
}
```

## HOCH - Innerhalb 1 Woche

### 1. JWT-Secret Rotation
```javascript
// Umgebungsvariablen:
JWT_SECRET_CURRENT=<neuer-secret>
JWT_SECRET_PREVIOUS=<alter-secret>
JWT_ROTATION_DATE=2024-01-01

// Token-Verifizierung mit Rotation
function verifyTokenWithRotation(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET_CURRENT);
    } catch (error) {
        if (error.name === 'TokenExpiredError') throw error;
        return jwt.verify(token, process.env.JWT_SECRET_PREVIOUS);
    }
}
```

### 2. Subdomain-Whitelist
```javascript
// In middleware/tenant.js
const ALLOWED_TENANTS = new Set(['bosch', 'mercedes', 'siemens']);

if (!ALLOWED_TENANTS.has(tenantId)) {
    return res.status(404).send('Tenant not found');
}
```

### 3. CSRF-Protection
```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Für alle State-Changing Operations
app.post('*', csrfProtection);
app.put('*', csrfProtection);
app.delete('*', csrfProtection);
```

### 4. Session-Management mit Redis
```javascript
const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
});

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'strict'
    }
}));
```

## MITTEL - Innerhalb 1 Monat

### 1. Audit-Logging
```javascript
// Neue Tabelle: security_audit_logs
CREATE TABLE security_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id VARCHAR(50),
    user_id INT,
    action VARCHAR(100),
    resource VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// Audit-Middleware
function auditLog(action, resource) {
    return async (req, res, next) => {
        const start = Date.now();
        res.on('finish', async () => {
            await db.query(`
                INSERT INTO security_audit_logs 
                (tenant_id, user_id, action, resource, ip_address, user_agent, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                req.tenant?.id,
                req.user?.userId,
                action,
                resource,
                req.ip,
                req.get('user-agent'),
                res.statusCode < 400
            ]);
        });
        next();
    };
}
```

### 2. Verschlüsselung sensibler Daten
```javascript
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
        content: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
    };
}

function decrypt(encrypted) {
    const decipher = crypto.createDecipheriv(
        algorithm, 
        key, 
        Buffer.from(encrypted.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
    
    let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
```

### 3. Input-Validierung verstärken
```javascript
const { body, validationResult } = require('express-validator');

// Beispiel für Employee-Erstellung
const validateEmployee = [
    body('first_name').isLength({ min: 2, max: 50 }).trim().escape(),
    body('last_name').isLength({ min: 2, max: 50 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isStrongPassword({
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    }),
    body('department_id').isInt().optional(),
    body('team_id').isInt().optional(),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
```

## Architektur-Empfehlungen für die Zukunft

### 1. API-Gateway Pattern
- Kong oder Traefik als API-Gateway
- Zentrale Authentifizierung/Autorisierung
- Rate-Limiting pro Tenant
- Request/Response-Transformation

### 2. Service-Mesh für Microservices
- Istio für Service-zu-Service-Kommunikation
- mTLS zwischen Services
- Circuit Breaker Pattern
- Distributed Tracing

### 3. Zero-Trust Architecture
- Keine impliziten Vertrauensbeziehungen
- Continuous Verification
- Least Privilege Access
- Micro-Segmentation

### 4. Container Security
- Distroless Images verwenden
- Security Scanning in CI/CD
- Pod Security Policies
- Network Policies

## Monitoring & Alerting

### 1. Security Information and Event Management (SIEM)
- ELK Stack für Log-Aggregation
- Anomaly Detection
- Real-time Alerting
- Compliance Reporting

### 2. Intrusion Detection System (IDS)
- Suricata oder Snort
- Network Traffic Analysis
- Behavioral Analysis
- Automated Response

## Compliance-Anforderungen

### 1. DSGVO/GDPR
- Right to be Forgotten
- Data Portability
- Consent Management
- Data Processing Agreements

### 2. ISO 27001
- Information Security Management System
- Risk Assessment
- Business Continuity Planning
- Incident Response

### 3. SOC 2
- Security
- Availability
- Processing Integrity
- Confidentiality
- Privacy

## Backup & Disaster Recovery

### 1. Tenant-isolierte Backups
```bash
# Backup-Script pro Tenant
#!/bin/bash
TENANT_ID=$1
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/${TENANT_ID}/${DATE}"

# Datenbank-Backup
mysqldump assixx_${TENANT_ID} | gzip > ${BACKUP_DIR}/database.sql.gz

# File-Backup
tar -czf ${BACKUP_DIR}/files.tar.gz /uploads/${TENANT_ID}/

# Verschlüsselung
gpg --encrypt --recipient backup@assixx.com ${BACKUP_DIR}/*

# Upload zu S3
aws s3 sync ${BACKUP_DIR} s3://assixx-backups/${TENANT_ID}/${DATE}/
```

### 2. Disaster Recovery Plan
- RTO: 4 Stunden
- RPO: 1 Stunde
- Automated Failover
- Regular DR Tests

## Empfehlung: Nächste Schritte

1. **Sofort**: Kritische Sicherheitslücken schließen (HTTPS, Headers, Token-Logging)
2. **Diese Woche**: JWT-Rotation und Subdomain-Whitelist implementieren
3. **Dieser Monat**: Audit-Logging und Verschlüsselung einführen
4. **Q1 2024**: API-Gateway und erweiterte Monitoring-Lösung
5. **Q2 2024**: Compliance-Zertifizierungen anstreben (ISO 27001, SOC 2)

Die Subdomain-Architektur ist richtig, aber Sicherheit muss JETZT priorisiert werden!