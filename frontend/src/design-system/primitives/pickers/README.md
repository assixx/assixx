# Date/Time Pickers

**Enhanced Native HTML5 Pickers** • Glassmorphism Design • Accessible by Default

---

## 📋 Overview

This picker system enhances **native HTML5 inputs** (`<input type="date">`, `<input type="time">`) with glassmorphism styling while preserving browser-native functionality.

**Why Native Inputs?**

- ✅ **Zero JavaScript** - No complex calendar grid logic
- ✅ **Mobile-Optimized** - Browser provides native mobile UI
- ✅ **Accessibility** - Built-in screen reader support, keyboard navigation
- ✅ **Internationalization** - Browser handles date/time formats per locale
- ✅ **KISS Principle** - Let the browser do what it does best

---

## 🎨 Components

### Date Picker

Single date selection with calendar icon

### Time Picker

Single time selection with clock icon

### Date Range

Two date pickers for start/end selection

---

## 🚀 Usage

### Basic Date Picker

```html
<!-- Standalone -->
<div class="date-picker">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>

<!-- With form-field wrapper (recommended) -->
<div class="form-field">
  <label class="form-field__label" for="birth-date">
    Geburtsdatum <span class="required">*</span>
  </label>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input
      type="date"
      id="birth-date"
      name="birth_date"
      class="date-picker__input"
      required
    />
  </div>
</div>
```

### Basic Time Picker

```html
<div class="time-picker">
  <i class="time-picker__icon fas fa-clock"></i>
  <input type="time" class="time-picker__input" />
</div>

<!-- With 24h indicator -->
<div class="time-picker time-picker--24h">
  <i class="time-picker__icon fas fa-clock"></i>
  <input type="time" class="time-picker__input" />
</div>
```

### Date Range

```html
<!-- Horizontal (default) -->
<div class="date-range">
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" class="date-picker__input" name="start_date" />
  </div>
  <span class="date-range__separator">bis</span>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" class="date-picker__input" name="end_date" />
  </div>
</div>

<!-- Vertical (stacked) -->
<div class="date-range date-range--vertical">
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" class="date-picker__input" name="start_date" />
  </div>
  <span class="date-range__separator">bis</span>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" class="date-picker__input" name="end_date" />
  </div>
</div>

<!-- With arrow separator -->
<div class="date-range date-range--arrow">
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" class="date-picker__input" name="start_date" />
  </div>
  <span class="date-range__separator">→</span>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" class="date-picker__input" name="end_date" />
  </div>
</div>
```

---

## 🎯 Size Variants

All pickers support 3 sizes:

```html
<!-- Small -->
<div class="date-picker date-picker--sm">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>

<!-- Medium (default) -->
<div class="date-picker">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>

<!-- Large -->
<div class="date-picker date-picker--lg">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>
```

---

## 🎨 State Variants

### Error State

```html
<div class="date-picker date-picker--error">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>
<span class="form-field__message form-field__message--error">
  Bitte wählen Sie ein Datum in der Zukunft
</span>
```

### Success State

```html
<div class="date-picker date-picker--success">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>
<span class="form-field__message form-field__message--success">
  Datum gültig
</span>
```

### Warning State

```html
<div class="date-picker date-picker--warning">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>
<span class="form-field__message form-field__message--warning">
  Datum liegt weit in der Zukunft
</span>
```

### Disabled State

```html
<div class="date-picker date-picker--disabled">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" disabled />
</div>
```

---

## 🔧 Modifiers

### Without Icon

```html
<div class="date-picker date-picker--no-icon">
  <input type="date" class="date-picker__input" />
</div>
```

### Inline (Auto Width)

```html
<div class="date-picker date-picker--inline">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>
```

### Date Range - Compact

```html
<div class="date-range date-range--compact">
  <!-- Smaller gap between pickers -->
</div>
```

### Date Range - Wide

```html
<div class="date-range date-range--wide">
  <!-- Larger gap between pickers -->
</div>
```

---

## 📱 Real-World Examples

### Shift Creation (Schichtplan)

```html
<div class="form-field">
  <label class="form-field__label" for="shift-date">
    Schichtdatum <span class="required">*</span>
  </label>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input
      type="date"
      id="shift-date"
      name="shift_date"
      class="date-picker__input"
      required
    />
  </div>
  <span class="form-field__hint">
    Wählen Sie das Datum für die neue Schicht
  </span>
</div>

<div class="form-field">
  <label class="form-field__label" for="shift-time">
    Schichtbeginn <span class="required">*</span>
  </label>
  <div class="time-picker time-picker--24h">
    <i class="time-picker__icon fas fa-clock"></i>
    <input
      type="time"
      id="shift-time"
      name="start_time"
      class="time-picker__input"
      value="06:00"
      required
    />
  </div>
</div>
```

### Feature Activation Period

```html
<div class="form-field">
  <label class="form-field__label">
    Aktivierungszeitraum <span class="required">*</span>
  </label>
  <div class="date-range">
    <div class="date-picker">
      <i class="date-picker__icon fas fa-calendar"></i>
      <input
        type="date"
        name="activation_start"
        class="date-picker__input"
        required
      />
    </div>
    <span class="date-range__separator">bis</span>
    <div class="date-picker">
      <i class="date-picker__icon fas fa-calendar"></i>
      <input
        type="date"
        name="activation_end"
        class="date-picker__input"
        required
      />
    </div>
  </div>
  <span class="form-field__hint">
    Feature wird nur in diesem Zeitraum verfügbar sein
  </span>
</div>
```

### Calendar Event (Kalender)

```html
<div class="form-field">
  <label class="form-field__label">Startdatum & Uhrzeit</label>
  <div style="display: flex; gap: var(--spacing-3);">
    <div class="date-picker" style="flex: 2;">
      <i class="date-picker__icon fas fa-calendar"></i>
      <input
        type="date"
        class="date-picker__input"
        name="event_start_date"
        required
      />
    </div>
    <div class="time-picker" style="flex: 1;">
      <i class="time-picker__icon fas fa-clock"></i>
      <input
        type="time"
        class="time-picker__input"
        name="event_start_time"
        value="09:00"
        required
      />
    </div>
  </div>
</div>
```

---

## ♿ Accessibility

### Native Advantages

- ✅ **Keyboard Navigation** - Arrow keys, Enter, Escape (browser native)
- ✅ **Screen Reader Support** - Browser announces date/time properly
- ✅ **Touch Optimization** - Mobile browsers provide touch-friendly UI
- ✅ **Format Localization** - Date/time displayed per user's locale

### Additional Features

- ✅ **Focus Visible** - Clear focus ring for keyboard users
- ✅ **High Contrast Mode** - Thicker borders automatically
- ✅ **Reduced Motion** - No transitions when user prefers reduced motion
- ✅ **ARIA Labels** - Use with proper `<label>` elements

### Best Practices

```html
<!-- ✅ GOOD: Proper label association -->
<label for="event-date">Eventdatum</label>
<div class="date-picker">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" id="event-date" class="date-picker__input" />
</div>

<!-- ❌ BAD: No label -->
<div class="date-picker">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" placeholder="Datum wählen" />
</div>

<!-- ✅ GOOD: Required field indication -->
<label for="birth-date">
  Geburtsdatum <span class="required" aria-label="Pflichtfeld">*</span>
</label>
<div class="date-picker">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" id="birth-date" class="date-picker__input" required />
</div>
```

---

## 🎯 When to Use

### ✅ Use Date/Time Pickers For:

- Shift scheduling (Schichtplanung)
- Calendar events (Kalender)
- Feature activation periods
- Employee birth dates
- Contract start/end dates
- Report date ranges
- Deadline selection

### ❌ Don't Use For:

- **Age Selection** - Use number input or select (e.g., 18-99)
- **Credit Card Expiry** - Use two selects (month + year)
- **Very Old Dates** - Native picker UI struggles with dates >100 years ago
- **Custom Date Logic** - If you need week selection, multi-date, etc. (use library)

---

## 🔄 React Migration Path

### Current (HTML + CSS)

```html
<div class="date-picker">
  <i class="date-picker__icon fas fa-calendar"></i>
  <input type="date" class="date-picker__input" />
</div>
```

### Future (React Component)

```tsx
// DatePicker.tsx
interface DatePickerProps {
  value?: string; // ISO 8601 format (YYYY-MM-DD)
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  state?: 'error' | 'success' | 'warning';
  disabled?: boolean;
  icon?: ReactNode;
  min?: string; // Min date (YYYY-MM-DD)
  max?: string; // Max date (YYYY-MM-DD)
}

export function DatePicker({
  value,
  onChange,
  size = 'md',
  state,
  disabled,
  icon = <i className="fas fa-calendar" />,
  ...props
}: DatePickerProps) {
  const className = cn(
    'date-picker',
    size !== 'md' && `date-picker--${size}`,
    state && `date-picker--${state}`,
    disabled && 'date-picker--disabled',
  );

  return (
    <div className={className}>
      <span className="date-picker__icon">{icon}</span>
      <input
        type="date"
        className="date-picker__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        {...props}
      />
    </div>
  );
}

// Usage
<DatePicker
  value={formData.birthDate}
  onChange={(date) => setFormData({ ...formData, birthDate: date })}
  state={errors.birthDate ? 'error' : undefined}
  min="1900-01-01"
  max={new Date().toISOString().split('T')[0]}
/>;
```

---

## 💡 Best Practices

### 1. Always Use Labels

```html
<!-- ✅ GOOD -->
<div class="form-field">
  <label for="start-date">Startdatum</label>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" id="start-date" class="date-picker__input" />
  </div>
</div>
```

### 2. Provide Helpful Hints

```html
<div class="form-field">
  <label for="deadline">Abgabefrist</label>
  <div class="date-picker">
    <i class="date-picker__icon fas fa-calendar"></i>
    <input type="date" id="deadline" class="date-picker__input" />
  </div>
  <span class="form-field__hint"> Spätestes Datum für die Einreichung </span>
</div>
```

### 3. Validate Date Ranges

```html
<div class="form-field">
  <label>Urlaubszeitraum</label>
  <div class="date-range" id="vacation-range">
    <div class="date-picker">
      <i class="date-picker__icon fas fa-calendar"></i>
      <input
        type="date"
        class="date-picker__input"
        name="vacation_start"
        id="vacation-start"
      />
    </div>
    <span class="date-range__separator">bis</span>
    <div class="date-picker">
      <i class="date-picker__icon fas fa-calendar"></i>
      <input
        type="date"
        class="date-picker__input"
        name="vacation_end"
        id="vacation-end"
      />
    </div>
  </div>
  <span
    class="form-field__message form-field__message--error"
    id="range-error"
    style="display: none;"
  >
    Enddatum muss nach Startdatum liegen
  </span>
</div>

<script>
  // Validation example
  const startInput = document.getElementById('vacation-start');
  const endInput = document.getElementById('vacation-end');
  const rangeContainer = document.getElementById('vacation-range');
  const errorMessage = document.getElementById('range-error');

  function validateRange() {
    const start = new Date(startInput.value);
    const end = new Date(endInput.value);

    if (startInput.value && endInput.value && end < start) {
      rangeContainer.classList.add('date-range--error');
      errorMessage.style.display = 'block';
    } else {
      rangeContainer.classList.remove('date-range--error');
      errorMessage.style.display = 'none';
    }
  }

  startInput.addEventListener('change', validateRange);
  endInput.addEventListener('change', validateRange);
</script>
```

### 4. Set Reasonable Min/Max Constraints

```html
<!-- Birth date (adults only) -->
<input
  type="date"
  class="date-picker__input"
  min="1900-01-01"
  max="2007-01-01"
/>

<!-- Future dates only (event scheduling) -->
<input type="date" class="date-picker__input" min="2025-01-01" />

<!-- Current year only -->
<input
  type="date"
  class="date-picker__input"
  min="2025-01-01"
  max="2025-12-31"
/>
```

### 5. Provide Default Values When Appropriate

```html
<!-- Today as default -->
<input type="date" class="date-picker__input" value="2025-10-06" />

<!-- Working hours default -->
<input type="time" class="time-picker__input" value="08:00" />
```

---

## 🎨 Design Tokens Used

```css
/* Spacing */
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;

/* Colors */
--color-text-primary: #e0e0e0;
--color-text-secondary: #9e9e9e;
--color-text-tertiary: #757575;
--color-primary: #2196f3;
--color-success: #4caf50;
--color-warning: #ff9800;
--color-danger: #f44336;

/* Border Radius */
--radius-lg: 0.5rem; /* 8px */

/* Typography */
--font-family-sans: outfit, -apple-system, ...;

/* Animation */
--duration-fast: 150ms;
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 🔍 Browser Compatibility

| Browser        | Date Picker | Time Picker | Notes                 |
| -------------- | ----------- | ----------- | --------------------- |
| Chrome 90+     | ✅          | ✅          | Full support          |
| Firefox 90+    | ✅          | ✅          | Full support          |
| Safari 14+     | ✅          | ✅          | Full support          |
| Edge 90+       | ✅          | ✅          | Full support          |
| Mobile Safari  | ✅          | ✅          | Native iOS picker     |
| Chrome Android | ✅          | ✅          | Native Android picker |

**Fallback:** Older browsers show text input. Use `pattern` attribute for validation:

```html
<input
  type="date"
  class="date-picker__input"
  pattern="\d{4}-\d{2}-\d{2}"
  placeholder="YYYY-MM-DD"
/>
```

---

## 📚 Related Components

- **Form Fields** - Wrapper with labels and validation messages
- **Toggles** - For date preset selection (Today, This Week, etc.)
- **Modals** - For date picker dialogs

---

## 📖 References

- [MDN: `<input type="date">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date)
- [MDN: `<input type="time">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/time)
- [WCAG 2.1 Date Input](https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html)

---

**Last Updated:** 2025-10-06
