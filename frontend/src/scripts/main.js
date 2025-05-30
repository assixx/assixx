/**
 * Main JavaScript Entry Point
 * Initializes all modules and global functionality
 */

// Import styles
import '../styles/main.css';

// Import core modules
import { initAuth } from './core/auth.js';
import { initNavigation } from './core/navigation.js';
import { initTheme } from './core/theme.js';
import { initUtils } from './core/utils.js';

// Import services
import ApiService from './services/api.service.js';
import StorageService from './services/storage.service.js';
import NotificationService from './services/notification.service.js';

// Import components
import { initModals } from './components/modals.js';
import { initTooltips } from './components/tooltips.js';
import { initDropdowns } from './components/dropdowns.js';

// Global app object
window.Assixx = {
  // Services
  api: new ApiService(),
  storage: new StorageService(),
  notification: new NotificationService(),

  // State
  user: null,
  theme: 'light',

  // Methods
  init() {
    console.log('Initializing Assixx Application...');

    // Initialize core modules
    initAuth();
    initNavigation();
    initTheme();
    initUtils();

    // Initialize UI components
    initModals();
    initTooltips();
    initDropdowns();

    // Page specific initialization
    this.initPageSpecific();

    console.log('Assixx Application initialized successfully');
  },

  initPageSpecific() {
    // Get current page
    const page = window.location.pathname.split('/').pop().replace('.html', '');

    // Load page-specific module
    switch (page) {
      case 'dashboard':
        import('./pages/dashboard.js').then((m) => m.initDashboard && m.initDashboard()).catch(() => {});
        break;
      case 'profile':
        // import('./pages/profile.js').then(m => m.init());
        break;
      case 'chat':
        // import('./pages/chat.js').then(m => m.init());
        break;
      case 'calendar':
        // import('./pages/calendar.js').then(m => m.init());
        break;
      // Add more pages as needed
    }
  },
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Assixx.init());
} else {
  window.Assixx.init();
}
