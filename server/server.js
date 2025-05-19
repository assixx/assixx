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
const departmentRoutes = require('./routes/departments');
const teamRoutes = require('./routes/teams');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');

// Multi-tenant middleware
const tenantMiddleware = require('./middleware/tenant');

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multi-tenant support - muss vor anderen Routen kommen
// Vorübergehend deaktiviert bis Datenbanken eingerichtet sind
// app.use(tenantMiddleware);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/components', express.static(path.join(__dirname, 'public/js/components')));
// REMOVE OR IMPORT THIS: app.use(securityMiddleware);
app.use(morgan('dev'));

// Logging Middleware
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  console.log('Received token:', token);
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

// Globales Rate-Limiting für alle API-Routen
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Limit jede IP auf 100 Anfragen pro Fenster
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut'
});
app.use('/api', apiLimiter);

// Startseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`Login attempt for user: ${username}`);
    
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

app.get('/employee-profile.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'employee-profile.html'));
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