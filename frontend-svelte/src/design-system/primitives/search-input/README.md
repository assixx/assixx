# Search Input Component

Enhanced search input with leading icon, trailing clear button, and loading state. Works with or without JavaScript.

## Quick Start

```html
<!-- Basic Search -->
<div class="search-input">
  <i class="search-input__icon fas fa-search"></i>
  <input type="search" class="search-input__field" placeholder="Search..." />
  <button class="search-input__clear" type="button" aria-label="Clear search">
    <i class="fas fa-times"></i>
  </button>
  <div class="search-input__spinner"></div>
</div>
```

## JavaScript (Optional)

```javascript
import { initSearchInput } from './search-input.js';

const search = initSearchInput(document.querySelector('.search-input'), {
  onSearch: (value) => console.log('Search:', value),
  onClear: () => console.log('Cleared'),
  debounce: 300,
});

// API
search.setValue('new value');
search.setLoading(true);
search.clear();
```

## Sizes

- `search-input--sm` - 36px height
- Default - 44px height
- `search-input--lg` - 52px height

## States

- `search-input--has-value` - Shows clear button (auto via JS)
- `search-input--loading` - Shows spinner
- `search-input--error` - Error state (red)
- `search-input--success` - Success state (green)
- `search-input--disabled` - Disabled state

## Features

- **Clear Button** - Auto-shows when input has value
- **Loading Spinner** - For async searches
- **Debounce** - Reduces API calls (300ms default)
- **Min Length** - Only search after N characters
- **Progressive Enhancement** - Works without JS

## With Results Dropdown

```html
<div class="search-input-wrapper">
  <div class="search-input">
    <!-- ... search input ... -->
  </div>

  <div class="search-input__results">
    <div class="search-input__result-item">Result 1</div>
    <div class="search-input__result-item">Result 2</div>
  </div>
</div>
```

Add `search-input-wrapper--open` to show results.

## Use Cases

- **Global Search** - Search everything
- **User Filter** - Filter lists/tables
- **Document Search** - Find files
- **Settings Search** - Quick navigation

## Accessibility

✅ Native search input (keyboard support)
✅ Clear button with aria-label
✅ Focus visible states
✅ Screen reader friendly
✅ Keyboard navigation

## Browser Support

All modern browsers. Graceful degradation without JavaScript.
