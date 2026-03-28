# Modal Component

Glassmorphism overlay modals for forms, confirmations, and dialogs.

## Structure

```html
<div class="modal-overlay [modal-overlay--active]">
  <div class="ds-modal [ds-modal--sm|ds-modal--md|ds-modal--lg|ds-modal--xl]">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Modal Title</h2>
      <button class="ds-modal__close">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <!-- Content here -->
    </div>
    <div class="ds-modal__footer [ds-modal__footer--centered|ds-modal__footer--spaced]">
      <button class="btn btn-cancel">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

## Usage

### Basic Modal

```html
<div class="modal-overlay modal-overlay--active">
  <div class="ds-modal">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Confirm Action</h2>
      <button class="ds-modal__close" data-action="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p>Are you sure you want to delete this item?</p>
    </div>
    <div class="ds-modal__footer ds-modal__footer--centered">
      <button class="btn btn-cancel" data-action="close">Cancel</button>
      <button class="btn btn-danger">Delete</button>
    </div>
  </div>
</div>
```

### Form Modal (with Design System Forms)

```html
<div class="modal-overlay modal-overlay--active">
  <div class="ds-modal ds-modal--lg">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Create Event</h2>
      <button class="ds-modal__close" data-action="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <form>
        <!-- Use Design System form-field components -->
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="title"> Title </label>
          <input type="text" id="title" class="form-field__control" required />
        </div>

        <div class="form-field">
          <label class="form-field__label" for="description"> Description </label>
          <textarea id="description" class="form-field__control" rows="4"></textarea>
        </div>
      </form>
    </div>
    <div class="ds-modal__footer">
      <button class="btn btn-cancel" data-action="close">Cancel</button>
      <button class="btn btn-primary">Create</button>
    </div>
  </div>
</div>
```

## Size Modifiers

| Modifier                  | Max-Width | Use Case                        |
| ------------------------- | --------- | ------------------------------- |
| `.ds-modal--sm`           | 500px     | Confirmations, simple dialogs   |
| `.ds-modal--md` (default) | 700px     | Standard forms, info            |
| `.ds-modal--lg`           | 900px     | Complex forms, detailed content |
| `.ds-modal--xl`           | 1200px    | Multi-section forms, settings   |
| `.ds-modal--full`         | ~100vw    | Full-screen content             |

## Footer Modifiers

| Modifier                      | Description           |
| ----------------------------- | --------------------- |
| Default                       | Buttons right-aligned |
| `.ds-modal__footer--centered` | Buttons centered      |
| `.ds-modal__footer--spaced`   | Buttons space-between |

## State

| Class                    | Description           |
| ------------------------ | --------------------- |
| `.modal-overlay`         | Hidden by default     |
| `.modal-overlay--active` | Visible with backdrop |

## JavaScript Toggle

```javascript
// Show modal
const modal = document.getElementById('myModal');
modal.classList.add('modal-overlay--active');

// Hide modal
modal.classList.remove('modal-overlay--active');

// Close on backdrop click
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('modal-overlay--active');
  }
});

// Close button
const closeBtn = modal.querySelector('.ds-modal__close');
closeBtn.addEventListener('click', () => {
  modal.classList.remove('modal-overlay--active');
});
```

## Token Usage

**Spacing:**

- Padding: `--spacing-6` (24px) desktop → `--spacing-4` (16px) mobile
- Gap: `--spacing-4` (16px) footer buttons

**Borders & Radius:**

- `--radius-xl` (12px) desktop
- `--radius-lg` (8px) mobile
- Border: `1px solid rgba(255, 255, 255, 0.1)`

**Glass Effect:**

- Modal: `background: rgba(255, 255, 255, 0.02)`, `backdrop-filter: blur(20px) saturate(180%)`
- Overlay: `background: rgba(0, 0, 0, 0.6)`, `backdrop-filter: blur(8px)`

**Shadow:**

- `--shadow-lg`

**Z-index:**

- `2000` (overlay)

## Responsive

**Desktop:**

- Padding: 24px
- Border-radius: 12px

**Tablet (≤768px):**

- Padding: 20px
- Width: 95%
- Max-height: 90vh

**Mobile (≤480px):**

- Padding: 16px
- Width: 100%
- Max-height: 95vh
- Border-radius: 8px
- Smaller title

## Accessibility

**Keyboard Navigation:**

- ESC key should close modal
- Focus trap inside modal when active
- Restore focus when closed

**Screen Readers:**

```html
<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="ds-modal">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title" id="modal-title">Modal Title</h2>
      <button class="ds-modal__close" aria-label="Close dialog">
        <i class="fas fa-times"></i>
      </button>
    </div>
    ...
  </div>
</div>
```

**Background Scrolling:**

- Body scroll is disabled when modal is active (via `:has()` selector)

## When to Use

**Use `.modal` for:**

- ✅ Delete confirmations
- ✅ Critical warnings
- ✅ Info dialogs
- ✅ Session timeouts
- ✅ Quick forms (small data entry)

**Avoid `.modal` for:**

- ❌ Complex data entry (use inline forms instead)
- ❌ Multi-step wizards (use page-container)
- ❌ Settings pages (use dedicated page)

## Examples

### Confirmation Dialog (Small)

```html
<div class="modal-overlay modal-overlay--active">
  <div class="ds-modal ds-modal--sm">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Delete User</h2>
      <button class="ds-modal__close"><i class="fas fa-times"></i></button>
    </div>
    <div class="ds-modal__body">
      <p>Are you sure you want to delete <strong>Max Mustermann</strong>?</p>
      <p style="color: var(--color-danger);">This action cannot be undone.</p>
    </div>
    <div class="ds-modal__footer ds-modal__footer--spaced">
      <button class="btn btn-cancel">Cancel</button>
      <button class="btn btn-danger">Delete</button>
    </div>
  </div>
</div>
```

### Event Form (Large)

```html
<div class="modal-overlay modal-overlay--active">
  <div class="ds-modal ds-modal--lg">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">Create Event</h2>
      <button class="ds-modal__close"><i class="fas fa-times"></i></button>
    </div>
    <div class="ds-modal__body">
      <form style="display: grid; gap: var(--spacing-4);">
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="eventTitle">
            Title
          </label>
          <input type="text" id="eventTitle" class="form-field__control" required />
        </div>

        <!-- Use Design System dropdown -->
        <div class="form-field">
          <label class="form-field__label">Event Level</label>
          <div class="dropdown">
            <button class="dropdown__trigger">
              <span>Company</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown__menu">
              <div class="dropdown__option">Company</div>
              <div class="dropdown__option">Department</div>
              <div class="dropdown__option">Team</div>
            </div>
          </div>
        </div>
      </form>
    </div>
    <div class="ds-modal__footer">
      <button class="btn btn-cancel">Cancel</button>
      <button class="btn btn-primary">Create Event</button>
    </div>
  </div>
</div>
```

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-modals--docs
```

## Migration from Legacy

**Old (calendar.css):**

```html
<div class="modal-overlay active">
  <div class="modal-container modal-lg">
    <div class="modal-header">...</div>
    <div class="modal-body">...</div>
    <div class="modal-footer">...</div>
  </div>
</div>
```

**New (Design System):**

```html
<div class="modal-overlay modal-overlay--active">
  <div class="ds-modal ds-modal--lg">
    <div class="ds-modal__header">...</div>
    <div class="ds-modal__body">...</div>
    <div class="ds-modal__footer">...</div>
  </div>
</div>
```

**Changes:**

- `.modal-container` → `.modal`
- `.active` → `.modal-overlay--active`
- `.ds-modal-header` → `.ds-modal__header` (BEM)
- `.ds-modal-body` → `.ds-modal__body` (BEM)
- `.ds-modal-footer` → `.ds-modal__footer` (BEM)
- `.ds-modal-title` → `.ds-modal__title` (BEM)
- `.ds-modal-close` → `.ds-modal__close` (BEM)

## Future Enhancements

- [ ] Drawer variant (slide-in from side)
- [ ] Bottom sheet variant (mobile)
- [ ] Nested modals support
- [ ] Modal stacking (multiple modals)
