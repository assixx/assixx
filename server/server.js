require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const db = require('./database');
const User = require('./models/user');
const AdminLog = require('./models/adminLog'); 
const { authenticateUser, generateToken, authenticateToken, authorizeRole } = require('./auth');

// Import all route modules
const rootRoutes = require('./routes/root');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');
const employeeTestRoutes = require('./routes/employee-test'); // TEST ROUTES without authentication
const departmentRoutes = require('./routes/departments');
const teamRoutes = require('./routes/teams');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');
const featureRoutes = require('./routes/features');
const signupRoutes = require('./routes/signup');

// Multi-tenant middleware
const tenantMiddleware = require('./middleware/tenant');

// Import enhanced security middleware
const {
    enforceHTTPS,
    securityHeaders,
    corsOptions,
    generalLimiter,
    authLimiter,
    uploadLimiter,
    validateTenantContext,
    sanitizeInputs,
    apiSecurityHeaders,
    cors
} = require('./middleware/security-enhanced');

const app = express();

// Security middleware - MUST come first
app.use(enforceHTTPS);
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(...sanitizeInputs);

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multi-tenant support (temporär deaktiviert)
// app.use(tenantMiddleware);
// app.use(validateTenantContext);

// Static files - with security headers
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
    }
}));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/components', express.static(path.join(__dirname, 'public/js/components')));

// API security headers for all routes
app.use(apiSecurityHeaders);

// Logging with security considerations
app.use(morgan('combined', {
    skip: (req, res) => {
        // Don't log sensitive endpoints
        return req.path.includes('/api/auth') || req.path.includes('/api/login');
    }
}));

// Secure Logging Middleware - never log tokens
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Auth: ${req.headers['authorization'] ? 'Present' : 'None'}`);
  next();
});

// Create required directories
async function createRequiredDirectories() {
  const directories = [
    'uploads',
    'uploads/profile_pictures',
    'uploads/documents'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Verzeichnis ${dir} erstellt oder bereits vorhanden`);
    } catch (error) {
      console.error(`Fehler beim Erstellen des Verzeichnisses ${dir}:`, error);
    }
  }
}
createRequiredDirectories();

// Statische Verzeichnisse für Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use enhanced rate limiting from security middleware
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);

// Öffentliche Seiten (OHNE tenantMiddleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Public signup routes with rate limiting
app.use('/api', signupRoutes);

// Auth routes
app.post('/register', async (req, res) => {
  try {
    const userId = await User.create(req.body);
    console.log(`User registered successfully with ID: ${userId}`);
    res.status(201).json({ message: 'Benutzer erfolgreich registriert', userId });
  } catch (error) {
    console.error('Registrierungsfehler:', error);
    res.status(500).json({ message: 'Fehler bei der Registrierung', error: error.message });
  }
});

app.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    // Don't log credentials
    console.log('Login attempt');
    
    const user = await authenticateUser(username, password);
    
    // IP-Adresse des Clients ermitteln
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (user) {
      const token = generateToken(user);
      console.log(`Login successful for user: ${username}`);
      
      // Wenn es sich um einen Admin oder Root handelt, Login protokollieren
      if (user.role === 'admin' || user.role === 'root') {
        await AdminLog.create({
          user_id: user.id,
          action: 'login',
          ip_address: ip,
          status: 'success'
        });
      }
      
      res.json({ message: 'Login erfolgreich', token, role: user.role });
    } else {
      console.log(`Login failed for user: ${username}`);
      
      // Fehlgeschlagenen Login suchen und protokollieren
      const userByUsername = await User.findByUsername(username);
      if (userByUsername && (userByUsername.role === 'admin' || userByUsername.role === 'root')) {
        await AdminLog.create({
          user_id: userByUsername.id,
          action: 'login',
          ip_address: ip,
          status: 'failure',
          details: 'Falsches Passwort'
        });
      }
      
      res.status(401).json({ message: 'Ungültige Anmeldeinformationen' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// HTML routes
app.get('/root-dashboard', (req, res) => {
  console.log('Accessing root dashboard');
  res.sendFile(path.join(__dirname, 'public', 'root-dashboard.html'));
});

app.get('/admin-config.html', (req, res) => {
  console.log('Accessing admin configuration page');
  res.sendFile(path.join(__dirname, 'public', 'admin-config.html'));
});

app.get('/org-management.html', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'root') {
    return res.status(403).send("Zugriff verweigert");
  }
  res.sendFile(path.join(__dirname, 'public', 'org-management.html'));
});

// API Test-Seite (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/api-test.html', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send("Seite nicht verfügbar");
  }
  res.sendFile(path.join(__dirname, 'public', 'api-test.html'));
});

// Datenbank-Test-Seite (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/test-db.html', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send("Seite nicht verfügbar");
  }
  res.sendFile(path.join(__dirname, 'public', 'test-db.html'));
});

// Debug-Dashboard (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/debug-dashboard.html', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send("Seite nicht verfügbar");
  }
  res.sendFile(path.join(__dirname, 'public', 'debug-dashboard.html'));
});

// Token-Debug Seite (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/token-debug.html', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send("Seite nicht verfügbar");
  }
  res.sendFile(path.join(__dirname, 'public', 'token-debug.html'));
});

// Token-Validierungs-Endpoint für Debugging
app.get('/api/validate-token', authenticateToken, (req, res) => {
  // Wenn wir hier ankommen, wurde das Token bereits validiert
  res.json({
    valid: true,
    user: req.user,
    message: 'Token ist gültig'
  });
});

// Test-Endpoint ohne Authentifizierung für Debugging
app.get('/api/token-test', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  res.json({
    endpoint: 'Token Test',
    tokenProvided: !!token,
    tokenDetails: token ? token.substring(0, 20) + '...' : 'none',
    requestHeaders: req.headers
  });
});

app.get('/employee-profile.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'employee-profile.html'));
});

app.get('/document-upload.html', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'document-upload.html'));
});

app.get('/salary-documents.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'salary-documents.html'));
});

// API routes
app.get('/api/dashboard-data', authenticateToken, authorizeRole('root'), (req, res) => {
  console.log('Sending dashboard data');
  res.json({
    message: 'Dies sind die Root-Dashboard-Daten',
    user: req.user
  });
});

app.get('/api/root-dashboard-data', authenticateToken, authorizeRole('root'), (req, res) => {
  console.log('Fetching root dashboard data');
  res.json({
    message: 'Dies sind die Root-Dashboard-Daten',
    user: req.user
  });
});

// Profilbilder
app.get('/profile-pictures/:filename', authenticateToken, async (req, res) => {
  const filename = req.params.filename;
  
  // Sicherheitscheck: Überprüfen, ob der Dateipfad Verzeichniswechsel enthält
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).send('Ungültiger Dateiname');
  }
  
  try {
    const filePath = path.join(__dirname, 'uploads', 'profile_pictures', filename);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Fehler beim Abrufen des Profilbilds:', error);
    res.status(404).send('Profilbild nicht gefunden');
  }
});

// API route for general user listing (for dashboard stats)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Fehler beim Abrufen der Benutzer', error: error.message });
  }
});

// Register API routes (ONLY ONCE)
app.use('/root', authenticateToken, authorizeRole('root'), rootRoutes);
app.use('/admin', authenticateToken, authorizeRole('admin'), adminRoutes);
app.use('/employee', authenticateToken, authorizeRole('employee'), employeeRoutes);
app.use('/departments', authenticateToken, departmentRoutes);
app.use('/teams', authenticateToken, teamRoutes);
app.use('/users', userRoutes);
app.use('/documents', authenticateToken, documentRoutes);
app.use('/features', featureRoutes);

// TEST Routes without authentication - SECURITY RISK - FOR DEVELOPMENT ONLY
// WARNING: These routes bypass all authentication and authorization
if (process.env.NODE_ENV !== 'production') {
  console.warn('WARNING: Test routes enabled - these routes bypass authentication!');
  app.use('/test/employee', employeeTestRoutes);
  
  // Import and register DB test routes
  const testDbRoutes = require('./routes/test-db');
  app.use('/test/db', testDbRoutes);
}

// Error handling - MUST be last
app.use((req, res, next) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).send("Sorry, diese Seite wurde nicht gefunden!");
});

app.use((err, req, res, next) => {
  console.error(`500 - Internal Server Error: ${err.stack}`);
  res.status(500).send('Etwas ist schief gelaufen!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));