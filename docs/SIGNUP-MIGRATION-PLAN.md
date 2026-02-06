# signup.html Migration Plan

File: frontend/src/pages/signup.html
Lines: 639 total (400+ inline JS, 239 HTML/CSS)

## Current State Analysis

### HTML Components Status

**Already Design System:**

- Forms: `.form-field`, `.form-field__control`, `.form-field__label` ✓
- Form validation messages: `.form-field__message` ✓

**Needs Verification:**

- Button: `.btn btn-primary` (could be Bootstrap compat OR Design System)
- Back button: `.back-button` (custom)
- Help button: `.help-button` (custom)

**Custom Components (keep):**

- Country dropdown: `.custom-country-select` (Vanilla JS)
- Plan dropdown: `.custom-plan-select` (Vanilla JS)
- Subdomain input group: `.subdomain-input-group` (custom)
- Phone input group: `.phone-input-group` (custom)

**Needs Migration:**

- Success message: `#successMessage` (currently hidden div, needs Design System alert)

### CSS Analysis

**Inline Styles:** NONE ✓

**Custom CSS File:** `/styles/signup.css` (not analyzed yet)

### JavaScript Analysis

**Total:** 71 declarations (functions, const, let, var)

**Functions Inventory:**

**Dropdown Logic:**

1. `toggleCountryDropdown()` - Toggle country dropdown
2. `closeDropdownOutside()` - Close dropdown on outside click
3. `selectCountry()` - Set selected country
4. `togglePlanDropdown()` - Toggle plan dropdown
5. `selectPlan()` - Set selected plan

**Validation Logic:** 6. `validateEmailMatch()` - Check email confirmation matches 7. `validatePasswordMatch()` - Check password confirmation matches 8. `isDACHCountry()` - Check if DACH region (Germany/Austria/Switzerland) 9. `validatePhoneNumber()` - Validate phone format 10. `validateForm()` - main validation before submit

**Form Submission:** 11. `isUsingV2Api()` - Feature flag (always v2 now) 12. `prepareSignupData()` - Transform form data for API 13. `parseResponse()` - Parse API JSON response 14. `handleSuccessfulSignup()` - Success flow (redirect) 15. `resetSubmitButton()` - Reset button state 16. `handleError()` - Error handling 17. `submitSignupForm()` - API call 18. `isSignupSuccessful()` - Check response status 19. `getErrorMessage()` - Extract error message

**Other:** 20. `showHelp()` - Show help alert

**Event Listeners:**

- Input validation (real-time)
- Form submit handler
- Click delegation (data-action attributes)

**State Variables:**

- `currentCountryCode` - Selected country code
- `currentPlan` - Selected plan

## Migration Tasks

### Step 1: HTML Components

**Task 1.1: Verify Button**

- Check if `.btn btn-primary` uses Design System or Bootstrap compat
- Ensure it uses Design System button component
- Check Storybook for correct markup

**Task 1.2: Success Message**

- Replace `#successMessage` div with Design System `.alert--success`
- Use proper Design System markup from Storybook

**Task 1.3: Custom Dropdowns**

- Verify markup matches Design System dropdown patterns
- Keep Vanilla JS logic (will be moved to TypeScript)

### Step 2: CSS

**Task 2.1: Analyze signup.css**

- Check for inline styles or legacy patterns
- Ensure all uses Design System or Tailwind utilities

### Step 3: TypeScript Migration

**Task 3.1: Create TypeScript Modules**

**File 1: `signup-form-controller.ts`**
Main form controller

- Class: `SignupFormController`
- Methods: `init()`, `setupEventListeners()`, `handleSubmit()`
- State: countryCode, plan

**File 2: `signup-validators.ts`**
Validation logic

- `validateEmail()`
- `validateEmailMatch()`
- `validatePassword()`
- `validatePasswordMatch()`
- `validatePhone()`
- `isDACHCountry()`

**File 3: `signup-dropdown.ts`**
Dropdown component logic

- Class: `DropdownController`
- Methods: `toggle()`, `select()`, `closeOnOutsideClick()`
- Reusable for country AND plan dropdowns

**File 4: `signup-api.ts`**
API communication

- `submitSignup(data: SignupData): Promise<SignupResponse>`
- Types: `SignupData`, `SignupResponse`
- Error handling

**Task 3.2: Update signup.html**
Replace `<script>` with:

```html
<script type="module">
  import { SignupFormController } from '/scripts/auth/signup-form-controller.js';

  new SignupFormController().init();
</script>
```

**Task 3.3: Type Definitions**
Create types in `types/auth.types.ts`:

- `SignupData`
- `SignupResponse`
- `ValidationResult`
- `CountryOption`
- `PlanOption`

## Migration Order Recommendation

**User decides, but suggested order:**

1. Button verification (quick, low risk)
2. Success message to Design System alert (quick)
3. TypeScript File 1: signup-validators.ts (isolated, testable)
4. TypeScript File 2: signup-dropdown.ts (isolated, reusable)
5. TypeScript File 3: signup-api.ts (isolated)
6. TypeScript File 4: signup-form-controller.ts (integrates all)
7. Update HTML with module import
8. Test all functionality
9. Remove inline script

## Testing Checklist

Per component replacement:

- [ ] Visual check (looks correct)
- [ ] Functionality check (works correctly)
- [ ] Console check (no errors)
- [ ] Type check passes (`pnpm run type-check`)

Final testing:

- [ ] Form submits successfully
- [ ] Validation triggers correctly
- [ ] Dropdowns open/close properly
- [ ] Error messages display (Design System alert)
- [ ] Success message displays (Design System alert)
- [ ] Redirect to login works
- [ ] Mobile responsive
- [ ] No TypeScript errors
- [ ] No console errors

## Existing Auth Modules

Can be reused:

- `scripts/auth/index.ts` - Auth utilities, API client
- `scripts/utils/api-client.ts` - HTTP client
- `types/api.types.ts` - Existing types

## Estimated Effort

- HTML: 30 minutes
- CSS: 15 minutes
- TypeScript: 90 minutes
- Testing: 30 minutes

Total: ~2.5 hours
