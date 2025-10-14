# Migration Quick Reference

Branch: lint/refactoring
Goal: Bootstrap OUT, Tailwind + Design System IN, TypeScript Modules

## Per Page Checklist

### Step 1: HTML

- [ ] Replace Bootstrap components with Design System
- [ ] Remove Bootstrap classes (.btn, .form-control, .modal, etc.)
- [ ] Use Design System classes (.btn-primary, .form-field__control, .modal, etc.)

### Step 2: CSS

- [ ] Remove inline styles
- [ ] Use Design System utilities or Tailwind classes
- [ ] Check Storybook (:6006) for component examples

### Step 3: TypeScript

- [ ] Extract inline `<script>` to TypeScript module(s)
- [ ] Create .ts files in appropriate scripts/ subdirectory
- [ ] Import module in HTML: `<script type="module">`
- [ ] Add proper types (no any, strict mode)
- [ ] Compile: `docker exec assixx-backend pnpm run type-check`

### Testing

- [ ] Visual check (looks correct?)
- [ ] Functionality check (works correctly?)
- [ ] Console check (no errors?)
- [ ] Type check passes
- [ ] Test on mobile/tablet

### Git Commit

```bash
git add frontend/src/pages/[filename].html
git add frontend/src/scripts/[module].ts
git commit -m "Migrate [filename] to Design System + TypeScript"
```

## Bootstrap Stays Active Until All Pages Done

Phase 9: Delete Bootstrap CSS/JS + Compat layer (768 lines)
