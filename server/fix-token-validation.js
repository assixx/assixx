/**
 * Token Validation Fixscript
 * 
 * Dieses Skript diagnostiziert und behebt Probleme mit der Token-Validierung 
 * zwischen verschiedenen Modulen.
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

console.log('=== Token-Validierungs-Diagnose ===');

// 1. Überprüfen der JWT_SECRET Umgebungsvariable
console.log('\n1. JWT_SECRET Überprüfung:');
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET ist nicht gesetzt!');
  process.exit(1);
} else {
  console.log(`JWT_SECRET ist gesetzt mit Länge: ${process.env.JWT_SECRET.length}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET.substring(0, 5)}...`);
}

// 2. Test-Token generieren
console.log('\n2. Test-Token generieren:');
const testUser = { id: 999, username: 'test-user', role: 'test' };
let testToken;

try {
  testToken = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1h' });
  console.log(`Test-Token erfolgreich generiert: ${testToken.substring(0, 20)}...`);
} catch (error) {
  console.error('ERROR: Konnte kein Test-Token generieren:', error);
  process.exit(1);
}

// 3. Token-Validierung testen mit beiden Implementierungen
console.log('\n3. Token-Validierung testen:');

// Test mit auth.js
try {
  const mainAuthPath = path.join(__dirname, 'auth.js');
  console.log(`Teste mit ${mainAuthPath}...`);
  
  if (fs.existsSync(mainAuthPath)) {
    const mainAuth = require('./auth');
    
    // Simuliere req, res, next
    const req = { 
      headers: { 'authorization': `Bearer ${testToken}` }, 
      originalUrl: '/test' 
    };
    const res = {
      status: (code) => ({ 
        json: (data) => {
          console.error(`ERROR: auth.js validation returned ${code}:`, data);
          return res;
        },
        send: (msg) => {
          console.error(`ERROR: auth.js validation returned ${code}:`, msg);
          return res;
        }
      })
    };
    
    const authJsSuccess = { success: false };
    
    mainAuth.authenticateToken(req, res, () => {
      console.log('auth.js: Token-Validierung erfolgreich');
      console.log(`User-Daten: id=${req.user.id}, username=${req.user.username}, role=${req.user.role}`);
      authJsSuccess.success = true;
    });
    
    if (!authJsSuccess.success) {
      console.error('WARNUNG: auth.js konnte Token nicht validieren');
    }
  } else {
    console.log('auth.js nicht gefunden, überspringe Test');
  }
} catch (error) {
  console.error('ERROR beim Test mit auth.js:', error);
}

// Test mit middleware/auth.js
try {
  const middlewareAuthPath = path.join(__dirname, 'middleware', 'auth.js');
  console.log(`\nTeste mit ${middlewareAuthPath}...`);
  
  if (fs.existsSync(middlewareAuthPath)) {
    const middlewareAuth = require('./middleware/auth');
    
    // Simuliere req, res, next
    const req = { 
      headers: { 'authorization': `Bearer ${testToken}` },
      originalUrl: '/test'
    };
    const res = {
      status: (code) => ({ 
        json: (data) => {
          console.error(`ERROR: middleware/auth.js validation returned ${code}:`, data);
          return res;
        },
        send: (msg) => {
          console.error(`ERROR: middleware/auth.js validation returned ${code}:`, msg);
          return res;
        }
      })
    };
    
    const middlewareAuthSuccess = { success: false };
    
    middlewareAuth.authenticateToken(req, res, () => {
      console.log('middleware/auth.js: Token-Validierung erfolgreich');
      console.log(`User-Daten: id=${req.user.id}, username=${req.user.username}, role=${req.user.role}`);
      middlewareAuthSuccess.success = true;
    });
    
    if (!middlewareAuthSuccess.success) {
      console.error('WARNUNG: middleware/auth.js konnte Token nicht validieren');
    }
  } else {
    console.log('middleware/auth.js nicht gefunden, überspringe Test');
  }
} catch (error) {
  console.error('ERROR beim Test mit middleware/auth.js:', error);
}

// 4. Einheitliche Lösung empfehlen
console.log('\n4. Lösungsvorschlag:');
console.log('Um das Token-Validierungsproblem zu beheben, sollten Sie:');
console.log('- Sicherstellen, dass dieselbe JWT_SECRET-Umgebungsvariable in allen Modulen verwendet wird');
console.log('- In beiden Authentifizierungsimplementierungen (auth.js und middleware/auth.js)');
console.log('  dieselbe Logik für jwt.verify() verwenden');
console.log('- Idealerweise eine einzige gemeinsame Authentifizierungsimplementierung haben');

console.log('\n=== Token-Validierungs-Diagnose abgeschlossen ===');