require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const db = require('./database');
const User = require('./models/user');
const AdminLog = require('./models/adminLog');
const {
  authenticateUser,
  generateToken,
  authenticateToken,
  authorizeRole,
} = require('./auth');

// Import all route modules
const rootRoutes = require('./routes/root');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');
// const employeeTestRoutes = require('./routes/employee-test'); // TEST ROUTES without authentication
const departmentRoutes = require('./routes/departments');
const teamRoutes = require('./routes/teams');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');
const featureRoutes = require('./routes/features');
const signupRoutes = require('./routes/signup');
const unsubscribeRoutes = require('./routes/unsubscribe');
const blackboardRoutes = require('./routes/blackboard');
const calendarRoutes = require('./routes/calendar');
const shiftRoutes = require('./routes/shifts');
const kvpRoutes = require('./routes/kvp');
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const userProfileRoutes = require('./routes/user');
const surveyRoutes = require('./routes/surveys');

// Multi-tenant middleware
const { tenantMiddleware, skipTenantCheck } = require('./middleware/tenant');

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
  cors,
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
app.use(
  express.static(path.join(__dirname, '../../frontend/src/pages'), {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    },
  })
);
app.use(
  '/js',
  express.static(path.join(__dirname, '../../frontend/src/scripts'))
);
app.use(
  '/css',
  express.static(path.join(__dirname, '../../frontend/src/styles'))
);
app.use(
  '/components',
  express.static(path.join(__dirname, '../../frontend/src/components'))
);

// API security headers for all routes
app.use(apiSecurityHeaders);

// Logging with security considerations
app.use(
  morgan('combined', {
    skip: (req, res) =>
      // Don't log sensitive endpoints
      req.path.includes('/api/auth') || req.path.includes('/api/login'),
  })
);

// Secure Logging Middleware - never log tokens
app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.path} - Auth: ${req.headers['authorization'] ? 'Present' : 'None'}`
  );
  next();
});

// Create required directories
async function createRequiredDirectories() {
  const directories = [
    'uploads',
    'uploads/profile_pictures',
    'uploads/documents',
    'uploads/chat',
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
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Use enhanced rate limiting from security middleware
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/upload', uploadLimiter);

// Middleware für Clean URLs - Redirect .html zu clean paths
app.use((req, res, next) => {
  if (req.path.endsWith('.html') && req.path !== '/') {
    const cleanPath = req.path.slice(0, -5); // Remove .html
    return res.redirect(
      301,
      cleanPath +
        (req.originalUrl.includes('?')
          ? req.originalUrl.substring(req.originalUrl.indexOf('?'))
          : '')
    );
  }
  next();
});

// Öffentliche Seiten (OHNE tenantMiddleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'signup.html'));
});

// Public signup routes with rate limiting
app.use('/api', signupRoutes);

// Auth routes
app.post('/register', async (req, res) => {
  try {
    const userId = await User.create(req.body);
    console.log(`User registered successfully with ID: ${userId}`);
    res
      .status(201)
      .json({ message: 'Benutzer erfolgreich registriert', userId });
  } catch (error) {
    console.error('Registrierungsfehler:', error);
    res
      .status(500)
      .json({ message: 'Fehler bei der Registrierung', error: error.message });
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
          status: 'success',
        });
      }

      res.json({ message: 'Login erfolgreich', token, role: user.role });
    } else {
      console.log(`Login failed for user: ${username}`);

      // Fehlgeschlagenen Login suchen und protokollieren
      const userByUsername = await User.findByUsername(username);
      if (
        userByUsername &&
        (userByUsername.role === 'admin' || userByUsername.role === 'root')
      ) {
        await AdminLog.create({
          user_id: userByUsername.id,
          action: 'login',
          ip_address: ip,
          status: 'failure',
          details: 'Falsches Passwort',
        });
      }

      res.status(401).json({ message: 'Ungültige Anmeldeinformationen' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// HTML routes - Clean URLs ohne .html
app.get('/root-dashboard', (req, res) => {
  console.log('Accessing root dashboard');
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'root-dashboard.html')
  );
});

app.get('/admin-config', (req, res) => {
  console.log('Accessing admin configuration page');
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'admin-config.html')
  );
});

app.get('/org-management', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'root') {
    return res.status(403).send('Zugriff verweigert');
  }
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'org-management.html')
  );
});

// API Test-Seite (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/api-test', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Seite nicht verfügbar');
  }
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'api-test.html')
  );
});

// Datenbank-Test-Seite (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/test-db', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Seite nicht verfügbar');
  }
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'test-db.html')
  );
});

// Debug-Dashboard (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/debug-dashboard', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Seite nicht verfügbar');
  }
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'debug-dashboard.html')
  );
});

// Token-Debug Seite (im Entwicklungsmodus ohne Authentifizierung verfügbar)
app.get('/token-debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).send('Seite nicht verfügbar');
  }
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'token-debug.html')
  );
});

// Token-Validierungs-Endpoint für Debugging
app.get('/api/validate-token', authenticateToken, (req, res) => {
  // Wenn wir hier ankommen, wurde das Token bereits validiert
  res.json({
    valid: true,
    user: req.user,
    message: 'Token ist gültig',
  });
});

// Test-Endpoint ohne Authentifizierung für Debugging
app.get('/api/token-test', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  res.json({
    endpoint: 'Token Test',
    tokenProvided: !!token,
    tokenDetails: token ? `${token.substring(0, 20)}...` : 'none',
    requestHeaders: req.headers,
  });
});

app.get('/employee-profile', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'employee-profile.html')
  );
});

app.get(
  '/document-upload',
  authenticateToken,
  authorizeRole('admin'),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/src/pages', 'document-upload.html')
    );
  }
);

app.get('/salary-documents', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'salary-documents.html')
  );
});

app.get('/chat', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'chat.html'));
});

// Weitere HTML Routen mit Clean URLs
app.get('/dashboard', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'dashboard.html')
  );
});

app.get(
  '/admin-dashboard',
  authenticateToken,
  authorizeRole('admin'),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/src/pages', 'admin-dashboard.html')
    );
  }
);

app.get('/employee-dashboard', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'employee-dashboard.html')
  );
});

app.get('/profile', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'profile.html')
  );
});

app.get('/profile-picture', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'profile-picture.html')
  );
});

app.get('/blackboard', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'blackboard.html')
  );
});

app.get('/calendar', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'calendar.html')
  );
});

app.get('/shifts', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'shifts.html'));
});

app.get('/kvp', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'kvp.html'));
});

app.get('/employee-documents', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'employee-documents.html')
  );
});

app.get(
  '/archived-employees',
  authenticateToken,
  authorizeRole('admin'),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        '../../frontend/src/pages',
        'archived-employees.html'
      )
    );
  }
);

app.get(
  '/feature-management',
  authenticateToken,
  authorizeRole('admin'),
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        '../../frontend/src/pages',
        'feature-management.html'
      )
    );
  }
);

app.get(
  '/survey-admin',
  authenticateToken,
  authorizeRole('admin'),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/src/pages', 'survey-admin.html')
    );
  }
);

app.get('/survey-employee', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'survey-employee.html')
  );
});

app.get('/survey-details', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'survey-details.html')
  );
});

app.get(
  '/survey-results',
  authenticateToken,
  authorizeRole('admin'),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/src/pages', 'survey-results.html')
    );
  }
);

app.get(
  '/root-features',
  authenticateToken,
  authorizeRole('root'),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/src/pages', 'root-features.html')
    );
  }
);

app.get(
  '/root-profile',
  authenticateToken,
  authorizeRole('root'),
  (req, res) => {
    res.sendFile(
      path.join(__dirname, '../../frontend/src/pages', 'root-profile.html')
    );
  }
);

app.get('/settings', authenticateToken, (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'settings.html')
  );
});

app.get('/hilfe', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/src/pages', 'hilfe.html'));
});

app.get('/design-standards', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../../frontend/src/pages', 'design-standards.html')
  );
});

// API routes
app.get(
  '/api/dashboard-data',
  authenticateToken,
  authorizeRole('root'),
  (req, res) => {
    console.log('Sending dashboard data');
    res.json({
      message: 'Dies sind die Root-Dashboard-Daten',
      user: req.user,
    });
  }
);

app.get(
  '/api/root-dashboard-data',
  authenticateToken,
  authorizeRole('root'),
  (req, res) => {
    console.log('Fetching root dashboard data');
    res.json({
      message: 'Dies sind die Root-Dashboard-Daten',
      user: req.user,
    });
  }
);

// Profilbilder
app.get('/profile-pictures/:filename', authenticateToken, async (req, res) => {
  const filename = req.params.filename;

  // Sicherheitscheck: Überprüfen, ob der Dateipfad Verzeichniswechsel enthält
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).send('Ungültiger Dateiname');
  }

  try {
    const filePath = path.join(
      __dirname,
      'uploads',
      'profile_pictures',
      filename
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error('Fehler beim Abrufen des Profilbilds:', error);
    res.status(404).send('Profilbild nicht gefunden');
  }
});

// API route for general user listing (for dashboard stats)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Use the search function with filters from query parameters
    const filters = {
      search: req.query.search || '',
      role: req.query.role || '',
      department_id: req.query.department_id || '',
      sort_by: req.query.sort_by || 'first_name',
      sort_dir: req.query.sort_dir || 'ASC',
      limit: parseInt(req.query.limit) || 50,
      page: parseInt(req.query.page) || 1,
    };

    const users = await User.search(filters);
    const total = await User.count(filters);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        pages: Math.ceil(total / (parseInt(req.query.limit) || 50)),
      },
    });
  } catch (error) {
    console.error('Error in /api/users:', error);
    res.status(500).json({
      message: 'Fehler beim Abrufen der Benutzer',
      error: error.message,
    });
  }
});

// Register API routes (ONLY ONCE)
app.use('/root', authenticateToken, authorizeRole('root'), rootRoutes);
app.use('/admin', authenticateToken, authorizeRole('admin'), adminRoutes);
app.use(
  '/employee',
  authenticateToken,
  authorizeRole('employee'),
  employeeRoutes
);
app.use('/departments', authenticateToken, departmentRoutes);
app.use('/teams', authenticateToken, teamRoutes);
app.use('/users', userRoutes);
app.use('/documents', authenticateToken, documentRoutes);
app.use('/api/features', featureRoutes);
app.use('/unsubscribe', unsubscribeRoutes); // E-Mail-Abmeldung (ohne Authentifizierung)
app.use('/api/auth', authRoutes); // Authentifizierungs-API
app.use('/api/user', userProfileRoutes); // Benutzer-Profil-API
app.use('/', blackboardRoutes); // Blackboard-System
app.use('/', calendarRoutes); // Firmenkalender-System
app.use('/api/shifts', shiftRoutes); // Schichtplanungs-System
app.use('/api/kvp', kvpRoutes); // KVP-System (Kontinuierlicher Verbesserungsprozess)
app.use('/api/chat', authenticateToken, chatRoutes); // Chat-System
app.use('/api/surveys', authenticateToken, surveyRoutes); // Umfrage-System

// Add additional API routes for departments and teams
app.use('/api/departments', departmentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/machines', require('./routes/machines'));
app.use('/api/areas', require('./routes/areas'));

// TEST Routes without authentication - SECURITY RISK - FOR DEVELOPMENT ONLY
// WARNING: These routes bypass all authentication and authorization
// All test routes have been removed for production readiness

// Error handling - MUST be last
app.use((req, res, next) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).send('Sorry, diese Seite wurde nicht gefunden!');
});

app.use((err, req, res, next) => {
  console.error(`500 - Internal Server Error: ${err.stack}`);
  res.status(500).send('Etwas ist schief gelaufen!');
});

const PORT = process.env.PORT || 3000;
const http = require('http');
const ChatWebSocketServer = require('./websocket');

// HTTP Server erstellen
const server = http.createServer(app);

// WebSocket Server initialisieren
const chatWS = new ChatWebSocketServer(server);
chatWS.startHeartbeat();
chatWS.startScheduledMessageProcessor();
chatWS.startMessageDeliveryProcessor();

server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`WebSocket Chat Server läuft auf ws://localhost:${PORT}/chat-ws`);
});
