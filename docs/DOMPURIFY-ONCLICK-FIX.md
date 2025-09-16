# DOMPurify onclick Handler Problem & Solution

## 🔴 Problem Description

### The Issue

When using `DOMPurify.sanitize()` to protect against XSS attacks, ALL inline event handlers (onclick, onchange, etc.) are automatically removed for security reasons.

### Example of the Problem

```javascript
// This code DOESN'T WORK:
element.innerHTML = DOMPurify.sanitize(`
  <button onclick="startSurvey(123)">Teilnehmen</button>
`);
// Result: <button>Teilnehmen</button> (onclick is REMOVED!)
```

### Impact in Assixx Project

- **328 onclick usages** across 38 HTML files
- **52 DOMPurify.sanitize() calls** that potentially break functionality
- **Critical Bug:** Survey "Teilnehmen" buttons don't work in survey-employee.html

## ⚠️ IMPORTANT: Why survey-admin.ts works but survey-employee.html doesn't

### The Critical Difference

There are TWO ways to use DOMPurify in this project, with DIFFERENT behaviors:

#### Method 1: Using dom-utils.ts setHTML() - ALLOWS onclick! ✅

```typescript
// survey-admin.ts uses:
import { setHTML } from '../utils/dom-utils';
setHTML(element, htmlWithOnclick); // onclick WORKS!

// Why? dom-utils.ts has CUSTOM CONFIG:
ALLOWED_ATTR: [
  'onclick',  // ← onclick is EXPLICITLY ALLOWED!
  'onchange', // ← other handlers could be added here
  ...
]
```

#### Method 2: Direct DOMPurify.sanitize() - REMOVES onclick! ❌

```javascript
// survey-employee.html uses:
element.innerHTML = DOMPurify.sanitize(htmlWithOnclick);
// NO config = DEFAULT behavior = onclick REMOVED!
```

### Summary Table

| Aspect | survey-admin (WORKS) | survey-employee (BROKEN) |
|--------|---------------------|-------------------------|
| Method | `setHTML()` from dom-utils | Direct `DOMPurify.sanitize()` |
| Config | Custom config WITH onclick | No config (default) |
| Result | ✅ onclick preserved | ❌ onclick removed |

### Quick Fix Options

1. **Use setHTML() instead of DOMPurify.sanitize()** (if you REALLY need onclick)
2. **Use Event Delegation** (RECOMMENDED - see below)
3. **Add custom config to DOMPurify** (NOT recommended - security risk)

## ✅ Best Practice Solution

### Principle

**NEVER use inline JavaScript in HTML!** Use Event Delegation or addEventListener after rendering.

### Solution Pattern 1: Event Delegation (Recommended)

```javascript
// 1. Add data attributes instead of onclick
const html = `
  <button class="survey-action" data-survey-id="${survey.id}">
    Teilnehmen
  </button>
`;

// 2. Safely render with DOMPurify
container.innerHTML = DOMPurify.sanitize(html);

// 3. Set up Event Delegation ONCE (not for each button)
container.addEventListener('click', (e) => {
  const button = e.target.closest('.survey-action');
  if (button) {
    const surveyId = button.dataset.surveyId;
    startSurvey(surveyId);
  }
});
```

### Solution Pattern 2: addEventListener After Rendering

```javascript
function createSurveyCard(survey, completed) {
  const card = document.createElement('div');
  card.className = 'survey-card';

  // Render HTML without onclick
  card.innerHTML = DOMPurify.sanitize(htmlContent);

  // Add event listener AFTER sanitization
  const button = card.querySelector('.survey-action');
  button.addEventListener('click', () => startSurvey(survey.id));

  return card;
}
```

## 📋 Migration Checklist

### Files That Need Fixing (High Priority)

- [x] survey-employee.html - "Teilnehmen" button broken
- [x] survey-admin.html - Similar survey management
- [x] admin-dashboard.html - 31 onclick handlers
- [x] document-upload.html - 24 onclick handlers
- [x] signup.html - 20 onclick handlers

### Files Using Best Practice (Reference)

- ✅ blackboard.ts - Uses addEventListener correctly
- ✅ documents.ts - Uses event delegation
- ✅ unified-navigation.ts - No inline handlers

## 🛠️ Implementation Guide

### Step 1: Identify Pattern

Check if the page:

1. Uses `DOMPurify.sanitize()`
2. Has `onclick` in the HTML string
3. → If both YES, needs fixing!

### Step 2: Choose Solution

- **Dynamic Lists** (multiple items) → Use Event Delegation
- **Single Elements** → Use addEventListener
- **Static HTML** → Move to TypeScript module

### Step 3: Implementation

1. Remove `onclick` from HTML string
2. Add `data-*` attributes for parameters
3. Add event listener after DOMPurify
4. Test functionality

## 🚀 Concrete Fix for survey-employee.html

### Before (BROKEN)

```javascript
// Line 966-992
card.innerHTML = DOMPurify.sanitize(`
  <button onclick="startSurvey(${survey.id})">Teilnehmen</button>
`);
```

### After (WORKING)

```javascript
// Replace createSurveyCard function (line 950)
function createSurveyCard(survey, completed) {
  const card = document.createElement('div');
  card.className = completed ? 'survey-card completed' : 'survey-card';

  // Set data attribute for survey ID
  card.dataset.surveyId = survey.id;

  // ... rest of HTML without onclick ...

  card.innerHTML = DOMPurify.sanitize(htmlContent);

  // Add click handler AFTER sanitization
  const button = card.querySelector('.survey-action');
  if (button) {
    if (completed) {
      button.addEventListener('click', () => window.viewResponse(survey.id));
    } else {
      button.addEventListener('click', () => window.startSurvey(survey.id));
    }
  }

  return card;
}
```

### Alternative: Event Delegation (Even Better)

```javascript
// Add once in DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
  loadSurveys();

  // Single event handler for ALL survey buttons
  document.body.addEventListener('click', (e) => {
    const button = e.target.closest('.survey-action');
    if (!button) return;

    const card = button.closest('.survey-card');
    const surveyId = card.dataset.surveyId;

    if (card.classList.contains('completed')) {
      window.viewResponse(surveyId);
    } else {
      window.startSurvey(surveyId);
    }
  });
});
```

## 📚 References

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Event Delegation MDN](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#event_delegation)
- Project Standards: `/docs/TYPESCRIPT-STANDARDS.md`
- DOMPurify Implementation: `/docs/DOMPURIFY-IMPLEMENTATION.md`

## ⚠️ Important Notes

1. **Security:** DOMPurify removing onclick is a FEATURE, not a bug!
2. **Performance:** Event delegation is better for lists (one listener vs many)
3. **Maintenance:** Separate JS from HTML makes code easier to debug
4. **TypeScript:** Event listeners in TS files get type checking

## 🎯 Summary

**Problem:** DOMPurify removes onclick handlers → buttons don't work
**Root Cause:** Direct `DOMPurify.sanitize()` uses DEFAULT config (removes onclick)
**Why survey-admin works:** Uses `setHTML()` from dom-utils with CUSTOM config (allows onclick)
**Solution:** Use event delegation or addEventListener after sanitization
**Best Practice:** NEVER put JavaScript in HTML strings!

## 🔧 Decision Tree for Future Issues

```
Having onclick problems with DOMPurify?
├── Are you using setHTML() from dom-utils?
│   └── YES → onclick should work (custom config allows it)
├── Are you using DOMPurify.sanitize() directly?
│   └── YES → onclick will be REMOVED (default behavior)
│       └── Solution: Use Event Delegation instead
└── Best Practice: Always use Event Delegation anyway!
```
