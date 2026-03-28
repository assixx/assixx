# Data Display Components

**Version 1.0.0** • Phase 7 of Design System

Components for displaying structured data in tables, lists, and empty states.

**REPLACES:** `/styles/tailwind/compat/bootstrap-tables.css`

---

## 📦 Components

### 1. Tables

Glassmorphism data tables with multiple variants

**Basic Usage:**

```html
<table class="data-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Role</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Max Mustermann</td>
      <td>max@example.com</td>
      <td><span class="badge badge--role-admin">Admin</span></td>
    </tr>
    <tr>
      <td>Anna Schmidt</td>
      <td>anna@example.com</td>
      <td><span class="badge badge--role-employee">Employee</span></td>
    </tr>
  </tbody>
</table>
```

**Classes:**

- `.data-table` - Base table component
- `.data-table--striped` - Alternating row colors
- `.data-table--hover` - Enhanced hover with primary color
- `.data-table--bordered` - Add borders around all cells
- `.data-table--borderless` - Remove all borders
- `.data-table--sm` - Compact layout (denser)
- `.data-table--xs` - Extra compact (very dense)
- `.table-responsive` - Wrapper for horizontal scroll

**Variants:**

```html
<!-- Striped Table -->
<table class="data-table data-table--striped">
  ...
</table>

<!-- Hover Table (clickable rows) -->
<table class="data-table data-table--hover">
  ...
</table>

<!-- Compact Table (for large datasets) -->
<table class="data-table data-table--sm">
  ...
</table>

<!-- Combined Variants -->
<table class="data-table data-table--striped data-table--hover data-table--sm">
  ...
</table>
```

**Responsive Wrapper (REQUIRED for wide tables):**

```html
<div class="table-responsive">
  <table class="data-table data-table--striped data-table--hover">
    ...
  </table>
</div>
```

The `.table-responsive` wrapper enables horizontal scrolling for tables wider than their container.

**Features:**

- Custom scrollbar styling (thin, glassmorphic)
- Smooth touch scrolling on iOS
- Table content auto-sizes to fit (`min-width: max-content`)

**⚠️ IMPORTANT - Tooltip Behavior in Scroll Containers:**

When using `.table-responsive`, elements with `position: absolute` (like tooltips) will be clipped.

**Solutions:**

1. **Native `title` attribute (Recommended for action buttons):**

   ```html
   <button class="action-icon action-icon--edit" title="Bearbeiten">
     <i class="fas fa-edit"></i>
   </button>
   ```

   Native browser tooltips are NOT clipped because they're rendered by the OS.

2. **Fixed positioning (For custom tooltips):**

   ```html
   <div class="tooltip tooltip--fixed">
     <button class="tooltip__trigger">Info</button>
     <div class="tooltip__content">Tooltip text</div>
   </div>
   ```

   Requires JavaScript to calculate `--tooltip-top` and `--tooltip-left` CSS properties.

**Use cases:**

- Logs table (System-Logs)
- User management (Employees, Admins, Root Users)
- Departments, Teams, Areas
- Shifts, Machines
- KVP suggestions
- Documents
- Any tabular data display

---

### 2. Empty States

Display when no data is available

**Usage:**

```html
<div class="empty-state">
  <div class="empty-state__icon">👥</div>
  <div class="empty-state__title">Keine Mitarbeiter gefunden</div>
  <div class="empty-state__description">Fügen Sie Ihren ersten Mitarbeiter hinzu</div>
  <button class="btn btn-primary empty-state__action">Mitarbeiter hinzufügen</button>
</div>
```

**With FontAwesome Icon:**

```html
<div class="empty-state">
  <div class="empty-state__icon">
    <i class="fas fa-inbox"></i>
  </div>
  <div class="empty-state__title">No search results</div>
  <div class="empty-state__description">Try adjusting your filters</div>
</div>
```

**With Custom Illustration:**

```html
<div class="empty-state">
  <img src="/illustrations/no-data.svg" class="empty-state__illustration" alt="" />
  <div class="empty-state__title">No data yet</div>
  <div class="empty-state__description">Start by creating your first entry</div>
</div>
```

**Classes:**

- `.empty-state` - Container
- `.empty-state__icon` - Icon/emoji circle
- `.empty-state__illustration` - Custom SVG/image
- `.empty-state__title` - Main heading
- `.empty-state__description` - Subtitle
- `.empty-state__action` - CTA button
- `.empty-state--sm` - Compact variant
- `.empty-state--lg` - Large variant (full-page)

**Use cases:**

- Empty tables (no employees, no logs, etc.)
- No search results
- Empty inbox
- No notifications
- First-time user onboarding

---

### 3. Data Lists

Key-value pair displays for detail views

**Usage:**

```html
<dl class="data-list">
  <div class="data-list__item">
    <dt class="data-list__label">Email</dt>
    <dd class="data-list__value">max.mustermann@example.com</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Telefon</dt>
    <dd class="data-list__value">+49 123 456789</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Rolle</dt>
    <dd class="data-list__value">
      <span class="badge badge--role-admin">Administrator</span>
    </dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Abteilung</dt>
    <dd class="data-list__value data-list__value--empty"></dd>
  </div>
</dl>
```

**Stacked Layout (label above value):**

```html
<dl class="data-list data-list--stacked">
  <div class="data-list__item">
    <dt class="data-list__label">Email</dt>
    <dd class="data-list__value">max@example.com</dd>
  </div>
</dl>
```

**Grid Layout (2 columns):**

```html
<dl class="data-list data-list--grid">
  <div class="data-list__item">
    <dt class="data-list__label">Vorname</dt>
    <dd class="data-list__value">Max</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Nachname</dt>
    <dd class="data-list__value">Mustermann</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Position</dt>
    <dd class="data-list__value">Entwickler</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Team</dt>
    <dd class="data-list__value">Frontend</dd>
  </div>
</dl>
```

**Classes:**

- `.data-list` - Container
- `.data-list__item` - Single key-value pair
- `.data-list__label` - Key (dt element)
- `.data-list__value` - Value (dd element)
- `.data-list__value--empty` - Empty value placeholder (shows "—")
- `.data-list--horizontal` - Horizontal flow (flex-wrap)
- `.data-list--stacked` - Label above value
- `.data-list--compact` - Smaller spacing
- `.data-list--borderless` - Remove borders
- `.data-list--grid` - 2-column grid layout

**Use cases:**

- User profile details
- Department information
- Machine specifications
- KVP suggestion details
- Settings panels
- Order/invoice details

---

## 🎨 Design Tokens Used

### Colors

- `--color-text-primary` - Main text
- `--color-text-secondary` - Labels, muted text
- `--color-primary` - Hover states
- `--glass-border` - Borders, dividers

### Spacing

- `--spacing-1` to `--spacing-10` - Consistent spacing scale

### Border Radius

- `--radius-lg` - Table borders
- `--radius-xl` - Empty state icons

### Transitions

- `0.2s ease` - Hover effects

---

## 🎯 Migration from Bootstrap

### Before (Bootstrap):

```html
<table class="table-striped table-hover table-sm table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Max</td>
      <td>max@example.com</td>
    </tr>
  </tbody>
</table>
```

### After (Design System):

```html
<table class="data-table data-table--striped data-table--hover data-table--sm">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Max</td>
      <td>max@example.com</td>
    </tr>
  </tbody>
</table>
```

### Class Mapping:

| Bootstrap           | Design System             |
| ------------------- | ------------------------- |
| `.table`            | `.data-table`             |
| `.table-striped`    | `.data-table--striped`    |
| `.table-hover`      | `.data-table--hover`      |
| `.table-sm`         | `.data-table--sm`         |
| `.table-bordered`   | `.data-table--bordered`   |
| `.table-borderless` | `.data-table--borderless` |
| `.table-responsive` | `.table-responsive`       |

---

## ♿ Accessibility

### Tables

- **Semantic HTML**: Use `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`
- **Scope attribute**: Add `scope="col"` to `<th>` for screen readers
- **Caption**: Consider adding `<caption>` for table description
- **Sortable headers**: Add `aria-sort` when implementing sorting

```html
<table class="data-table">
  <caption class="sr-only">
    List of employees
  </caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Email</th>
      <th scope="col">Role</th>
    </tr>
  </thead>
  <tbody>
    ...
  </tbody>
</table>
```

### Empty States

- Use semantic headings
- Provide alt text for illustrations
- Ensure color contrast on text

### Data Lists

- Use semantic `<dl>`, `<dt>`, `<dd>` elements
- Screen readers announce as "definition list"

---

## 📱 Responsive Behavior

### Tables

- Font size: 14px → 13px on mobile
- Padding: reduced on mobile
- Horizontal scroll via `.table-responsive`

### Empty States

- Icon size: 80px → 60px on mobile
- Font sizes reduced proportionally

### Data Lists

- Grid layout: 2 columns → 1 column on mobile
- Side-by-side layout → stacked on mobile

---

## 🔄 React Migration

### Table Component

```tsx
interface DataTableProps {
  columns: { key: string; label: string }[];
  data: Record<string, any>[];
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  bordered?: boolean;
}

export function DataTable({ columns, data, striped, hover, compact, bordered }: DataTableProps) {
  const className = cn(
    'data-table',
    striped && 'data-table--striped',
    hover && 'data-table--hover',
    compact && 'data-table--sm',
    bordered && 'data-table--bordered',
  );

  return (
    <table className={className}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key}>{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Empty State Component

```tsx
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({ icon, title, description, action, size = 'md' }: EmptyStateProps) {
  const className = cn(
    'empty-state',
    size === 'sm' && 'empty-state--sm',
    size === 'lg' && 'empty-state--lg',
  );

  return (
    <div className={className}>
      <div className="empty-state__icon">{icon}</div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__description">{description}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
```

### Data List Component

```tsx
interface DataListProps {
  items: { label: string; value: ReactNode }[];
  layout?: 'default' | 'stacked' | 'grid' | 'compact';
  borderless?: boolean;
}

export function DataList({ items, layout = 'default', borderless }: DataListProps) {
  const className = cn(
    'data-list',
    layout !== 'default' && `data-list--${layout}`,
    borderless && 'data-list--borderless',
  );

  return (
    <dl className={className}>
      {items.map((item, i) => (
        <div key={i} className="data-list__item">
          <dt className="data-list__label">{item.label}</dt>
          <dd className="data-list__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

---

## 📚 Examples

### Complete Employee Table

```html
<div class="table-responsive">
  <table class="data-table data-table--striped data-table--hover">
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col">E-Mail</th>
        <th scope="col">Position</th>
        <th scope="col">Abteilung</th>
        <th scope="col">Status</th>
        <th scope="col">Aktionen</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Max Mustermann</td>
        <td>max@example.com</td>
        <td>Entwickler</td>
        <td>IT</td>
        <td><span class="badge badge--success">Aktiv</span></td>
        <td>
          <button class="btn btn-sm btn-cancel">Bearbeiten</button>
          <button class="btn btn-sm btn-danger">Löschen</button>
        </td>
      </tr>
      <tr>
        <td>Anna Schmidt</td>
        <td>anna@example.com</td>
        <td>Managerin</td>
        <td>HR</td>
        <td><span class="badge badge--warning">Urlaub</span></td>
        <td>
          <button class="btn btn-sm btn-cancel">Bearbeiten</button>
          <button class="btn btn-sm btn-danger">Löschen</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Empty State with Action

```html
<div class="empty-state">
  <div class="empty-state__icon">
    <i class="fas fa-users"></i>
  </div>
  <div class="empty-state__title">Keine Mitarbeiter gefunden</div>
  <div class="empty-state__description">
    Fügen Sie Ihren ersten Mitarbeiter hinzu, um loszulegen
  </div>
  <button class="btn btn-primary empty-state__action">
    <i class="fas fa-plus"></i>
    Mitarbeiter hinzufügen
  </button>
</div>
```

### User Profile Data List

```html
<dl class="data-list data-list--grid">
  <div class="data-list__item">
    <dt class="data-list__label">Vorname</dt>
    <dd class="data-list__value">Max</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Nachname</dt>
    <dd class="data-list__value">Mustermann</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Email</dt>
    <dd class="data-list__value">max.mustermann@assixx.de</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Telefon</dt>
    <dd class="data-list__value">+49 123 456789</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Position</dt>
    <dd class="data-list__value">Senior Entwickler</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Abteilung</dt>
    <dd class="data-list__value">IT Development</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Team</dt>
    <dd class="data-list__value">Frontend Team</dd>
  </div>
  <div class="data-list__item">
    <dt class="data-list__label">Rolle</dt>
    <dd class="data-list__value">
      <span class="badge badge--role-admin">Administrator</span>
    </dd>
  </div>
</dl>
```

---

## 🎯 Decision Tree

**When to use Tables:**

- Displaying multiple records with consistent fields
- Sortable/filterable datasets
- Comparing data across rows
- Data exports (CSV, Excel)

**When to use Empty States:**

- No search results
- Empty tables/lists
- First-time user experience
- Deleted/archived content

**When to use Data Lists:**

- Single record details (user profile, invoice, etc.)
- Settings panels
- Key-value pairs
- Non-tabular structured data

**When NOT to use Tables:**

- Small datasets (<3 items) → Use data lists or cards
- Narrative content → Use regular text
- Complex nested data → Use trees or nested lists

---

**Maintained by:** Assixx Design System Team
**Last Updated:** 2025-11-26
**Version:** 1.1.0
