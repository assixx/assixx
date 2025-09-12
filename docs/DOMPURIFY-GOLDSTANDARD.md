# DOMPurify Gold Standard - Best Practices für Assixx

## 🎯 Executive Summary

**Das Problem:** Wir haben 2 verschiedene DOMPurify-Implementierungen mit unterschiedlichem Verhalten.
**Die Lösung:** Vereinheitlichen auf dom-utils.ts OHNE onclick-Support.
**Best Practice:** IMMER Event Delegation verwenden.

## 📊 Aktuelle Situation (Stand: Dezember 2024)

### Zwei konkurrierende Ansätze

| Ansatz | Verwendet von | Config | onclick | Problem |
|--------|--------------|--------|---------|---------|
| **dom-utils.ts setHTML()** | 17 TypeScript Dateien | Custom (erlaubt onclick) | ✅ Funktioniert | Sicherheitsrisiko |
| **DOMPurify.sanitize()** | 19 HTML Dateien | Default (entfernt onclick) | ❌ Entfernt | Inkonsistentes Verhalten |

### Warum existieren beide?

1. **Historisch gewachsen** - HTML Dateien waren zuerst da
2. **Keine einheitliche Migration** - TypeScript Module nutzen dom-utils
3. **Unterschiedliche Entwickler** - Verschiedene Patterns verwendet

## ✅ Der Gold Standard

### 1. NUR dom-utils.ts verwenden

```typescript
// IMMER so:
import { setHTML } from '../utils/dom-utils';
setHTML(element, htmlContent);

// NIEMALS so:
element.innerHTML = DOMPurify.sanitize(htmlContent);
```

### 2. Config ANPASSEN (Sicherheit!)

```typescript
// dom-utils.ts - NEUE Config (sicher)
export function setHTML(element: HTMLElement | null, html: string): void {
  if (element) {
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...],
      ALLOWED_ATTR: [
        'href', 'class', 'id', 'data-*',
        // KEINE onclick, onchange, etc.!
      ],
      ALLOW_DATA_ATTR: true,
    });
    element.innerHTML = sanitized;
  }
}
```

### 3. IMMER Event Delegation

```typescript
// ✅ RICHTIG - Event Delegation
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action]');
  if (button) {
    const action = button.dataset.action;
    handleAction(action);
  }
});

// ❌ FALSCH - Inline Handler
<button onclick="doSomething()">Click</button>
```

## 🛠️ Migration Guide

### Phase 1: Config anpassen (SOFORT!)

```typescript
// dom-utils.ts - Zeile 310
ALLOWED_ATTR: [
  // 'onclick',  ← ENTFERNEN!
  // 'onchange', ← ENTFERNEN!
  // Alle on* Handler entfernen
]
```

### Phase 2: TypeScript Module fixen

Alle Module die setHTML() nutzen und onclick erwarten:

- ✅ survey-admin.ts → Event Delegation (COMPLETED)
- admin-dashboard.ts → Event Delegation
- Weitere 19 Dateien...

### Phase 3: HTML Dateien migrieren

Option A: **Quick Fix**

```javascript
// Statt:
element.innerHTML = DOMPurify.sanitize(html);

// Neu (temporär):
import { setHTML } from '/utils/dom-utils.js';
setHTML(element, html);
```

Option B: **Proper Migration** (empfohlen)

- HTML → TypeScript Module konvertieren
- Event Delegation implementieren
- Kein Inline JavaScript mehr

## 📋 Checkliste für neue Features

- [ ] **Verwende dom-utils.ts setHTML()** - nicht DOMPurify direkt
- [ ] **Keine onclick/onchange Handler** - nutze Event Delegation
- [ ] **data-* Attribute für Parameter** - statt onclick="func(123)"
- [ ] **TypeScript Module** - kein Inline JavaScript in HTML
- [ ] **Test ohne onclick** - stelle sicher dass Events funktionieren

## 🚫 Was NICHT tun

```javascript
// ❌ FALSCH - Direktes DOMPurify
element.innerHTML = DOMPurify.sanitize(`
  <button onclick="doSomething()">Click</button>
`);

// ❌ FALSCH - Custom Config mit onclick
DOMPurify.sanitize(html, {
  ALLOWED_ATTR: ['onclick'] // NIEMALS!
});

// ❌ FALSCH - Inline Handler
<button onclick="alert('XSS!')">Click</button>
```

## ✅ Was STATTDESSEN tun

```typescript
// ✅ RICHTIG - dom-utils mit Event Delegation
import { setHTML } from '../utils/dom-utils';

// HTML ohne onclick
const html = `
  <button data-action="delete" data-id="${id}">
    Delete
  </button>
`;

// Sicher rendern
setHTML(container, html);

// Event Delegation
container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (btn) {
    const id = btn.dataset.id;
    deleteItem(id);
  }
});
```

## 🎯 Vorteile des Gold Standards

1. **Sicherheit** - Kein XSS-Risiko durch onclick
2. **Konsistenz** - Ein Pattern überall
3. **Wartbarkeit** - Zentrale Config in dom-utils
4. **Performance** - Event Delegation ist effizienter
5. **TypeScript** - Volle Type-Safety

## 📊 Entscheidungsbaum

```
Muss ich HTML mit User-Content rendern?
├── JA → Verwende setHTML() aus dom-utils
│   ├── Brauche ich Click-Handler?
│   │   └── JA → Event Delegation
│   └── Nur Display?
│       └── setHTML() reicht
└── NEIN → Verwende normale DOM APIs
    └── element.textContent = text
```

## 🔄 Migration Status

| Komponente | Status | Nächster Schritt |
|------------|--------|------------------|
| dom-utils.ts Config | ⚠️ Erlaubt noch onclick | onclick entfernen |
| TypeScript Module | ⚠️ Erwarten onclick | Event Delegation |
| HTML Dateien | ❌ Nutzen DOMPurify direkt | Auf dom-utils migrieren |
| Neue Features | ✅ | Folgen Gold Standard |

## 📚 Referenzen

- [DOMPurify Docs](https://github.com/cure53/DOMPurify)
- [Event Delegation Pattern](https://javascript.info/event-delegation)
- `/docs/DOMPURIFY-ONCLICK-FIX.md` - Spezifisches onclick Problem
- `/docs/TYPESCRIPT-STANDARDS.md` - TypeScript Best Practices

## ⚠️ Wichtige Warnung

**Nach Config-Änderung:** ALLE Module die onclick nutzen werden BRECHEN!
**Lösung:** ERST Event Delegation implementieren, DANN Config ändern.

## 🏁 Endziel

```typescript
// Eine Config für alle
// Keine onclick Handler
// Nur Event Delegation
// 100% Type-Safe
// 100% XSS-Sicher
```

---

**Merke:** Der Gold Standard ist NICHT verhandelbar. Sicherheit > Convenience!
