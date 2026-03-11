# Svelte Actions

Wiederverwendbare Svelte-Actions und globale DOM-Behaviors.

## modal-dropdown-scroll

**Globaler Auto-Fix** für Dropdowns in Modals — zero Config, zero Imports pro Komponente.

### Problem

`.dropdown__menu` ist `position: absolute` innerhalb von `.ds-modal__body` (`overflow-y: auto`).
Absolute Elemente tragen nicht zur Scroll-Höhe bei → Menüs nahe dem unteren Rand des Modals werden abgeschnitten.

### Lösung

Ein einziger `MutationObserver` auf `document.body` beobachtet Class-Änderungen auf `.dropdown__menu` Elementen:

1. **Dropdown öffnet** (`.active` hinzugefügt):
   - Prüft ob das Menü in einem `.ds-modal__body` sitzt
   - Berechnet den Overflow (`menuRect.bottom - bodyRect.bottom`)
   - Wenn Overflow > 0: Modal-Höhe locken, PaddingBottom erweitern, smooth nach unten scrollen
   - Wenn kein Overflow: nichts tun (Dropdown passt)

2. **Dropdown schließt** (`.active` entfernt):
   - Scrollt `.ds-modal__body` smooth zurück nach oben
   - Entfernt Extra-Padding und Höhen-Lock **nach** Scroll-Ende (`scrollend` Event)
   - Nur wenn vorher tatsächlich gescrollt wurde (`WeakSet` trackt betroffene Bodies)

### Architektur

```
document.body
  └── MutationObserver (attributeFilter: ['class'], subtree: true)
        └── Reagiert NUR auf .dropdown__menu Elemente
              ├── .active hinzugefügt → scrollToShowMenu()
              └── .active entfernt   → resetScroll()
```

- **WeakSet** trackt welche `.ds-modal__body` Elemente vom Observer gescrollt wurden → sauberes GC
- **Kein nested Observer** — ein einziger Observer für die gesamte App
- **Side-effect Import** in `+layout.svelte` → startet automatisch, kein Setup nötig

### Setup

Bereits konfiguriert in `src/routes/+layout.svelte`:

```ts
import '$lib/actions/modal-dropdown-scroll';
```

Fertig. Alle 56+ Modals mit `.ds-modal__body` und `.dropdown__menu.active` profitieren automatisch.

### Wann greift der Fix?

| Situation                                         | Ergebnis                         |
| ------------------------------------------------- | -------------------------------- |
| Dropdown passt komplett in den sichtbaren Bereich | Nichts passiert                  |
| Dropdown ragt unten aus `.ds-modal__body` raus    | Padding + Scroll nach unten      |
| Dropdown schließt nach Scroll                     | Smooth zurück nach oben, Cleanup |
| Dropdown nicht in einem Modal                     | Komplett ignoriert               |

### Dateien

| Datei                      | Zweck                                               |
| -------------------------- | --------------------------------------------------- |
| `modal-dropdown-scroll.ts` | Globaler Observer + Scroll-Logik                    |
| `click-outside.ts`         | Capture-Phase Click-Outside für Dropdowns in Modals |

## click-outside

Capture-Phase Click-Outside-Detection für Dropdowns. Löst das Problem, dass Modals `e.stopPropagation()` nutzen und damit Bubble-Phase Handler blockieren.

```ts
import { onClickOutsideDropdown } from '$lib/actions/click-outside';

$effect(() => {
  return onClickOutsideDropdown(closeAllDropdowns);
});
```
