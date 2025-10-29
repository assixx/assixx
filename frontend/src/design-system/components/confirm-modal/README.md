# Confirm Modal Component

**Glassmorphic confirmation dialogs** for critical user actions with color-coded variants.

---

## 📖 Overview

The Confirm Modal component provides a standardized way to ask users for confirmation before executing important or destructive actions. Features glassmorphic design, color-coded variants, and icons for visual context.

### Key Features

- ✅ **4 Variants:** Warning, Danger, Info, Success
- ✅ **Icon Support:** Visual indicators with Font Awesome
- ✅ **Glassmorphism:** Blurred backdrop with gradient background
- ✅ **Responsive:** Mobile-optimized button layout
- ✅ **Accessible:** Proper focus states and disabled handling

---

## 🎨 Variants

### Default (Blue)

Standard confirmation for neutral actions.

```html
<div class="confirm-modal">
  <div class="confirm-modal__icon">
    <i class="fas fa-question-circle"></i>
  </div>
  <h3 class="confirm-modal__title">Confirm Action</h3>
  <p class="confirm-modal__message">Are you sure you want to proceed?</p>
  <div class="confirm-modal__actions">
    <button class="confirm-modal__btn confirm-modal__btn--cancel">Cancel</button>
    <button class="confirm-modal__btn confirm-modal__btn--confirm">Confirm</button>
  </div>
</div>
```

---

### Warning (Orange)

For actions that require caution.

```html
<div class="confirm-modal confirm-modal--warning">
  <div class="confirm-modal__icon">
    <i class="fas fa-exclamation-triangle"></i>
  </div>
  <h3 class="confirm-modal__title">Warning</h3>
  <p class="confirm-modal__message">This action cannot be easily undone.</p>
  <div class="confirm-modal__actions">
    <button class="confirm-modal__btn confirm-modal__btn--cancel">Cancel</button>
    <button class="confirm-modal__btn confirm-modal__btn--confirm">Proceed</button>
  </div>
</div>
```

**Use cases:**

- Archive items
- Bulk operations
- Configuration changes

---

### Danger (Red)

For destructive actions.

```html
<div class="confirm-modal confirm-modal--danger">
  <div class="confirm-modal__icon">
    <i class="fas fa-trash-alt"></i>
  </div>
  <h3 class="confirm-modal__title">Delete Permanently</h3>
  <p class="confirm-modal__message">This will permanently delete the item. This action cannot be undone.</p>
  <div class="confirm-modal__actions">
    <button class="confirm-modal__btn confirm-modal__btn--cancel">Cancel</button>
    <button class="confirm-modal__btn confirm-modal__btn--confirm">Delete</button>
  </div>
</div>
```

**Use cases:**

- Delete user data
- Remove accounts
- Permanent removal

---

### Info (Blue)

For informational confirmations.

```html
<div class="confirm-modal confirm-modal--info">
  <div class="confirm-modal__icon">
    <i class="fas fa-info-circle"></i>
  </div>
  <h3 class="confirm-modal__title">Information</h3>
  <p class="confirm-modal__message">This will send a notification to all team members.</p>
  <div class="confirm-modal__actions">
    <button class="confirm-modal__btn confirm-modal__btn--cancel">Cancel</button>
    <button class="confirm-modal__btn confirm-modal__btn--confirm">Send</button>
  </div>
</div>
```

**Use cases:**

- Send notifications
- Share information
- Publish content

---

### Success (Green)

For positive confirmations.

```html
<div class="confirm-modal confirm-modal--success">
  <div class="confirm-modal__icon">
    <i class="fas fa-check-circle"></i>
  </div>
  <h3 class="confirm-modal__title">Complete Setup</h3>
  <p class="confirm-modal__message">Ready to activate your account?</p>
  <div class="confirm-modal__actions">
    <button class="confirm-modal__btn confirm-modal__btn--cancel">Not Yet</button>
    <button class="confirm-modal__btn confirm-modal__btn--confirm">Activate</button>
  </div>
</div>
```

**Use cases:**

- Activate features
- Complete onboarding
- Approve requests

---

## 💡 Usage with Modal Overlay

Combine with the modal overlay system:

```html
<div class="modal-overlay modal-overlay--active">
  <div class="confirm-modal confirm-modal--danger">
    <div class="confirm-modal__icon">
      <i class="fas fa-trash-alt"></i>
    </div>
    <h3 class="confirm-modal__title">Delete User</h3>
    <p class="confirm-modal__message">
      This will permanently delete the user "John Doe" and all associated data. This action cannot be undone.
    </p>
    <div class="confirm-modal__actions">
      <button class="confirm-modal__btn confirm-modal__btn--cancel" onclick="closeModal()">Cancel</button>
      <button class="confirm-modal__btn confirm-modal__btn--confirm" onclick="deleteUser()">Delete User</button>
    </div>
  </div>
</div>
```

---

## 🎯 Icon Recommendations

| Variant | Icon Class                        | Purpose              |
| ------- | --------------------------------- | -------------------- |
| Default | `fa-question-circle`              | General confirmation |
| Warning | `fa-exclamation-triangle`         | Caution required     |
| Danger  | `fa-trash-alt`, `fa-exclamation`  | Destructive action   |
| Info    | `fa-info-circle`, `fa-bell`       | Informational        |
| Success | `fa-check-circle`, `fa-thumbs-up` | Positive action      |

---

## ♿ Accessibility

**Required:**

- Use semantic HTML (`<button>`, not `<div>`)
- Add `:disabled` state when action is in progress
- Provide clear, actionable text
- Use appropriate ARIA attributes

**Example:**

```html
<div class="confirm-modal" role="dialog" aria-labelledby="modal-title" aria-describedby="modal-desc">
  <h3 id="modal-title" class="confirm-modal__title">Delete Item</h3>
  <p id="modal-desc" class="confirm-modal__message">This action is permanent.</p>
  <div class="confirm-modal__actions">
    <button class="confirm-modal__btn confirm-modal__btn--cancel" aria-label="Cancel deletion">Cancel</button>
    <button class="confirm-modal__btn confirm-modal__btn--confirm" aria-label="Confirm deletion">Delete</button>
  </div>
</div>
```

---

## 📱 Responsive Behavior

**Desktop:**

- Buttons side-by-side
- Fixed 500px max-width

**Mobile (`< 768px`):**

- Buttons stack vertically
- Cancel button appears below confirm (reversed order for thumb reach)
- Full width buttons
- Reduced padding

---

## 🚫 Don't Use For

- ❌ Non-critical actions (use regular buttons)
- ❌ Form validation errors (use field validation)
- ❌ Success messages (use toast/alert)
- ❌ Multi-step processes (use wizard)

---

## ✅ Best Practices

1. **Be Specific:** "Delete user 'John Doe'?" not "Are you sure?"
2. **Explain Consequences:** State what will happen and if it's reversible
3. **Button Labels:** Use action verbs ("Delete", "Archive") not generic ("Yes", "OK")
4. **Variant Choice:** Match severity - Red for destructive, Orange for caution
5. **Focus Management:** Focus confirm button by default, except for danger (focus cancel)

---

## 🔗 Related Components

- [Modal Overlay](../modal/README.md) - Base modal system
- [Alerts](../alerts/README.md) - Non-blocking notifications
- [Buttons](../../primitives/buttons/README.md) - Button styles

---

## 📦 Import

Already included via Design System index:

```css
@import './components/confirm-modal/confirm-modal.css';
```

---

**Created:** 2025-10-28
**Status:** ✅ Production Ready
