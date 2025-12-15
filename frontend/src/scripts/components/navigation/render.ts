/**
 * Navigation Render Module
 * HTML generation functions for navigation components
 */

import type { NavItem, Role, TokenPayload } from './types';
import { CSS_CLASSES } from './constants';
import { getNavigationForRole } from './menu-config';
import { escapeHtml } from './utils';
import { getInitials, getColorClass } from '../../../design-system/primitives/avatar/avatar.js';

/**
 * Badge configuration map
 */
const BADGE_CONFIG = new Map<string, { className: string; id: string }>([
  ['unread-messages', { className: 'nav-badge', id: 'chat-unread-badge' }],
  ['pending-surveys', { className: 'nav-badge nav-badge-surveys', id: 'surveys-pending-badge' }],
  ['unread-documents', { className: 'nav-badge nav-badge-documents', id: 'documents-unread-badge' }],
  ['new-kvp-suggestions', { className: 'nav-badge nav-badge-kvp', id: 'kvp-badge' }],
  ['lean-management-parent', { className: 'nav-badge nav-badge-lean-parent', id: 'lean-management-badge' }],
  ['unread-calendar-events', { className: 'nav-badge', id: 'calendar-unread-badge' }],
]);

/**
 * Create badge HTML for navigation item
 */
export function createBadgeHtml(badge?: string): string {
  if (badge === undefined || badge === '') return '';

  const config = BADGE_CONFIG.get(badge);
  if (config === undefined) return '';

  return `<span class="${config.className} ${CSS_CLASSES.hidden}" id="${config.id}">0</span>`;
}

/**
 * Create badge HTML for submenu child item
 */
export function createChildBadgeHtml(child: NavItem): string {
  if (child.badgeId !== undefined) {
    return `<span class="nav-badge nav-badge-child nav-badge-child-default ${CSS_CLASSES.hidden}" id="${child.badgeId}">0</span>`;
  }
  if (child.badge === 'pending-surveys') {
    return `<span class="nav-badge nav-badge-child nav-badge-surveys ${CSS_CLASSES.hidden}" id="surveys-pending-badge">0</span>`;
  }
  if (child.badge === 'new-kvp-suggestions') {
    return `<span class="nav-badge nav-badge-child nav-badge-kvp ${CSS_CLASSES.hidden}" id="kvp-badge">0</span>`;
  }
  return '';
}

/**
 * Create submenu items HTML
 */
export function createSubmenuItems(submenu?: NavItem[]): string {
  if (!submenu || submenu.length === 0) return '';

  return submenu
    .map((child) => {
      const childBadgeHtml = createChildBadgeHtml(child);
      return `
        <li class="submenu-item">
          <a href="${child.url ?? '#'}" class="submenu-link" data-nav-id="${child.id}">
            <span class="submenu-label">${child.label}</span>
            ${childBadgeHtml}
          </a>
        </li>
      `;
    })
    .join('');
}

/**
 * Create submenu navigation item HTML
 */
export function createSubmenuItem(item: NavItem, activeClass: string, badgeHtml: string): string {
  const submenuItems = createSubmenuItems(item.submenu);
  return `
    <li class="sidebar-item has-submenu ${activeClass}">
      <a href="#" class="sidebar-link" data-action="toggle-submenu" data-nav-id="${item.id}">
        <span class="icon">${item.icon ?? ''}</span>
        <span class="label">${item.label}</span>
        <span class="nav-indicator"></span>
        <span class="submenu-arrow">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </span>
        ${badgeHtml}
      </a>
      <ul class="submenu ${CSS_CLASSES.hidden}" id="submenu-${item.id}">
        ${submenuItems}
      </ul>
    </li>
  `;
}

/**
 * Create children items HTML
 */
export function createChildrenItems(children?: NavItem[]): string {
  if (!children || children.length === 0) return '';

  return children
    .map(
      (child) => `
        <li class="submenu-item">
          <a href="${child.url ?? '#'}" class="submenu-link" data-nav-id="${child.id}">
            <span class="submenu-label">${child.label}</span>
          </a>
        </li>
      `,
    )
    .join('');
}

/**
 * Create children navigation item HTML
 */
export function createChildrenItem(item: NavItem, activeClass: string, badgeHtml: string): string {
  const childrenItems = createChildrenItems(item.children);
  return `
    <li class="sidebar-item has-submenu ${activeClass}">
      <a href="#" class="sidebar-link" data-action="toggle-submenu" data-nav-id="${item.id}">
        <span class="icon">${item.icon ?? ''}</span>
        <span class="label">${item.label}</span>
        <span class="nav-indicator"></span>
        <span class="submenu-arrow">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </span>
        ${badgeHtml}
      </a>
      <ul class="submenu ${CSS_CLASSES.hidden}" id="submenu-${item.id}">
        ${childrenItems}
      </ul>
    </li>
  `;
}

/**
 * Create simple menu item HTML (no submenu)
 */
export function createSimpleMenuItem(item: NavItem, activeClass: string, badgeHtml: string): string {
  return `
    <li class="sidebar-item ${activeClass}">
      <a href="${item.url ?? '#'}" class="sidebar-link" data-nav-id="${item.id}">
        <span class="icon">${item.icon ?? ''}</span>
        <span class="label">${item.label}</span>
        <span class="nav-indicator"></span>
        ${badgeHtml}
      </a>
    </li>
  `;
}

/**
 * Create menu item HTML (determines type and renders accordingly)
 */
export function createMenuItem(item: NavItem, isActive: boolean = false): string {
  const activeClass = isActive ? 'active' : '';
  const hasChildren = item.children && item.children.length > 0;
  const hasSubmenu = item.hasSubmenu === true && item.submenu !== undefined && item.submenu.length > 0;
  const badgeHtml = createBadgeHtml(item.badge);

  if (hasSubmenu) {
    return createSubmenuItem(item, activeClass, badgeHtml);
  }

  if (hasChildren === true) {
    return createChildrenItem(item, activeClass, badgeHtml);
  }

  return createSimpleMenuItem(item, activeClass, badgeHtml);
}

/**
 * Create storage widget HTML (only for root users)
 */
export function createStorageWidget(): string {
  return `
    <div class="storage-widget" id="storage-widget">
      <div class="storage-header">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,11H5V9H19M19,7H5V5H19M5,15H11V13H5M3,21H21A2,2 0 0,1 19,19V3A2,2 0 0,1 21,1H3A2,2 0 0,1 5,3V19A2,2 0 0,1 3,21Z"/>
        </svg>
        <span>Speicherplatz</span>
      </div>
      <div class="storage-info">
        <div class="storage-usage-text">
          <span id="storage-used">0 GB</span> von <span id="storage-total">0 GB</span>
        </div>
        <div class="storage-progress">
          <div class="storage-progress-bar ${CSS_CLASSES.progressBarDynamic}" id="storage-progress-bar"></div>
        </div>
        <div class="storage-percentage" id="storage-percentage">0% belegt</div>
      </div>
      <button class="storage-upgrade-btn" data-action="navigate-storage-upgrade">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
        </svg>
        Speicher erweitern
      </button>
    </div>
  `;
}

/**
 * Create logout modal HTML
 */
export function createLogoutModal(): string {
  return `
    <!-- Logout Confirmation Modal - Design System pattern -->
    <div id="logoutModal" class="modal-overlay">
      <div class="confirm-modal confirm-modal--info">
        <div class="confirm-modal__icon">
          <i class="fas fa-sign-out-alt"></i>
        </div>
        <h3 class="confirm-modal__title">Abmeldung bestätigen</h3>
        <p class="confirm-modal__message">
          Möchten Sie sich wirklich abmelden?<br>
          <small><i class="fas fa-info-circle"></i> Alle ungespeicherten Änderungen gehen verloren.</small>
        </p>
        <div class="confirm-modal__actions confirm-modal__actions--centered">
          <button class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide" id="cancelLogout">
            Abbrechen
          </button>
          <button class="btn btn-danger confirm-modal__btn--wide" id="confirmLogout">
            Abmelden
          </button>
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
  const bannerDismissedKey =
    activeRole !== null ? `roleSwitchBannerDismissed_${activeRole}` : 'roleSwitchBannerDismissed_default';
  const isBannerDismissed = localStorage.getItem(bannerDismissedKey) === 'true';

  if (!isRoleSwitched || isBannerDismissed) {
    return '';
  }

  const currentRoleText = activeRole === 'employee' ? 'Mitarbeiter' : activeRole === 'admin' ? 'Admin' : 'Root';
  const originalRoleText = storedUserRole === 'root' ? 'Root' : storedUserRole === 'admin' ? 'Admin' : 'Mitarbeiter';

  return `
    <!-- Role Switch Warning Banner -->
    <div class="role-switch-banner" id="role-switch-warning-banner">
      <div class="role-switch-banner-content">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" class="${CSS_CLASSES.marginRight2}">
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
 * Create root user role switch dropdown HTML
 */
export function createRootRoleSwitchDropdown(activeRole: string | null): string {
  const roleIcons = {
    root: 'manage_accounts',
    admin: 'supervisor_account',
    employee: 'person_apron',
  };

  const currentRole: 'root' | 'admin' | 'employee' =
    activeRole === 'root' ? 'root' : activeRole === 'admin' ? 'admin' : 'employee';
  const currentView =
    activeRole === 'root' ? 'Root-Ansicht' : activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht';
  // eslint-disable-next-line security/detect-object-injection -- currentRole is type-safe literal union
  const currentIcon = roleIcons[currentRole];

  return `
    <!-- Role Switch - EXACT Storybook Structure -->
    <div class="dropdown role-switch-dropdown">
      <div class="dropdown__trigger" id="roleSwitchDisplay">
        <span>
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">${currentIcon}</span>
          ${currentView}
        </span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" id="roleSwitchDropdown">
        <div class="dropdown__option ${activeRole === 'root' ? 'active' : ''}" data-value="root">
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">manage_accounts</span>
          Root-Ansicht
        </div>
        <div class="dropdown__option ${activeRole === 'admin' ? 'active' : ''}" data-value="admin">
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">supervisor_account</span>
          Admin-Ansicht
        </div>
        <div class="dropdown__option ${activeRole === 'employee' ? 'active' : ''}" data-value="employee">
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">person_apron</span>
          Mitarbeiter-Ansicht
        </div>
      </div>
    </div>
  `;
}

/**
 * Create admin user role switch dropdown HTML
 */
export function createAdminRoleSwitchDropdown(activeRole: string | null): string {
  const roleIcons = {
    admin: 'supervisor_account',
    employee: 'person_apron',
  };

  const currentRole: 'admin' | 'employee' = activeRole === 'admin' ? 'admin' : 'employee';
  const currentView = activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht';
  // eslint-disable-next-line security/detect-object-injection -- currentRole is type-safe literal union
  const currentIcon = roleIcons[currentRole];

  return `
    <!-- Role Switch - EXACT Storybook Structure -->
    <div class="dropdown role-switch-dropdown">
      <div class="dropdown__trigger" id="roleSwitchDisplay">
        <span>
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">${currentIcon}</span>
          ${currentView}
        </span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" id="roleSwitchDropdown">
        <div class="dropdown__option ${activeRole === 'admin' ? 'active' : ''}" data-value="admin">
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">supervisor_account</span>
          Admin-Ansicht
        </div>
        <div class="dropdown__option ${activeRole === 'employee' ? 'active' : ''}" data-value="employee">
          <span class="material-symbols-outlined ${CSS_CLASSES.marginRight2}">person_apron</span>
          Mitarbeiter-Ansicht
        </div>
      </div>
    </div>
  `;
}

/**
 * Create role switch dropdown based on user role
 */
export function createRoleSwitchDropdown(userRole: string, activeRole: string | null): string {
  if (userRole === 'root') {
    return createRootRoleSwitchDropdown(activeRole);
  }
  if (userRole === 'admin') {
    return createAdminRoleSwitchDropdown(activeRole);
  }
  return '';
}

/**
 * Create user avatar HTML
 */
export function createUserAvatar(
  profilePicture: string | null,
  firstName: string,
  lastName: string,
  uniqueId: string,
): string {
  const fullName = `${firstName} ${lastName}`.trim();

  if (profilePicture !== null && profilePicture !== '') {
    return `
      <div id="user-avatar" class="avatar avatar--sm">
        <img src="${profilePicture}" alt="${fullName}" class="avatar__image" />
      </div>
    `;
  }

  const colorClass = getColorClass(uniqueId);
  const initials = getInitials(fullName);

  return `
    <div id="user-avatar" class="avatar avatar--sm ${colorClass}">
      <span class="avatar__initials">${initials}</span>
    </div>
  `;
}

/**
 * Create header HTML
 */
export function createHeader(
  dashboardUrl: string,
  logoSrc: string,
  roleSwitchDropdown: string,
  userAvatar: string,
  displayName: string,
  isCollapsed: boolean,
): string {
  const togglePath = isCollapsed
    ? 'M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z'
    : 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z';

  return `
    <!-- Header -->
    <header class="header">
      <button class="sidebar-toggle" id="sidebar-toggle" title="Sidebar ein-/ausklappen">
        <svg class="toggle-icon" width="30" height="30" viewBox="0 0 24 24" fill="white">
          <path class="toggle-icon-path" d="${togglePath}"></path>
        </svg>
      </button>
      <a href="${dashboardUrl}" class="logo-container">
        <img src="${logoSrc}" alt="Assixx Logo" class="logo" id="header-logo" />
      </a>
      <div class="header-content">
        <div class="header-actions">
          ${roleSwitchDropdown}
          <span id="token-timer" class="token-timer">--:--</span>
          <div id="user-info">
            ${userAvatar}
            <span id="user-name">${escapeHtml(displayName)}</span>
          </div>
          <button id="logout-btn" class="btn btn-danger" data-action="logout" title="Abmelden">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </header>
  `;
}

/**
 * Create modals and banner HTML
 */
export function createModalsAndBanner(storedUserRole: string | null, activeRole: string | null): string {
  const warningBanner = createRoleSwitchBanner(storedUserRole, activeRole);

  return `
    ${createLogoutModal()}
    ${warningBanner}
  `;
}

/**
 * Create navigation HTML for sidebar
 */
export function createNavigationHTML(currentRole: Role | null, currentUser: TokenPayload | null): string {
  const menuItems = getNavigationForRole(currentRole);
  const storageWidget = currentRole === 'root' ? createStorageWidget() : '';

  const roleBadgeClass =
    currentRole === 'root' ? 'badge--danger' : currentRole === 'admin' ? 'badge--warning' : 'badge--info';
  const roleBadgeText = currentRole === 'root' ? 'Root' : currentRole === 'admin' ? 'Admin' : 'Mitarbeiter';

  return `
    <nav class="sidebar-nav">
      <ul class="sidebar-menu">
        ${menuItems.map((item, index) => createMenuItem(item, index === 0)).join('')}
      </ul>
      ${storageWidget}
    </nav>

    <div class="user-info-card" id="sidebar-user-info-card">
      <div id="sidebar-user-avatar" class="avatar avatar--md avatar--color-0">
        <span class="avatar__initials">U</span>
      </div>
      <div class="user-details">
        <div class="company-info">
          <div class="company-name" id="sidebar-company-name">Firmennamen lädt...</div>
        </div>
        <div class="user-name" id="sidebar-user-name">${currentUser?.email ?? 'User'}</div>
        <div class="user-full-name" id="sidebar-user-fullname"></div>
        <div class="user-position ${CSS_CLASSES.hidden}" id="sidebar-user-position"></div>
        <div class="user-employee-number" id="sidebar-employee-number"></div>
        <span id="role-indicator" class="badge badge--sm ${roleBadgeClass}">${roleBadgeText}</span>
      </div>
    </div>
  `;
}
