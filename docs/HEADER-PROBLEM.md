# Header User-Info Problem - Dokumentation

## Problem-Beschreibung (09.01.2025)

Auf der blackboard.html Seite wurden das Profilbild und die Role-Badge im Header nicht angezeigt, obwohl sie im HTML vorhanden waren.

### Symptome:
- Avatar und Role-Badge waren für ~1ms sichtbar beim Laden der Seite
- Danach verschwanden sie komplett
- Console logs zeigten: `Elements found: { userNameElement: false, userAvatar: false, roleIndicator: false }`
- Das `user-info` div hatte 0 Kinder und nur Text-Content: `Son Goku`

## Ursache

Mehrere Scripts manipulierten gleichzeitig das `user-info` Element:
1. Ein unbekanntes Script überschrieb `innerHTML` des user-info divs mit nur dem Benutzernamen
2. Dadurch wurden alle Child-Elemente (img#user-avatar, span#user-name, span#role-indicator) gelöscht
3. Timing-Konflikt zwischen verschiedenen Scripts

## Lösung

### 1. MutationObserver zum Schutz (in blackboard.html)
```javascript
window.addEventListener('DOMContentLoaded', function() {
  const userInfoDiv = document.getElementById('user-info');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const roleIndicator = document.getElementById('role-indicator');
  
  if (userInfoDiv) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.target.id === 'user-info') {
          if (userInfoDiv.children.length === 0) {
            console.log('[Blackboard] Restoring user-info elements');
            userInfoDiv.innerHTML = '';
            if (userAvatar) userInfoDiv.appendChild(userAvatar);
            if (userName) userInfoDiv.appendChild(userName);
            if (roleIndicator) userInfoDiv.appendChild(roleIndicator);
          }
        }
      });
    });
    
    observer.observe(userInfoDiv, { childList: true, subtree: false });
  }
});
```

### 2. Script-Reihenfolge geändert
```html
<!-- Vorher: -->
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
<script type="module" src="/scripts/blackboard.ts"></script>

<!-- Nachher: -->
<script type="module" src="/scripts/blackboard.ts"></script>
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
```

### 3. Struktur-Wiederherstellung in loadHeaderUserInfo()
```typescript
// Check if user-info has been overwritten
const userInfoDiv = document.getElementById('user-info');
if (userInfoDiv && userInfoDiv.children.length === 0) {
  console.log('[Blackboard] Restoring user-info structure...');
  userInfoDiv.innerHTML = `
    <img id="user-avatar" src="/assets/images/default-avatar.svg" alt="Avatar" style="display: block !important; visibility: visible !important;" />
    <span id="user-name" style="display: inline !important; visibility: visible !important;">Lade...</span>
    <span id="role-indicator" class="role-badge admin" style="display: inline-flex !important; visibility: visible !important;">Admin</span>
  `;
}
```

## Lessons Learned

1. **Script-Konflikte**: Bei mehreren Scripts, die dasselbe DOM-Element manipulieren, auf Reihenfolge achten
2. **MutationObserver**: Nützlich zum Schutz kritischer DOM-Strukturen
3. **Defensive Programmierung**: Immer prüfen, ob DOM-Struktur intakt ist, bevor man sie verwendet
4. **Debug-Logs**: Hilfreich zur Diagnose von DOM-Manipulationsproblemen

## Betroffene Dateien

- `/frontend/src/pages/blackboard.html` - MutationObserver und Script-Reihenfolge
- `/frontend/src/scripts/blackboard.ts` - loadHeaderUserInfo() Funktion mit Wiederherstellung
- `/frontend/src/styles/user-info-update.css` - Inline-Styles mit !important hinzugefügt

## Status
✅ GELÖST (09.01.2025)

---

## Problem-Beschreibung 2 (10.01.2025) - Calendar.html

Auf der calendar.html Seite fehlten der Role Switch Button und die Role Badge komplett im Header.

### Symptome:
- Kein Role Switch Button vorhanden
- Role Badge (`<span id="role-indicator">`) fehlte im user-info div
- Nur Avatar und Username wurden angezeigt
- Header sah anders aus als bei admin-dashboard.html

### Ursache:

1. **Fehlende HTML-Elemente**: Die Header-Struktur war unvollständig
2. **Fehlende Scripts**: role-switch.ts wurde nicht geladen
3. **Fehlende Navigation**: unified-navigation.ts wurde nicht eingebunden

## Lösung für Calendar.html

### 1. Vollständige Header-Struktur hinzugefügt
```html
<div class="header-actions">
  <!-- Role Switch Button -->
  <button id="role-switch-btn" class="btn-role-switch" title="Als Mitarbeiter anzeigen">
    <i class="fas fa-exchange-alt"></i>
    <span class="role-switch-text">Als Mitarbeiter</span>
  </button>
  
  <div id="user-info">
    <img id="user-avatar" src="/assets/images/default-avatar.svg" alt="Avatar" />
    <span id="user-name">Lade...</span>
    <span id="role-indicator" class="role-badge admin">Admin</span>
  </div>
  <button id="logout-btn" class="btn-logout" class="btn btn-secondary">
    <i class="fas fa-sign-out-alt"></i>
    Abmelden
  </button>
</div>
```

### 2. Erweiterter MutationObserver
```javascript
window.addEventListener('DOMContentLoaded', function() {
  const userInfoDiv = document.getElementById('user-info');
  
  if (userInfoDiv) {
    // Speichere Referenzen zu den Original-Elementen
    const originalAvatar = document.getElementById('user-avatar');
    const originalUserName = document.getElementById('user-name');
    const originalRoleIndicator = document.getElementById('role-indicator');
    
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.target.id === 'user-info') {
          // Prüfe ob alle 3 Elemente vorhanden sind
          const currentAvatar = document.getElementById('user-avatar');
          const currentUserName = document.getElementById('user-name');
          const currentRoleIndicator = document.getElementById('role-indicator');
          
          if (!currentAvatar || !currentUserName || !currentRoleIndicator) {
            console.log('[Calendar] Restoring user-info elements');
            userInfoDiv.innerHTML = '';
            
            // Alle 3 Elemente wiederherstellen
            // Avatar, Username und Role Badge
          }
        }
      });
    });
    
    observer.observe(userInfoDiv, { childList: true, subtree: false });
  }
});
```

### 3. Korrekte Script-Reihenfolge
```html
<!-- Scripts in richtiger Reihenfolge -->
<script type="module" src="/scripts/calendar.ts"></script>
<!-- Header User Info Loading -->
<script type="module" src="/scripts/header-user-info.ts"></script>
<!-- Role Switch Functionality -->
<script type="module" src="/scripts/role-switch.ts"></script>
<!-- Unified Navigation NACH calendar.ts -->
<script type="module" src="/scripts/components/unified-navigation.ts"></script>
```

## Wichtige Erkenntnisse

1. **Header-Konsistenz**: Alle Seiten sollten die gleiche Header-Struktur haben
2. **Script-Abhängigkeiten**: role-switch.ts ist notwendig für die Role Switch Funktionalität
3. **Element-Schutz**: MutationObserver muss alle Header-Elemente schützen (Avatar, Name, Badge)

## Betroffene Dateien (Update)

- `/frontend/src/pages/calendar.html` - Vollständige Header-Struktur und Scripts
- `/frontend/src/scripts/header-user-info.ts` - avatarElement Variable Definition gefixt

## Status
✅ BEIDE PROBLEME GELÖST (10.01.2025)