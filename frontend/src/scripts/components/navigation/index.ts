/* eslint-disable max-lines */
/**
 * Unified Navigation Component
 * Entry point that orchestrates all navigation modules
 */

import { $$, setHTML } from '../../../utils/dom-utils';
import { tokenManager } from '../../../utils/token-manager';
import { getInitials, getColorClass } from '../../../design-system/primitives/avatar/avatar.js';
import type { NavItem, TokenPayload, Role, UserProfileResponse } from './types';
import { DASHBOARD_URLS, SELECTORS, CSS_CLASSES, ACCESS_CONTROL } from './constants';
import { getNavigationItems, getNavigationForRole } from './menu-config';
import { parseTokenPayload, isMainDashboardPage, getActiveRole } from './utils';
import {
  createNavigationHTML,
  createHeader,
  createModalsAndBanner,
  createRoleSwitchDropdown,
  createUserAvatar,
} from './render';
import {
  initializeSSE,
  loadUserProfile,
  updateUnreadMessages,
  updateStorageInfo,
  updateCompanyInfo,
  updateUserInfo,
  updateEmployeeNumber,
  updateAdminPosition,
  updateHeaderUserName,
} from './services';
import {
  handleNavigationClick,
  handleLogout,
  setupRoleSwitchListener,
  setupStorageListener,
  setupTokenTimer,
  initializeEventDelegation,
  setupGlobalToggleSubmenu,
  setupGlobalDismissRoleBanner,
  storeParentSubmenuState,
  checkKvpSubmenuClick,
} from './handlers';
import {
  attachSidebarToggle,
  isCollapsed,
  restoreSidebarState,
  fixLogoNavigation,
  setupLogoVisibilityListener,
} from './sidebar';
import { initializeRoleSwitch } from './role-switch-ui';

/**
 * Unified Navigation Component
 * Orchestrates navigation rendering, state, and interactions
 */
class UnifiedNavigation {
  private currentUser: TokenPayload | null = null;
  private currentRole: Role | null = null;
  // @ts-expect-error: Reserved for future badge tracking feature
  private _navigationItems: ReturnType<typeof getNavigationItems>;
  private sidebarIsCollapsed = false;
  private userProfileData: UserProfileResponse | null = null;
  // @ts-expect-error: Reserved for KVP badge state persistence
  private _lastKvpClickTimestamp: number | null = null;
  // @ts-expect-error: Reserved for KVP badge state persistence
  private _lastKnownKvpCount = 0;
  private isEventListenerAttached = false;
  private documentClickHandler?: (e: MouseEvent) => void;
  private visibilityListenerAdded = false;

  constructor() {
    this._navigationItems = getNavigationItems();
    this.loadSavedState();
    this.init();
  }

  private loadSavedState(): void {
    const savedTimestamp = localStorage.getItem('lastKvpClickTimestamp');
    this._lastKvpClickTimestamp = savedTimestamp !== null ? Number.parseInt(savedTimestamp, 10) : null;
    const savedCount = localStorage.getItem('lastKnownKvpCount');
    this._lastKnownKvpCount = savedCount !== null ? Number.parseInt(savedCount, 10) : 0;
    this.sidebarIsCollapsed = isCollapsed();
  }

  /**
   * Check if role can access page
   */
  public canAccessPage(path: string, role: Role): boolean {
    const normalizedPath = (path.split('?')[0] ?? path).split('#')[0] ?? path;
    const allowedRoles = ACCESS_CONTROL.get(normalizedPath);
    if (allowedRoles) {
      return allowedRoles.includes(role);
    }
    return true;
  }

  /**
   * Get dashboard URL for role
   */
  public getDashboardForRole(role: Role): string {
    switch (role) {
      case 'root':
        return DASHBOARD_URLS.root;
      case 'admin':
        return DASHBOARD_URLS.admin;
      case 'employee':
        return DASHBOARD_URLS.employee;
      default:
        return DASHBOARD_URLS.employee;
    }
  }

  /**
   * Enforce page access based on role
   */
  public enforcePageAccess(): void {
    const currentPath = window.location.pathname;
    const activeRole = getActiveRole();

    if (!this.canAccessPage(currentPath, activeRole)) {
      const dashboard = this.getDashboardForRole(activeRole);
      window.location.href = dashboard;
    }
  }

  private init(): void {
    void tokenManager.refreshIfNeeded();
    this.setupInitialState();
    this.setupEventHandlers();
    initializeSSE();
    this.setupBadgeUpdates();
    setupRoleSwitchListener(() => {
      this.refresh();
    });
    setupStorageListener(() => {
      this.refresh();
    });
    setupTokenTimer();
    setupGlobalToggleSubmenu();
    setupGlobalDismissRoleBanner();
  }

  private setupInitialState(): void {
    this.sidebarIsCollapsed = isCollapsed();

    const currentPath = window.location.pathname;
    if (currentPath.includes('dashboard')) {
      localStorage.removeItem('openSubmenu');
    }

    this.enforcePageAccess();
    this.loadUserInfo();
    this.injectNavigationHTML();
  }

  private setupEventHandlers(): void {
    initializeEventDelegation();

    setTimeout(() => {
      fixLogoNavigation(this.currentRole);
      initializeRoleSwitch();
      if (!this.visibilityListenerAdded) {
        this.visibilityListenerAdded = true;
        setupLogoVisibilityListener(this.currentRole);
      }
    }, 100);
  }

  private setupBadgeUpdates(): void {
    setTimeout(() => {
      void updateUnreadMessages();
    }, 1000);

    setInterval(() => {
      void updateUnreadMessages();
    }, 600000);
  }

  private loadUserInfo(): void {
    const payload = parseTokenPayload() as (TokenPayload & { activeRole?: string; isRoleSwitched?: boolean }) | null;
    if (payload === null) {
      return;
    }

    this.currentUser = payload;

    const currentPath = window.location.pathname;
    const dashboardType = this.getDashboardTypeFromPath(currentPath);
    const storedUserRole = localStorage.getItem('userRole');

    this.currentRole = this.determineActiveRole(dashboardType, payload);
    this.updateActiveRoleInStorage(dashboardType, storedUserRole);

    void this.loadFullUserProfile();
  }

  private getDashboardTypeFromPath(path: string): Role | null {
    if (path.includes(DASHBOARD_URLS.root)) return 'root';
    if (path.includes(DASHBOARD_URLS.admin)) return 'admin';
    if (path.includes(DASHBOARD_URLS.employee)) return 'employee';
    return null;
  }

  private determineActiveRole(dashboardType: Role | null, payload: TokenPayload & { activeRole?: string }): Role {
    if (dashboardType !== null) return dashboardType;

    if (payload.activeRole !== undefined) {
      return payload.activeRole as Role;
    }

    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && ['root', 'admin', 'employee'].includes(activeRole)) {
      return activeRole as Role;
    }

    return payload.role;
  }

  private updateActiveRoleInStorage(dashboardType: Role | null, storedUserRole: string | null): void {
    if (dashboardType === 'root' && storedUserRole === 'root') {
      localStorage.setItem('activeRole', 'root');
    } else if (dashboardType === 'admin' && (storedUserRole === 'root' || storedUserRole === 'admin')) {
      localStorage.setItem('activeRole', 'admin');
    } else if (dashboardType === 'employee') {
      localStorage.setItem('activeRole', 'employee');
    }
  }

  private async loadFullUserProfile(): Promise<void> {
    const userData = await loadUserProfile();
    if (userData === null) return;

    updateCompanyInfo(userData);
    updateUserInfo(userData);
    updateEmployeeNumber(userData);
    updateAdminPosition(userData, this.currentRole);
    updateHeaderUserName(userData);
    this.updateAvatars(userData);

    this.userProfileData = userData;
  }

  private updateAvatars(userData: UserProfileResponse): void {
    const profilePic = this.extractProfilePicture(userData);
    const firstName = userData.firstName ?? userData.data?.firstName ?? '';
    const lastName = userData.lastName ?? userData.data?.lastName ?? '';

    const sidebarAvatar = $$('#sidebar-user-avatar');
    if (sidebarAvatar) {
      this.updateAvatarElement(sidebarAvatar, profilePic, firstName, lastName);
    }

    const headerAvatar = $$('#user-avatar');
    if (headerAvatar) {
      this.updateAvatarElement(headerAvatar, profilePic, firstName, lastName);
    }
  }

  private extractProfilePicture(userData: UserProfileResponse): string | null {
    return userData.data?.profilePicture ?? userData.profilePicture ?? null;
  }

  private updateAvatarElement(
    element: HTMLElement,
    profilePicUrl: string | null,
    firstName?: string,
    lastName?: string,
  ): void {
    element.innerHTML = '';

    const uniqueId = String(this.userProfileData?.id ?? this.userProfileData?.email ?? 'default');
    const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();

    if (profilePicUrl !== null && profilePicUrl !== '') {
      element.className = 'avatar avatar--md';
      const img = document.createElement('img');
      img.src = profilePicUrl;
      img.alt = fullName !== '' ? fullName : 'Avatar';
      img.className = 'avatar__image';
      element.appendChild(img);
    } else {
      const colorClass = getColorClass(uniqueId);
      const initials = getInitials(fullName !== '' ? fullName : uniqueId !== '' ? uniqueId : 'User');

      element.className = `avatar avatar--md ${colorClass}`;
      const initialsSpan = document.createElement('span');
      initialsSpan.className = 'avatar__initials';
      initialsSpan.textContent = initials;
      element.appendChild(initialsSpan);
    }
  }

  private injectNavigationHTML(): void {
    const navigation = createNavigationHTML(this.currentRole, this.currentUser);

    const navigationContainer = document.querySelector('#navigation-container');
    if (navigationContainer) {
      const existingHeader = document.querySelector('.header');
      if (!existingHeader) {
        const headerHTML = this.createHeaderOnly();
        // eslint-disable-next-line no-unsanitized/method -- Safe: headerHTML is internally generated
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
      }

      const modalsAndBanner = this.createModalsAndBannerHTML();
      setHTML(navigationContainer as HTMLElement, modalsAndBanner);

      this.injectSidebarIntoLayout(navigation);
      this.updateActiveNavigation();

      setTimeout(() => {
        if (!this.isEventListenerAttached) {
          this.attachEventListeners();
        }
      }, 100);

      return;
    }

    const existingSidebar = document.querySelector(SELECTORS.sidebar);
    if (existingSidebar) {
      setHTML(existingSidebar as HTMLElement, navigation);
    } else {
      this.createSidebarStructure(navigation);
    }
  }

  private injectSidebarIntoLayout(navigation: string): void {
    let layoutContainer = document.querySelector('.layout-container');

    if (!layoutContainer) {
      layoutContainer = document.createElement('div');
      layoutContainer.className = 'layout-container';

      const mainContent = document.querySelector(SELECTORS.mainContent);
      if (mainContent !== null && mainContent.parentElement?.classList.contains('layout-container') !== true) {
        document.body.append(layoutContainer);
        layoutContainer.append(mainContent);
      }
    }

    let sidebar = layoutContainer.querySelector(SELECTORS.sidebar);

    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.className = `sidebar ${this.sidebarIsCollapsed ? 'collapsed' : ''}`;
      layoutContainer.insertBefore(sidebar, layoutContainer.firstChild);
    }

    setHTML(sidebar as HTMLElement, navigation);
  }

  private createHeaderOnly(): string {
    const storedUserRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole') ?? storedUserRole;
    const userRole = storedUserRole ?? 'employee';

    const userName = this.userProfileData?.username ?? this.currentUser?.username ?? 'User';
    const firstName = this.userProfileData?.firstName ?? '';
    const lastName = this.userProfileData?.lastName ?? '';
    const displayName = firstName !== '' && lastName !== '' ? `${firstName} ${lastName}` : userName;
    let profilePicture = this.userProfileData?.profilePicture ?? null;
    if (profilePicture === '') profilePicture = null;

    const dashboardUrl =
      storedUserRole === 'root' ? 'root-dashboard' : userRole === 'admin' ? 'admin-dashboard' : 'employee-dashboard';
    const logoSrc = this.sidebarIsCollapsed ? '/assets/images/logo_collapsed.png' : '/assets/images/logo.png';

    const uniqueId = String(this.userProfileData?.id ?? this.userProfileData?.email ?? 'default');
    const roleSwitchDropdown = createRoleSwitchDropdown(userRole, activeRole);
    const userAvatar = createUserAvatar(profilePicture, firstName, lastName, uniqueId);

    return createHeader(dashboardUrl, logoSrc, roleSwitchDropdown, userAvatar, displayName, this.sidebarIsCollapsed);
  }

  private createModalsAndBannerHTML(): string {
    const storedUserRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole') ?? storedUserRole;
    return createModalsAndBanner(storedUserRole, activeRole);
  }

  private createSidebarStructure(navigation: string): void {
    const existingLayout = document.querySelector('.layout-container');

    if (!existingLayout) {
      const header = document.querySelector('.header');
      const container = document.querySelector('.container');

      const layoutContainer = document.createElement('div');
      layoutContainer.className = 'layout-container';

      const sidebar = document.createElement('aside');
      sidebar.className = 'sidebar';
      setHTML(sidebar, navigation);

      const mainContent = document.createElement('main');
      mainContent.className = 'main-content';
      if (container) {
        mainContent.append(container);
      }

      layoutContainer.append(sidebar);
      layoutContainer.append(mainContent);

      if (header) {
        document.body.insertBefore(layoutContainer, header.nextSibling);
      } else {
        document.body.append(layoutContainer);
      }
    }
  }

  private attachEventListeners(): void {
    console.log('[Navigation] attachEventListeners called');

    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.isEventListenerAttached = false;
    }

    this.documentClickHandler = (e: MouseEvent): void => {
      this.handleNavLinkClick(e);
      this.handleSubmenuLinkClick(e);
      this.handleLogoutClick(e);
    };

    document.addEventListener('click', this.documentClickHandler);
    this.isEventListenerAttached = true;
    console.log('[Navigation] Document click handler attached');

    const logoutBtnCheck = $$('#logout-btn');
    console.log('[Navigation] logout-btn found:', logoutBtnCheck !== null, logoutBtnCheck);

    if (logoutBtnCheck) {
      logoutBtnCheck.onclick = (e: MouseEvent): void => {
        console.log('[Navigation] Logout button onclick triggered');
        e.preventDefault();
        e.stopPropagation();
        void handleLogout();
      };
      console.log('[Navigation] Direct onclick attached to logout-btn');
    } else {
      console.warn('[Navigation] WARNING: #logout-btn NOT FOUND in DOM!');
    }

    attachSidebarToggle((newState) => {
      this.sidebarIsCollapsed = newState;
    });

    initializeRoleSwitch();
  }

  private handleNavLinkClick(e: MouseEvent): void {
    const navLink = (e.target as HTMLElement).closest('.sidebar-link:not([onclick])');
    if (navLink) {
      handleNavigationClick(navLink as HTMLElement, this.currentRole);
    }
  }

  private handleSubmenuLinkClick(e: MouseEvent): void {
    const submenuLink = (e.target as HTMLElement).closest('.submenu-link');
    if (!(submenuLink instanceof HTMLElement)) {
      return;
    }

    storeParentSubmenuState(submenuLink);
    checkKvpSubmenuClick(submenuLink, this.currentRole);
  }

  private handleLogoutClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const logoutBtn = target.closest('#logout-btn');

    if (!logoutBtn) {
      return;
    }

    console.log('[Navigation] handleLogoutClick triggered via document handler');
    e.preventDefault();
    e.stopPropagation();
    void handleLogout();
  }

  private updateActiveNavigation(): void {
    const activeNav = localStorage.getItem('activeNavigation');
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash.substring(1);

    const targetElement = isMainDashboardPage(currentPath)
      ? this.findTargetForDashboardPage(currentHash, activeNav)
      : this.findTargetForNonDashboardPage(currentPath, activeNav);

    if (targetElement !== null) {
      this.applyActiveState(targetElement, currentPath);
    }

    this.updateSubmenuStates();
  }

  private findTargetForDashboardPage(currentHash: string, activeNav: string | null): Element | null {
    if (currentHash !== '' && currentHash !== 'dashboard') {
      return document.querySelector(`[data-nav-id="${currentHash}"]`);
    }

    if (activeNav === null || activeNav === '' || activeNav === 'dashboard') {
      return document.querySelector('[data-nav-id="dashboard"]');
    }

    return null;
  }

  private findTargetForNonDashboardPage(currentPath: string, activeNav: string | null): Element | null {
    const detected = this.findActivePageElement(currentPath);
    if (detected !== null) {
      return detected;
    }

    if (activeNav !== null && activeNav !== '' && activeNav !== 'dashboard') {
      return document.querySelector(`[data-nav-id="${activeNav}"]`);
    }

    return null;
  }

  private applyActiveState(targetElement: Element, currentPath: string): void {
    document.querySelectorAll(SELECTORS.sidebarItem).forEach((item) => {
      item.classList.remove('active');
    });

    targetElement.closest(SELECTORS.sidebarItem)?.classList.add('active');

    if (!isMainDashboardPage(currentPath)) {
      localStorage.removeItem('activeNavigation');
    }
  }

  private updateSubmenuStates(): void {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');

    this.closeAllSubmenus();

    const isDashboard = currentPath.includes('dashboard');
    let foundActiveSubmenu = false;

    if (isDashboard && section !== null && section !== '') {
      foundActiveSubmenu = this.handleDashboardSection(section);
    }

    if (!foundActiveSubmenu && !isDashboard) {
      foundActiveSubmenu = this.handleDirectSubmenuPages(currentPath);
    }

    if (!foundActiveSubmenu) {
      localStorage.removeItem('openSubmenu');
    }

    this.restorePreviousSubmenu(foundActiveSubmenu);
  }

  private closeAllSubmenus(): void {
    document.querySelectorAll(SELECTORS.submenu).forEach((submenu) => {
      submenu.classList.add(CSS_CLASSES.hidden);
      submenu.classList.remove(CSS_CLASSES.submenuOpen);
      submenu.closest(SELECTORS.sidebarItem)?.classList.remove('open');
    });

    document.querySelectorAll('.submenu-item').forEach((item) => {
      item.classList.remove('active');
    });

    document.querySelectorAll('.submenu-link').forEach((link) => {
      link.classList.remove('active');
    });
  }

  private handleDashboardSection(section: string): boolean {
    const menuItems = getNavigationForRole(this.currentRole);
    const menuItem = menuItems.find((item) => item.id === section);

    if (!menuItem) return false;

    const hasSubmenu = menuItem.hasSubmenu === true;
    const hasChildren = menuItem.children !== undefined && menuItem.children.length > 0;

    if (!hasSubmenu && !hasChildren) return false;

    const submenu = document.querySelector(`#submenu-${section}`);
    const parentItem = submenu?.closest('.sidebar-item.has-submenu');

    if (!(submenu instanceof HTMLElement) || !parentItem) return false;

    submenu.classList.remove(CSS_CLASSES.hidden);
    submenu.classList.add(CSS_CLASSES.submenuOpen);
    parentItem.classList.add('open');
    localStorage.setItem('openSubmenu', section);

    if (menuItem.children && menuItem.children.length > 0) {
      const firstChildLink = submenu.querySelector('.submenu-link');
      if (firstChildLink) {
        firstChildLink.classList.add('active');
        firstChildLink.closest('.submenu-item')?.classList.add('active');
      }
    }

    return true;
  }

  private handleDirectSubmenuPages(currentPath: string): boolean {
    let foundActiveSubmenu = false;

    document.querySelectorAll('.submenu-link').forEach((link) => {
      if (foundActiveSubmenu) return;

      const linkElement = link as HTMLAnchorElement;
      try {
        const linkPath = new URL(linkElement.href, window.location.origin).pathname;
        if (currentPath === linkPath) {
          foundActiveSubmenu = true;
          this.activateSubmenuLink(link);
        }
      } catch {
        console.warn('Invalid submenu URL:', linkElement.href);
      }
    });

    return foundActiveSubmenu;
  }

  private activateSubmenuLink(link: Element): void {
    link.classList.add('active');
    link.closest('.submenu-item')?.classList.add('active');

    const submenu = link.closest(SELECTORS.submenu);
    const parentItem = submenu?.closest('.sidebar-item.has-submenu');

    if (submenu && parentItem) {
      submenu.classList.remove(CSS_CLASSES.hidden);
      submenu.classList.add(CSS_CLASSES.submenuOpen);
      parentItem.classList.add('open');
      parentItem.classList.add('active');

      const parentLink = parentItem.querySelector<HTMLElement>('.sidebar-link');
      const parentId = parentLink?.dataset['navId'];
      if (parentId !== undefined && parentId !== '') {
        localStorage.setItem('openSubmenu', parentId);
      }
    }
  }

  private restorePreviousSubmenu(foundActiveSubmenu: boolean): void {
    if (foundActiveSubmenu) return;

    const storedSubmenu = localStorage.getItem('openSubmenu');
    if (storedSubmenu === null || storedSubmenu === '') return;

    const submenu = document.querySelector(`#submenu-${storedSubmenu}`);
    const parentItem = submenu?.closest('.sidebar-item.has-submenu');

    if (submenu instanceof HTMLElement && parentItem?.classList.contains('active') === true) {
      submenu.classList.remove(CSS_CLASSES.hidden);
      submenu.classList.add(CSS_CLASSES.submenuOpen);
      parentItem.classList.add('open');
    }
  }

  private findActivePageElement(currentPath: string): Element | null {
    const menuItems = getNavigationForRole(this.currentRole);

    for (const item of menuItems) {
      const nestedItems = item.children ?? item.submenu ?? [];

      for (const child of nestedItems) {
        if (this.isValidChildUrl(child) && currentPath === child.url) {
          return document.querySelector(`[data-nav-id="${child.id}"]`);
        }
      }
    }

    const matchingItem = menuItems.find((item: NavItem) => {
      if (item.url === undefined || item.url === '' || item.url.startsWith('#')) {
        return false;
      }

      if (item.url.startsWith('/')) {
        return currentPath === item.url;
      }

      return currentPath.includes(item.url.replace('/', ''));
    });

    if (matchingItem !== undefined) {
      return document.querySelector(`[data-nav-id="${matchingItem.id}"]`);
    }

    return null;
  }

  private isValidChildUrl(child: NavItem): boolean {
    return child.url !== undefined && child.url !== '' && !child.url.startsWith('#') && child.url.startsWith('/');
  }

  /**
   * Refresh navigation
   */
  public refresh(): void {
    this.loadUserInfo();

    const navigationContainer = document.querySelector('#navigation-container');
    if (navigationContainer) {
      const existingHeader = document.querySelector('.header');
      if (existingHeader) {
        existingHeader.remove();
      }
      const headerHTML = this.createHeaderOnly();
      // eslint-disable-next-line no-unsanitized/method -- Safe: headerHTML is internally generated
      document.body.insertAdjacentHTML('afterbegin', headerHTML);

      const modalsAndBanner = this.createModalsAndBannerHTML();
      setHTML(navigationContainer as HTMLElement, modalsAndBanner);

      const navigation = createNavigationHTML(this.currentRole, this.currentUser);
      this.injectSidebarIntoLayout(navigation);

      setTimeout(() => {
        if (!this.isEventListenerAttached) {
          this.attachEventListeners();
        }
        this.updateActiveNavigation();
        restoreSidebarState();
      }, 100);
    } else {
      this.injectNavigationHTML();
      this.updateActiveNavigation();
    }
  }

  /**
   * Set active navigation item
   */
  public setActive(navId: string): void {
    localStorage.setItem('activeNavigation', navId);
    this.updateActiveNavigation();
  }

  /**
   * Update unread messages badge
   */
  public async updateUnreadMessages(): Promise<void> {
    await updateUnreadMessages();
  }

  /**
   * Update storage info
   */
  public async updateStorageInfo(): Promise<void> {
    await updateStorageInfo(this.currentRole);
  }

  // Badge update stubs for SSE compatibility - methods kept empty for API compatibility
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- SSE stub for backwards compatibility
  public updateUnreadCalendarEvents(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- SSE stub for backwards compatibility
  public updateNewKvpSuggestions(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- SSE stub for backwards compatibility
  public updatePendingSurveys(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- SSE stub for backwards compatibility
  public updateUnreadDocuments(): void {}
}

// Global window interface for navigation (required for SSE client calls)
interface NavigationWindowExtension {
  UnifiedNavigation?: typeof UnifiedNavigation;
  unifiedNav?: UnifiedNavigation;
}

// Export to window for SSE client compatibility
const navWindow = window as unknown as NavigationWindowExtension;
navWindow.UnifiedNavigation = UnifiedNavigation;

// Auto-initialize navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    navWindow.unifiedNav = new UnifiedNavigation();
  });
} else {
  // DOM already loaded, initialize immediately
  navWindow.unifiedNav = new UnifiedNavigation();
}

export default UnifiedNavigation;
export { UnifiedNavigation };
