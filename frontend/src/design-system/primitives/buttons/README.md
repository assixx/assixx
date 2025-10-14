# Button System

**Design System Component** • Version 1.0.0 • Best Practice 2025

## 📋 Overview

Professional button component library following atomic design principles. Fully documented, accessible, and React-migration ready.

---

## 🎨 Variants

### Primary (Second-Level)

**Visual:** Blue gradient background
**Usage:** Main form actions, dialog CTAs
**Example:** Save, Submit, Upload

```html
<button class="btn btn-primary">Save Changes</button>
```

### Primary First-Level

**Visual:** Transparent with shadow only
**Usage:** Hero CTAs, landing pages, login
**Example:** Register, Get Started, Login

```html
<button class="btn btn-primary-first">Get Started</button>
```

**⚠️ Critical:** `background: none !important` - This is intentional!

### Secondary

**Visual:** Outline with glassmorphism
**Usage:** Cancel, back, alternative actions

```html
<button class="btn btn-secondary">Cancel</button>
```

### Danger

**Visual:** Red gradient (destructive)
**Usage:** Delete, remove, permanent actions

```html
<button class="btn btn-danger">Delete Account</button>
```

**Best Practice:** Always confirm destructive actions!

### Success

**Visual:** Green gradient
**Usage:** Approve, confirm, positive actions

```html
<button class="btn btn-success">Approve Request</button>
```

### Status Toggle

**Visual:** Outline with status colors
**Usage:** Activate/deactivate toggles

```html
<!-- Current state: Active → Show deactivate -->
<button class="btn btn-status-active">Deactivate</button>

<!-- Current state: Inactive → Show activate -->
<button class="btn btn-status-inactive">Activate</button>
```

**Logic:** Button shows OPPOSITE of current state

---

## 📏 Sizes

```html
<!-- Small -->
<button class="btn btn-primary btn-sm">Small</button>

<!-- Medium (default) -->
<button class="btn btn-primary">Medium</button>

<!-- Large -->
<button class="btn btn-primary btn-lg">Large</button>
```

---

## 🎯 Modifiers

### Full Width

```html
<button class="btn btn-primary btn-block">Full Width Button</button>
```

### With Icon

```html
<button class="btn btn-primary">
  <svg width="20" height="20">...</svg>
  Upload File
</button>
```

### Icon Only

```html
<button class="btn btn-primary btn-icon">
  <svg width="20" height="20">...</svg>
</button>
```

### Loading State

```html
<button class="btn btn-primary" data-loading="true">Saving...</button>
```

Shows spinner automatically!

### Disabled

```html
<button class="btn btn-primary" disabled>Disabled Button</button>
```

---

## ✨ Effects

### Shine Animation

Automatically applied to `.btn-primary` and `.btn-primary-first`

### Pulse (Attention Grabber)

```html
<button class="btn btn-primary btn-pulse">Limited Time Offer!</button>
```

**⚠️ Use sparingly** - only for time-sensitive CTAs

### Glow (Premium)

```html
<button class="btn btn-primary btn-glow">Upgrade to Pro</button>
```

---

## ♿ Accessibility

- **WCAG AAA compliant** focus states
- **Keyboard navigation** fully supported
- **Screen readers** properly announced
- **Reduced motion** respected via `prefers-reduced-motion`

```css
/* Focus visible for keyboard users */
.btn:focus-visible {
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.2);
}
```

---

## 🏗️ Architecture

```
buttons/
├── button.base.css           ← Foundation (structure & behavior)
├── button.primary.css        ← Variant (visual appearance)
├── button.primary-first.css
├── button.secondary.css
├── button.danger.css
├── button.success.css
├── button.status.css
├── button.effects.css        ← Enhancements (micro-interactions)
├── index.css                 ← Barrel export
└── README.md                 ← This file
```

**Philosophy:** Separation of concerns

- **Base** = What all buttons ARE
- **Variants** = How they LOOK
- **Effects** = How they FEEL

---

## 🎈 Floating Action Button (FAB)

**Special button** for primary actions, fixed to screen corner

### Basic Usage

```html
<button class="btn-float" aria-label="Add item">
  <i class="fas fa-plus"></i>
</button>
```

### Variants

```html
<!-- Primary (Default) -->
<button class="btn-float" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>

<!-- Success -->
<button class="btn-float btn-float--success" aria-label="Approve">
  <i class="fas fa-check"></i>
</button>

<!-- Danger -->
<button class="btn-float btn-float--danger" aria-label="Delete">
  <i class="fas fa-trash"></i>
</button>

<!-- Warning -->
<button class="btn-float btn-float--warning" aria-label="Warning">
  <i class="fas fa-exclamation"></i>
</button>
```

### Sizes

```html
<!-- Small (48px) -->
<button class="btn-float btn-float--sm" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>

<!-- Default (60px) -->
<button class="btn-float" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>

<!-- Large (72px) -->
<button class="btn-float btn-float--lg" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>
```

### Positions

```html
<!-- Bottom-Right (Default) -->
<button class="btn-float" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>

<!-- Bottom-Left -->
<button class="btn-float btn-float--bottom-left" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>

<!-- Top-Right -->
<button class="btn-float btn-float--top-right" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>

<!-- Top-Left -->
<button class="btn-float btn-float--top-left" aria-label="Add">
  <i class="fas fa-plus"></i>
</button>
```

### Extended (with Text)

```html
<button class="btn-float btn-float--extended" aria-label="Create new">
  <i class="fas fa-plus btn-float__icon"></i>
  <span class="btn-float__label">Create new</span>
</button>
```

**Note:** Auto-collapses to icon-only on mobile

### With Notification Badge

```html
<button class="btn-float" aria-label="Messages">
  <i class="fas fa-comment"></i>
  <span class="btn-float__badge">3</span>
</button>
```

### Use Cases

- **Add new items** - Employees, departments, products
- **Quick actions** - Chat, help, support
- **Scroll to top** - Long pages
- **Primary action** - On data table pages

### Accessibility

**Required:**

- Always use `aria-label` for screen readers
- FAB has built-in focus states
- Keyboard accessible (Tab + Enter/Space)

**Example:**

```html
<button class="btn-float" aria-label="Add new employee">
  <i class="fas fa-user-plus"></i>
</button>
```

---

## 🔄 React Migration Path

This CSS structure maps directly to React components:

### Current (CSS)

```html
<button class="btn btn-primary btn-lg">Submit</button>
```

### Future (React)

```tsx
<Button variant="primary" size="lg">
  Submit
</Button>
```

### Component API

```tsx
interface ButtonProps {
  variant: 'primary' | 'primary-first' | 'secondary' | 'danger' | 'success' | 'status-active' | 'status-inactive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}
```

---

## 🎯 Decision Tree

**Need a button? Follow this:**

1. **What's the action?**
   - Main form submit → `.btn-primary`
   - Hero/Landing CTA → `.btn-primary-first`
   - Cancel/Back → `.btn-secondary`
   - Delete/Remove → `.btn-danger`
   - Approve/Success → `.btn-success`
   - Status toggle → `.btn-status-*`

2. **Where is it?**
   - Hero section → `.btn-primary-first`
   - Form → `.btn-primary`
   - Modal → `.btn-primary` + `.btn-secondary`
   - Table row → `.btn-sm`

3. **How important?**
   - Critical → `.btn-lg`
   - Standard → (default)
   - Compact UI → `.btn-sm`

---

## 📚 References

- **Material Design** - Button component
- **Radix UI** - Primitive pattern
- **Shadcn** - Variant architecture
- **Fluent** - Semantic tokens
- **iOS HIG** - Micro-interactions

---

## ✅ Checklist for New Buttons

Before adding a new button variant:

- [ ] Does it fit an existing variant?
- [ ] Is there a semantic use case?
- [ ] Does it follow the naming convention?
- [ ] Is it documented here?
- [ ] Does it work with all sizes?
- [ ] Is it accessible (focus, keyboard)?
- [ ] Does it respect reduced motion?

---

## 🚀 Usage in Project

```css
/* Import in your CSS */
@import 'design-system/primitives/buttons';
```

**That's it!** All button styles are now available.

---

**Maintained by:** Assixx Design System Team
**Last Updated:** 2025-10-04
**Version:** 1.0.0
