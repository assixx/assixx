# Action Icon Buttons

**Component:** `action-icon`
**Type:** Icon-only buttons for table actions
**File:** `button.action-icons.css`

---

## 📖 Overview

Icon-only action buttons with **color-coded hover states** for quick table actions. Designed for compact spaces where text labels would be redundant.

### Key Features

- ✅ Icon-only (compact)
- ✅ Color-coded hover (Yellow = Edit, Red = Delete)
- ✅ Smooth transitions
- ✅ Accessibility (aria-label + title)
- ✅ Touch-friendly (larger on mobile)

---

## 🎨 Variants

### Edit (Yellow Hover)

```html
<button class="action-icon action-icon--edit" title="Bearbeiten" aria-label="Eintrag bearbeiten">
  <i class="fas fa-edit"></i>
</button>
```

**Hover Color:** `#fbbf24` (Yellow-400)
**Usage:** Edit, modify, update actions

---

### Delete (Red Hover)

```html
<button class="action-icon action-icon--delete" title="Löschen" aria-label="Eintrag löschen">
  <i class="fas fa-trash"></i>
</button>
```

**Hover Color:** `#ef4444` (Red-500)
**Usage:** Delete, remove, destroy actions

---

### View (Blue Hover)

```html
<button class="action-icon action-icon--view" title="Ansehen" aria-label="Details ansehen">
  <i class="fas fa-eye"></i>
</button>
```

**Hover Color:** `#3b82f6` (Blue-500)
**Usage:** View, preview, inspect actions

---

### More (Neutral Hover)

```html
<button class="action-icon action-icon--more" title="Mehr" aria-label="Weitere Optionen">
  <i class="fas fa-ellipsis-v"></i>
</button>
```

**Hover Color:** `--color-text-primary`
**Usage:** More options, context menu

---

### Toggle (Orange/Green Hover)

```html
<!-- Deactivate (Orange) -->
<button
  class="action-icon action-icon--toggle"
  data-status="active"
  title="Deaktivieren"
  aria-label="Eintrag deaktivieren"
>
  <i class="fas fa-times-circle"></i>
</button>

<!-- Activate (Green) -->
<button
  class="action-icon action-icon--toggle"
  data-status="inactive"
  title="Aktivieren"
  aria-label="Eintrag aktivieren"
>
  <i class="fas fa-check-circle"></i>
</button>
```

**Hover Color:** `#f97316` (Orange-500) for active → deactivate | `#10b981` (Green-500) for inactive → activate
**Usage:** Toggle status, activate/deactivate actions

---

## 💡 Usage

### In Tables

```html
<td>
  <div class="flex gap-2">
    <button class="action-icon action-icon--edit" title="Bearbeiten">
      <i class="fas fa-edit"></i>
    </button>
    <button class="action-icon action-icon--delete" title="Löschen">
      <i class="fas fa-trash"></i>
    </button>
  </div>
</td>
```

### With Event Handlers

```html
<button
  class="action-icon action-icon--edit"
  data-action="edit-department"
  data-dept-id="123"
  title="Abteilung bearbeiten"
  aria-label="Abteilung bearbeiten"
>
  <i class="fas fa-edit"></i>
</button>
```

---

## ♿ Accessibility

**REQUIRED:**

- `title` - Native browser tooltip
- `aria-label` - Screen reader description

**Example:**

```html
<button
  class="action-icon action-icon--delete"
  title="Löschen"
  aria-label="Eintrag dauerhaft löschen"
>
  <i class="fas fa-trash"></i>
</button>
```

---

## 🎯 States

### Default

- Transparent background
- Secondary text color
- Icon size: `0.875rem`

### Hover

- Color changes (variant-specific)
- Background: `rgba(color, 0.1)`
- Scale: `1.1`

### Active

- Darker shade
- Scale: `0.95`

### Disabled

- Opacity: `0.4`
- No hover effects
- `cursor: not-allowed`

---

## 📱 Responsive

### Desktop

- Size: `2rem × 2rem`
- Font size: `0.875rem`

### Mobile (`< 768px`)

- Size: `2.5rem × 2.5rem` (larger touch target)
- Font size: `1rem`

---

## 🚫 Don't Use For

- ❌ Primary page actions (use `.btn.btn-primary`)
- ❌ Forms (use `.btn.btn-primary`)
- ❌ When text label is needed for clarity
- ❌ Standalone buttons (need context)

---

## ✅ Best Practices

1. **Always provide tooltips** - `title` + `aria-label`
2. **Group related actions** - Use `flex gap-2`
3. **Limit to 2-3 actions** - More = dropdown menu
4. **Follow color conventions:**
   - 🟡 Yellow = Edit/Modify
   - 🔴 Red = Delete/Remove
   - 🔵 Blue = View/Read
   - ⚪ Neutral = More/Options

---

## 🔗 Related Components

- [`.btn-icon`](./README.md#icon-only) - Full button with icon
- [`.btn-float`](./button.float.css) - Floating action button
- [`.btn.btn-sm`](./button.sizes.css) - Small text button

---

## 📦 Import

Already included via `@import "./button.action-icons.css"` in `index.css`

---

## 🎨 Color Reference

| Variant      | Hover Color  | RGB                         |
| ------------ | ------------ | --------------------------- |
| Edit         | Yellow-400   | `#fbbf24`                   |
| Delete       | Red-500      | `#ef4444`                   |
| View         | Blue-500     | `#3b82f6`                   |
| More         | Text Primary | `var(--color-text-primary)` |
| Toggle (off) | Orange-500   | `#f97316`                   |
| Toggle (on)  | Green-500    | `#10b981`                   |

---

**Created:** 2025-01-22
**Status:** ✅ Production Ready
