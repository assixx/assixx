# How to Handle CodeQL False Positives

## Problem
CodeQL sometimes reports false positives, especially for:
- `js/missing-rate-limiting` - Doesn't recognize middleware patterns
- `js/missing-token-validation` - Doesn't recognize JWT auth patterns (199+ false positives!)
- `js/sql-injection` - Doesn't understand parameterized queries
- `js/xss` - Doesn't recognize custom sanitization functions

## Solutions

### 1. Inline Suppression (For Individual Cases)
```javascript
// codeql[js/missing-rate-limiting] - Explanation why it's safe
router.get('/api/endpoint', rateLimiter.public, handler);
```

**IMPORTANT:** 
- Suppressions only work AFTER merging to master (not in PRs)!
- Use `codeql[rule-id]` format (NOT `lgtm` or `codeql-ignore`)

### 2. Global Exclusion (For Systemic False Positives)
Edit `.github/codeql-config.yml`:
```yaml
query-filters:
  - exclude:
      id: js/missing-token-validation
      # Reason: We use JWT everywhere
```

### 3. Workflow Configuration
The workflow in `.github/workflows/codeql-analysis.yml` uses the config:
```yaml
- name: Initialize CodeQL
  uses: github/codeql-action/init@v3
  with:
    config-file: ./.github/codeql-config.yml
```

## Current Status
- ✅ `js/missing-token-validation` - Globally excluded (199 false positives!)
- ✅ `js/missing-rate-limiting` - Globally excluded (systemic issue)
- ✅ `js/xss` - Globally excluded (custom sanitization not recognized)
- ✅ Individual suppressions added where needed

## CodeQL Limits Warning
"Locations for an alert exceeded limits" - This happens when CodeQL finds more than 100 instances of an issue. Only the first 100 are shown.

## Notes
- CodeQL limit: Max 100 locations per alert type
- Suppressions don't work in PRs (security feature by design)
- Use `codeql[rule-id]` format for inline suppressions
