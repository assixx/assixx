# Avatar Component

WhatsApp-style user avatars with initials and glassmorphism. Works with or without JavaScript.

## Quick Start

```html
<!-- Initials Avatar -->
<div class="avatar avatar--color-4">
  <span class="avatar__initials">JD</span>
</div>

<!-- Image Avatar -->
<div class="avatar">
  <img src="user.jpg" alt="User Name" class="avatar__image" />
</div>

<!-- With Status -->
<div class="avatar avatar--color-2">
  <span class="avatar__initials">AB</span>
  <span class="avatar__status avatar__status--online"></span>
</div>
```

## JavaScript (Optional)

```javascript
import { getInitials, getColorClass, createAvatar } from './avatar.js';

const initials = getInitials('John Doe'); // "JD"
const color = getColorClass('john.doe'); // "avatar--color-4" (consistent)
const avatar = createAvatar('John Doe', 'john.doe', { size: 'lg', status: 'online' });
```

## Sizes

- `avatar--xs` - 24px
- `avatar--sm` - 32px
- Default - 40px
- `avatar--lg` - 56px
- `avatar--xl` - 80px

## Colors

10 distinct colors (`avatar--color-0` to `avatar--color-9`):

- Use JavaScript `getColorClass(username)` for consistent assignment
- Same username always gets same color

## Shapes

- Default - Circle
- `avatar--square` - Rounded square

## Status

- `avatar__status--online` - Green
- `avatar__status--offline` - Gray
- `avatar__status--busy` - Red
- `avatar__status--away` - Yellow

## Avatar Groups

Stack multiple avatars:

```html
<div class="avatar-group">
  <div class="avatar avatar--color-0">
    <span class="avatar__initials">JD</span>
  </div>
  <div class="avatar avatar--color-1">
    <span class="avatar__initials">AB</span>
  </div>
  <div class="avatar-group__count">+5</div>
</div>
```

## Use Cases

- **User Profiles** - Profile headers, settings
- **Comments** - Discussion threads
- **Chat/Messages** - Message lists
- **Navigation** - User menu dropdown
- **Team Lists** - Member directories

## Accessibility

✅ Alt text on images
✅ Screen reader support
✅ Focus visible states
✅ ARIA labels on status indicators

## Browser Support

All modern browsers. Works without JavaScript (static display).
