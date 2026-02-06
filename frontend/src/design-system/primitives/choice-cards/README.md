# Choice Cards Component

Card-style selection controls for radio buttons and checkboxes.
Vertical stacked layout with glassmorphism styling.

## Pattern Origin

From `manage-admins.html` Berechtigungen Modal - Radio button cards for permission selection.

## Structure

```html
<div class="choice-group">
  <label class="choice-card">
    <input
      type="radio|checkbox"
      class="choice-card__input"
      name="group"
      value="option1"
    />
    <span class="choice-card__text">Option 1</span>
  </label>
  <!-- More options... -->
</div>
```

## Usage

### Radio Buttons (Single Choice)

```html
<div class="choice-group">
  <label class="choice-card">
    <input
      type="radio"
      class="choice-card__input"
      name="permissions"
      value="none"
      checked
    />
    <span class="choice-card__text">Keine Abteilungen</span>
  </label>
  <label class="choice-card">
    <input
      type="radio"
      class="choice-card__input"
      name="permissions"
      value="specific"
    />
    <span class="choice-card__text">Spezifische Abteilungen</span>
  </label>
  <label class="choice-card">
    <input
      type="radio"
      class="choice-card__input"
      name="permissions"
      value="all"
    />
    <span class="choice-card__text">Alle Abteilungen</span>
  </label>
</div>
```

### Checkboxes (Multiple Choice)

```html
<div class="choice-group">
  <label class="choice-card">
    <input
      type="checkbox"
      class="choice-card__input"
      name="features"
      value="analytics"
    />
    <span class="choice-card__text">Analytics Dashboard</span>
  </label>
  <label class="choice-card">
    <input
      type="checkbox"
      class="choice-card__input"
      name="features"
      value="reports"
      checked
    />
    <span class="choice-card__text">Advanced Reports</span>
  </label>
  <label class="choice-card">
    <input
      type="checkbox"
      class="choice-card__input"
      name="features"
      value="api"
    />
    <span class="choice-card__text">API Access</span>
  </label>
</div>
```

### With Icons

```html
<div class="choice-group">
  <label class="choice-card choice-card--with-icon">
    <input type="radio" class="choice-card__input" name="plan" value="free" />
    <span class="choice-card__text">
      <i class="fas fa-gift"></i>
      Free Plan
    </span>
  </label>
  <label class="choice-card choice-card--with-icon">
    <input type="radio" class="choice-card__input" name="plan" value="pro" />
    <span class="choice-card__text">
      <i class="fas fa-star"></i>
      Pro Plan
    </span>
  </label>
</div>
```

### With Description

```html
<div class="choice-group">
  <label class="choice-card choice-card--lg">
    <input type="radio" class="choice-card__input" name="plan" value="basic" />
    <span class="choice-card__text">
      Basic Plan
      <span class="choice-card__description"
        >Perfect for small teams up to 10 users</span
      >
    </span>
  </label>
  <label class="choice-card choice-card--lg">
    <input
      type="radio"
      class="choice-card__input"
      name="plan"
      value="enterprise"
    />
    <span class="choice-card__text">
      Enterprise Plan
      <span class="choice-card__description"
        >Unlimited users with advanced features</span
      >
    </span>
  </label>
</div>
```

## Modifiers

### Choice Group

| Modifier                  | Description |
| ------------------------- | ----------- |
| `.choice-group` (default) | Gap: 12px   |
| `.choice-group--compact`  | Gap: 8px    |

### Choice Card

| Modifier                  | Description                 |
| ------------------------- | --------------------------- |
| `.choice-card` (default)  | Padding: 10px 16px          |
| `.choice-card--lg`        | Larger padding: 16px 20px   |
| `.choice-card--with-icon` | Flex layout for icon + text |

## States

### Visual States

| State        | Trigger        | Effect                         |
| ------------ | -------------- | ------------------------------ |
| **Default**  | -              | Glassmorphism card             |
| **Hover**    | Hover          | Border glow + translateY(-1px) |
| **Checked**  | Input checked  | Blue glow + background tint    |
| **Focus**    | Keyboard focus | Outline ring                   |
| **Disabled** | Input disabled | Opacity 0.5 + no interaction   |

### Indicator Animations

**Radio (Circle with dot):**

- Dot scales from 0 → 1.2 → 1
- Fade in with scale animation
- Duration: 0.3s

**Checkbox (Checkmark):**

- Checkmark scales from 0 → 1.2 → 1
- Rotated 45° border trick
- Duration: 0.3s

## Token Usage

**Spacing:**

- Gap: `--spacing-3` (12px)
- Padding: `--spacing-4` (16px)
- Input margin: `--spacing-3` (12px)

**Borders & Radius:**

- Card: `--radius-xl` (12px)
- Radio: `border-radius: 50%`
- Checkbox: `--radius-sm` (4px)

**Colors:**

- Border: `rgba(255, 255, 255, 0.1)`
- Background: `rgba(255, 255, 255, 0.03)`
- Hover border: `rgba(33, 150, 243, 0.3)`
- Checked border: `rgba(33, 150, 243, 0.5)`
- Checked background: `rgba(33, 150, 243, 0.1)`
- Glow: `0 0 20px rgba(33, 150, 243, 0.15)`

**Typography:**

- Text: `--color-text-secondary` (default)
- Checked: `--color-text-primary`
- Size: 0.875rem (14px)

## Responsive

**Desktop:**

- Padding: 10px 16px
- Input: 20px × 20px
- Text: 14px

**Mobile (≤480px):**

- Padding: 8px 12px
- Input: 18px × 18px
- Text: 13px

## Accessibility

**Native Inputs:**

- Uses real `<input type="radio|checkbox">`
- Works with keyboard (Space, Arrow keys)
- Screen reader compatible

**Focus Management:**

```html
<label class="choice-card">
  <input type="radio" class="choice-card__input" aria-label="Select option" />
  <span class="choice-card__text">Option</span>
</label>
```

**Keyboard Navigation:**

- Tab: Move between options
- Arrow keys: Navigate radio group
- Space: Toggle checkbox/radio
- Focus ring visible on `:focus-visible`

## When to Use

**Use `.choice-card` when:**

- ✅ Permission selection (Keine/Spezifisch/Alle)
- ✅ Plan selection (Free/Basic/Pro/Enterprise)
- ✅ Settings with 3-5 exclusive options
- ✅ Multi-step form choices
- ✅ Visual preference selection

**Use regular form controls when:**

- ❌ More than 7 options (use `<select>`)
- ❌ Simple yes/no (use toggle switch)
- ❌ Space-constrained UI (use compact checkboxes)

## Comparison with Other Components

| Component          | Layout            | Use Case                        |
| ------------------ | ----------------- | ------------------------------- |
| **Choice Cards**   | Vertical cards    | Visual single/multi choice      |
| **Toggle Buttons** | Horizontal inline | View modes, filters (NO inputs) |
| **Form Checkbox**  | Basic inline      | Simple yes/no in forms          |
| **Form Radio**     | Basic inline      | Simple exclusive choice         |
| **Dropdown**       | Collapsed menu    | Many options (>7)               |

## Examples

### Permissions Modal (Real Use Case)

```html
<div class="modal-overlay modal-overlay--active">
  <div class="modal modal--md">
    <div class="modal__header">
      <h2 class="modal__title">Abteilungsberechtigungen verwalten</h2>
      <button class="modal__close"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal__body">
      <div class="form-field">
        <label class="form-field__label">Berechtigungstyp</label>
        <div class="choice-group">
          <label class="choice-card">
            <input
              type="radio"
              class="choice-card__input"
              name="permission-type"
              value="none"
              checked
            />
            <span class="choice-card__text">Keine Abteilungen</span>
          </label>
          <label class="choice-card">
            <input
              type="radio"
              class="choice-card__input"
              name="permission-type"
              value="specific"
            />
            <span class="choice-card__text">Spezifische Abteilungen</span>
          </label>
          <label class="choice-card">
            <input
              type="radio"
              class="choice-card__input"
              name="permission-type"
              value="all"
            />
            <span class="choice-card__text">Alle Abteilungen</span>
          </label>
        </div>
      </div>
    </div>
    <div class="modal__footer">
      <button class="btn btn-cancel">Abbrechen</button>
      <button class="btn btn-primary">Speichern</button>
    </div>
  </div>
</div>
```

### Plan Selection

```html
<div class="page-container page-container--narrow page-container--centered">
  <h1>Choose Your Plan</h1>
  <div class="choice-group">
    <label class="choice-card choice-card--lg">
      <input type="radio" class="choice-card__input" name="plan" value="free" />
      <span class="choice-card__text">
        <i class="fas fa-gift"></i>
        Free Plan
        <span class="choice-card__description">
          Up to 5 users • Basic features • Email support
        </span>
      </span>
    </label>
    <label class="choice-card choice-card--lg">
      <input
        type="radio"
        class="choice-card__input"
        name="plan"
        value="pro"
        checked
      />
      <span class="choice-card__text">
        <i class="fas fa-star"></i>
        Pro Plan
        <span class="choice-card__description">
          Up to 50 users • Advanced features • Priority support
        </span>
      </span>
    </label>
    <label class="choice-card choice-card--lg">
      <input
        type="radio"
        class="choice-card__input"
        name="plan"
        value="enterprise"
      />
      <span class="choice-card__text">
        <i class="fas fa-building"></i>
        Enterprise Plan
        <span class="choice-card__description">
          Unlimited users • All features • Dedicated support
        </span>
      </span>
    </label>
  </div>
  <button class="btn btn-primary btn-block">Continue</button>
</div>
```

### Feature Toggles (Checkbox)

```html
<div class="form-field">
  <label class="form-field__label">Enable Features</label>
  <div class="choice-group choice-group--compact">
    <label class="choice-card">
      <input
        type="checkbox"
        class="choice-card__input"
        name="features"
        value="analytics"
        checked
      />
      <span class="choice-card__text">
        <i class="fas fa-chart-line"></i>
        Analytics Dashboard
      </span>
    </label>
    <label class="choice-card">
      <input
        type="checkbox"
        class="choice-card__input"
        name="features"
        value="api"
        checked
      />
      <span class="choice-card__text">
        <i class="fas fa-code"></i>
        API Access
      </span>
    </label>
    <label class="choice-card">
      <input
        type="checkbox"
        class="choice-card__input"
        name="features"
        value="export"
      />
      <span class="choice-card__text">
        <i class="fas fa-download"></i>
        Data Export
      </span>
    </label>
  </div>
</div>
```

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-choicecards--docs
```

## Migration from Legacy

**Old (manage-admins.css):**

```html
<div class="permission-type-selection">
  <label class="radio-label">
    <input type="radio" name="permission-type" value="none" />
    <span class="radio-text">Keine Abteilungen</span>
  </label>
</div>
```

**New (Design System):**

```html
<div class="choice-group">
  <label class="choice-card">
    <input
      type="radio"
      class="choice-card__input"
      name="permission-type"
      value="none"
    />
    <span class="choice-card__text">Keine Abteilungen</span>
  </label>
</div>
```

**Changes:**

- `.permission-type-selection` → `.choice-group`
- `.radio-label` → `.choice-card`
- `.radio-text` → `.choice-card__text`
- Native `<input>` → `.choice-card__input`
- BEM naming pattern
- Token-based styling

## Future Enhancements

- [ ] Horizontal layout variant (inline cards)
- [ ] Color variants (success, warning, danger)
- [ ] Image support (plan cards with illustrations)
- [ ] Badge/Label support (e.g., "Popular", "Best Value")
