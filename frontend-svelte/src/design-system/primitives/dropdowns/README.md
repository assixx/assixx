# Custom Dropdown Component

JavaScript-driven dropdown for complex layouts (icons, prices, flags, two-column).

**⚠️ Use native `<select>` when possible** - Better accessibility, keyboard nav, mobile support.

## When to Use Custom Dropdown

✅ **Use when:**

- Icons/Flags in options
- Two-column layouts (name + price)
- Complex styling requirements
- Custom interactions needed

❌ **Don't use when:**

- Simple text options
- Accessibility is critical
- Mobile-first priority
- Keyboard navigation important

→ Use `form-field__control--select` instead (native select)

## Usage

### Basic Example (Plan Selector)

```html
<div class="dropdown">
  <!-- Trigger -->
  <div class="dropdown__trigger" id="planTrigger">
    <span>Enterprise</span>
    <svg width="10" height="6" viewBox="0 0 10 6">
      <path d="M1 1L5 5L9 1" stroke="currentColor" />
    </svg>
  </div>

  <!-- Menu -->
  <div class="dropdown__menu" id="planMenu">
    <div class="dropdown__option" data-value="enterprise">
      <span>Enterprise</span>
      <span class="dropdown__option-secondary">€149/M</span>
    </div>
    <div class="dropdown__option" data-value="professional">
      <span>Professional</span>
      <span class="dropdown__option-secondary">€99/M</span>
    </div>
  </div>
</div>
```

### With Icons

```html
<div class="dropdown__option" data-value="production">
  <i class="fas fa-cogs"></i>
  Produktion
</div>
```

### With Scroll (Many Options)

```html
<div class="dropdown__menu dropdown__menu--scrollable">
  <!-- Options here -->
</div>
```

## JavaScript Example

```javascript
const trigger = document.querySelector('#planTrigger');
const menu = document.querySelector('#planMenu');
const options = document.querySelectorAll('.dropdown__option');

// Toggle menu
trigger.addEventListener('click', (e) => {
  e.stopPropagation();
  trigger.classList.toggle('active');
  menu.classList.toggle('active');
});

// Select option
options.forEach((option) => {
  option.addEventListener('click', () => {
    const value = option.dataset.value;
    trigger.querySelector('span').textContent = option.textContent;
    menu.classList.remove('active');
    trigger.classList.remove('active');
  });
});

// Close on outside click
document.addEventListener('click', () => {
  menu.classList.remove('active');
  trigger.classList.remove('active');
});
```

## Classes

| Class                         | Description                   |
| ----------------------------- | ----------------------------- |
| `.dropdown`                   | Container wrapper             |
| `.dropdown__trigger`          | Clickable trigger button      |
| `.dropdown__menu`             | Options container (menu)      |
| `.dropdown__menu--scrollable` | Menu with max-height + scroll |
| `.dropdown__option`           | Individual menu option        |
| `.dropdown__option-secondary` | Secondary text (e.g., price)  |

## States

- **Closed**: Menu invisible (`visibility: hidden`, `opacity: 0`)
- **Open**: `.active` on trigger and menu
- **Hover**: Option highlights with primary color
- **Active**: Option pressed state

## Spacing

- **Menu offset**: `calc(100% + 5px)` - 5px gap from trigger (not 4px!)
- **Consistent** across all dropdowns

## Token Usage

- **Form tokens**: `--form-field-padding-*`, `--form-field-bg`, `--form-field-border`
- **Colors**: `--color-primary`, `--color-text-primary`
- **Radius**: `--radius-xl` (menu), `--form-field-radius` (trigger)
- **Shadows**: `--shadow-sm`

## Accessibility

⚠️ **Custom dropdowns have limited accessibility**

**Missing features:**

- No native keyboard navigation
- Screen readers may not announce correctly
- Mobile touch targets may be smaller

**Improvements:**

- Add `role="listbox"` and `aria-expanded`
- Add keyboard handlers (Arrow keys, Enter, Escape)
- Focus management
- Consider using native `<select>` with custom styling instead

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-dropdowns--docs
```

## Examples

### Plan Selector (Pricing)

- Name + Price layout
- Use: Subscription plans, pricing tiers

### Country Selector (Flags)

- Emoji flags + codes
- Use: Country/language selection

### Department Selector (Icons)

- FontAwesome icons + text
- Use: Department, team, category selection

## Migration from Legacy

**Old (signup.css):**

```html
<div class="plan-dropdown">
  <div class="plan-option">...</div>
</div>
```

**New (Design System):**

```html
<div class="dropdown__menu">
  <div class="dropdown__option">...</div>
</div>
```

## Future Enhancements

- [ ] Keyboard navigation (Arrow keys, Enter, Escape)
- [ ] ARIA attributes for accessibility
- [ ] Search/filter in dropdown
- [ ] Multi-select variant
- [ ] Size variants (sm, md, lg)
