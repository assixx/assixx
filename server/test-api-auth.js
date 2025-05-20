// test-api-auth.js
require('dotenv').config();
const { authenticateUser, generateToken, authenticateToken } = require('./auth');

// Fake Express Middleware für Tests
const req = {
  headers: {
    'authorization': ''
  }
};

const res = {
  status: function(code) {
    console.log(`Status: ${code}`);
    return this;
  },
  json: function(data) {
    console.log('Response:', data);
    return this;
  },
  sendStatus: function(code) {
    console.log(`SendStatus: ${code}`);
    return this;
  },
  send: function(data) {
    console.log('Send:', data);
    return this;
  }
};

const next = () => {
  console.log('Next middleware called');
};

// Test-Funktion
async function testAuthentication() {
  try {
    console.log('----- TEST: USER AUTHENTICATION -----');
    
    const username = 'localhost.washboard010@passmail.net'; // Dein normaler Login
    const password = 'admin123'; // Korrigiertes Passwort
    
    console.log(`Testing login with: ${username} / ${password}`);
    
    // 1. Benutzer authentifizieren
    const user = await authenticateUser(username, password);
    console.log('Authentication result:', user ? 'Success' : 'Failed');
    
    if (!user) {
      console.log('User authentication failed. Exiting test.');
      return;
    }
    
    console.log('Authenticated user:', { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    });
    
    // 2. Token generieren
    console.log('\n----- TEST: TOKEN GENERATION -----');
    console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);
    
    const token = generateToken(user);
    console.log('Generated token length:', token.length);
    console.log('Token snippet:', token.substring(0, 20) + '...');
    
    // 3. Token validieren
    console.log('\n----- TEST: TOKEN VALIDATION -----');
    
    // Positiver Test - mit gültigem Token
    req.headers.authorization = `Bearer ${token}`;
    console.log('Testing with valid token');
    authenticateToken(req, res, () => {
      console.log('Token validation successful. User from token:', req.user);
    });
    
    // Negativer Test - mit ungültigem Token
    req.headers.authorization = 'Bearer invalid.token.here';
    console.log('\nTesting with invalid token');
    authenticateToken(req, res, next);
    
    // Negativer Test - ohne Token
    req.headers.authorization = undefined;
    console.log('\nTesting without token');
    authenticateToken(req, res, next);
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Test ausführen
testAuthentication();