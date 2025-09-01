# DOMPurify Implementation Guide

## Was ist DOMPurify?

- **Zweck:** Säubert HTML-Strings von gefährlichem JavaScript (XSS-Schutz)
- **Wo:** NUR im **Frontend** (Browser) - NICHT im Backend!
- **Dateien:** In `.ts` Dateien im `/frontend/src/scripts/` Ordner
- **NICHT in:** `.html` Dateien (dort kein JavaScript)
- **NICHT in:** Backend `/backend/` (Node.js hat kein DOM)
- **Ersetzt NICHT:** `dom-utils.ts` - das bleibt! DOMPurify ist nur eine Ergänzung

## Warum DOMPurify?

Verhindert XSS-Angriffe beim Verwenden von `innerHTML` mit Nutzerdaten.

## Installation ✅ BEREITS ERLEDIGT (25.08.2025)

```bash
cd frontend
pnpm add dompurify        # ✅ Installiert
# @types/dompurify NICHT mehr nötig - DOMPurify hat eigene TypeScript-Definitionen!
# ❌ ENTFERNT am 25.08.2025 - war deprecated
```

## Implementation Steps

### 1. Import hinzufügen

```typescript
import DOMPurify from 'dompurify';
```

### 2. innerHTML ersetzen

#### Vorher (unsicher)

```typescript
element.innerHTML = userContent;
element.innerHTML = `<div>${userData.name}</div>`;
```

#### Nachher (sicher)

```typescript
element.innerHTML = DOMPurify.sanitize(userContent);
element.innerHTML = DOMPurify.sanitize(`<div>${userData.name}</div>`);
```

## Wo implementieren?

### Priorität 1 - Nutzerdaten

- `/frontend/src/scripts/shifts.ts` - Mitarbeiternamen in Modals
- `/frontend/src/scripts/blackboard.ts` - User-generierte Inhalte
- `/frontend/src/scripts/chat.ts` - Nachrichten von Nutzern

### Priorität 2 - Template-Strings mit Variablen

- `/frontend/src/scripts/calendar.ts` - Event-Beschreibungen
- `/frontend/src/scripts/documents.ts` - Dateinamen

### Priorität 3 - Statische Templates (optional)

- `/frontend/src/scripts/utils/modal-manager.ts` - Interne Templates

## Zusammenspiel mit dom-utils.ts

**dom-utils.ts behält seine Funktionen:**

```typescript
import { $$, createElement } from '../utils/dom-utils';

// dom-utils für DOM-Manipulation
const button = createElement('button', {
  className: 'btn',
  textContent: 'Click me'  // Sicher!
});

// DOMPurify NUR wenn innerHTML mit Nutzerdaten nötig
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(htmlWithUserData);
```

## Best Practices

1. **IMMER sanitizen bei:**
   - Nutzereingaben
   - Datenbank-Inhalten
   - API-Responses

2. **NICHT nötig bei:**
   - Hartcodierten HTML-Strings ohne Variablen
   - Framework-generiertem HTML (React/Vue)

3. **Alternative zu innerHTML:**

   ```typescript
   // Statt innerHTML für Text:
   element.textContent = userData.name; // Automatisch sicher!

   // Oder mit dom-utils:
   createElement('div', { textContent: userData.name }); // Auch sicher!
   ```

## Wichtige Unterschiede

| Tool | Zweck | Wann verwenden |
|------|-------|----------------|
| **dom-utils.ts** | DOM-Elemente erstellen/finden | Immer für DOM-Manipulation |
| **DOMPurify** | HTML-Strings säubern | NUR bei innerHTML mit Nutzerdaten |
| **escapeHtml()** | Text escapen | Wenn man HTML als Text anzeigen will |

## Testing

Nach Implementation prüfen mit:

```javascript
// Test-String mit XSS
const evil = '<img src=x onerror="alert(1)">';
console.log(DOMPurify.sanitize(evil)); // Output: <img src="x">
```
