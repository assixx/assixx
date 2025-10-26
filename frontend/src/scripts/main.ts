/**
 * Main TypeScript Entry Point
 * Initializes all modules and global functionality
 */

// Import styles
import '../styles/main.css';

// Import components - these are still .js files
import { initModals } from './components/modals.js';
import { initTooltips } from './components/tooltips.js';
import { initDropdowns } from './components/dropdowns.js';
// Import services - these are already TypeScript (default instances)
import storageService, { StorageService } from './services/storage.service';
import notificationService, { NotificationService } from './services/notification.service';

// Define the Assixx interface
interface AssixxApp {
  // Services
  storage: StorageService;
  notification: NotificationService;

  // State
  user: unknown;
  theme: 'light' | 'dark';

  // Methods
  init: () => void;
  initPageSpecific: () => void;
}

// Declare global window extension
declare global {
  interface Window {
    Assixx: AssixxApp;
  }
}

// Global app object
const assixxApp: AssixxApp = {
  // Services (use the imported instances)
  storage: storageService,
  notification: notificationService,

  // State
  user: null,
  theme: 'light',

  // Methods
  init() {
    console.info('Initializing Assixx Application...');

    // Initialize UI components
    initModals();
    initTooltips();
    initDropdowns();

    // Page specific initialization
    this.initPageSpecific();

    console.info('Assixx Application initialized successfully');
  },

  initPageSpecific() {
    // Get current page
    const page = window.location.pathname.split('/').pop() ?? '';

    // Load page-specific module
    switch (page) {
      case 'dashboard':
        void import('./pages/dashboard.js')

          .then((module: { initDashboard?: () => void }) => {
            if (typeof module.initDashboard === 'function') {
              module.initDashboard();
            }
            return null;
          })

          .catch((error: unknown) => {
            console.error('Failed to load dashboard module:', error);
          });
        break;
      case 'profile':
        // void import('./pages/profile.js')
        //   .then((module) => {
        //     if (module.init && typeof module.init === 'function') {
        //       module.init();
        //     }
        //   })
        //   .catch((error) => {
        //     console.error('Failed to load profile module:', error);
        //   });
        break;
      case 'chat':
        // void import('./pages/chat.js')
        //   .then((module) => {
        //     if (module.init && typeof module.init === 'function') {
        //       module.init();
        //     }
        //   })
        //   .catch((error) => {
        //     console.error('Failed to load chat module:', error);
        //   });
        break;
      case 'calendar':
        // void import('./pages/calendar.js')
        //   .then((module) => {
        //     if (module.init && typeof module.init === 'function') {
        //       module.init();
        //     }
        //   })
        //   .catch((error) => {
        //     console.error('Failed to load calendar module:', error);
        //   });
        break;
      default:
        // No page-specific initialization needed
        break;
    }
  },
};

// Assign to window
window.Assixx = assixxApp;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.Assixx.init();
  });
} else {
  window.Assixx.init();
}

// Export for module usage if needed
export default assixxApp;
