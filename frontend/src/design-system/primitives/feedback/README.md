# Feedback & Notification System

**Design System Component** • Version 1.0.0 • Best Practice 2025

## 📋 Overview

Professional feedback components following atomic design principles. Comprehensive notification system with alerts, progress indicators, spinners, skeletons, and toasts.

---

## 🎨 Components

### 1. Alerts - Inline Messages

**Purpose:** Display contextual messages within page content
**When to use:** Form validation, page-level notifications, important information

#### Basic Usage

```html
<div class="alert alert--success">
  <div class="alert__icon">
    <i class="fas fa-check-circle"></i>
  </div>
  <div class="alert__content">
    <div class="alert__title">Success!</div>
    <div class="alert__message">Your changes have been saved successfully.</div>
  </div>
  <button class="alert__close">
    <i class="fas fa-times"></i>
  </button>
</div>
```

#### Variants

```html
<!-- Success -->
<div class="alert alert--success">Success message</div>

<!-- Warning -->
<div class="alert alert--warning">Warning message</div>

<!-- Error/Danger -->
<div class="alert alert--error">Error message</div>

<!-- Info -->
<div class="alert alert--info">Info message</div>

<!-- Neutral -->
<div class="alert alert--neutral">General message</div>
```

#### Solid Variants (Stronger Visual)

```html
<div class="alert alert--success-solid">
  <div class="alert__icon"><i class="fas fa-check-circle"></i></div>
  <div class="alert__content">
    <div class="alert__title">Success!</div>
    <div class="alert__message">Item created successfully</div>
  </div>
</div>
```

#### Sizes

```html
<!-- Small -->
<div class="alert alert--success alert--sm">Compact alert</div>

<!-- Default (medium) -->
<div class="alert alert--success">Standard alert</div>

<!-- Large -->
<div class="alert alert--success alert--lg">Large alert</div>
```

#### With Actions

```html
<div class="alert alert--warning">
  <div class="alert__icon"><i class="fas fa-exclamation-triangle"></i></div>
  <div class="alert__content">
    <div class="alert__title">Unsaved Changes</div>
    <div class="alert__message">You have unsaved changes. Save before leaving?</div>
    <div class="alert__actions">
      <button class="btn btn-primary">Save</button>
      <button class="btn btn-cancel">Discard</button>
    </div>
  </div>
</div>
```

---

### 2. Progress Bars

**Purpose:** Show progress of ongoing operations
**When to use:** File uploads, form completion, multi-step processes

#### Basic Linear Progress

```html
<div class="progress">
  <div class="progress__bar" style="width: 65%">65%</div>
</div>
```

#### With Label

```html
<div class="progress__label">Uploading file...</div>
<div class="progress">
  <div class="progress__bar progress__bar--primary" style="width: 75%">75%</div>
</div>
```

#### Label Next to Bar

```html
<div class="progress--with-label">
  <div class="progress">
    <div class="progress__bar" style="width: 85%"></div>
  </div>
  <div class="progress__percentage">85%</div>
</div>
```

#### Color Variants

```html
<!-- Primary (default) -->
<div class="progress">
  <div class="progress__bar progress__bar--primary" style="width: 50%"></div>
</div>

<!-- Success -->
<div class="progress">
  <div class="progress__bar progress__bar--success" style="width: 100%"></div>
</div>

<!-- Warning -->
<div class="progress">
  <div class="progress__bar progress__bar--warning" style="width: 30%"></div>
</div>

<!-- Danger -->
<div class="progress">
  <div class="progress__bar progress__bar--danger" style="width: 15%"></div>
</div>
```

#### Size Variants

```html
<!-- Small -->
<div class="progress progress--sm">
  <div class="progress__bar" style="width: 60%"></div>
</div>

<!-- Medium (default) -->
<div class="progress progress--md">
  <div class="progress__bar" style="width: 60%"></div>
</div>

<!-- Large -->
<div class="progress progress--lg">
  <div class="progress__bar" style="width: 60%">60%</div>
</div>
```

#### Indeterminate (Loading)

```html
<div class="progress progress--indeterminate">
  <div class="progress__bar"></div>
</div>
```

**Use when:** You don't know exact progress (e.g., processing data)

#### Striped (Animated)

```html
<div class="progress progress--striped-animated">
  <div class="progress__bar" style="width: 70%"></div>
</div>
```

#### Stacked Progress (Multiple Bars)

```html
<div class="progress progress--stacked">
  <div class="progress__bar progress__bar--success" style="width: 40%"></div>
  <div class="progress__bar progress__bar--warning" style="width: 30%"></div>
  <div class="progress__bar progress__bar--danger" style="width: 20%"></div>
</div>
```

**Use case:** Show distribution (e.g., disk usage by category)

#### Circular Progress

```html
<div class="progress-circle">
  <svg width="120" height="120">
    <circle class="progress-circle__bg" cx="60" cy="60" r="54"></circle>
    <circle
      class="progress-circle__bar"
      cx="60"
      cy="60"
      r="54"
      stroke-dasharray="339.292"
      stroke-dashoffset="84.823"
    ></circle>
  </svg>
  <div class="progress-circle__text">75%</div>
</div>
```

**Formula:** `dashoffset = circumference * (1 - progress)`

---

### 3. Spinners

**Purpose:** Indicate loading state
**When to use:** Waiting for API responses, lazy loading, async operations

#### Circular Spinner (Default)

```html
<div class="spinner"></div>
```

#### Sizes

```html
<!-- Small -->
<div class="spinner spinner--sm"></div>

<!-- Medium (default) -->
<div class="spinner spinner--md"></div>

<!-- Large -->
<div class="spinner spinner--lg"></div>

<!-- Extra large -->
<div class="spinner spinner--xl"></div>
```

#### Color Variants

```html
<div class="spinner spinner--primary"></div>
<div class="spinner spinner--success"></div>
<div class="spinner spinner--warning"></div>
<div class="spinner spinner--danger"></div>
<div class="spinner spinner--white"></div>
```

#### Dots Spinner

```html
<div class="spinner-dots">
  <div class="spinner-dots__dot"></div>
  <div class="spinner-dots__dot"></div>
  <div class="spinner-dots__dot"></div>
</div>
```

#### Pulse Spinner

```html
<div class="spinner-pulse"></div>
```

#### Ring Spinner (Gradient)

```html
<div class="spinner-ring"></div>
```

#### Fullscreen Overlay

```html
<div class="spinner-overlay">
  <div class="spinner-overlay__content">
    <div class="spinner spinner--lg spinner--white"></div>
    <div class="spinner-overlay__text">Processing...</div>
  </div>
</div>
```

**Use case:** Block entire UI during critical operations

#### Inline Spinner (Buttons)

```html
<button class="btn btn-primary">
  <div class="spinner-inline"></div>
  Loading...
</button>
```

#### Centered Container

```html
<div class="spinner-container">
  <div class="spinner"></div>
</div>
```

**Use case:** Center spinner in empty tables, panels

---

### 4. Skeletons

**Purpose:** Loading placeholder to prevent layout shift
**When to use:** Initial page load, lazy loading content

#### Text Skeletons

```html
<!-- Single line -->
<div class="skeleton skeleton--text"></div>

<!-- Multiple lines (paragraph) -->
<div class="skeleton--paragraph">
  <div class="skeleton skeleton--text"></div>
  <div class="skeleton skeleton--text"></div>
  <div class="skeleton skeleton--text"></div>
  <div class="skeleton skeleton--text skeleton--w-75"></div>
</div>

<!-- Heading -->
<div class="skeleton skeleton--heading"></div>
```

#### Width Variants

```html
<div class="skeleton skeleton--text skeleton--w-full"></div>
<div class="skeleton skeleton--text skeleton--w-75"></div>
<div class="skeleton skeleton--text skeleton--w-50"></div>
<div class="skeleton skeleton--text skeleton--w-25"></div>
```

#### Avatar/Circle

```html
<div class="skeleton skeleton--avatar"></div>

<!-- Sizes -->
<div class="skeleton skeleton--avatar-sm"></div>
<div class="skeleton skeleton--avatar-md"></div>
<div class="skeleton skeleton--avatar-lg"></div>
<div class="skeleton skeleton--avatar-xl"></div>
```

#### Rectangles/Cards

```html
<div class="skeleton skeleton--rect"></div>

<!-- Sizes -->
<div class="skeleton skeleton--rect-sm"></div>
<div class="skeleton skeleton--rect-md"></div>
<div class="skeleton skeleton--rect-lg"></div>
```

#### Buttons & Inputs

```html
<!-- Button -->
<div class="skeleton skeleton--button"></div>

<!-- Input -->
<div class="skeleton skeleton--input"></div>
```

#### Composite Patterns

**User Card Skeleton:**

```html
<div class="skeleton-user-card">
  <div class="skeleton skeleton--avatar skeleton-user-card__avatar"></div>
  <div class="skeleton-user-card__content">
    <div class="skeleton skeleton--text"></div>
    <div class="skeleton skeleton--text skeleton--w-75"></div>
  </div>
</div>
```

**Table Row Skeleton:**

```html
<div class="skeleton-table-row">
  <div class="skeleton skeleton--text"></div>
  <div class="skeleton skeleton--text"></div>
  <div class="skeleton skeleton--text"></div>
  <div class="skeleton skeleton--text"></div>
</div>
```

**Card Skeleton:**

```html
<div class="skeleton-card">
  <div class="skeleton-card__header">
    <div class="skeleton skeleton--avatar"></div>
    <div class="skeleton skeleton--text skeleton--w-50"></div>
  </div>
  <div class="skeleton-card__body">
    <div class="skeleton skeleton--text"></div>
    <div class="skeleton skeleton--text"></div>
    <div class="skeleton skeleton--text skeleton--w-75"></div>
  </div>
</div>
```

#### Animation Variants

```html
<!-- Shimmer (default) -->
<div class="skeleton skeleton--text"></div>

<!-- Pulse -->
<div class="skeleton skeleton--text skeleton--pulse"></div>

<!-- Wave -->
<div class="skeleton skeleton--text skeleton--wave"></div>

<!-- No animation (static) -->
<div class="skeleton skeleton--text skeleton--static"></div>
```

---

### 5. Toasts (Notifications)

**Purpose:** Temporary notifications that auto-dismiss
**When to use:** Success confirmations, errors, warnings (non-blocking)

#### Setup Container

Add to `<body>`:

```html
<div class="toast-container toast-container--top-right">
  <!-- Toasts appear here via JavaScript -->
</div>
```

#### Basic Toast

```html
<div class="toast toast--success">
  <div class="toast__icon">
    <i class="fas fa-check-circle"></i>
  </div>
  <div class="toast__content">
    <div class="toast__title">Success!</div>
    <div class="toast__message">Item saved successfully</div>
  </div>
  <button class="toast__close">
    <i class="fas fa-times"></i>
  </button>
  <div class="toast__progress">
    <div class="toast__progress-bar" style="animation-duration: 5s"></div>
  </div>
</div>
```

#### Variants

```html
<!-- Success -->
<div class="toast toast--success">...</div>

<!-- Warning -->
<div class="toast toast--warning">...</div>

<!-- Error -->
<div class="toast toast--error">...</div>

<!-- Info -->
<div class="toast toast--info">...</div>
```

#### Container Positions

```html
<!-- Top positions -->
<div class="toast-container toast-container--top-left"></div>
<div class="toast-container toast-container--top-center"></div>
<div class="toast-container toast-container--top-right"></div>

<!-- Bottom positions -->
<div class="toast-container toast-container--bottom-left"></div>
<div class="toast-container toast-container--bottom-center"></div>
<div class="toast-container toast-container--bottom-right"></div>
```

#### With Actions

```html
<div class="toast toast--info">
  <div class="toast__icon"><i class="fas fa-info-circle"></i></div>
  <div class="toast__content">
    <div class="toast__title">Item Deleted</div>
    <div class="toast__message">The item has been removed</div>
    <div class="toast__actions">
      <button class="toast__action">Undo</button>
    </div>
  </div>
  <button class="toast__close"><i class="fas fa-times"></i></button>
</div>
```

#### JavaScript Integration

```javascript
function showToast(type, title, message, duration = 5000) {
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type} toast--enter-right`;

  toast.innerHTML = `
    <div class="toast__icon">
      <i class="fas fa-${getIcon(type)}"></i>
    </div>
    <div class="toast__content">
      <div class="toast__title">${title}</div>
      <div class="toast__message">${message}</div>
    </div>
    <button class="toast__close">
      <i class="fas fa-times"></i>
    </button>
    <div class="toast__progress">
      <div class="toast__progress-bar" style="animation-duration: ${duration}ms"></div>
    </div>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  setTimeout(() => toast.classList.add('toast--enter-right-active'), 10);

  // Close button
  toast.querySelector('.toast__close').addEventListener('click', () => {
    dismissToast(toast);
  });

  // Auto-dismiss
  setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
  toast.classList.remove('toast--enter-right-active');
  toast.classList.add('toast--exit-active');
  setTimeout(() => toast.remove(), 300);
}

function getIcon(type) {
  const icons = {
    success: 'check-circle',
    warning: 'exclamation-triangle',
    error: 'times-circle',
    info: 'info-circle',
  };
  return icons[type] || 'bell';
}

// Usage:
showToast('success', 'Success!', 'Changes saved successfully');
```

---

## ♿ Accessibility

All components are **WCAG AAA compliant**:

- ✅ Screen reader support with ARIA attributes
- ✅ Keyboard navigation for dismissible alerts/toasts
- ✅ Focus visible states
- ✅ Reduced motion support
- ✅ Semantic HTML structure

### ARIA Examples

```html
<!-- Alert -->
<div class="alert alert--error" role="alert" aria-live="polite">Error message</div>

<!-- Toast -->
<div class="toast toast--success" role="status" aria-live="polite" aria-atomic="true">
  Success toast
</div>

<!-- Spinner -->
<div class="spinner" role="status" aria-label="Loading">
  <span class="spinner__sr-text">Loading...</span>
</div>

<!-- Skeleton -->
<div class="skeleton skeleton--text" aria-busy="true" aria-label="Loading content"></div>
```

---

## 🎯 Decision Tree

### When to Use What?

**Inline Messages:**

- Form validation → Alert (error, success)
- Page-level info → Alert (info, warning)

**Progress:**

- Known progress → Progress bar with percentage
- Unknown duration → Indeterminate progress or spinner
- File upload → Progress bar with label
- Multi-step form → Stepper (see Navigation components)

**Loading States:**

- Lazy loading content → Skeleton
- API request → Spinner
- Fullscreen operation → Spinner overlay
- Button action → Inline spinner in button

**Notifications:**

- Success confirmation → Toast (success)
- Non-critical error → Toast (error)
- Undo action → Toast with action button
- Critical error → Alert or Modal

---

## 🔄 React Migration Path

### Current (CSS)

```html
<div class="alert alert--success">Message</div>
```

### Future (React)

```tsx
<Alert variant="success">Message</Alert>
```

### Component API

```tsx
interface AlertProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  title?: string;
  message: string;
  closable?: boolean;
  onClose?: () => void;
  size?: 'sm' | 'md' | 'lg';
  actions?: ReactNode;
}

interface ProgressProps {
  value: number; // 0-100
  max?: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showPercentage?: boolean;
  indeterminate?: boolean;
}

interface SpinnerProps {
  variant?: 'circular' | 'dots' | 'pulse' | 'ring';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'white';
  overlay?: boolean;
  label?: string;
}

interface ToastProps {
  variant: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  actions?: Array<{ label: string; onClick: () => void }>;
  onClose?: () => void;
}
```

---

## 📚 Best Practices

### Alerts

- ✅ Use specific variants (not generic "info" for everything)
- ✅ Keep messages concise (1-2 sentences)
- ✅ Provide actionable next steps when possible
- ⚠️ Don't stack multiple alerts (prioritize most important)

### Progress

- ✅ Always show percentage or label for clarity
- ✅ Use indeterminate for unknown duration
- ✅ Match color to context (danger for low disk space)
- ⚠️ Don't animate if operation is instant

### Spinners

- ✅ Use size appropriate to container
- ✅ Provide text label for context ("Loading data...")
- ✅ Use overlay for blocking operations
- ⚠️ Don't use multiple spinners on same page

### Skeletons

- ✅ Match skeleton shape to actual content
- ✅ Use during initial load (not for refresh)
- ✅ Combine with progressive loading
- ⚠️ Don't show skeleton for <200ms operations

### Toasts

- ✅ Auto-dismiss non-critical messages (3-5s)
- ✅ Keep title short (2-4 words)
- ✅ Use actions sparingly (Undo, Retry, View)
- ⚠️ Don't use for critical errors (use Alert or Modal)
- ⚠️ Limit to 3 toasts max at once

---

## 🚀 Usage in Project

```css
/* Import in your CSS */
@import 'design-system/primitives/feedback';
```

All feedback components are now available!

---

**Maintained by:** Assixx Design System Team
**Last Updated:** 2025-10-04
**Version:** 1.0.0
