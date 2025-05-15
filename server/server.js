require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const User = require('./models/user');
const AdminLog = require('./models/adminLog'); // Added this import
const { authenticateUser, generateToken, authenticateToken, authorizeRole } = require('./auth');
const rootRoutes = require('./routes/root');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');
const securityMiddleware = require('./middleware/security');
const documentRoutes = require('./routes/documents');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(securityMiddleware);
app.use(morgan('dev'));

// Logging Middleware
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  console.log('Received token:', token);
  next();
});

// Globales Rate-Limiting für alle API-Routen
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Limit jede IP auf 100 Anfragen pro Fenster
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Zu viele Anfragen von dieser IP, bitte versuchen Sie es später erneut'
});

// Anwenden des Rate-Limiters auf alle API-Routen
app.use('/api', apiLimiter);

// Authentifizierte Routen mit Rollenschutz
app.use('/root', authenticateToken, authorizeRole('root'), rootRoutes);
app.use('/admin', authenticateToken, authorizeRole('admin'), adminRoutes);
app.use('/employee', authenticateToken, authorizeRole('employee'), employeeRoutes);
app.use('/documents', authenticateToken, documentRoutes);

// Startseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registrierungsroute
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

// Anmelderoute
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

// Root Dashboard Route
app.get('/root-dashboard', (req, res) => {
  console.log('Accessing root dashboard');
  res.sendFile(path.join(__dirname, 'public', 'root-dashboard.html'));
});

// Admin Config Route
app.get('/admin-config.html', (req, res) => {
  console.log('Accessing admin configuration page');
  res.sendFile(path.join(__dirname, 'public', 'admin-config.html'));
});

// Dashboard API-Routen (geschützt durch globales Rate-Limiting)
app.get('/api/dashboard-data', authenticateToken, authorizeRole('root'), (req, res) => {
  console.log('Sending dashboard data');
  res.json({
    message: 'Dies sind die Root-Dashboard-Daten',
    user: req.user
  });
});

// Wir nutzen eine klare, eindeutige Route statt Duplikate
app.get('/api/root-dashboard-data', authenticateToken, authorizeRole('root'), (req, res) => {
  console.log('Fetching root dashboard data');
  res.json({
    message: 'Dies sind die Root-Dashboard-Daten',
    user: req.user
  });
});

// Fehlerbehandlung für nicht gefundene Routen
app.use((req, res, next) => {
  console.log(`404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).send("Sorry, diese Seite wurde nicht gefunden!");
});

// Allgemeine Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(`500 - Internal Server Error: ${err.stack}`);
  res.status(500).send('Etwas ist schief gelaufen!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));