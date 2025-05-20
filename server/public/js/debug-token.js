/**
 * Debug-Token Script
 * 
 * Dieses Skript überprüft, ob ein Token im localStorage vorhanden ist
 * und ob es mit dem Server validiert werden kann.
 */

console.log('Debug-Token Script geladen');

// Token aus localStorage abrufen und anzeigen
function checkToken() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.log('Kein Token im localStorage gefunden!');
    document.getElementById('token-status').textContent = '❌ Kein Token gefunden';
    document.getElementById('token-value').textContent = 'N/A';
    return;
  }
  
  console.log('Token gefunden mit Länge:', token.length);
  document.getElementById('token-status').textContent = '✓ Token gefunden';
  document.getElementById('token-value').textContent = token.substring(0, 20) + '...';
  
  // Token Validierung testen
  validateToken(token);
}

// Token gegen API testen
async function validateToken(token) {
  try {
    const response = await fetch('/api/validate-token', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      console.log('Token ist gültig!');
      document.getElementById('validation-status').textContent = '✓ Token ist gültig';
      
      // Token-Daten anzeigen
      const data = await response.json();
      document.getElementById('token-data').textContent = JSON.stringify(data, null, 2);
    } else {
      console.log('Token ist NICHT gültig:', response.status);
      document.getElementById('validation-status').textContent = `❌ Token ist ungültig (${response.status})`;
    }
  } catch (error) {
    console.error('Fehler bei der Token-Validierung:', error);
    document.getElementById('validation-status').textContent = `❌ Fehler: ${error.message}`;
  }
}

// Neues Token generieren durch Login
async function generateNewToken() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    alert('Bitte Benutzername und Passwort eingeben!');
    return;
  }
  
  try {
    document.getElementById('login-status').textContent = 'Anmeldung läuft...';
    
    const response = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      localStorage.setItem('token', data.token);
      document.getElementById('login-status').textContent = '✓ Anmeldung erfolgreich';
      console.log('Neues Token generiert und gespeichert');
      
      // Aktualisiere die Token-Anzeige
      checkToken();
    } else {
      document.getElementById('login-status').textContent = `❌ Anmeldung fehlgeschlagen: ${data.message || 'Unbekannter Fehler'}`;
      console.error('Login fehlgeschlagen:', data);
    }
  } catch (error) {
    document.getElementById('login-status').textContent = `❌ Fehler: ${error.message}`;
    console.error('Fehler beim Login:', error);
  }
}

// Token-Status testen, wenn das Dokument geladen ist
document.addEventListener('DOMContentLoaded', () => {
  // Initialer Token-Check
  checkToken();
  
  // Event-Listener für Buttons
  document.getElementById('token-check-btn').addEventListener('click', checkToken);
  document.getElementById('login-btn').addEventListener('click', generateNewToken);
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    document.getElementById('logout-status').textContent = '✓ Abgemeldet';
    checkToken();
  });
});