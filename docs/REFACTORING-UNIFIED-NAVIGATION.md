# Refactoring Plan: unified-navigation

> **Status:** ✅ COMPLETED
> **Erstellt:** 2025-12-12
> **Aktualisiert:** 2025-12-12 (EXECUTION COMPLETE)
> **Branch:** `lint/refactoring`
>
> ## Execution Summary
> - **Phase 1:** ✅ CSS Cleanup - Inline styles → CSS classes
> - **Phase 2:** ✅ TypeScript Module Split - 3008-line God-class → 11 modules (3295 lines)
> - **Phase 3:** ✅ onclick → data-action Migration (already done in Phase 2)
> - **Phase 4:** ✅ Import Path Migration - 29 HTML files updated
> - **Phase 5:** ⏳ Final Testing (pending manual verification)

---

## Kontext

| Regel | Wert |
|-------|------|
| **API** | v2 only (kein v1 Fallback) |
| **TypeScript** | camelCase |
| **Database** | snake_case |
| **Rollback** | Git |

---

## 1. Ist-Zustand

| Metrik | Wert |
|--------|------|
| TS Zeilen | 3008 |
| CSS Zeilen | 1042 |
| Referenzen | 64 in 38 Files |
| ESLint | `/* eslint-disable max-lines */` |
| Problem | God-Class, 15+ Verantwortlichkeiten |

### 1.1 TS Struktur (3008 Zeilen)

```
001-126:    Imports, Interfaces, Constants
128-144:    Token Timer Helper
146-500:    init(), User Info Loading
500-660:    User Profile Methods
662-1000:   Navigation Items Config
1002-1057:  SVG Icons (50+)
1059-1200:  Avatar, HTML Injection
1200-1500:  Header, Modals, Role Switch
1500-1700:  Sidebar, Menu Items
1700-2000:  Event Handlers
2000-2150:  Role Switch Handlers
2150-2450:  Active Navigation State
2450-2700:  Refresh, Badges, SSE
2700-2900:  Logo, Storage Widget
2900-3008:  Window Exports
```

### 1.2 CSS Struktur (1042 Zeilen)

```
001-090:    Header, Token Timer
090-150:    Role Switch Banner
148-500:    Sidebar (Base, Collapsed)
500-620:    User Info Card
620-640:    Role Switch Dropdown
640-800:    Menu Items, Submenus
800-860:    Layout Container
860-990:    Storage Widget
990-1042:   Responsive, Badges
```

### 1.3 Inline Styles (VOLLSTÄNDIG - zu eliminieren)

#### 1.3.1 `style.` Property Assignments (27 Stellen)

| Zeile | Code | Lösung |
|-------|------|--------|
| 580 | `style.display = 'flex'` | `.employee-number--visible` |
| 581 | `style.justifyContent = 'center'` | `.employee-number--visible` |
| 588 | `style.color = 'var(--warning-color)'` | `.employee-number--temp` |
| 603 | `style.display = 'none'` | `.u-hidden` |
| 613 | `style.display = 'block'` | remove `.u-hidden` |
| 615 | `style.display = 'none'` | `.u-hidden` |
| 1838 | `style.removeProperty('width')` | CSS class toggle |
| 1929 | `style.display = 'block'` | `.modal-overlay--active` |
| 1947 | `style.display = 'none'` | remove `.modal-overlay--active` |
| 2276 | `style.display = 'none'` | `.u-hidden` |
| 2311 | `style.display = 'block'` | remove `.u-hidden` |
| 2365 | `style.display = 'block'` | remove `.u-hidden` |
| 2387 | `style.display = 'block'` | remove `.u-hidden` |
| 2533 | `style.display = DISPLAY_INLINE_BLOCK` | remove `.u-hidden` |
| 2535 | `style.display = 'none'` | `.u-hidden` |
| 2558 | `style.display !== DISPLAY_INLINE_BLOCK` | check `.u-hidden` |
| 2579 | `style.display = DISPLAY_INLINE_BLOCK` | remove `.u-hidden` |
| 2581 | `style.display = 'none'` | `.u-hidden` |
| 2624 | `style.display = 'none'` | `.u-hidden` |
| 2635 | `style.display = 'none'` | `.u-hidden` |
| 2780 | `style.cursor = 'pointer'` | `.logo-container--clickable` |
| 2864 | `style.width = ...` | CSS custom property |
| 2865 | `style.backgroundColor = ...` | CSS custom property |
| 2932 | `style.display === 'block'` | check `.submenu--open` |
| 2937 | `style.display = 'none'` | `.u-hidden` |
| 2944 | `style.display = 'block'` | `.submenu--open` |
| 2949 | `style.display = 'none'` | `.u-hidden` |
| 2989 | `style.display = 'none'` | `.u-hidden` |
| 3001 | `style.top = ''` | CSS class |
| 3002 | `style.height = ''` | CSS class |

#### 1.3.2 Template Literal `style="..."` (19 Stellen)

| Zeile | Code | Lösung |
|-------|------|--------|
| 585 | `style="letter-spacing: 2px;"` | `.employee-number__text` |
| 587 | `style="letter-spacing: 2px;"` | `.employee-number__text` |
| 1266 | `style="margin-right: 8px;"` | `.icon--mr` oder Tailwind `mr-2` |
| 1310 | `style="margin-right: 8px;"` | `.icon--mr` oder Tailwind `mr-2` |
| 1350 | `style="margin-right: 8px;"` | `.icon--mr` oder Tailwind `mr-2` |
| 1436 | `style="display: none;"` | `.u-hidden` |
| 1446 | `style="color: ...; margin-bottom: ..."` | Design System / Tailwind |
| 1449 | `style="color: ...; font-size: ..."` | Design System / Tailwind |
| 1537 | `style="font-size: 13px; color: ..."` | `.user-position` |
| 1538 | `style="font-size: 13px; color: ..."` | `.user-employee-number` |
| 1580 | `style="display: none;"` | `.u-hidden` |
| 1585 | `style="display: none;"` | `.u-hidden` |
| 1588 | `style="display: none;"` | `.u-hidden` |
| 1591 | `style="display: none;"` | `.u-hidden` |
| 1599 | `style="position: relative;"` | bereits in CSS |
| 1611 | `style="display: none;"` | `.u-hidden` |
| 1625 | `style="position: relative; display: block;"` | bereits in CSS |
| 1638 | `style="position: relative;"` | bereits in CSS |
| 1650 | `style="display: none;"` | `.u-hidden` |
| 1675 | `style="position: relative;"` | bereits in CSS |
| 2818 | `style="width: 0%"` | `.storage-progress-bar` initial |

### 1.4 Window Exports (zu migrieren)

```typescript
// Aktuelle Window Exports:
window.UnifiedNavigation = UnifiedNavigation;     // Line 2983
window.unifiedNav = new UnifiedNavigation();      // Line 2961/2965
window.dismissRoleSwitchBanner = function() {...} // Line 2986
window.toggleSubmenu = function() {...}           // Line 2924

// Declare global interface:
declare global {
  interface Window {
    UnifiedNavigation?: typeof UnifiedNavigation;
    unifiedNav?: UnifiedNavigation;
    dismissRoleSwitchBanner?: () => void;
    toggleSubmenu?: (event: Event, itemId: string) => void;
  }
}
```

---

## 2. Ziel-Struktur

```
frontend/src/scripts/components/navigation/
├── index.ts            # Entry Point, Auto-Init (~150 Zeilen)
├── types.ts            # Interfaces (~100 Zeilen)
├── constants.ts        # URLs, Selectors, Access Control (~200 Zeilen)
├── icons.ts            # SVG Map (~100 Zeilen)
├── menu-config.ts      # Nav Items Config (~350 Zeilen)
├── render.ts           # HTML Generation (~400 Zeilen)
├── handlers.ts         # Event Handlers, data-action Delegation (~350 Zeilen)
├── services.ts         # API, SSE, Badges (~300 Zeilen)
├── utils.ts            # Helpers (~100 Zeilen)
├── role-switch-ui.ts   # Role Switch UI/Banner (~200 Zeilen) ← RENAMED
└── sidebar.ts          # Sidebar State/Toggle (~150 Zeilen)
```

**Total: 11 Module (~2400 Zeilen) vs. 1 God-Class (3008 Zeilen)**

### 2.0 Architektur-Entscheidungen

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| **Import-Strategie** | Direkte Imports | Alte `unified-navigation.ts` wird gelöscht. 38 HTML-Files werden per `sed` aktualisiert. Keine Wrapper. |
| **Window Exports** | ENTFERNEN | `window.toggleSubmenu`, `window.dismissRoleSwitchBanner` → `data-action` Event Delegation. Konsistent mit Design System. |
| **Progress Bar** | CSS Variables | `style.setProperty('--progress', value)` statt inline styles. |
| **role-switch Naming** | `role-switch-ui.ts` | Unterscheidung von `auth/role-switch.ts` (API calls). |

### 2.1 Module

#### types.ts

```typescript
import type { User, Tenant } from '../../../types/api.types';

export interface TokenPayload {
  id: number;
  username: string;
  role: Role;
  tenantId?: number | null;
  email?: string;
  activeRole?: string;
  isRoleSwitched?: boolean;
}

export interface NavItem {
  id: string;
  icon?: string;
  label: string;
  url?: string;
  section?: string;
  badge?: string;
  badgeId?: string;
  hasSubmenu?: boolean;
  submenu?: NavItem[];
  children?: NavItem[];
}

export interface NavigationItems {
  admin: NavItem[];
  employee: NavItem[];
  root: NavItem[];
}

export interface UserProfileResponse extends User {
  user?: User;
  companyName?: string;
  subdomain?: string;
  data?: {
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    employeeNumber?: string;
  };
  tenant?: Tenant;
}

export interface RoleSwitchMessage {
  type: string;
  newRole?: string;
  token?: string;
}

export type Role = 'admin' | 'employee' | 'root';

export interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  plan: string;
}
```

#### constants.ts

```typescript
import type { Role } from './types';

// Dashboard URLs
export const DASHBOARD_URLS = {
  employee: '/employee-dashboard',
  admin: '/admin-dashboard',
  root: '/root-dashboard',
} as const;

// CSS Selectors
export const SELECTORS = {
  sidebar: '.sidebar',
  sidebarItem: '.sidebar-item',
  mainContent: '.main-content',
  submenu: '.submenu',
  navBadge: '.nav-badge',
} as const;

// CSS Classes
export const CSS_CLASSES = {
  collapsed: 'collapsed',
  sidebarCollapsed: 'sidebar-collapsed',
  hidden: 'u-hidden',
  active: 'active',
  open: 'open',
  modalActive: 'modal-overlay--active',
  submenuOpen: 'submenu--open',
} as const;

// Badge IDs
export const BADGE_IDS = {
  chat: '#chat-unread-badge',
  kvp: '#kvp-badge',
  surveys: '#surveys-pending-badge',
  leanManagement: '#lean-management-badge',
  documents: '#documents-unread-badge',
  calendar: '#calendar-badge',
} as const;

// Access Control Map
const accessControlData: Record<string, Role[]> = {
  '/root-dashboard': ['root'],
  '/manage-root': ['root'],
  '/root-features': ['root'],
  '/root-profile': ['root'],
  '/tenant-deletion-status': ['root'],
  '/storage-upgrade': ['root'],
  '/logs': ['root'],
  '/admin-dashboard': ['admin', 'root'],
  '/manage-admins': ['admin', 'root'],
  '/manage-employees': ['admin', 'root'],
  '/manage-departments': ['admin', 'root'],
  '/manage-areas': ['admin', 'root'],
  '/manage-teams': ['admin', 'root'],
  '/manage-machines': ['admin', 'root'],
  '/survey-admin': ['admin', 'root'],
  '/admin-profile': ['admin', 'root'],
  '/employee-dashboard': ['employee', 'admin', 'root'],
  '/employee-profile': ['employee', 'admin', 'root'],
  '/blackboard': ['employee', 'admin', 'root'],
  '/kvp': ['employee', 'admin', 'root'],
  '/calendar': ['employee', 'admin', 'root'],
  '/shifts': ['employee', 'admin', 'root'],
  '/chat': ['employee', 'admin', 'root'],
  '/documents-explorer': ['employee', 'admin', 'root'],
  '/account-settings': ['employee', 'admin', 'root'],
};

export const ACCESS_CONTROL = new Map<string, Role[]>(Object.entries(accessControlData));
```

#### icons.ts

```typescript
const ICONS_DATA: Record<string, string> = {
  home: '<i class="fas fa-home"></i>',
  users: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  document: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
  lightbulb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17h8v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,3L1,9V21H23V9M21,19H3V10.53L12,5.68L21,10.53M8,15H10V19H8M12,15H14V19H12M16,15H18V19H16Z"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>',
  feature: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,8L15,12H18C18,15.31 15.31,18 12,18C10.99,18 10.03,17.75 9.2,17.3L7.74,18.76C8.97,19.54 10.43,20 12,20C16.42,20 20,16.42 20,12H23M6,12C6,8.69 8.69,6 12,6C13.01,6 13.97,6.25 14.8,6.7L16.26,5.24C15.03,4.46 13.57,4 12,4C7.58,4 4,7.58 4,12H1L5,16L9,12"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H9.2V10C9.2,8.6 10.6,7 12,7M8.2,16V13H15.8V16H8.2Z"/></svg>',
  'user-shield': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z"/></svg>',
  poll: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3,22V8H7V22H3M10,22V2H14V22H10M17,22V14H21V22H17Z"/></svg>',
  lean: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/></svg>',
  sitemap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.19 21C14.12 19.43 13 17.36 13 15.5C13 13.67 13.96 12 15.4 11H15V9H17V10.23C17.5 10.09 18 10 18.5 10C18.67 10 18.84 10 19 10.03V3H5V21H11V17.5H13V21H15.19M15 5H17V7H15V5M9 19H7V17H9V19M9 15H7V13H9V15M9 11H7V9H9V11M9 7H7V5H9V7M11 5H13V7H11V5M11 9H13V11H11V9M11 15V13H13V15H11M18.5 12C16.6 12 15 13.61 15 15.5C15 18.11 18.5 22 18.5 22S22 18.11 22 15.5C22 13.61 20.4 12 18.5 12M18.5 16.81C17.8 16.81 17.3 16.21 17.3 15.61C17.3 14.91 17.9 14.41 18.5 14.41S19.7 15 19.7 15.61C19.8 16.21 19.2 16.81 18.5 16.81Z"/></svg>',
  logs: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M8,15.5H16V17H8V15.5M8,11.5H16V13H8V11.5Z"/></svg>',
  generator: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2C5.9 2 5 2.9 5 4V6H4C2.9 6 2 6.9 2 8V20H4V21C4 21.55 4.45 22 5 22H6C6.55 22 7 21.55 7 21V20H17V21C17 21.55 17.45 22 18 22H19C19.55 22 20 21.55 20 21V20H22V8C22 6.9 21.11 6 20 6H19V4C19 2.9 18.11 2 17 2H7M14 10V8H20V10H14M14 14V12H20V14H14M7 4H17V6H7V4M7 8V12H9L6 18V14H4L7 8Z"/></svg>',
};

const ICONS = new Map(Object.entries(ICONS_DATA));

export function getIcon(name: string): string {
  return ICONS.get(name) ?? ICONS.get('home') ?? '';
}
```

#### utils.ts

```typescript
import type { TokenPayload } from './types';

export function escapeHtml(text: string): string {
  const escapeMap = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#039;'],
  ]);
  return text.replace(/["&'<>]/g, (m) => escapeMap.get(m) ?? m);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB';
  const k = 1024;
  const sizesMap = new Map([
    [0, 'B'], [1, 'KB'], [2, 'MB'], [3, 'GB'], [4, 'TB'],
  ]);
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 4);
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizesMap.get(i) ?? 'B'}`;
}

export function formatTokenTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function parseTokenPayload(): TokenPayload | null {
  const token = localStorage.getItem('token');
  if (token === null || token === '') return null;
  try {
    const tokenPart = token.split('.')[1];
    if (tokenPart === undefined) return null;
    return JSON.parse(atob(tokenPart)) as TokenPayload;
  } catch {
    return null;
  }
}

export function getDashboardTypeFromPath(path: string): 'root' | 'admin' | 'employee' | null {
  if (path.includes('/root-dashboard')) return 'root';
  if (path.includes('/admin-dashboard')) return 'admin';
  if (path.includes('/employee-dashboard')) return 'employee';
  return null;
}
```

#### role-switch-ui.ts (RENAMED von role-switch.ts)

```typescript
import type { Role, RoleSwitchMessage } from './types';
import { DASHBOARD_URLS, CSS_CLASSES } from './constants';
import { $$ } from '../../../utils/dom-utils';

/**
 * BroadcastChannel for cross-tab role switching
 */
const roleChannel = new BroadcastChannel('role_switch_channel');

/**
 * Setup listener for role switch messages from other tabs
 */
export function setupRoleSwitchListener(onRoleSwitch: () => void): void {
  roleChannel.onmessage = (event: MessageEvent<RoleSwitchMessage>) => {
    if (event.data.type === 'ROLE_SWITCHED') {
      if (event.data.newRole !== undefined) {
        localStorage.setItem('activeRole', event.data.newRole);
      }
      if (event.data.token !== undefined) {
        localStorage.setItem('token', event.data.token);
      }
      onRoleSwitch();
    }
  };
}

/**
 * Setup storage event listener for cross-tab sync
 */
export function setupStorageListener(onRoleChange: (newRole: string | null) => void): void {
  let redirectTimeout: ReturnType<typeof setTimeout> | null = null;

  window.addEventListener('storage', (event) => {
    if (event.key === 'activeRole' && event.newValue !== event.oldValue) {
      if (redirectTimeout) clearTimeout(redirectTimeout);
      redirectTimeout = setTimeout(() => {
        onRoleChange(event.newValue);
      }, 300);
    }
  });
}

/**
 * Handle role change and redirect if needed
 */
export function handleRoleChangeRedirect(newActiveRole: string | null): void {
  const currentPagePath = window.location.pathname;
  const userRole = localStorage.getItem('userRole');

  const getDashboardPath = (role: string | null): string => {
    switch (role) {
      case 'root': return DASHBOARD_URLS.root;
      case 'admin': return DASHBOARD_URLS.admin;
      case 'employee': return DASHBOARD_URLS.employee;
      default: return '/';
    }
  };

  const targetPath = getDashboardPath(newActiveRole);

  if (targetPath !== '' && !currentPagePath.includes(targetPath)) {
    if (newActiveRole === 'root' && userRole !== 'root') return;
    window.location.replace(targetPath);
  }
}

/**
 * Create role switch dropdown HTML for root users
 */
export function createRootRoleSwitchDropdown(activeRole: string | null): string {
  const roleIcons = {
    root: 'manage_accounts',
    admin: 'supervisor_account',
    employee: 'person_apron',
  };

  const currentRole = (activeRole === 'root' ? 'root' : activeRole === 'admin' ? 'admin' : 'employee') as Role;
  const currentView = activeRole === 'root' ? 'Root-Ansicht' : activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht';
  const currentIcon = roleIcons[currentRole];

  return `
    <div class="dropdown role-switch-dropdown">
      <div class="dropdown__trigger" id="roleSwitchDisplay">
        <span>
          <span class="material-symbols-outlined mr-2">${currentIcon}</span>
          ${currentView}
        </span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" id="roleSwitchDropdown">
        <div class="dropdown__option ${activeRole === 'root' ? 'active' : ''}" data-value="root">
          <span class="material-symbols-outlined mr-2">manage_accounts</span>Root-Ansicht
        </div>
        <div class="dropdown__option ${activeRole === 'admin' ? 'active' : ''}" data-value="admin">
          <span class="material-symbols-outlined mr-2">supervisor_account</span>Admin-Ansicht
        </div>
        <div class="dropdown__option ${activeRole === 'employee' ? 'active' : ''}" data-value="employee">
          <span class="material-symbols-outlined mr-2">person_apron</span>Mitarbeiter-Ansicht
        </div>
      </div>
    </div>
  `;
}

/**
 * Create role switch dropdown HTML for admin users
 */
export function createAdminRoleSwitchDropdown(activeRole: string | null): string {
  const roleIcons = { admin: 'supervisor_account', employee: 'person_apron' };
  const currentRole = (activeRole === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee';
  const currentView = activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht';
  const currentIcon = roleIcons[currentRole];

  return `
    <div class="dropdown role-switch-dropdown">
      <div class="dropdown__trigger" id="roleSwitchDisplay">
        <span>
          <span class="material-symbols-outlined mr-2">${currentIcon}</span>
          ${currentView}
        </span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" id="roleSwitchDropdown">
        <div class="dropdown__option ${activeRole === 'admin' ? 'active' : ''}" data-value="admin">
          <span class="material-symbols-outlined mr-2">supervisor_account</span>Admin-Ansicht
        </div>
        <div class="dropdown__option ${activeRole === 'employee' ? 'active' : ''}" data-value="employee">
          <span class="material-symbols-outlined mr-2">person_apron</span>Mitarbeiter-Ansicht
        </div>
      </div>
    </div>
  `;
}

/**
 * Create role switch banner HTML
 */
export function createRoleSwitchBanner(storedUserRole: string | null, activeRole: string | null): string {
  const isRoleSwitched = storedUserRole !== activeRole && activeRole !== null;
  const bannerDismissedKey = activeRole !== null ? `roleSwitchBannerDismissed_${activeRole}` : 'roleSwitchBannerDismissed_default';
  const isBannerDismissed = localStorage.getItem(bannerDismissedKey) === 'true';

  if (!isRoleSwitched || isBannerDismissed) return '';

  const currentRoleText = activeRole === 'employee' ? 'Mitarbeiter' : activeRole === 'admin' ? 'Admin' : 'Root';
  const originalRoleText = storedUserRole === 'root' ? 'Root' : storedUserRole === 'admin' ? 'Admin' : 'Mitarbeiter';

  return `
    <div class="role-switch-banner" id="role-switch-warning-banner">
      <div class="role-switch-banner-content">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" class="mr-2">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Sie agieren derzeit als <strong>${currentRoleText}</strong>. Ihre ursprüngliche Rolle ist <strong>${originalRoleText}</strong>.</span>
        <button class="role-switch-banner-close" data-action="dismiss-role-banner" title="Banner schließen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Dismiss role switch banner
 */
export function dismissRoleSwitchBanner(): void {
  const banner = $$('#role-switch-warning-banner');
  if (banner) {
    banner.classList.add(CSS_CLASSES.hidden);

    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && activeRole !== '') {
      localStorage.setItem(`roleSwitchBannerDismissed_${activeRole}`, 'true');
    }
  }
}
```

#### sidebar.ts (NEU)

```typescript
import { $$, $all } from '../../../utils/dom-utils';
import { CSS_CLASSES, SELECTORS } from './constants';

/**
 * Sidebar state
 */
let isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

/**
 * Get collapsed state
 */
export function getIsCollapsed(): boolean {
  return isCollapsed;
}

/**
 * Set collapsed state
 */
export function setIsCollapsed(collapsed: boolean): void {
  isCollapsed = collapsed;
  localStorage.setItem('sidebarCollapsed', String(collapsed));
}

/**
 * Toggle sidebar collapsed state
 */
export function toggleSidebar(): void {
  const sidebar = $$(SELECTORS.sidebar);
  const mainContent = $$(SELECTORS.mainContent);

  if (!sidebar) return;

  isCollapsed = !isCollapsed;
  setIsCollapsed(isCollapsed);

  sidebar.classList.toggle(CSS_CLASSES.collapsed, isCollapsed);
  mainContent?.classList.toggle(CSS_CLASSES.sidebarCollapsed, isCollapsed);

  updateToggleIcon(isCollapsed);
}

/**
 * Update toggle icon based on collapsed state
 */
function updateToggleIcon(collapsed: boolean): void {
  const iconPath = $$('.toggle-icon-path');
  if (iconPath) {
    const path = collapsed
      ? 'M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z'
      : 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z';
    iconPath.setAttribute('d', path);
  }
}

/**
 * Setup sidebar toggle button
 */
export function setupSidebarToggle(): void {
  const toggleBtn = $$('#sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSidebar);
  }
}

/**
 * Toggle submenu open/close
 */
export function toggleSubmenu(event: Event, itemId: string): void {
  event.preventDefault();
  event.stopPropagation();

  const submenu = $$(`#submenu-${itemId}`);
  const parentItem = submenu?.closest(SELECTORS.sidebarItem);

  if (!(submenu instanceof HTMLElement) || !parentItem) return;

  const isOpen = !submenu.classList.contains(CSS_CLASSES.hidden);

  // Close all other submenus
  $all('.submenu').forEach((menu) => {
    if (menu !== submenu) {
      menu.classList.add(CSS_CLASSES.hidden);
      menu.closest(SELECTORS.sidebarItem)?.classList.remove(CSS_CLASSES.open);
    }
  });

  // Toggle current submenu
  if (!isOpen) {
    submenu.classList.remove(CSS_CLASSES.hidden);
    parentItem.classList.add(CSS_CLASSES.open);
    localStorage.setItem('openSubmenu', itemId);
  } else {
    submenu.classList.add(CSS_CLASSES.hidden);
    parentItem.classList.remove(CSS_CLASSES.open);
    localStorage.removeItem('openSubmenu');
  }
}

/**
 * Update active navigation state based on current path
 */
export function updateActiveNavigation(): void {
  const currentPath = window.location.pathname;

  // Remove all active states
  $all(`${SELECTORS.sidebarItem}.${CSS_CLASSES.active}`).forEach((item) => {
    item.classList.remove(CSS_CLASSES.active);
  });

  // Find and activate current item
  $all('.sidebar-link, .submenu-link').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const linkPath = new URL(link.href, window.location.origin).pathname;
    if (linkPath === currentPath) {
      const item = link.closest(SELECTORS.sidebarItem);
      item?.classList.add(CSS_CLASSES.active);

      // If in submenu, also open parent
      const parentSubmenu = link.closest('.submenu');
      if (parentSubmenu) {
        const parentItem = parentSubmenu.closest(SELECTORS.sidebarItem);
        parentItem?.classList.add(CSS_CLASSES.open);
        parentSubmenu.classList.remove(CSS_CLASSES.hidden);
      }
    }
  });
}

/**
 * Restore submenu state from localStorage
 */
export function restoreSubmenuState(): void {
  const openSubmenuId = localStorage.getItem('openSubmenu');
  if (openSubmenuId) {
    const submenu = $$(`#submenu-${openSubmenuId}`);
    const parentItem = submenu?.closest(SELECTORS.sidebarItem);
    if (submenu && parentItem) {
      submenu.classList.remove(CSS_CLASSES.hidden);
      parentItem.classList.add(CSS_CLASSES.open);
    }
  }
}
```

#### menu-config.ts

```typescript
import type { NavItem } from './types';
import { getIcon } from './icons';

export function getAdminNavigationItems(): NavItem[] {
  return [
    ...getAdminCoreItems(),
    ...getAdminContentItems(),
    ...getAdminCommunicationItems(),
  ];
}

function getAdminCoreItems(): NavItem[] {
  return [
    { id: 'dashboard', icon: getIcon('home'), label: 'Übersicht', url: '/admin-dashboard', section: 'dashboard' },
    { id: 'blackboard', icon: getIcon('pin'), label: 'Schwarzes Brett', url: '/blackboard', section: 'blackboard' },
    { id: 'employees', icon: getIcon('users'), label: 'Mitarbeiter', url: '/manage-employees', section: 'employees' },
    { id: 'teams', icon: getIcon('team'), label: 'Teams', url: '/manage-teams', section: 'teams' },
    { id: 'machines', icon: getIcon('generator'), label: 'Maschinen', url: '/manage-machines', section: 'machines' },
  ];
}

function getAdminContentItems(): NavItem[] {
  return [
    { id: 'documents', icon: getIcon('document'), label: 'Dokumente', hasSubmenu: true, submenu: getDocumentSubmenu() },
    { id: 'calendar', icon: getIcon('calendar'), label: 'Kalender', url: '/calendar', badge: 'unread-calendar-events' },
    { id: 'lean-management', icon: getIcon('lean'), label: 'LEAN-Management', hasSubmenu: true, badge: 'lean-management-parent', submenu: getLeanManagementSubmenu(true) },
    { id: 'shifts', icon: getIcon('clock'), label: 'Schichtplanung', url: '/shifts' },
  ];
}

function getAdminCommunicationItems(): NavItem[] {
  return [
    { id: 'chat', icon: getIcon('chat'), label: 'Chat', url: '/chat', badge: 'unread-messages' },
    { id: 'settings', icon: getIcon('settings'), label: 'Einstellungen', url: '#settings', section: 'settings' },
    { id: 'profile', icon: getIcon('user'), label: 'Mein Profil', url: '/admin-profile' },
  ];
}

export function getEmployeeNavigationItems(): NavItem[] {
  return [
    { id: 'dashboard', icon: getIcon('home'), label: 'Dashboard', url: '/employee-dashboard' },
    { id: 'blackboard', icon: getIcon('pin'), label: 'Schwarzes Brett', url: '/blackboard' },
    { id: 'documents', icon: getIcon('document'), label: 'Dokumente', hasSubmenu: true, badge: 'unread-documents', submenu: getDocumentSubmenu() },
    { id: 'calendar', icon: getIcon('calendar'), label: 'Kalender', url: '/calendar', badge: 'unread-calendar-events' },
    { id: 'lean-management', icon: getIcon('lean'), label: 'LEAN-Management', hasSubmenu: true, badge: 'lean-management-parent', submenu: getLeanManagementSubmenu(false) },
    { id: 'chat', icon: getIcon('chat'), label: 'Chat', url: '/chat', badge: 'unread-messages' },
    { id: 'shifts', icon: getIcon('clock'), label: 'Schichtplanung', url: '/shifts' },
    { id: 'profile', icon: getIcon('user'), label: 'Mein Profil', url: '/employee-profile' },
  ];
}

export function getRootNavigationItems(): NavItem[] {
  return [
    { id: 'dashboard', icon: getIcon('home'), label: 'Root Dashboard', url: '/root-dashboard' },
    { id: 'blackboard', icon: getIcon('pin'), label: 'Schwarzes Brett', url: '/blackboard' },
    { id: 'root-users', icon: getIcon('user-shield'), label: 'Root User', url: '/manage-root' },
    { id: 'admins', icon: getIcon('admin'), label: 'Administratoren', url: '/manage-admins' },
    { id: 'areas', icon: getIcon('sitemap'), label: 'Bereiche', url: '/manage-areas', section: 'areas' },
    { id: 'departments', icon: getIcon('building'), label: 'Abteilungen', url: '/manage-departments' },
    { id: 'chat', icon: getIcon('chat'), label: 'Chat', url: '/chat', badge: 'unread-messages' },
    { id: 'features', icon: getIcon('feature'), label: 'Features', url: '/root-features' },
    { id: 'logs', icon: getIcon('logs'), label: 'System-Logs', url: '/logs' },
    { id: 'profile', icon: getIcon('user'), label: 'Mein Profil', url: '/root-profile' },
    { id: 'system', icon: getIcon('settings'), label: 'System', hasSubmenu: true, submenu: [
      { id: 'account-settings', icon: getIcon('user-shield'), label: 'Kontoeinstellungen', url: '/account-settings' },
    ]},
  ];
}

export function getDocumentSubmenu(): NavItem[] {
  return [
    { id: 'documents-explorer', icon: getIcon('folder'), label: 'Datei Explorer', url: '/documents-explorer' },
  ];
}

export function getLeanManagementSubmenu(isAdmin: boolean): NavItem[] {
  return [
    { id: 'kvp', icon: getIcon('lightbulb'), label: 'KVP System', url: '/kvp', badge: 'new-kvp-suggestions' },
    { id: 'surveys', icon: getIcon('poll'), label: 'Umfragen', url: isAdmin ? '/survey-admin' : '/survey-employee', badge: isAdmin ? undefined : 'pending-surveys' },
  ];
}
```

#### render.ts, services.ts, handlers.ts, index.ts

*(Wie im ursprünglichen Plan, aber mit imports aus role-switch-ui.ts und sidebar.ts)*

---

## 3. Execution Plan

### Phase 1: CSS Cleanup

**Ziel:** Alle inline styles aus TS eliminieren

```
1.1 Neue CSS-Klassen in unified-navigation.css erstellen:

    /* Employee Number Styles */
    .employee-number--visible {
      display: flex;
      justify-content: center;
    }
    .employee-number__text {
      letter-spacing: 2px;
    }
    .employee-number--temp {
      color: var(--warning-color);
    }

    /* User Info Styles */
    .user-position {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 2px;
    }
    .user-employee-number {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Logo Clickable */
    .logo-container--clickable {
      cursor: pointer;
    }

    /* Storage Progress Bar - CSS Variables für dynamische Werte */
    .storage-progress-bar {
      width: var(--storage-progress, 0%);
      background-color: var(--storage-color, var(--color-primary));
      transition: width 0.5s ease, background-color 0.3s ease;
    }

    /* Submenu Open State */
    .submenu--open {
      display: block;
    }

    /* Icon Margin */
    .icon--mr,
    .mr-2 {
      margin-right: 8px;
    }

1.2 TS ändern:
    - style.display = 'none' → classList.add('u-hidden')
    - style.display = 'block/flex' → classList.remove('u-hidden')
    - style.display = 'inline-block' → classList.remove('u-hidden')
    - Template literal style="..." → CSS classes
    - Progress bar: CSS Variables statt inline styles:
      ```typescript
      // VORHER (schlecht):
      progressBar.style.width = `${percentage}%`;
      progressBar.style.backgroundColor = color;

      // NACHHER (gut):
      progressBar.style.setProperty('--storage-progress', `${percentage}%`);
      progressBar.style.setProperty('--storage-color', color);
      ```

1.3 Testen:
    - Root Dashboard
    - Admin Dashboard
    - Employee Dashboard
    - Sidebar collapsed/expanded
    - Submenus öffnen/schließen
    - Role switch dropdown
    - Role switch banner
    - Logout modal
    - Badges anzeigen/verstecken
    - Storage widget
```

### Phase 2: TS Module Split

**Reihenfolge (dependency-aware):**

```
2.1   Ordner erstellen: frontend/src/scripts/components/navigation/
2.2   types.ts extrahieren (0 deps)
2.3   constants.ts extrahieren (types)
2.4   icons.ts extrahieren (0 deps)
2.5   utils.ts extrahieren (types)
2.6   role-switch-ui.ts extrahieren (types, constants, dom-utils)
2.7   sidebar.ts extrahieren (constants, dom-utils)
2.8   menu-config.ts extrahieren (types, icons)
2.9   render.ts extrahieren (types, icons, utils, role-switch-ui)
2.10  services.ts extrahieren (types, api-client, token-manager, sse-client)
2.11  handlers.ts extrahieren (types, services, sidebar, role-switch-ui, data-action delegation)
2.12  index.ts refactoren (all modules, auto-init, KEINE window exports)
```

**Nach jedem Schritt:**
- ESLint check: `docker exec assixx-backend pnpm exec eslint frontend/src/scripts/components/navigation/`
- Type check: `docker exec assixx-backend pnpm run type-check`
- Browser test: Root/Admin/Employee Dashboard

### Phase 3: HTML onclick → data-action Migration

**Ziel:** Window exports entfernen, Event Delegation einführen

```
3.1 handlers.ts: Event Delegation Setup hinzufügen:

    // handlers.ts
    export function setupEventDelegation(): void {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const actionEl = target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.getAttribute('data-action');
        const itemId = actionEl.getAttribute('data-item-id') ?? '';

        switch (action) {
          case 'toggle-submenu':
            toggleSubmenu(e, itemId);
            break;
          case 'dismiss-role-banner':
            dismissRoleSwitchBanner();
            break;
          case 'sidebar-toggle':
            toggleSidebar();
            break;
          case 'logout':
            showLogoutModal();
            break;
          case 'role-switch':
            const role = actionEl.getAttribute('data-role');
            handleRoleSwitch(role);
            break;
        }
      });
    }

3.2 render.ts: HTML Templates aktualisieren:

    // VORHER (schlecht):
    <button onclick="window.toggleSubmenu(event, 'docs')">

    // NACHHER (gut):
    <button data-action="toggle-submenu" data-item-id="docs">

3.3 index.ts: Window exports ENTFERNEN:

    // ENTFERNEN:
    // window.UnifiedNavigation = UnifiedNavigation;
    // window.unifiedNav = new UnifiedNavigation();
    // window.dismissRoleSwitchBanner = ...
    // window.toggleSubmenu = ...

    // BEHALTEN (nur auto-init):
    document.addEventListener('DOMContentLoaded', () => {
      const nav = new UnifiedNavigation();
      nav.init();
    });
```

### Phase 4: Import-Pfade Migration

**Ziel:** Alte Datei löschen, alle Imports aktualisieren

```
4.1 Alle HTML-Files per sed aktualisieren:

    # Im Docker Container:
    docker exec assixx-backend sh -c "
      sed -i 's|/scripts/components/unified-navigation.ts|/scripts/components/navigation/index.ts|g' \
        frontend/src/pages/*.html
    "

4.2 Verifizieren dass keine alten Imports mehr existieren:

    grep -r "unified-navigation.ts" frontend/src/pages/
    # Erwartete Ausgabe: keine Treffer

4.3 Alte Datei löschen:

    rm frontend/src/scripts/components/unified-navigation.ts

4.4 Build und Test:

    docker exec assixx-backend pnpm run build
    # Browser: alle 38 Seiten testen
```

### Phase 5: Final Cleanup

```
5.1 ESLint verify (keine disable comments):
    docker exec assixx-backend pnpm exec eslint frontend/src/scripts/components/navigation/

5.2 Type check:
    docker exec assixx-backend pnpm run type-check

5.3 MIGRATION-DESIGN-SYSTEM.md abhaken:
    - [x] unified-navigation.ts und css !

5.4 CSS Cleanup (optional):
    - Ungenutzte CSS-Regeln in unified-navigation.css entfernen
    - PurgeCSS oder manuell prüfen
```

---

## 4. Erfolgs-Kriterien

### Code Quality
- [ ] Kein `/* eslint-disable */` in neuen Dateien
- [ ] Alle Module < 500 Zeilen
- [ ] Keine inline styles (`style.` oder `style="..."`) - außer CSS Variables via `setProperty()`
- [ ] Keine `window.` exports (globals entfernt)
- [ ] Keine `onclick="..."` Handler (alles via `data-action`)
- [ ] Type check: 0 errors
- [ ] ESLint: 0 errors (ohne disable comments)

### Funktionalität (alle 38 Seiten testen)
- [ ] Navigation lädt korrekt
- [ ] Sidebar toggle funktioniert (collapsed/expanded)
- [ ] Submenus öffnen/schließen (data-action)
- [ ] Role switch funktioniert (Root: 3 Rollen, Admin: 2 Rollen)
- [ ] Role switch banner erscheint/verschwindet
- [ ] Badges werden angezeigt (Chat, KVP, etc.)
- [ ] Logout modal funktioniert (data-action)
- [ ] Active state wird korrekt gesetzt
- [ ] Storage widget zeigt korrekten Fortschritt (CSS Variables)
- [ ] Cross-tab sync (BroadcastChannel) funktioniert

---

## 5. Referenzen

**Bereits migrierte Module (als Muster):**
- `shifts/` → 23 Files (komplexestes Beispiel)
- `calendar/` → 8 Files
- `chat/` → 11 Files

**Wichtige Imports:**
```typescript
// Utils
import { apiClient } from '../../../utils/api-client';
import { tokenManager } from '../../../utils/token-manager';
import { $$, $all, setHTML } from '../../../utils/dom-utils';

// Auth
import { switchRoleForRoot, switchRoleForAdmin } from '../../auth/role-switch';
import { logout, loadUserInfo } from '../../auth/index';

// Services
import { SSEClient } from '../../utils/sse-client';

// Design System
import { getInitials, getColorClass } from '../../../design-system/primitives/avatar/avatar.js';
```

**CSS Utility Classes (Design System):**
```css
.u-hidden { display: none !important; }
.mr-2 { margin-right: 8px; }
```

---

## 6. Out of Scope

**Diese Dateien werden NICHT in diesem Refactoring bearbeitet:**

| Datei | Grund | TODO für später |
|-------|-------|-----------------|
| `auth/role-switch.ts` | Separate Funktionalität (API calls) | Hat 6+ inline styles die später gefixed werden sollten |
| `unified-navigation.css` | Nur neue Klassen hinzufügen, kein komplettes Refactoring | CSS-Cleanup in Phase 5.4 (optional) |

**Notiz für späteres Refactoring:**
```
auth/role-switch.ts inline styles (6 Stellen):
- Line 23-24: switchBtn.style.opacity
- Line 110: switchBtn.style.display
- Line 117: switchBtn.style.display
- Line 124: switchSelect.style.display
- Line 150-151: dropdownDisplay.style.pointerEvents/opacity
```

---

## 7. Risiken & Mitigations

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| 38 HTML-Files brechen nach sed | Niedrig | Git rollback, sed ist deterministisch |
| data-action events feuern nicht | Mittel | Event bubbling testen, closest() prüfen |
| Cross-tab sync bricht | Niedrig | BroadcastChannel ist browser-native |
| CSS Variables nicht unterstützt | Sehr niedrig | Alle modernen Browser unterstützen es |

**Rollback-Plan:**
```bash
# Bei Problemen:
git checkout -- frontend/src/scripts/components/unified-navigation.ts
git checkout -- frontend/src/pages/*.html
```
