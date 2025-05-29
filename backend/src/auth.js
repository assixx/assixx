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
const JWT_SECRET =
  process.env.JWT_SECRET || 'fallback_secret_nur_fuer_entwicklung';

/**
 * Benutzerauthentifizierung mit Benutzername/E-Mail und Passwort
 */
async function authenticateUser(usernameOrEmail, password) {
  try {
    // Try to find user by username first
    let user = await User.findByUsername(usernameOrEmail);

    // If not found by username, try by email
    if (!user) {
      user = await User.findByEmail(usernameOrEmail);
    }

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      return user;
    } else {
      return null;
    }
  } catch (error) {
    console.error(
      `Error during authentication for user ${usernameOrEmail}:`,
      error
    );
    throw error;
  }
}

/**
 * Token-Generierung für authentifizierte Benutzer
 */
function generateToken(user) {
  try {
    const token = jwt.sign(
      {
        id: parseInt(user.id, 10), // Ensure ID is a number
        username: user.username,
        role: user.role,
        tenant_id: parseInt(user.tenant_id, 10), // Ensure tenant_id is a number
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

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
  const authHeader = req.headers['authorization'];

  // Try to get token from Authorization header first
  let token = authHeader && authHeader.split(' ')[1];

  // If no token in header, try cookie (for HTML pages)
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Debug logging
  console.log('Auth check - Path:', req.path);
  console.log('Auth check - Headers:', req.headers);
  console.log('Auth check - Cookies:', req.cookies);
  console.log('Auth check - Token found:', !!token);

  if (token == null) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res
        .status(403)
        .json({ error: 'Invalid or expired token', details: err.message });
    }

    // Normalize user object for consistency and ensure IDs are numbers
    req.user = {
      ...user,
      id: parseInt(user.id, 10), // Ensure ID is a number
      userId: parseInt(user.id, 10),
      tenant_id: parseInt(user.tenant_id, 10), // Ensure tenant_id is a number
      tenantId: parseInt(user.tenant_id, 10),
    };
    next();
  });
}

/**
 * Middleware zur Rollenbasierte Autorisierung
 */
function authorizeRole(role) {
  return (req, res, next) => {
    // Root hat Zugriff auf alles
    if (req.user.role === 'root') {
      return next();
    }

    // Admin hat Zugriff auf Admin- und Employee-Ressourcen
    if (
      req.user.role === 'admin' &&
      (role === 'admin' || role === 'employee')
    ) {
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
      user: decoded,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

module.exports = {
  authenticateUser,
  generateToken,
  authenticateToken,
  authorizeRole,
  validateToken,
  JWT_SECRET, // Exportiere das verwendete Secret für Testzwecke
};
