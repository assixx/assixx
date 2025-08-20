# Role Switch Fix Documentation

## Problem

When an admin uses role switch to view as employee, they could still see admin features on various pages, especially the KVP page. This was a critical security issue where the effective role was not being properly checked.

## Root Cause

1. The KVP page was checking `localStorage.getItem('activeRole')` but the role-switch.ts was not setting `sessionStorage.setItem('roleSwitch', 'employee')` which the KVP page was checking
2. The unified navigation wasn't considering the activeRole when determining which menu items to show
3. Role switch was redirecting to dashboard instead of staying on the current page

## Solution

### 1. Updated role-switch.ts

- Added `sessionStorage.setItem('roleSwitch', 'employee')` when admin switches to employee role
- Changed redirect behavior from `window.location.href = '/pages/...'` to `window.location.reload()` to stay on current page
- Both localStorage and sessionStorage are now synchronized

### 2. Updated unified-navigation.ts

- Modified `loadUserInfo()` to check activeRole and use it for menu display
- When admin has activeRole='employee', the navigation shows employee menu items
- Properly considers role switch state for UI elements

### 3. Updated kvp.ts

- Already had `getEffectiveRole()` method that checks sessionStorage
- Now properly hides admin features when role-switched

## Implementation Details

### role-switch.ts Changes

```typescript
// Added sessionStorage sync
if (data.user.activeRole === 'employee' && userRole === 'admin') {
  sessionStorage.setItem('roleSwitch', 'employee');
} else {
  sessionStorage.removeItem('roleSwitch');
}

// Changed redirect to reload
window.location.reload(); // Instead of redirecting to dashboard
```

### unified-navigation.ts Changes

```typescript
// Check for role switch in loadUserInfo()
const activeRole = localStorage.getItem('activeRole');
if (payload.role === 'admin' && activeRole === 'employee') {
  this.currentRole = 'employee';
} else if (activeRole && ['root', 'admin', 'employee'].includes(activeRole)) {
  this.currentRole = activeRole as 'root' | 'admin' | 'employee';
} else {
  this.currentRole = payload.role;
}
```

## Testing

1. Login as admin
2. Navigate to KVP page
3. Use role switch to switch to employee view
4. Verify:
   - Admin features are hidden (stats, share buttons, etc.)
   - Create button is visible (employee feature)
   - Navigation shows employee menu items
   - Page reloads in place instead of redirecting
   - Switching back to admin restores admin features

## Security Impact

This fix ensures that role-switched admins truly see what employees see, preventing accidental exposure of admin features or data when testing the employee experience.
