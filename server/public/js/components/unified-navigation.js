/**
 * Unified Navigation Component für alle Dashboards
 * Verwendet rolle-basierte Menüs mit Glassmorphismus-Design
 */

class UnifiedNavigation {
    constructor() {
        this.currentUser = null;
        this.currentRole = null;
        this.navigationItems = this.getNavigationItems();
        this.init();
    }

    init() {
        this.loadUserInfo();
        this.injectNavigationHTML();
        this.attachEventListeners();
    }

    loadUserInfo() {
        // User-Info aus Token oder Session laden
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                this.currentUser = payload;
                this.currentRole = payload.role;
            } catch (error) {
                console.error('Error parsing token:', error);
            }
        }
    }

    getNavigationItems() {
        return {
            // Admin Navigation (14 Items)
            admin: [
                { id: 'dashboard', icon: this.getSVGIcon('home'), label: 'Übersicht', url: '/admin-dashboard.html', section: 'dashboard' },
                { id: 'employees', icon: this.getSVGIcon('users'), label: 'Mitarbeiter', url: '#employees', section: 'employees' },
                { id: 'documents', icon: this.getSVGIcon('document'), label: 'Dokumente', url: '#documents', section: 'documents' },
                { id: 'blackboard', icon: this.getSVGIcon('blackboard'), label: 'Blackboard', url: '/blackboard.html' },
                { id: 'calendar', icon: this.getSVGIcon('calendar'), label: 'Kalender', url: '/calendar.html' },
                { id: 'shifts', icon: this.getSVGIcon('clock'), label: 'Schichtplanung', url: '/shifts.html' },
                { id: 'chat', icon: this.getSVGIcon('chat'), label: 'Chat', url: '/chat.html' },
                { id: 'kvp', icon: this.getSVGIcon('lightbulb'), label: 'KVP System', url: '/kvp.html' },
                { id: 'surveys', icon: this.getSVGIcon('poll'), label: 'Umfragen', url: '/survey-admin.html' },
                { id: 'payslips', icon: this.getSVGIcon('money'), label: 'Gehaltsabrechnungen', url: '#payslips', section: 'payslips' },
                { id: 'departments', icon: this.getSVGIcon('building'), label: 'Abteilungen', url: '#departments', section: 'departments' },
                { id: 'teams', icon: this.getSVGIcon('team'), label: 'Teams', url: '#teams', section: 'teams' },
                { id: 'settings', icon: this.getSVGIcon('settings'), label: 'Einstellungen', url: '#settings', section: 'settings' },
                { id: 'features', icon: this.getSVGIcon('feature'), label: 'Feature Management', url: '/admin/feature-management.html' }
            ],
            
            // Employee Navigation (9 Items)
            employee: [
                { id: 'dashboard', icon: this.getSVGIcon('home'), label: 'Dashboard', url: '/employee-dashboard.html' },
                { id: 'documents', icon: this.getSVGIcon('document'), label: 'Meine Dokumente', url: '/employee-documents.html' },
                { id: 'blackboard', icon: this.getSVGIcon('blackboard'), label: 'Blackboard', url: '/blackboard.html' },
                { id: 'calendar', icon: this.getSVGIcon('calendar'), label: 'Kalender', url: '/calendar.html' },
                { id: 'chat', icon: this.getSVGIcon('chat'), label: 'Chat', url: '/chat.html' },
                { id: 'shifts', icon: this.getSVGIcon('clock'), label: 'Schichtplanung', url: '/shifts.html' },
                { id: 'kvp', icon: this.getSVGIcon('lightbulb'), label: 'KVP System', url: '/kvp.html' },
                { id: 'surveys', icon: this.getSVGIcon('poll'), label: 'Umfragen', url: '/survey-employee.html' },
                { id: 'profile', icon: this.getSVGIcon('user'), label: 'Mein Profil', url: '/profile.html' }
            ],
            
            // Root Navigation (erweitert)
            root: [
                { id: 'dashboard', icon: this.getSVGIcon('home'), label: 'Root Dashboard', url: '/root-dashboard.html' },
                { id: 'admins', icon: this.getSVGIcon('admin'), label: 'Administratoren', url: '#admins', section: 'admins' },
                { id: 'tenants', icon: this.getSVGIcon('building'), label: 'Firmen', url: '#tenants', section: 'tenants' },
                { id: 'features', icon: this.getSVGIcon('feature'), label: 'Features', url: '/root-features.html' },
                { id: 'profile', icon: this.getSVGIcon('user'), label: 'Mein Profil', url: '/root-profile.html' },
                { id: 'system', icon: this.getSVGIcon('settings'), label: 'System', url: '#system', section: 'system' }
            ]
        };
    }

    getSVGIcon(name) {
        const icons = {
            home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
            users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
            user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
            document: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>',
            blackboard: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
            calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>',
            clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
            chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
            lightbulb: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17h8v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>',
            money: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
            building: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,3L1,9V21H23V9M21,19H3V10.53L12,5.68L21,10.53M8,15H10V19H8M12,15H14V19H12M16,15H18V19H16Z"/></svg>',
            team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
            settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>',
            feature: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19,8L15,12H18C18,15.31 15.31,18 12,18C10.99,18 10.03,17.75 9.2,17.3L7.74,18.76C8.97,19.54 10.43,20 12,20C16.42,20 20,16.42 20,12H23M6,12C6,8.69 8.69,6 12,6C13.01,6 13.97,6.25 14.8,6.7L16.26,5.24C15.03,4.46 13.57,4 12,4C7.58,4 4,7.58 4,12H1L5,16L9,12"/></svg>',
            admin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H9.2V10C9.2,8.6 10.6,7 12,7M8.2,16V13H15.8V16H8.2Z"/></svg>',
            poll: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3,22V8H7V22H3M10,22V2H14V22H10M17,22V14H21V22H17Z"/></svg>'
        };
        return icons[name] || icons.home;
    }

    getNavigationForRole(role) {
        return this.navigationItems[role] || [];
    }

    injectNavigationHTML() {
        const navigation = this.createNavigationHTML();
        
        // Suche nach bestehender Sidebar und ersetze sie
        const existingSidebar = document.querySelector('.sidebar');
        if (existingSidebar) {
            existingSidebar.innerHTML = navigation;
        } else {
            // Erstelle neue Sidebar falls keine existiert
            this.createSidebarStructure();
        }
    }

    createSidebarStructure() {
        const body = document.body;
        const existingLayout = document.querySelector('.layout-container');
        
        if (!existingLayout) {
            // Erstelle Layout-Container falls nicht vorhanden
            const header = document.querySelector('.header');
            const container = document.querySelector('.container');
            
            const layoutContainer = document.createElement('div');
            layoutContainer.className = 'layout-container';
            
            const sidebar = document.createElement('aside');
            sidebar.className = 'sidebar';
            sidebar.innerHTML = this.createNavigationHTML();
            
            const mainContent = document.createElement('main');
            mainContent.className = 'main-content';
            if (container) {
                mainContent.appendChild(container);
            }
            
            layoutContainer.appendChild(sidebar);
            layoutContainer.appendChild(mainContent);
            
            if (header) {
                body.insertBefore(layoutContainer, header.nextSibling);
            } else {
                body.appendChild(layoutContainer);
            }
        }
    }

    createNavigationHTML() {
        const menuItems = this.getNavigationForRole(this.currentRole);
        
        return `
            <nav class="sidebar-nav">
                <h3 class="sidebar-title">
                    <span class="title-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,8L8,12L12,16L16,12L12,8Z"/>
                        </svg>
                    </span>
                    Navigation
                </h3>
                <div class="user-info-card">
                    <div class="user-avatar">${this.getUserInitials()}</div>
                    <div class="user-details">
                        <div class="user-name">${this.currentUser?.username || 'User'}</div>
                        <div class="user-role">${this.getRoleDisplay()}</div>
                    </div>
                </div>
                <ul class="sidebar-menu">
                    ${menuItems.map((item, index) => this.createMenuItem(item, index === 0)).join('')}
                </ul>
            </nav>
        `;
    }

    createMenuItem(item, isActive = false) {
        const activeClass = isActive ? 'active' : '';
        const clickHandler = item.section ? `onclick="showSection('${item.section}')"` : '';
        
        return `
            <li class="sidebar-item ${activeClass}">
                <a href="${item.url}" class="sidebar-link" ${clickHandler} data-nav-id="${item.id}">
                    <span class="icon">${item.icon}</span>
                    <span class="label">${item.label}</span>
                    <span class="nav-indicator"></span>
                </a>
            </li>
        `;
    }

    getUserInitials() {
        if (!this.currentUser?.username) return '👤';
        return this.currentUser.username.charAt(0).toUpperCase();
    }

    getRoleDisplay() {
        const roleMap = {
            'admin': 'Administrator',
            'employee': 'Mitarbeiter',
            'root': 'Root User'
        };
        return roleMap[this.currentRole] || this.currentRole;
    }

    attachEventListeners() {
        // Navigation Link Clicks
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('.sidebar-link');
            if (navLink) {
                this.handleNavigationClick(navLink, e);
            }

            // Logout Button Click
            if (e.target && e.target.id === 'logout-btn') {
                this.handleLogout();
            }
        });

        // Update active state on page load
        this.updateActiveNavigation();
    }

    handleLogout() {
        // Remove token and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('activeNavigation');
        
        // Clear user session
        sessionStorage.clear();
        
        // Redirect to login page
        window.location.href = '/login.html';
    }

    handleNavigationClick(link, event) {
        // Update active state
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        link.closest('.sidebar-item').classList.add('active');

        // Store active navigation
        const navId = link.dataset.navId;
        if (navId) {
            localStorage.setItem('activeNavigation', navId);
        }

        // Add navigation animation
        this.animateNavigation(link);
    }

    updateActiveNavigation() {
        const activeNav = localStorage.getItem('activeNavigation');
        const currentPath = window.location.pathname;
        
        // Remove all active states
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });

        // Set active based on current page or stored state
        if (activeNav) {
            const activeLink = document.querySelector(`[data-nav-id="${activeNav}"]`);
            if (activeLink) {
                activeLink.closest('.sidebar-item').classList.add('active');
            }
        } else {
            // Auto-detect active page
            this.autoDetectActivePage(currentPath);
        }
    }

    autoDetectActivePage(currentPath) {
        const menuItems = this.getNavigationForRole(this.currentRole);
        const matchingItem = menuItems.find(item => {
            if (item.url.startsWith('#')) return false;
            return currentPath.includes(item.url.replace('/', ''));
        });

        if (matchingItem) {
            const link = document.querySelector(`[data-nav-id="${matchingItem.id}"]`);
            if (link) {
                link.closest('.sidebar-item').classList.add('active');
            }
        }
    }

    animateNavigation(link) {
        // Add ripple effect
        const ripple = document.createElement('span');
        ripple.className = 'nav-ripple';
        link.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    // Public method to refresh navigation
    refresh() {
        this.loadUserInfo();
        this.injectNavigationHTML();
        this.attachEventListeners();
    }

    // Public method to set active navigation
    setActive(navId) {
        localStorage.setItem('activeNavigation', navId);
        this.updateActiveNavigation();
    }
}

// CSS Styles für die Unified Navigation
const unifiedNavigationCSS = `
    .header .header-actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
    }

    .header .header-actions #user-info {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        background: rgba(255, 255, 255, 0.1);
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .header .header-actions #user-info::before {
        content: "";
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
    }

    .sidebar {
        width: 280px;
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(20px);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        min-height: 100vh;
        position: fixed;
        left: 0;
        top: 60px;
        z-index: 100;
        transition: all 0.3s ease;
    }

    .sidebar-nav {
        padding: var(--spacing-md);
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .sidebar-title {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 var(--spacing-lg) 0;
        padding: var(--spacing-sm) var(--spacing-md);
        background: rgba(33, 150, 243, 0.1);
        border-radius: var(--radius-md);
        border: 1px solid rgba(33, 150, 243, 0.2);
    }

    .title-icon {
        font-size: 1rem;
    }

    .user-info-card {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        background: rgba(255, 255, 255, 0.05);
        border-radius: var(--radius-md);
        border: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: var(--spacing-lg);
    }

    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
    }

    .user-details {
        flex: 1;
    }

    .user-name {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.85rem;
        margin-bottom: 2px;
    }

    .user-role {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .sidebar-menu {
        list-style: none;
        padding: 0;
        margin: 0;
        flex: 1;
    }

    .sidebar-item {
        margin-bottom: var(--spacing-xs);
    }

    .sidebar-link {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm) var(--spacing-md);
        color: var(--text-secondary);
        text-decoration: none;
        border-radius: 18px;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
        border: 1px solid transparent;
        font-size: 0.9rem;
    }

    .sidebar-link:hover {
        background: rgba(33, 150, 243, 0.1);
        color: var(--primary-color);
        transform: translateY(-2px);
        border-color: rgba(33, 150, 243, 0.2);
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
    }

    .sidebar-item.active .sidebar-link {
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.08));
        color: var(--primary-color);
        border-color: rgba(33, 150, 243, 0.3);
        box-shadow: 0 4px 20px rgba(33, 150, 243, 0.2);
    }

    .sidebar-link .icon {
        min-width: 20px;
        text-align: center;
        transition: all 0.3s ease;
    }

    .sidebar-link .label {
        font-weight: 500;
        flex: 1;
    }

    .nav-indicator {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: transparent;
        transition: all 0.3s ease;
    }

    .sidebar-item.active .nav-indicator {
        background: var(--primary-color);
        box-shadow: 0 0 6px rgba(33, 150, 243, 0.6);
    }

    .nav-ripple {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(33, 150, 243, 0.3);
        transform: translate(-50%, -50%);
        animation: ripple 0.6s ease-out;
    }

    @keyframes ripple {
        to {
            width: 200px;
            height: 200px;
            opacity: 0;
        }
    }

    /* Layout adjustments */
    .layout-container {
        display: flex;
        min-height: calc(100vh - 60px);
        margin-top: 60px;
    }

    .main-content {
        flex: 1;
        margin-left: 280px;
        padding: var(--spacing-xl);
        background: var(--background-primary);
        min-height: calc(100vh - 60px);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .sidebar {
            width: 100%;
            transform: translateX(-100%);
            top: 60px;
        }

        .sidebar.mobile-open {
            transform: translateX(0);
        }

        .main-content {
            margin-left: 0;
        }

        .layout-container {
            flex-direction: column;
        }
    }
`;

// CSS automatisch einbinden
if (!document.querySelector('#unified-navigation-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'unified-navigation-styles';
    styleSheet.textContent = unifiedNavigationCSS;
    document.head.appendChild(styleSheet);
}

// Navigation automatisch initialisieren
document.addEventListener('DOMContentLoaded', () => {
    window.unifiedNav = new UnifiedNavigation();
});

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedNavigation;
}