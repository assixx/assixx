# Form Fields (Glass)

Version 0.1.0 • Dark Theme Baseline

## Ziel

Einheitliche Eingabekomponenten für Inline-Formulare (siehe CLAUDE.md: „keine Modals für Dateneingabe“). Die Klassen basieren auf Tokens aus `tokens/forms.css` und sind vollständig Glassmorphism-kompatibel.

## Klassenübersicht

| Klasse                                        | Beschreibung                                               |
| --------------------------------------------- | ---------------------------------------------------------- |
| `.form-field`                                 | Wrapper (Flex, vertikal, standardmäßig 8px Abstand)        |
| `.form-field--inline`                         | Label und Control nebeneinander, z. B. für kompakte Filter |
| `.form-field__label`                          | Beschriftung (14 px, medium)                               |
| `.form-field__label--required`                | Fügt `*`-Pflichtindikator hinzu                            |
| `.form-field__control`                        | Basis für `input`, `textarea`, `select`                    |
| `.form-field__control--textarea`              | Stellt Mindesthöhe & `resize` ein                          |
| `.form-field__control--select`                | Fügt Custom-Dropdown-Pfeil hinzu                           |
| `.form-field__message`                        | Hilfetext oder Validierungshinweis                         |
| `.form-field__message--error/success/warning` | Farbvarianten                                              |
| `.is-error / .is-success / .is-warning`       | Statusklassen auf dem Control                              |

## States

- **Hover**: `--form-field-bg-hover`, `--form-field-border-hover`
- **Focus**: `--form-field-border-focus`, `--form-field-focus-ring`
- **Disabled**: Reduzierte Opazität, andere Textfarbe
- **Validation**: Error/Success/Warning Klassen steuern Rahmen & Textfarbe

## Verwendung

```html
<div class="form-field">
  <label class="form-field__label form-field__label--required" for="firstName"
    >Vorname</label
  >
  <input
    class="form-field__control"
    id="firstName"
    name="firstName"
    placeholder="Max"
  />
  <p class="form-field__message">Wird auf allen Dokumenten angezeigt.</p>
</div>
```

Für Fehlerzustände: `<input class="form-field__control is-error" />` + `<p class="form-field__message form-field__message--error">…</p>`.

## Roadmap

- Checkbox/Radio-Primitives (inkl. mehrzeiliger Labels)
- Inline-Feedback (Icons, Async-State)
- Light-Theme Tokens
- React-Mapping (`<FormField control="input" />`)
