# Modal Reset Pattern - Svelte 5 Best Practice

## Problem

Modal state (dropdowns, password visibility, scroll position) persists between open/close cycles.

## Root Cause

Using `class:modal-overlay--active={show}` only toggles CSS visibility.
Component stays alive → state persists.

## Solution: Conditional Rendering

```svelte
<!-- BAD: State persists -->
<div class="modal-overlay" class:modal-overlay--active={show}>...</div>

<!-- GOOD: State auto-resets -->
{#if show}
  <div class="modal-overlay modal-overlay--active">...</div>
{/if}
```

## Why It Works

| Pattern               | Component Lifecycle | State      |
| --------------------- | ------------------- | ---------- |
| `class:active={show}` | Stays mounted       | Persists   |
| `{#if show}`          | Destroyed/Created   | Auto-reset |

When `{#if show}` toggles:

- `show = false` → Component **destroyed**, all `$state` gone
- `show = true` → Component **created fresh**, all `$state` initialized

## Benefits

- No manual `$effect` reset logic needed
- No `resetForm()` functions required
- Scroll position auto-resets (new DOM element)
- KISS principle - framework handles it

## Checklist

- [ ] Modal wrapped with `{#if show}` or `{#if state.showModal}`
- [ ] `class:modal-overlay--active={show}` replaced with `class="modal-overlay modal-overlay--active"`
- [ ] Remove unnecessary `$effect` that resets state on `!show`

---

_Last updated: 2025-01-03_
