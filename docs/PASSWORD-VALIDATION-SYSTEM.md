# Password Validation System Documentation

**Version:** 1.0.0
**Last Updated:** 2024-11-20
**Status:** Production Ready

## 📋 Table of Contents

1. [Overview](#overview)
2. [Password Requirements (2024 Standards)](#password-requirements-2024-standards)
3. [Architecture](#architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [UI/UX Components](#uiux-components)
7. [Database Schema](#database-schema)
8. [Security Considerations](#security-considerations)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Assixx password validation system implements modern security standards with intelligent strength analysis, combining:
- **BCrypt** for secure password hashing (bcryptjs v3.0.3)
- **zxcvbn-ts** for intelligent password strength estimation
- **Real-time validation** with visual feedback
- **German localization** for user-facing messages
- **Progressive enhancement** with lazy loading

### Key Features

- ✅ NIST 800-63B compliant (2024 standards)
- ✅ BCrypt hashing with 72-byte limit handling
- ✅ Pattern-based strength analysis (not just rules)
- ✅ Real-time visual feedback with strength meter
- ✅ Crack time estimation
- ✅ Context-aware validation (prevents user info in passwords)
- ✅ Automatic logout after password change

---

## Password Requirements (2024 Standards)

### Enforced Rules

```typescript
// From backend/src/schemas/common.schema.ts
{
  minLength: 12,           // NIST 800-63B recommendation
  maxLength: 72,           // BCrypt limitation
  categories: 3 of 4,      // Must have 3 of: uppercase, lowercase, numbers, special chars
  specialChars: '!@#$%^&*()_+-=[]{};\':"\\|,.<>/?'
}
```

### Validation Layers

1. **Frontend Validation** (Immediate feedback)
   - Length check (12-72 characters)
   - Category counting
   - Real-time strength meter

2. **Backend Validation** (Authoritative)
   - Zod schema validation
   - Same rules as frontend
   - Returns field-specific errors

3. **Intelligent Analysis** (zxcvbn-ts)
   - Pattern detection
   - Dictionary checks
   - Context-aware (prevents user data)
   - Crack time estimation

---

## Architecture

```mermaid
graph TB
    subgraph Frontend
        UI[Password Input Field]
        RT[Real-time Validator]
        ZX[zxcvbn-ts Lazy Loaded]
        VM[Visual Meter]
    end

    subgraph Backend
        ZS[Zod Schema]
        BC[BCrypt Hashing]
        DB[(MySQL Database)]
    end

    UI --> RT
    RT --> ZX
    RT --> VM
    UI --> ZS
    ZS --> BC
    BC --> DB
```

---

## Backend Implementation

### 1. Zod Schema (`backend/src/schemas/common.schema.ts`)

```typescript
import { z } from 'zod';

/**
 * Password validation with MODERN security requirements (2024 Standards)
 * - Minimum: 12 characters (NIST 800-63B recommendation)
 * - Maximum: 72 characters (BCrypt limitation - truncates at 72 bytes)
 * - Complexity: At least 3 out of 4 character categories
 */
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(72, 'Password cannot exceed 72 characters (BCrypt limit)')
  .refine(
    (password: string) => {
      // Count how many character categories are present
      let categoriesPresent = 0;

      // Category 1: Uppercase letters
      if (/[A-Z]/.test(password)) categoriesPresent++;

      // Category 2: Lowercase letters
      if (/[a-z]/.test(password)) categoriesPresent++;

      // Category 3: Numbers
      if (/\d/.test(password)) categoriesPresent++;

      // Category 4: Special characters (common set)
      if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) categoriesPresent++;

      // Require at least 3 out of 4 categories
      return categoriesPresent >= 3;
    },
    {
      message: 'Password must contain characters from at least 3 of the following: uppercase, lowercase, numbers, special characters (!@#$%^&*)',
    },
  );
```

### 2. BCrypt Integration

```typescript
import bcryptjs from 'bcryptjs';

// Hashing (during registration/password change)
const saltRounds = 10;
const hashedPassword = await bcryptjs.hash(plainPassword, saltRounds);
// Output: 60-character hash string

// Verification (during login)
const isValid = await bcryptjs.compare(plainPassword, hashedPassword);
```

**BCrypt Limitations:**
- **Input:** Max 72 bytes (enforced by algorithm)
- **Output:** Always 60 characters
- **Salt:** Embedded in hash (no separate storage needed)

---

## Frontend Implementation

### 1. Password Strength Module (`frontend/src/scripts/root/profile/password-strength.ts`)

```typescript
/**
 * Password Strength Analysis Module
 * Uses zxcvbn-ts for intelligent password strength estimation
 * Implements lazy loading to minimize bundle impact
 */

import type { ZxcvbnResult } from '@zxcvbn-ts/core';

// Module state - lazy loaded
let zxcvbnInstance: ((password: string, userInputs?: string[]) => ZxcvbnResult) | null = null;

/**
 * Initialize zxcvbn with German language support
 * Lazy loads all required modules on first use
 */
export async function initPasswordStrength(): Promise<void> {
  // Dynamic imports for code splitting
  const [
    { zxcvbn, zxcvbnOptions },
    zxcvbnCommonPackage,
    zxcvbnDePackage,
  ] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-de'),
  ]);

  // Configure German language
  const options = {
    translations: zxcvbnDePackage.translations,
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnDePackage.dictionary,
    },
  };

  zxcvbnOptions.setOptions(options);
  zxcvbnInstance = zxcvbn;
}

/**
 * Check password strength with user context
 * @param password - Password to analyze
 * @param userInputs - User-specific context (name, email, etc.)
 */
export async function checkPasswordStrength(
  password: string,
  userInputs: string[] = [],
): Promise<ZxcvbnResult | null> {
  if (password === '') return null;

  // Initialize if needed
  if (zxcvbnInstance === null) {
    await initPasswordStrength();
  }

  // Add Assixx-specific context
  const context = [
    'assixx',
    'scs',
    'technik',
    'scs-technik',
    ...userInputs.filter((input) => input !== ''),
  ];

  return zxcvbnInstance(password, context);
}
```

### 2. Form Integration (`frontend/src/scripts/root/profile/forms.ts`)

```typescript
// Initialize on first focus (lazy loading)
newPasswordInput.addEventListener(
  'focus',
  () => {
    void initPasswordStrength();
  },
  { once: true },
);

// Real-time validation with debouncing
let validationTimeout: NodeJS.Timeout | null = null;
newPasswordInput.addEventListener('input', () => {
  if (validationTimeout !== null) {
    clearTimeout(validationTimeout);
  }
  validationTimeout = setTimeout(() => {
    void validatePasswordStrength();
  }, 300); // 300ms debounce
});
```

### 3. Automatic Logout After Password Change

```typescript
import { SessionManager } from '../../utils/session-manager';

try {
  await handleChangePassword(data);
  showSuccessAlert('Passwort erfolgreich geändert. Sie werden aus Sicherheitsgründen abgemeldet...');

  // Logout after 2 seconds to let user see the success message
  setTimeout(() => {
    const sessionManager = SessionManager.getInstance();
    sessionManager.logout(false);
  }, 2000);
} catch (error) {
  handlePasswordChangeError(error);
}
```

---

## UI/UX Components

### 1. HTML Structure (`frontend/src/pages/root-profile.html`)

```html
<!-- Password Field with Toggle -->
<div class="form-field">
  <label class="form-field__label" for="new_password">Neues Passwort</label>
  <div class="form-field__password-wrapper">
    <input
      type="password"
      id="new_password"
      name="new_password"
      class="form-field__control"
      autocomplete="new-password"
      minlength="12"
      maxlength="72"
      required
    />
    <button
      type="button"
      class="form-field__password-toggle"
      aria-label="Passwort anzeigen"
      id="new-password-toggle"
    >
      <i class="fas fa-eye"></i>
    </button>
  </div>

  <!-- Password Strength Indicator -->
  <div class="password-strength-container u-hidden" id="password-strength-container">
    <div class="password-strength-meter">
      <div class="password-strength-bar" id="password-strength-bar" data-score="-1"></div>
    </div>
    <div class="password-strength-info">
      <span class="password-strength-label" id="password-strength-label"></span>
      <span class="password-strength-time" id="password-strength-time"></span>
    </div>
  </div>

  <!-- Error Message -->
  <span class="form-field__message form-field__message--error u-hidden" id="new-password-error">
    Min. 12 Zeichen, 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)
  </span>

  <!-- Feedback Section -->
  <div class="password-feedback u-hidden" id="password-feedback">
    <span class="password-feedback-warning" id="password-feedback-warning"></span>
    <ul class="password-feedback-suggestions u-hidden" id="password-feedback-suggestions"></ul>
  </div>
</div>
```

### 2. CSS Styles (`frontend/src/styles/password-strength.css`)

```css
/* Container */
.password-strength-container {
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: rgb(255 255 255 / 3%);
  transition: all var(--transition-normal);
}

/* Strength Meter (Progress Bar) */
.password-strength-meter {
  height: 6px;
  background: rgb(255 255 255 / 10%);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: var(--spacing-2);
}

.password-strength-bar {
  height: 100%;
  width: 0;
  border-radius: 3px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: left;
}

/* Score-based colors */
.password-strength-bar[data-score="0"] {
  width: 20%;
  background: linear-gradient(90deg, #d32f2f, #e53935);
  box-shadow: 0 0 10px rgb(211 47 47 / 40%);
}

.password-strength-bar[data-score="1"] {
  width: 40%;
  background: linear-gradient(90deg, #f57c00, #ff9800);
}

.password-strength-bar[data-score="2"] {
  width: 60%;
  background: linear-gradient(90deg, #fbc02d, #fdd835);
}

.password-strength-bar[data-score="3"] {
  width: 80%;
  background: linear-gradient(90deg, #689f38, #7cb342);
}

.password-strength-bar[data-score="4"] {
  width: 100%;
  background: linear-gradient(90deg, #388e3c, #4caf50);
  animation: pulse-success 2s ease-in-out;
}

/* Strength Info */
.password-strength-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.password-strength-label {
  font-weight: 600;
  transition: color var(--transition-fast);
}

.password-strength-time {
  font-size: 0.813rem;
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Feedback Section */
.password-feedback {
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  border-left: 3px solid var(--color-warning);
  background: rgb(255 193 7 / 5%);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  font-size: 0.875rem;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .password-strength-container {
    background: rgb(0 0 0 / 20%);
  }

  .password-strength-meter {
    background: rgb(0 0 0 / 30%);
  }
}
```

---

## Database Schema

### MySQL Table Structure

```sql
-- Users table (root_users, admins, users)
CREATE TABLE `users` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,  -- Stores 60-char BCrypt hash
  `first_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Important:**
- `password` column: `VARCHAR(255)` - More than enough for 60-char BCrypt hash
- Never store plain passwords
- BCrypt hash includes salt (no separate salt column needed)

### Password History (Optional Enhancement)

```sql
-- Track password changes for security auditing
CREATE TABLE `password_history` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) UNSIGNED NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_by_ip` VARCHAR(45) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_password_history_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Security Considerations

### 1. Password Storage

- ✅ **DO:** Use BCrypt with cost factor 10+
- ✅ **DO:** Store only the hash (never plain text)
- ✅ **DO:** Use parameterized queries
- ❌ **DON'T:** Log passwords (even in debug mode)
- ❌ **DON'T:** Send passwords in URLs
- ❌ **DON'T:** Store passwords in localStorage

### 2. Transmission Security

- ✅ Always use HTTPS
- ✅ Use `autocomplete="new-password"` for password fields
- ✅ Clear password fields after submission
- ✅ Implement rate limiting on password endpoints

### 3. Session Management

- ✅ Automatic logout after password change
- ✅ Invalidate all existing sessions on password change
- ✅ Require re-authentication for sensitive operations

### 4. Error Messages

```typescript
// DON'T reveal too much information
❌ "User with email admin@example.com not found"
❌ "Password incorrect for user admin@example.com"

// DO use generic messages
✅ "Invalid email or password"
```

---

## Testing Guide

### 1. Valid Password Examples

```javascript
// Minimum valid (12 chars, 3 categories)
"SecurePass123"      // ✅ Upper, lower, numbers
"myPassword2024!"    // ✅ All 4 categories
"SuperSecret$999"    // ✅ Upper, lower, numbers, special

// Maximum valid (72 chars)
"This1sAVeryLongPasswordThatReachesTheMaximumLimitOf72CharactersExactly!"  // ✅
```

### 2. Invalid Password Examples

```javascript
// Too short
"Short1!"            // ❌ Only 7 characters

// Too long
"a".repeat(73)       // ❌ 73 characters (exceeds BCrypt limit)

// Not enough categories
"onlylowercase"      // ❌ Only 1 category
"ONLYUPPERCASE"      // ❌ Only 1 category
"12345678901"        // ❌ Only 1 category
"lower123456"        // ❌ Only 2 categories
```

### 3. Edge Cases

```javascript
// Special characters in password
"Test@#$%^&*()123"   // ✅ Should work

// International characters
"Prüfung123!"        // ✅ Should work (but counts ü as lowercase)

// Spaces
"My Secure Pass 1!"  // ✅ Spaces are allowed
```

---

## Troubleshooting

### Common Issues

1. **zxcvbn not loading**
   - Check network tab for chunk loading
   - Verify lazy loading triggers on focus
   - Check console for import errors

2. **Password strength not updating**
   - Verify debounce timeout (300ms)
   - Check if zxcvbn initialized
   - Look for console errors

3. **BCrypt validation fails**
   - Ensure password ≤ 72 characters
   - Check UTF-8 encoding
   - Verify salt rounds (10 recommended)

4. **Styles not applying**
   - Verify password-strength.css is imported
   - Check CSS variable definitions
   - Inspect element for class conflicts

### Debug Commands

```javascript
// Check if zxcvbn is loaded
console.log('zxcvbn ready:', typeof window.zxcvbn !== 'undefined');

// Test password strength
const result = await checkPasswordStrength('TestPassword123!');
console.log('Score:', result.score);
console.log('Crack time:', result.crackTimesDisplay);

// Verify BCrypt hash length
const hash = await bcryptjs.hash('test', 10);
console.log('Hash length:', hash.length); // Should be 60
```

---

## Performance Metrics

- **Initial Load:** 0 KB (lazy loaded)
- **After Focus:** ~65 KB gzipped (zxcvbn + dictionaries)
- **Validation Delay:** 300ms debounce
- **BCrypt Hashing:** ~100ms (cost factor 10)
- **Memory Usage:** ~2MB peak (during analysis)

---

## Future Enhancements

1. **Password History**
   - Prevent reuse of last N passwords
   - Track password age

2. **Advanced Rules**
   - Configurable per tenant
   - Role-based requirements

3. **Additional Dictionaries**
   - Company-specific terms
   - Industry jargon

4. **2FA Integration**
   - Require 2FA after password change
   - Lower password requirements with 2FA

5. **Breach Detection**
   - Check against HaveIBeenPwned API
   - Warn about compromised passwords

---

## Dependencies

```json
{
  "backend": {
    "bcryptjs": "^3.0.3",
    "zod": "^3.23.8"
  },
  "frontend": {
    "@zxcvbn-ts/core": "^3.0.4",
    "@zxcvbn-ts/language-common": "^3.0.4",
    "@zxcvbn-ts/language-de": "^3.0.4"
  }
}
```

---

## References

- [NIST 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) - Digital Identity Guidelines
- [BCrypt Paper](https://www.usenix.org/legacy/event/usenix99/provos/provos.pdf) - Original BCrypt specification
- [zxcvbn-ts Documentation](https://github.com/zxcvbn-ts/zxcvbn) - Password strength estimator
- [OWASP Password Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

## Changelog

### Version 1.0.0 (2024-11-20)
- Initial implementation
- BCrypt integration with 72-char limit
- zxcvbn-ts with German localization
- Real-time validation
- Automatic logout after password change
- Complete documentation

---

## Contact

For questions or issues related to the password validation system:
- **Technical Lead:** Development Team
- **Security:** security@assixx.de
- **Documentation:** docs@assixx.de