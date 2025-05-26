/**
 * Update-Skript für die Authentifizierungsimplementierung
 * 
 * Dieses Skript aktualisiert alle Dateien, die auf die alten Authentifizierungsmodule 
 * verweisen, und ersetzt sie durch Verweise auf die neue vereinheitlichte Implementierung.
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Logger
function log(message) {
  console.log(`[Auth Update] ${message}`);
}

function error(message) {
  console.error(`[Auth Update ERROR] ${message}`);
}

// Haupt-Update-Funktion
async function updateAuthImplementation() {
  log('Starte Update der Authentifizierungsimplementierung...');
  
  try {
    // 1. Finde alle Dateien, die auth.js oder middleware/auth.js importieren
    log('Suche nach Dateien, die alte Auth-Module importieren...');
    
    const { stdout: grepOutput } = await execPromise(
      "grep -r \"require('.*auth')\\|require(\\\".*auth\\\")\" --include=\"*.js\" . | grep -v node_modules"
    );
    
    const affectedFiles = grepOutput.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [filePath] = line.split(':');
        return filePath;
      })
      .filter(filePath => filePath !== 'auth-unified.js' && filePath !== 'update-auth.js');
    
    const uniqueFiles = [...new Set(affectedFiles)];
    
    log(`${uniqueFiles.length} betroffene Dateien gefunden.`);
    
    // 2. Aktualisiere die Imports in den gefundenen Dateien
    for (const filePath of uniqueFiles) {
      try {
        log(`Bearbeite Datei: ${filePath}`);
        let content = await fs.readFile(filePath, 'utf8');
        
        // Ersetze alte Auth-Importe durch den neuen Unified-Import
        // Für Dateien in Unterordnern, verwende relativen Pfad mit ../
        const relativePath = filePath.includes('/') ? '../' : './';
        
        content = content.replace(
          /const\s+\{[^}]*\}\s+=\s+require\(['"](\.\.\/)?middleware\/auth['"][^)]*\)/g,
          `const { authenticateToken, authorizeRole } = require('${relativePath}auth')`
        );
        
        content = content.replace(
          /const\s+\{[^}]*\}\s+=\s+require\(['"](\.\.\/)?auth['"][^)]*\)/g,
          `const { authenticateUser, generateToken, authenticateToken, authorizeRole } = require('${relativePath}auth')`
        );
        
        // Schreibe aktualisierte Datei
        await fs.writeFile(filePath, content, 'utf8');
        log(`Datei ${filePath} aktualisiert.`);
      } catch (fileError) {
        error(`Fehler beim Aktualisieren von ${filePath}: ${fileError.message}`);
      }
    }
    
    // 3. Aktualisiere server.js (besondere Behandlung, da es das Hauptmodul ist)
    try {
      const serverPath = './server.js';
      log(`Aktualisiere ${serverPath}...`);
      
      let serverContent = await fs.readFile(serverPath, 'utf8');
      
      // Ersetze den Auth-Import
      serverContent = serverContent.replace(
        /const\s+\{[^}]*\}\s+=\s+require\(['"](\.\.\/)?auth['"][^)]*\)/g,
        "const { authenticateUser, generateToken, authenticateToken, authorizeRole } = require('./auth-unified')"
      );
      
      await fs.writeFile(serverPath, serverContent, 'utf8');
      log(`${serverPath} aktualisiert.`);
    } catch (serverError) {
      error(`Fehler beim Aktualisieren von server.js: ${serverError.message}`);
    }
    
    // 4. Erstelle Backup der alten Auth-Dateien
    log('Erstelle Backups der alten Auth-Dateien...');
    
    try {
      await fs.copyFile('./auth.js', './auth.js.bak');
      log('auth.js gesichert als auth.js.bak');
    } catch (backupError) {
      error(`Fehler beim Sichern von auth.js: ${backupError.message}`);
    }
    
    try {
      await fs.copyFile('./middleware/auth.js', './middleware/auth.js.bak');
      log('middleware/auth.js gesichert als middleware/auth.js.bak');
    } catch (backupError) {
      error(`Fehler beim Sichern von middleware/auth.js: ${backupError.message}`);
    }
    
    // 5. Aktiviere die neue unified-auth.js
    log('Aktiviere die neue auth-unified.js durch Umbenennung...');
    
    try {
      // auth.js durch auth-unified.js ersetzen
      await fs.copyFile('./auth-unified.js', './auth.js');
      log('auth.js wurde durch auth-unified.js ersetzt');
      
      // Symlink für middleware/auth.js erstellen
      await fs.writeFile('./middleware/auth.js', 
        "// Diese Datei wurde durch auth-unified.js ersetzt\n" +
        "// Sie leitet alle Importe zur neuen Implementierung weiter\n" +
        "module.exports = require('../auth');\n"
      );
      log('middleware/auth.js leitet jetzt zu auth.js weiter');
    } catch (activateError) {
      error(`Fehler beim Aktivieren der neuen Auth-Implementierung: ${activateError.message}`);
    }
    
    log('Auth-Implementierung erfolgreich aktualisiert! Starte den Server neu, um die Änderungen zu übernehmen.');
  } catch (generalError) {
    error(`Allgemeiner Fehler: ${generalError.message}`);
    error(generalError.stack);
  }
}

// Führe das Update aus
updateAuthImplementation().catch(err => {
  error(`Unerwarteter Fehler: ${err.message}`);
  error(err.stack);
  process.exit(1);
});