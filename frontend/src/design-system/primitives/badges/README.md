# Badge Component

Status indicators, labels, and tags for UI feedback and categorization.

## Structure

```html
<span class="badge [badge--variant] [badge--size] [badge--modifier]">Label</span>
```

## Usage

### Status Badges

```html
<span class="badge badge--success">Success</span>
<span class="badge badge--warning">Warning</span>
<span class="badge badge--danger">Error</span>
<span class="badge badge--info">Info</span>
<span class="badge badge--primary">Primary</span>
<span class="badge badge--secondary">Secondary</span>
<span class="badge badge--dark">Dark</span>
```

### Action Badges (Logs)

```html
<span class="badge badge--login">Login</span>
<span class="badge badge--create">Created</span>
<span class="badge badge--update">Updated</span>
<span class="badge badge--delete">Deleted</span>
<span class="badge badge--logout">Logout</span>
<span class="badge badge--share">Shared</span>
<span class="badge badge--upload">Uploaded</span>
<span class="badge badge--download">Downloaded</span>
```

### Role Badges

```html
<span class="badge badge--sm badge--role-root">Root</span>
<span class="badge badge--sm badge--role-admin">Admin</span>
<span class="badge badge--sm badge--role-employee">Employee</span>
<span class="badge badge--sm badge--role-manager">Manager</span>
<span class="badge badge--sm badge--role-guest">Guest</span>
```

## Size Modifiers

| Modifier     | Padding  | Border Radius | Font Size | Use Case              |
| ------------ | -------- | ------------- | --------- | --------------------- |
| `.badge--sm` | 2px 8px  | 8px           | 11px      | Roles, compact labels |
| Default      | 4px 12px | 12px          | 12px      | Standard badges       |
| `.badge--lg` | 6px 16px | 14px          | 13px      | Prominent indicators  |

## Modifiers

### With Dot Indicator

```html
<span class="badge badge--dot badge--success">Online</span> <span class="badge badge--dot badge--danger">Offline</span>
```

### Uppercase

```html
<span class="badge badge--uppercase badge--primary">NEW</span>
<span class="badge badge--uppercase badge--warning">BETA</span>
```

## Variant Overview

### Status Variants

| Variant             | Color            | Use Case                  |
| ------------------- | ---------------- | ------------------------- |
| `.badge--success`   | Green (#4caf50)  | Success states, completed |
| `.badge--warning`   | Orange (#ff9800) | Warnings, pending         |
| `.badge--danger`    | Red (#f44336)    | Errors, failed            |
| `.badge--info`      | Cyan (#17a2b8)   | Information, notices      |
| `.badge--primary`   | Blue (#2196f3)   | Primary actions           |
| `.badge--secondary` | Gray (#9e9e9e)   | Secondary, neutral        |
| `.badge--dark`      | Dark (#343a40)   | Dark themes               |

### Action Variants

| Variant               | Color            | Use Case         |
| --------------------- | ---------------- | ---------------- |
| `.badge--login`       | Blue             | Login actions    |
| `.badge--create`      | Green            | Create actions   |
| `.badge--update`      | Orange           | Update actions   |
| `.badge--delete`      | Red              | Delete actions   |
| `.badge--logout`      | Gray             | Logout actions   |
| `.badge--role-switch` | Purple (#673ab7) | Role changes     |
| `.badge--share`       | Cyan (#00bcd4)   | Share actions    |
| `.badge--comment`     | Yellow (#ffc107) | Comments         |
| `.badge--upload`      | Teal (#009688)   | Upload actions   |
| `.badge--download`    | Indigo (#3f51b5) | Download actions |

### Role Variants

| Variant                 | Color                 | Use Case    |
| ----------------------- | --------------------- | ----------- |
| `.badge--role-root`     | Purple (#9c27b0)      | Root users  |
| `.badge--role-admin`    | Light Blue (#03a9f4)  | Admins      |
| `.badge--role-employee` | Blue Gray (#607d8b)   | Employees   |
| `.badge--role-manager`  | Deep Orange (#ff5722) | Managers    |
| `.badge--role-guest`    | Gray (#9e9e9e)        | Guest users |

## Token Usage

**Spacing:**

- Small: `2px 8px`
- Default: `4px 12px`
- Large: `6px 16px`

**Border Radius:**

- Small: `8px`
- Default: `12px`
- Large: `14px`

**Colors:**

- Border: `color / 30%` opacity
- Background: `color / 15%` opacity
- Text: Base color

**Hover:**

- Border: `color / 40%` opacity
- Background: `color / 20%` opacity

## Responsive

Badges are intrinsically responsive and scale with font-size.

**Mobile Considerations:**

- Use `.badge--sm` for compact mobile layouts
- Avoid very long badge text on mobile
- Consider truncating text with ellipsis

## Accessibility

**Semantic HTML:**

```html
<!-- Good: Using appropriate semantic element -->
<span class="badge badge--success" role="status" aria-label="Status: Success"> Success </span>

<!-- Good: With screen reader text -->
<span class="badge badge--danger">
  <span class="sr-only">Error:</span>
  Failed
</span>
```

**Color Independence:**

- Never rely solely on color to convey meaning
- Use text labels or icons
- Consider dot indicator for status

## When to Use

**Use `.badge` for:**

- ✅ Status indicators (online/offline, active/inactive)
- ✅ Action labels (created, updated, deleted)
- ✅ Role/permission labels
- ✅ Counts and notifications
- ✅ Tags and categories

**Avoid `.badge` for:**

- ❌ Buttons (use `.btn` instead)
- ❌ Large blocks of text
- ❌ Interactive elements (badges are passive)

## Examples

### In Table Cells (Logs)

```html
<table class="logs-table">
  <tr>
    <td>John Doe</td>
    <td><span class="badge badge--sm badge--role-admin">Admin</span></td>
    <td><span class="badge badge--login">Login</span></td>
    <td><span class="badge badge--success">Success</span></td>
  </tr>
</table>
```

### Status Indicator with Dot

```html
<div class="user-status">
  <span class="badge badge--dot badge--success">Online</span>
</div>
```

### Combined Modifiers

```html
<span class="badge badge--sm badge--uppercase badge--primary">new</span>
<span class="badge badge--lg badge--dot badge--success">Available</span>
```

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-badges--docs
```

## Migration from Legacy

**Old (logs.css):**

```html
<span class="action-label action-login">Login</span> <span class="role-badge role-admin">Admin</span>
```

**New (Design System):**

```html
<span class="badge badge--login">Login</span> <span class="badge badge--sm badge--role-admin">Admin</span>
```

**Changes:**

- `action-label` → `badge`
- `action-login` → `badge--login`
- `role-badge` → `badge badge--sm`
- `role-admin` → `badge--role-admin`

## Future Enhancements

- [ ] Closable badges (with X button)
- [ ] Outlined variant (border only, no background)
- [ ] Notification badges (number badges)
- [ ] Gradient badges
