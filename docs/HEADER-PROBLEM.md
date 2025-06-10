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