# Toggle Components

Mutually exclusive button groups for view modes, filters, and segmented controls.

## Components

### Toggle Button Group

Radio-like behavior - only one button active at a time.

**Use cases:**

- View mode toggles (Active/Archived/All)
- Filter options (Pending/Approved/Rejected)
- Time ranges (Day/Week/Month/Year)
- Display modes (Grid/List/Table)

## Usage

### Basic Example

```html
<div class="toggle-group">
  <button class="toggle-group__btn active" data-mode="active">
    <i class="fas fa-folder"></i>
    Aktive
  </button>
  <button class="toggle-group__btn" data-mode="archived">
    <i class="fas fa-archive"></i>
    Archiviert
  </button>
  <button class="toggle-group__btn" data-mode="all">
    <i class="fas fa-folder-open"></i>
    Alle
  </button>
</div>
```

### Icon Only (Compact)

```html
<div class="toggle-group">
  <button class="toggle-group__btn active" title="Grid View">
    <i class="fas fa-th"></i>
  </button>
  <button class="toggle-group__btn" title="List View">
    <i class="fas fa-list"></i>
  </button>
</div>
```

### With Disabled Option

```html
<div class="toggle-group">
  <button class="toggle-group__btn active">Free</button>
  <button class="toggle-group__btn">Pro</button>
  <button class="toggle-group__btn" disabled>Enterprise</button>
</div>
```

## JavaScript Example

```javascript
const toggleGroup = document.querySelector('.toggle-group');

toggleGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-group__btn');
  if (!btn || btn.disabled) return;

  // Remove active from all
  toggleGroup.querySelectorAll('.toggle-group__btn').forEach((b) => {
    b.classList.remove('active');
  });

  // Add active to clicked
  btn.classList.add('active');

  // Handle state change
  const mode = btn.dataset.mode;
  console.log('Mode changed to:', mode);
});
```

## Classes

| Class                        | Description                     |
| ---------------------------- | ------------------------------- |
| `.toggle-group`              | Container for toggle buttons    |
| `.toggle-group__btn`         | Individual toggle button        |
| `.toggle-group__btn--active` | Active state (or use `.active`) |

## States

- **Default**: Inactive button
- **Hover**: Light highlight
- **Active**: Primary color highlight
- **Disabled**: Reduced opacity, not clickable

## Token Usage

- **Spacing**: `--spacing-1`, `--spacing-1-5`, `--spacing-2`, `--spacing-3`
- **Radius**: `--radius-md`, `--radius-lg`
- **Colors**: `--color-primary`, `--color-primary-alpha-15`, `--color-primary-alpha-30`
- **Font**: `--font-weight-medium`

## Accessibility

- Use semantic `<button>` elements
- Add `title` or `aria-label` for icon-only buttons
- Disabled state with `disabled` attribute
- Keyboard navigation works out of the box

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-toggles--docs
```

## Migration from Legacy

**Old (documents.css):**

```html
<div class="view-mode-toggle">
  <button class="toggle-btn active">...</button>
</div>
```

**New (Design System):**

```html
<div class="toggle-group">
  <button class="toggle-group__btn active">...</button>
</div>
```

## Future Enhancements

- [ ] Toggle Switch component (ON/OFF)
- [ ] Segmented Control variant (iOS-style)
- [ ] Radio group integration
- [ ] Size variants (sm, md, lg)
