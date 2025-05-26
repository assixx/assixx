# Assixx Project Instructions for Claude

## 🚨 WICHTIG: TODO-LISTE ZUERST LESEN!

**IMMER als erstes die TODO.md Datei lesen**, bevor mit der Arbeit begonnen wird:
- Die TODO.md enthält alle aktuellen und erledigten Aufgaben
- Zeigt Prioritäten und aktuelle Arbeitsstände
- Verhindert doppelte Arbeit
- Gibt Überblick über das gesamte Projekt

```bash
# Erste Aktion bei jedem Start:
cat /home/scs/projects/Assixx/TODO.md
```

## 📋 Wichtige Hinweise für Claude AI

Diese Datei enthält spezielle Anweisungen für AI-Assistenten.
Entwickler-Guidelines siehe [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md)

## 📝 CODE-KOMMENTIERUNG STANDARDS (IMMER BEFOLGEN!)

### Kommentierungs-Regeln:
1. **JEDE Funktion** muss kommentiert werden:
   ```javascript
   // Validiert die Subdomain-Eingabe und zeigt Fehler an
   // @param {string} value - Die eingegebene Subdomain
   // @returns {boolean} - True wenn gültig, false wenn ungültig
   function validateSubdomain(value) {
   ```

2. **CSS-Abschnitte** klar strukturieren:
   ```css
   /* ========================================
      HEADER SECTION - Glassmorphismus Design
      ======================================== */
   .header {
       /* Transparenter Hintergrund mit Blur für Glaseffekt */
       background: rgba(255, 255, 255, 0.02);
   ```

3. **Komplexe Logik** detailliert erklären:
   ```javascript
   // Prüft zuerst ob Passwörter übereinstimmen
   // Dann sammelt alle Features die ausgewählt wurden
   // Fügt Ländervorwahl zur Telefonnummer hinzu
   // Sendet alles als JSON an Backend
   ```

4. **HTML-Bereiche** beschreiben:
   ```html
   <!-- Signup Form - 3 Spalten Layout für 16-Zoll Monitore -->
   <!-- Erste Zeile: Firma, Subdomain, Email -->
   <div class="form-grid">
   ```

### Wann kommentieren:
- Bei JEDER Funktion (was macht sie, Parameter, Return)
- Bei komplexen CSS-Eigenschaften (warum dieser Wert?)
- Bei wichtigen HTML-Strukturen
- Bei API-Calls und Datenverarbeitung
- Bei Berechnungen und Algorithmen

### NICHT übertreiben:
- Keine offensichtlichen Kommentare wie `// Button Klick`
- Nicht jede einzelne CSS-Zeile
- Fokus auf das WARUM, nicht nur WAS

## 🎨 GLASSMORPHISMUS DESIGN STANDARDS (IMMER VERWENDEN!)

### Background Gradient (NEUER STANDARD!):
```css
/* Body Background - Dramatischer Verlauf */
body::before {
    background: radial-gradient(circle at 50% 50%, #1E1E1E 0%, #121212 50%, #0A0A0A 100%);
    opacity: 0.9;
    z-index: -1;
}

body::after {
    background: linear-gradient(135deg, transparent 0%, rgba(0, 142, 255, 0.08) 25%, #01000482 60%, rgba(0, 0, 4, 0.6) 90%, black 100%);
    z-index: -1;
}
```

### Container/Cards:
```css
background: rgba(255, 255, 255, 0.02);
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.15);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
animation: fadeInUp 0.6s ease-out;
```

### Form Controls:
```css
background: rgba(255, 255, 255, 0.04);
border: 1px solid rgba(255, 255, 255, 0.12);
backdrop-filter: blur(5px);
/* Focus */
background: rgba(255, 255, 255, 0.08);
box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15),
            inset 0 1px 2px rgba(0, 0, 0, 0.1);
```

### Help Button:
```css
width: 36px;
height: 36px;
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(10px);
border: 1px solid rgba(255, 255, 255, 0.15);
/* Hover */
transform: scale(1.1);
background: rgba(33, 150, 243, 0.15);
```

### Custom Dropdowns:
```css
background: rgba(18, 18, 18, 0.8);
backdrop-filter: blur(20px) saturate(180%);
/* Hover */
background: rgba(33, 150, 243, 0.2);
```

### Buttons (Primary):
```css
background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
box-shadow: 0 1px 4px rgba(33, 150, 243, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
position: relative;
overflow: hidden;
/* Shine Effect */
::before {
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
}
/* Hover */
transform: translateY(-2px);
box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
```

### Buttons (Secondary):
```css
background: rgba(255, 255, 255, 0.04);
color: var(--primary-color);
border: 1px solid rgba(255, 255, 255, 0.12);
backdrop-filter: blur(5px);
/* Hover */
background: rgba(255, 255, 255, 0.08);
border-color: var(--primary-color);
transform: translateY(-1px);
```

### Special Elements:
- Offer Banner: `rgba(251, 191, 36, 0.02)` 
- Success: `rgba(16, 185, 129, 0.15)`
- Text-Shadow für Titles: `0 0 20px rgba(33, 150, 243, 0.0)` (sehr subtil)

### Animationen:
```css
/* Fade In Up */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Subtle Pulse für Logos */
@keyframes subtle-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.95; transform: scale(1.02); }
}
```

### WICHTIG:
- DRAMATISCHER Background Gradient (transparent → blau → dunkel → schwarz)
- SEHR subtile Transparenzen (0.02-0.08)
- Blur: 20px für große Container, 10px für Buttons, 5px für Inputs
- IMMER inset shadow für Glaseffekt
- ALLE Container mit fadeInUp Animation
- Logo immer mit subtle-pulse
- Header OHNE border-bottom (nur box-shadow)

### User-Info Design (Header):
```css
/* Kompaktes User-Info Design - TRANSPARENT */
.header .header-actions #user-info {
    display: flex !important;
    align-items: center !important;
    gap: 0.4rem !important;
    padding: 0.2rem 0.5rem !important;
    background: transparent !important;
    backdrop-filter: none !important;
    border-radius: 0 !important;
    border: none !important;
    font-size: 0.85rem !important;
    color: var(--text-secondary) !important;
    transition: all 0.3s ease !important;
}

/* User Avatar */
#user-avatar {
    display: block !important;
    width: 24px !important;
    height: 24px !important;
    border-radius: 50% !important;
    object-fit: cover !important;
    border: 1px solid rgba(255, 255, 255, 0.06) !important;
}

/* Hover Effekt */
#user-info:hover {
    background: transparent !important;
}

/* Dezenter Logout Button */
#logout-btn {
    padding: 0.25rem 0.6rem !important;
    background: linear-gradient(135deg, rgba(220, 38, 38, 0.8), rgba(185, 28, 28, 0.8)) !important;
    color: white !important;
    border: none !important;
    border-radius: 4px !important;
    font-size: 0.8rem !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.3rem !important;
    text-decoration: none !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
}

/* Logout Icon */
#logout-btn i {
    font-size: 0.75rem !important;
}

/* Logout Hover */
#logout-btn:hover {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9)) !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3) !important;
}
```

### Sidebar Design Standards:
```css
/* Sidebar Title - Zentriert mit Icon */
.sidebar-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
}

/* User-Info-Card in Sidebar */
.user-info-card {
    display: flex;
    align-items: center; /* WICHTIG: Mittig ausrichten */
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: var(--spacing-lg);
}

/* Sidebar Avatar - IMG Element */
#sidebar-user-avatar {
    display: block !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    object-fit: cover !important;
    border: 1px solid rgba(255, 255, 255, 0.06) !important;
    flex-shrink: 0 !important;
}

/* User Role Badge - NUR Text, kein Background */
.user-role-badge {
    display: inline-block;
    font-size: 0.75rem;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
    margin-bottom: 4px;
}
```

### User-Info-Card Struktur:
```html
<div class="user-info-card">
    <img id="sidebar-user-avatar" class="user-avatar" src="/images/default-avatar.svg" alt="Avatar">
    <div class="user-details">
        <div class="user-name">Username</div>
        <div class="user-role-badge">ADMIN</div>
        <div class="user-full-name">Vorname Nachname</div>
        <div class="user-birthdate">Geboren: DD.MM.YYYY</div>
    </div>
</div>
```

### Modal Design Standards (PERFEKTES DESIGN!)

#### 1. Modal Container (.modal):
```css
.modal {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    justify-content: center;
    align-items: center;
}
```

#### 2. Modal Content (.modal-content):
```css
.modal-content {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: fadeInUp 0.3s ease-out;
}
```

#### 3. Modal Header (.modal-header):
```css
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
}
```

#### 4. Modal Title (.modal-title):
```css
.modal-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--primary-color);
    margin: 0;
}
```

#### 5. Modal Close Button (.modal-close):
```css
.modal-close {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all 0.3s ease;
}

.modal-close:hover {
    background-color: var(--background-dark);
    color: var(--error-color);
}
```

#### 6. Modal Form Styling:
```css
.modal form {
    padding: var(--spacing-lg);
}

/* Form Groups innerhalb des Modals */
.modal .form-group {
    margin-bottom: var(--spacing-md);
}

/* Form Controls mit Glassmorphismus */
.modal .form-control {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-sm);
    color: #fff;
    transition: all 0.3s ease;
}

.modal .form-control:focus {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(0, 142, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(0, 142, 255, 0.15),
                inset 0 1px 2px rgba(0, 0, 0, 0.2);
    outline: none;
}
```

#### 7. Modal Button Group:
```css
.button-group {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    margin-top: 20px;
}

/* Primary Button im Modal */
.modal .btn-primary {
    background: linear-gradient(135deg, rgba(0, 142, 255, 0.2), rgba(0, 142, 255, 0.1));
    border-color: rgba(0, 142, 255, 0.3);
}

/* Secondary Button im Modal */
.modal .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    color: var(--primary-color);
    border: 1px solid rgba(255, 255, 255, 0.2);
}
```

#### HTML Struktur Beispiel:
```html
<!-- Department Modal Beispiel -->
<div id="department-modal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3 class="modal-title">Neue Abteilung</h3>
            <button class="modal-close" onclick="hideModal('department-modal')">&times;</button>
        </div>
        <form id="department-form">
            <div class="form-group">
                <label class="form-label">Name</label>
                <input type="text" name="name" class="form-control" required>
            </div>
            <div class="form-group">
                <label class="form-label">Beschreibung</label>
                <textarea name="description" class="form-control" rows="3"></textarea>
            </div>
            <div class="button-group">
                <button type="submit" class="btn btn-primary">Erstellen</button>
                <button type="button" class="btn btn-secondary" onclick="hideModal('department-modal')">Abbrechen</button>
            </div>
        </form>
    </div>
</div>
```

#### JavaScript Modal Functions:
```javascript
// Modal anzeigen
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Modal verstecken
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Modal bei Klick außerhalb schließen
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});
```

#### WICHTIGE HINWEISE:
- **ALLE Modals** müssen diesem Design folgen - keine Ausnahmen!
- Glassmorphismus-Effekt ist PFLICHT (backdrop-filter)
- FadeInUp Animation für smooth appearance
- Modal-close Button mit Hover-Effekt
- Form Controls mit subtiler Transparenz
- Buttons mit Gradient und Hover-Effekten
- IMMER responsive (max-width: 500px, width: 90%)
- Overflow-y: auto für lange Formulare
- Z-index: 1000 für korrekte Schichtung

### Compact-Cards Design (Admin Dashboard):
```css
/* Compact-Card Container */
.compact-card {
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* Hover-Effekt mit Top-Border */
.compact-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
    opacity: 0;
    transition: opacity 0.3s ease;
}

.compact-card:hover::before {
    opacity: 1;
}

.compact-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.03);
}

/* Card Header - Transparenter */
.compact-card .card-header {
    background: rgba(255, 255, 255, 0.01);
    backdrop-filter: blur(10px);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px 10px 0 0;
}

/* Card Title mit Akzent-Strich */
.compact-card .card-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}

.compact-card .card-title::before {
    content: '';
    width: 4px;
    height: 20px;
    background: linear-gradient(180deg, var(--primary-color), var(--primary-light));
    border-radius: 2px;
}

/* Content mit Flex */
.compact-content {
    padding: var(--spacing-lg);
    flex: 1;
    display: flex;
    flex-direction: column;
}

/* List Items - Besser lesbar */
.compact-list {
    margin: var(--spacing-md) 0;
    flex: 1;
}

.compact-list .list-item {
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-sm);
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.2s ease;
    font-size: 0.9rem;
    color: var(--text-secondary);
}

.compact-list .list-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(0, 142, 255, 0.3);
    transform: translateX(5px);
    color: var(--text-primary);
}

/* Kompakter Button */
.compact-card .btn-block {
    width: 100%;
    padding: 10px 16px;
    font-weight: 500;
    font-size: 0.9rem;
    letter-spacing: 0.3px;
    margin-bottom: var(--spacing-md);
}

/* View-All Link - Minimalistisch */
.view-all-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.85rem;
    transition: color 0.2s ease;
    padding: 8px 0;
    margin-top: auto;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.view-all-link:hover {
    color: var(--primary-light);
}

.view-all-link .arrow {
    font-size: 0.9rem;
    transition: transform 0.2s ease;
}

.view-all-link:hover .arrow {
    transform: translateX(3px);
}

/* Grid Layout - 4 Spalten */
.admin-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-lg);
    align-items: stretch;
}

@media (max-width: 1200px) {
    .admin-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .admin-grid {
        grid-template-columns: 1fr;
    }
}
```

### JavaScript User-Info Loading:
```javascript
// Header User Info laden - MUSS in jeder Seite mit Navigation sein!
async function loadHeaderUserInfo() {
    const token = localStorage.getItem('token');
    if (!token || token === 'test-mode') return;
    
    try {
        // Username aus Token für sofortige Anzeige
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = payload.username || 'User';
        }
        
        // Vollständiges Profil laden
        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const userData = await response.json();
            const user = userData.user || userData;
            
            // Update mit vollständigem Namen
            if (userNameElement && (user.first_name || user.last_name)) {
                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                userNameElement.textContent = fullName || user.username || payload.username;
            }
            
            // Avatar update
            const avatarElement = document.getElementById('user-avatar');
            if (avatarElement && user.profile_picture) {
                avatarElement.src = user.profile_picture;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// MUSS beim Seitenladen aufgerufen werden!
document.addEventListener('DOMContentLoaded', () => {
    loadHeaderUserInfo();
});
```

---

## 🚨 Neue Workflow-Anweisungen von Simon

### 🚨 Hauptanweisungen (IMMER befolgen!)

1. **ALLE .md Dateien lesen** wenn Simon sagt "weiter machen mit Assixx Projekt":
   - CLAUDE.md
   - README.md 
   - ROADMAP.md
   - DATABASE-SETUP-README.md

2. **Kurze Zusammenfassung** erstellen:
   - Was haben wir erreicht ✅
   - Aktuelle Probleme 🔴
   - Was müssen wir prüfen 🔍

3. **Doppelte Genehmigung** einholen:
   - "Sind Sie sicher, dass wir anfangen sollen?"
   - Nach Bestätigung: Konkrete Aufgaben zeigen
   - "Welche Aufgabe möchten Sie beginnen?"

4. **Checkup-Fragen** (VOR und NACH jeder Aufgabe):
   - VOR: "Haben Sie die notwendigen Backups/Tests durchgeführt?"
   - NACH: "Haben Sie die Änderungen getestet? Alles funktioniert?"

5. **DATABASE-SETUP-README.md** IMMER aktualisieren bei DB-Änderungen!

### 📝 Aktuelle TODO Liste
1. ✅ Signup.html UI Design verbessern
2. Chat System Checkup
3. Survey Tool fertigstellen

### 🔧 Projekt-Übersicht
- **Was**: Multi-Tenant SaaS für Industriefirmen
- **Tech Stack**: Siehe [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Features**: Siehe [FEATURES.md](./FEATURES.md)
- **GitHub**: https://github.com/SCS-Technik/Assixx
- **Lokale Dev**: http://localhost:3000

---

## 💬 Chat System Design Standards

### WebSocket-Nachrichten Format:
```javascript
// Standard Message Format
{
    type: 'new_message',
    conversationId: 123,
    message: {
        id: 456,
        sender_id: 789,
        sender_name: 'Max Mustermann',
        content: 'Nachrichtentext',
        created_at: '2025-01-24T12:00:00',
        attachments: []
    }
}

// Typing Indicator
{
    type: 'typing',
    conversationId: 123,
    userId: 789,
    userName: 'Max Mustermann',
    isTyping: true
}
```

### Chat UI Standards:
```css
/* Chat Container - Glassmorphismus */
.chat-container {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
}

/* Message Bubbles */
.message.sent {
    background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.1));
    margin-left: auto;
}

.message.received {
    background: rgba(255, 255, 255, 0.05);
}

/* Unread Badge */
.unread-badge {
    background: linear-gradient(135deg, #f44336, #e53935);
    color: white;
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 0.75rem;
}
```

### Chat-Berechtigungen:
- **Admins**: Können mit allen chatten (Employees und andere Admins)
- **Employees**: Können nur mit anderen Employees und Admins chatten
- **Tenant-Isolation**: Chats nur innerhalb des gleichen Tenants

### Best Practices:
1. **Buffer zu Base64**: Immer `Buffer.from(data).toString('base64')` für Attachments
2. **Undefined-Checks**: Immer prüfen ob Conversation existiert bevor Zugriff
3. **WebSocket Reconnect**: Automatischer Reconnect nach Verbindungsabbruch
4. **Message Deduplication**: Prüfung auf doppelte Nachrichten beim Senden

---

- When new databases and structures are changed, update the database setup README accordingly
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Please clean up any files that you've created for testing or debugging purposes after they're no longer needed.