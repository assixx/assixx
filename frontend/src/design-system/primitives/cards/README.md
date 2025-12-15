\*\*# Card Components

Glassmorphism containers for content grouping.

## Card Types

### 1. Base Card (`.card`)

General-purpose container with header, body, footer structure.

**Use cases:**

- Content sections
- Forms
- Data tables
- General grouping

```html
<div class="card">
  <div class="card__header">
    <h2 class="card__title">Title</h2>
  </div>
  <div class="card__body">
    <!-- Content here -->
  </div>
  <div class="card__footer">
    <!-- Footer content -->
  </div>
</div>
```

### 2. Stat Card (`.card-stat`)

For displaying statistics and KPI metrics.

**Use cases:**

- Dashboard metrics
- Counter displays
- Performance indicators

```html
<div class="card-stat">
  <div class="card-stat__icon">
    <i class="fas fa-users"></i>
  </div>
  <div class="card-stat__value">247</div>
  <div class="card-stat__label">Mitarbeiter</div>
</div>
```

**Color variants:**

- `.card-stat--success` - Green (positive metrics)
- `.card-stat--warning` - Orange (caution metrics)
- `.card-stat--danger` - Red (error metrics)

### 3. Accent Card (`.card-accent`)

Clean glassmorphism card with header structure.

**Use cases:**

- Feature modules
- Navigation cards
- Section highlights

```html
<div class="card-accent">
  <div class="card-accent__header">
    <h3 class="card-accent__title">Feature Title</h3>
  </div>
  <div class="card-accent__content">
    <!-- Content here -->
  </div>
</div>
```

**Modifiers:**

- `.card-accent--static` - Removes hover effects (non-clickable)

## Modifiers

### Base Card Modifiers

| Modifier           | Description                            |
| ------------------ | -------------------------------------- |
| `.card--clickable` | Makes card interactive (hover effects) |
| `.card--no-margin` | Removes bottom margin (for grids)      |
| `.card--compact`   | Reduced padding (16px instead of 24px) |

### Accent Card Modifiers

| Modifier               | Description                           |
| ---------------------- | ------------------------------------- |
| `.card-accent--static` | Removes hover effects (non-clickable) |

## Layout Structure

### Base Card

```
┌─────────────────────────┐
│ card__header            │ ← Optional
│ - card__title           │
├─────────────────────────┤
│ card__body              │ ← Main content
│                         │
├─────────────────────────┤
│ card__footer            │ ← Optional
└─────────────────────────┘
```

### Stat Card

```
┌─────────────────────────┐
│      card-stat__icon    │ ← Optional
│                         │
│   card-stat__value      │ ← Large number
│   card-stat__label      │ ← Description
└─────────────────────────┘
```

### Accent Card

```
┌─────────────────────────┐
│ card-accent__header     │
│   card-accent__title    │ ← Clean title without indicators
├─────────────────────────┤
│ card-accent__content    │
│                         │
└─────────────────────────┘
```

## Token Usage

**Spacing:**

- `--spacing-6` (24px) - Default padding
- `--spacing-4` (16px) - Compact padding
- `--spacing-8` (32px) - Accent card padding

**Colors:**

- `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`
- `--color-text-primary`, `--color-text-secondary`

**Borders & Radius:**

- `--radius-lg` (8px) - Standard cards
- `--radius-xl` (12px) - Accent cards

**Shadows:**

- `--shadow-md` - Base card shadow
- `--shadow-sm` - Stat/Accent card shadow

## Responsive

Cards are **mobile-first** and stack naturally in column layouts.

For grid layouts, use CSS Grid:

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-6);
}
```

## Accessibility

- Use semantic HTML (`<article>`, `<section>`)
- Add `role="button"` for clickable cards
- Add `tabindex="0"` and keyboard handlers
- Use proper heading hierarchy in card\_\_title

## Examples

### Dashboard Stats Grid

```html
<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;">
  <div class="card-stat">
    <div class="card-stat__value">247</div>
    <div class="card-stat__label">Total</div>
  </div>
  <div class="card-stat card-stat--success">
    <div class="card-stat__value">94%</div>
    <div class="card-stat__label">Active</div>
  </div>
  <!-- More stats... -->
</div>
```

### Feature Modules

```html
<div class="card-accent card-accent--success">
  <div class="card-accent__header">
    <h3 class="card-accent__title">Quality Control</h3>
  </div>
  <div class="card-accent__content">
    <p>Manage all quality reports...</p>
    <button class="btn btn-success">Open</button>
  </div>
</div>
```

### Navigation Cards

```html
<div class="card card--clickable">
  <div class="card__body">
    <i class="fas fa-file-alt"></i>
    <h3>Documents</h3>
    <p>247 files available</p>
  </div>
</div>
```

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-cards--docs
```

## Migration from Legacy

**Old (dashboard-theme.css):**

```html
<div class="card">
  <div class="card-header">
    <h2 class="card-title">Title</h2>
  </div>
  <div class="card-body">...</div>
</div>
```

**New (Design System):**

```html
<div class="card">
  <div class="card__header">
    <h2 class="card__title">Title</h2>
  </div>
  <div class="card__body">...</div>
</div>
```

**Changes:**

- `card-header` → `card__header` (BEM naming)
- `card-title` → `card__title` (BEM naming)
- `card-body` → `card__body` (BEM naming)

## Future Enhancements

- [ ] Card with image (`.card--image`)
- [ ] Card with tabs (`.card--tabs`)
- [ ] Card with actions (`.card__actions`)
- [ ] Expandable card (`.card--expandable`)
- [ ] Card loading state (`.card--loading`)
