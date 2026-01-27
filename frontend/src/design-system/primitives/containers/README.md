# Container Component

Glassmorphism page wrapper für Hauptsektionen.

## Was ist ein Container?

**Container** = Glassmorphism-Box für **ganze Page-Bereiche**
**Card** = Content-Gruppierung **innerhalb** von Containern

### Unterschied Container vs Card

| Aspect       | Container                 | Card                         |
| ------------ | ------------------------- | ---------------------------- |
| **Größe**    | Größer (max-width 1200px) | Kleiner (Teil des Layouts)   |
| **Purpose**  | Ganze Seite/Hauptbereich  | Content-Gruppierung          |
| **Padding**  | 28px 40px (mehr Platz)    | 24px                         |
| **Use Case** | Login Box, Settings Page  | Dashboard Widget, Info Block |

## Usage

### Basic Container

```html
<div class="page-container page-container--centered">
  <h1>Settings</h1>
  <div class="card">
    <!-- Cards INSIDE Container -->
  </div>
</div>
```

### Login/Signup Box

```html
<div class="page-container page-container--narrow page-container--centered">
  <h1>Login</h1>
  <form>
    <!-- Form fields -->
  </form>
</div>
```

## Modifiers

| Modifier                      | Description                       |
| ----------------------------- | --------------------------------- |
| `.page-container--centered`   | Center horizontally (most common) |
| `.page-container--wide`       | Max-width 1600px                  |
| `.page-container--narrow`     | Max-width 800px (forms)           |
| `.page-container--compact`    | Reduced padding (24px)            |
| `.page-container--borderless` | No border                         |

## Token Usage

**Spacing:**

- Default padding: `28px 40px`
- Compact: `--spacing-6` (24px)
- Mobile: `--spacing-6` → `--spacing-4` (24px → 16px)

**Borders & Radius:**

- `--radius-xl` (12px) desktop
- `--radius-lg` (8px) mobile

**Glass Effect:**

- Background: `rgba(255, 255, 255, 0.02)`
- Backdrop: `blur(20px) saturate(180%)`
- Shadow: `--shadow-sm`

## Responsive

**Desktop:**

- Padding: 28px 40px
- Border-radius: 12px

**Tablet (≤768px):**

- Padding: 24px
- Border-radius: 8px

**Mobile (≤480px):**

- Padding: 16px

## Examples

### Settings Page

```html
<div class="page-container page-container--centered">
  <h1>Account Settings</h1>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Profile</h2>
    </div>
    <div class="card__body">
      <!-- Form fields -->
    </div>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Security</h2>
    </div>
    <div class="card__body">
      <!-- Security settings -->
    </div>
  </div>
</div>
```

### Signup Form (Narrow)

```html
<div class="page-container page-container--narrow page-container--centered">
  <h1>Create Account</h1>
  <p>Sign up for Assixx</p>

  <form>
    <div class="form-field">
      <label class="form-field__label" for="email">Email</label>
      <input type="email" class="form-field__control" id="email" />
    </div>
    <!-- More fields -->
    <button class="btn btn-primary btn-block">Sign Up</button>
  </form>
</div>
```

### Dashboard (Wide)

```html
<div class="page-container page-container--wide page-container--centered">
  <h1>Dashboard</h1>

  <!-- Stats/Cards inside container -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;">
    <div class="card-stat">...</div>
    <div class="card-stat">...</div>
    <div class="card-stat">...</div>
    <div class="card-stat">...</div>
  </div>
</div>
```

## Storybook

View interactive examples:

```
http://localhost:6006/?path=/docs/design-system-containers--docs
```

## Migration from Legacy

**Old (signup.html):**

```html
<div class="signup-container">...</div>
```

**New (Design System):**

```html
<div class="page-container page-container--narrow page-container--centered">
  ...
</div>
```

**Changes:**

- `signup-container` → `page-container page-container--narrow page-container--centered`
- Gleiche Glassmorphism styles
- BEM naming pattern
- Token-basiert

## When to Use

**Use `.page-container` when:**

- ✅ Login/Signup boxes
- ✅ Settings pages
- ✅ Wizard steps
- ✅ Modal content (full-page)
- ✅ Form containers

**Use `.card` when:**

- ✅ Dashboard widgets
- ✅ Info blocks
- ✅ List items (gruppiert)
- ✅ Content sections INSIDE containers

## Future Enhancements

- [ ] Split-container (left/right sections)
- [ ] Scrollable container variant
- [ ] Container with header/footer sections
