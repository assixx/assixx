# Navigation Components

**Version 1.0.0** • Phase 6 of Design System

Navigation primitives for wayfinding, content organization, and user flow.

---

## 📦 Components

### 1. Breadcrumbs

Path navigation showing page hierarchy (Home > Admin > Users)

**Usage:**

```html
<nav class="breadcrumb">
  <a href="/" class="breadcrumb__item">Home</a>
  <span class="breadcrumb__separator">/</span>
  <a href="/admin" class="breadcrumb__item">Admin</a>
  <span class="breadcrumb__separator">/</span>
  <span class="breadcrumb__item breadcrumb__item--active">Users</span>
</nav>
```

**Classes:**

- `.breadcrumb` - Container
- `.breadcrumb__item` - Link or text item
- `.breadcrumb__item--active` - Current page (no pointer-events)
- `.breadcrumb__separator` - Separator (/, >, •)

**Use cases:**

- Page hierarchy navigation
- Multi-level admin panels
- Documentation navigation
- File system navigation

---

### 2. Pagination

Page navigation for lists and tables

**Usage:**

```html
<nav class="pagination">
  <button class="pagination__btn pagination__btn--prev" disabled>Previous</button>
  <div class="pagination__pages">
    <button class="pagination__page pagination__page--active">1</button>
    <button class="pagination__page">2</button>
    <button class="pagination__page">3</button>
    <span class="pagination__ellipsis">...</span>
    <button class="pagination__page">10</button>
  </div>
  <button class="pagination__btn pagination__btn--next">Next</button>
</nav>
```

**Classes:**

- `.pagination` - Container
- `.pagination__btn` - Previous/Next button
- `.pagination__pages` - Page numbers container
- `.pagination__page` - Individual page button
- `.pagination__page--active` - Current page
- `.pagination__info` - "Page X of Y" text
- `.pagination__ellipsis` - "..." for truncated pages
- `.pagination--compact` - Mobile variant (hides page numbers)

**Use cases:**

- Table pagination (logs, users, products)
- Search results
- Blog posts
- Image galleries

---

### 3. Tabs

Tab-based navigation for switching between content sections

**Usage (Underline variant - default):**

```html
<div class="tabs">
  <div class="tabs__nav">
    <button class="tabs__tab tabs__tab--active">Overview</button>
    <button class="tabs__tab">Details</button>
    <button class="tabs__tab">Settings</button>
  </div>
  <div class="tabs__content tabs__content--active">Overview content</div>
  <div class="tabs__content">Details content</div>
  <div class="tabs__content">Settings content</div>
</div>
```

**Usage (Glass variant):**

```html
<div class="tabs tabs--glass">
  <div class="tabs__nav">
    <button class="tabs__tab tabs__tab--active">Tab 1</button>
    <button class="tabs__tab">Tab 2</button>
  </div>
</div>
```

**Classes:**

- `.tabs` - Container
- `.tabs__nav` - Tab buttons container
- `.tabs__tab` - Individual tab button
- `.tabs__tab--active` - Active tab
- `.tabs__content` - Content container
- `.tabs__content--active` - Active content (visible)
- `.tabs--glass` - Glassmorphic button tabs
- `.tabs--compact` - Smaller spacing
- `.tabs--centered` - Center-aligned tabs
- `.tabs__tab--icon-only` - Icon-only tabs (no text)

**Use cases:**

- Dashboard views (Calendar, List, Week)
- Settings sections
- Product details (Description, Reviews, Specs)
- Data visualizations (Chart, Table, Export)

---

### 4. Stepper

Multi-step progress indicator for wizards, onboarding, checkout flows

**Usage:**

```html
<div class="stepper">
  <div class="stepper__step stepper__step--completed">
    <div class="stepper__indicator">
      <span class="stepper__number">1</span>
      <i class="fas fa-check stepper__check"></i>
    </div>
    <div class="stepper__label">Account</div>
  </div>
  <div class="stepper__connector stepper__connector--active"></div>
  <div class="stepper__step stepper__step--active">
    <div class="stepper__indicator">
      <span class="stepper__number">2</span>
      <i class="fas fa-check stepper__check"></i>
    </div>
    <div class="stepper__label">Profile</div>
  </div>
  <div class="stepper__connector"></div>
  <div class="stepper__step">
    <div class="stepper__indicator">
      <span class="stepper__number">3</span>
      <i class="fas fa-check stepper__check"></i>
    </div>
    <div class="stepper__label">Complete</div>
  </div>
</div>
```

**Classes:**

- `.stepper` - Container
- `.stepper__step` - Individual step
- `.stepper__indicator` - Circle with number/icon
- `.stepper__number` - Step number (hidden when completed)
- `.stepper__check` - Checkmark icon (shown when completed)
- `.stepper__label` - Step title
- `.stepper__description` - Optional description text
- `.stepper__connector` - Line between steps
- `.stepper__step--completed` - Completed step (green checkmark)
- `.stepper__step--active` - Current step (blue highlight)
- `.stepper__step--inactive` - Upcoming step (grayed out)
- `.stepper__step--error` - Error step (red)
- `.stepper__connector--active` - Connector between completed and active
- `.stepper__connector--completed` - Completed connector
- `.stepper--vertical` - Vertical layout
- `.stepper--compact` - Smaller circles
- `.stepper--clickable` - Steps are clickable

**Use cases:**

- Onboarding flows
- Multi-step forms
- Checkout process
- Wizard interfaces
- Progress tracking

---

### 5. Accordion

Collapsible content sections for FAQs, settings, documentation

**Usage:**

```html
<div class="accordion">
  <div class="accordion__item">
    <button class="accordion__header">
      <span class="accordion__title">Section 1</span>
      <i class="fas fa-chevron-down accordion__icon"></i>
    </button>
    <div class="accordion__content">
      <div class="accordion__body">Content goes here</div>
    </div>
  </div>
  <div class="accordion__item accordion__item--active">
    <button class="accordion__header">
      <span class="accordion__title">Section 2</span>
      <i class="fas fa-chevron-down accordion__icon"></i>
    </button>
    <div class="accordion__content">
      <div class="accordion__body">Expanded content</div>
    </div>
  </div>
</div>
```

**With icons and badges:**

```html
<button class="accordion__header">
  <div class="accordion__header-icon">
    <i class="fas fa-settings"></i>
    <span class="accordion__title">Settings</span>
  </div>
  <span class="accordion__badge">3</span>
  <i class="fas fa-chevron-down accordion__icon"></i>
</button>
```

**Classes:**

- `.accordion` - Container
- `.accordion__item` - Individual accordion item
- `.accordion__header` - Clickable header button
- `.accordion__title` - Title text
- `.accordion__icon` - Chevron icon (rotates when active)
- `.accordion__content` - Content wrapper (handles animation)
- `.accordion__body` - Actual content
- `.accordion__item--active` - Expanded item
- `.accordion__item--disabled` - Disabled item
- `.accordion--flush` - No borders between items
- `.accordion--compact` - Smaller padding
- `.accordion--bordered` - Thicker borders
- `.accordion--always-open` - Multiple items can be open
- `.accordion__header-icon` - Icon + title wrapper
- `.accordion__badge` - Notification badge

**Use cases:**

- FAQs
- Settings panels
- Documentation sections
- Filter panels
- Mobile navigation
- Expandable card lists

---

## 🎨 Design Tokens Used

### Colors

- `--color-primary` - Active states
- `--color-success` - Completed states (stepper)
- `--color-danger` - Error states (stepper)
- `--color-text-primary` - Main text
- `--color-text-secondary` - Secondary text, inactive states
- `--glass-border` - Borders, connectors

### Spacing

- `--spacing-1` to `--spacing-6` - Consistent spacing scale

### Border Radius

- `--radius-lg` - Tabs, pagination buttons
- `--radius-xl` - Accordion items

### Transitions

- `0.2s ease` - Quick interactions (tabs, breadcrumbs)
- `0.3s ease` - Medium animations (accordion, stepper)

---

## ♿ Accessibility

### Keyboard Navigation

- **Tabs**: Arrow keys to switch, Enter/Space to activate
- **Accordion**: Enter/Space to toggle
- **Stepper (clickable)**: Enter/Space to jump to step
- **Pagination**: Tab to navigate, Enter/Space to activate

### ARIA Attributes (to be added via JS)

```html
<!-- Tabs -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">Tab 1</button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">Content</div>

<!-- Accordion -->
<button aria-expanded="true" aria-controls="section-1">Section 1</button>
<div id="section-1" role="region" aria-labelledby="accordion-1">Content</div>

<!-- Stepper -->
<nav aria-label="Progress">
  <ol>
    <li aria-current="step">Step 2</li>
  </ol>
</nav>
```

### Focus States

All interactive elements have visible focus states with `box-shadow` or border changes.

### Screen Readers

- Use semantic HTML (`<nav>`, `<button>`, `<ol>`)
- Provide `aria-label` for context
- Use `aria-current` for current page/step
- Use `aria-expanded` for accordion state

---

## 📱 Responsive Behavior

### Breadcrumbs

- Font size: 14px → 13px
- Text truncation on mobile (max-width: 120px)

### Pagination

- Button padding reduced
- `.pagination--compact` hides page numbers on mobile

### Tabs

- Font size: 14px → 13px
- Glass tabs wrap to 2 columns on mobile

### Stepper

- Indicator size: 40px → 32px
- Auto-switch to vertical layout < 480px

### Accordion

- Padding: reduced on mobile
- Font size: 14px → 13px

---

## 🔄 React Migration

### Breadcrumb Component

```tsx
interface BreadcrumbProps {
  items: { label: string; href?: string }[];
  separator?: string;
}

export function Breadcrumb({ items, separator = '/' }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="breadcrumb__separator">{separator}</span>}
          {item.href ?
            <a href={item.href} className="breadcrumb__item">
              {item.label}
            </a>
          : <span className="breadcrumb__item breadcrumb__item--active">{item.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}
```

### Tabs Component

```tsx
interface TabsProps {
  variant?: 'underline' | 'glass';
  tabs: { id: string; label: string; content: ReactNode }[];
  defaultActive?: string;
}

export function Tabs({ variant = 'underline', tabs, defaultActive }: TabsProps) {
  const [active, setActive] = useState(defaultActive || tabs[0].id);

  return (
    <div className={cn('tabs', variant === 'glass' && 'tabs--glass')}>
      <div className="tabs__nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn('tabs__tab', active === tab.id && 'tabs__tab--active')}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn('tabs__content', active === tab.id && 'tabs__content--active')}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

### Accordion Component

```tsx
interface AccordionProps {
  items: { id: string; title: string; content: ReactNode }[];
  variant?: 'default' | 'flush' | 'bordered';
  alwaysOpen?: boolean;
}

export function Accordion({ items, variant = 'default', alwaysOpen }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const newOpen = new Set(openItems);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      if (!alwaysOpen) newOpen.clear();
      newOpen.add(id);
    }
    setOpenItems(newOpen);
  };

  return (
    <div className={cn('accordion', `accordion--${variant}`)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn('accordion__item', openItems.has(item.id) && 'accordion__item--active')}
        >
          <button className="accordion__header" onClick={() => toggle(item.id)}>
            <span className="accordion__title">{item.title}</span>
            <i className="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div className="accordion__content">
            <div className="accordion__body">{item.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 📚 Examples

### Complete Pagination Example

```html
<nav class="pagination">
  <button class="pagination__btn" disabled>
    <i class="fas fa-chevron-left"></i>
    Previous
  </button>

  <div class="pagination__pages">
    <button class="pagination__page pagination__page--active">1</button>
    <button class="pagination__page">2</button>
    <button class="pagination__page">3</button>
    <button class="pagination__page">4</button>
    <button class="pagination__page">5</button>
    <span class="pagination__ellipsis">...</span>
    <button class="pagination__page">20</button>
  </div>

  <span class="pagination__info">Page 1 of 20</span>

  <button class="pagination__btn">
    Next
    <i class="fas fa-chevron-right"></i>
  </button>
</nav>
```

### Vertical Stepper Example

```html
<div class="stepper stepper--vertical">
  <div class="stepper__step stepper__step--completed">
    <div class="stepper__indicator">
      <span class="stepper__number">1</span>
      <i class="fas fa-check stepper__check"></i>
    </div>
    <div>
      <div class="stepper__label">Create Account</div>
      <div class="stepper__description">Set up your login credentials</div>
    </div>
  </div>
  <div class="stepper__connector stepper__connector--active"></div>
  <div class="stepper__step stepper__step--active">
    <div class="stepper__indicator">
      <span class="stepper__number">2</span>
      <i class="fas fa-check stepper__check"></i>
    </div>
    <div>
      <div class="stepper__label">Company Information</div>
      <div class="stepper__description">Tell us about your company</div>
    </div>
  </div>
  <div class="stepper__connector"></div>
  <div class="stepper__step">
    <div class="stepper__indicator">
      <span class="stepper__number">3</span>
      <i class="fas fa-check stepper__check"></i>
    </div>
    <div>
      <div class="stepper__label">Complete</div>
      <div class="stepper__description">Review and submit</div>
    </div>
  </div>
</div>
```

---

## 🎯 Decision Tree

**When to use Breadcrumbs:**

- Multi-level page hierarchy (3+ levels)
- Users need to navigate up the tree
- Clear parent-child relationships

**When to use Pagination:**

- Large datasets (>20 items)
- Table or list views
- Search results

**When to use Tabs:**

- Related content sections (2-6 tabs)
- No need to see all content at once
- Switching doesn't lose state

**When to use Stepper:**

- Multi-step process (3-7 steps)
- Linear workflow
- Progress tracking needed

**When to use Accordion:**

- Optional content sections
- FAQs or documentation
- Limited vertical space
- Content can be scanned by titles

---

**Maintained by:** Assixx Design System Team
**Last Updated:** 2025-10-04
**Version:** 1.0.0
