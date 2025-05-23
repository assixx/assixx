/**
 * Vereinheitlichte Authentifizierungsbibliothek
 * 
 * Diese Datei stellt alle Authentifizierungsfunktionen für die gesamte Anwendung bereit.
 * Sie ersetzt sowohl auth.js als auch middleware/auth.js, um Inkonsistenzen zu vermeiden.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/user');

// Konstante für das JWT-Secret aus der Umgebungsvariable
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_nur_fuer_entwicklung';

/**
 * Benutzerauthentifizierung mit Benutzername/E-Mail und Passwort
 */
async function authenticateUser(usernameOrEmail, password) {
  console.log(`Attempting to authenticate user: ${usernameOrEmail}`);
  try {
    // Try to find user by username first
    let user = await User.findByUsername(usernameOrEmail);
    
    // If not found by username, try by email
    if (!user) {
      user = await User.findByEmail(usernameOrEmail);
    }
    
    if (!user) {
      console.log(`User not found: ${usernameOrEmail}`);
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      console.log(`User authenticated successfully: ${user.username}`);
      return user;
    } else {
      console.log(`Invalid password for user: ${user.username}`);
      return null;
    }
  } catch (error) {
    console.error(`Error during authentication for user ${usernameOrEmail}:`, error);
    throw error;
  }
}

/**
 * Token-Generierung für authentifizierte Benutzer
 */
function generateToken(user) {
  console.log(`Generating token for user: ${user.username}`);
  try {
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        tenant_id: user.tenant_id // Wichtig für Multi-Tenant
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log(`Token generated successfully for user: ${user.username}`);
    return token;
  } catch (error) {
    console.error(`Error generating token for user ${user.username}:`, error);
    throw error;
  }
}

/**
 * Middleware zur Token-Authentifizierung
 */
function authenticateToken(req, res, next) {
  console.log('Entering authenticateToken middleware for:', req.originalUrl);
  const authHeader = req.headers['authorization'];
  console.log('Auth header:', authHeader ? authHeader.substring(0, 20) + '...' : 'undefined');
  
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Extracted token:', token ? token.substring(0, 20) + '...' : 'null');

  if (token == null) {
    console.log('No token provided, sending 401');
    return res.status(401).json({ error: 'Authentication token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      console.log('Error details:', err);
      return res.status(403).json({ error: 'Invalid or expired token', details: err.message });
    }
    console.log('Token verified successfully. User:', user);
    req.user = user;
    next();
  });
}

/**
 * Middleware zur Rollenbasierte Autorisierung
 */
function authorizeRole(role) {
  return (req, res, next) => {
    console.log('User role:', req.user.role);
    console.log('Required role:', role);
    
    // Root hat Zugriff auf alles
    if (req.user.role === 'root') {
      return next();
    }
    
    // Admin hat Zugriff auf Admin- und Employee-Ressourcen
    if (req.user.role === 'admin' && (role === 'admin' || role === 'employee')) {
      return next();
    }
    
    // Genauer Rollen-Match
    if (req.user.role === role) {
      return next();
    }
    
    return res.status(403).send('Unauthorized');
  };
}

/**
 * Token-Validierung ohne Middleware-Kontext
 * Nützlich für Tests und andere nicht-Express-Kontexte
 */
function validateToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      valid: true,
      user: decoded
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  authenticateUser,
  generateToken,
  authenticateToken,
  authorizeRole,
  validateToken,
  JWT_SECRET  // Exportiere das verwendete Secret für Testzwecke
};