/**
 * PurgeCSS Configuration for Assixx
 *
 * IMPORTANT: This is configured for SAFE analysis.
 * It includes extensive safelists to prevent false positives.
 *
 * Usage:
 *   pnpm css:analyze    - Generate report of unused CSS (DRY RUN)
 *   pnpm css:purge      - Actually remove unused CSS (DANGEROUS)
 */

module.exports = {
  // CSS files to analyze - ONLY page-specific styles
  // EXCLUDED:
  //   - tailwind.css & tailwind/** (Tailwind v4 has built-in purge)
  //   - lib/** (third-party: FontAwesome, FullCalendar, Bootstrap)
  //   - frontend/src/design-system/** (design tokens - keep all for consistency)
  //   - base/** (CSS variables - must keep)
  css: [
    // Page-specific stylesheets only (no subdirectories)
    'frontend/src/styles/account-settings.css',
    'frontend/src/styles/admin-dashboard.css',
    'frontend/src/styles/admin-profile.css',
    'frontend/src/styles/alerts.css',
    'frontend/src/styles/blackboard.css',
    'frontend/src/styles/blackboard-widget.css',
    'frontend/src/styles/bootstrap-override.css',
    'frontend/src/styles/breadcrumb-alignment.css',
    'frontend/src/styles/calendar.css',
    'frontend/src/styles/chat.css',
    'frontend/src/styles/chat-icons.css',
    'frontend/src/styles/container-padding-fix.css',
    'frontend/src/styles/dashboard-theme.css',
    'frontend/src/styles/documents-explorer.css',
    'frontend/src/styles/employee-dashboard.css',
    'frontend/src/styles/employee-profile.css',
    'frontend/src/styles/feature-management.css',
    'frontend/src/styles/fonts-outfit.css',
    'frontend/src/styles/index.css',
    'frontend/src/styles/kvp.css',
    'frontend/src/styles/kvp-detail.css',
    'frontend/src/styles/login.css',
    'frontend/src/styles/logs.css',
    'frontend/src/styles/main.css',
    'frontend/src/styles/manage-admins.css',
    'frontend/src/styles/manage-areas.css',
    'frontend/src/styles/manage-department-groups.css',
    'frontend/src/styles/manage-employees.css',
    'frontend/src/styles/manage-machines.css',
    'frontend/src/styles/manage-root.css',
    'frontend/src/styles/manage-teams.css',
    'frontend/src/styles/password-strength.css',
    'frontend/src/styles/profile-picture.css',
    'frontend/src/styles/rate-limit.css',
    'frontend/src/styles/root-dashboard.css',
    'frontend/src/styles/features.css',
    'frontend/src/styles/root-profile.css',
    'frontend/src/styles/shifts.css',
    'frontend/src/styles/signup.css',
    'frontend/src/styles/storage-upgrade.css',
    'frontend/src/styles/style.css',
    'frontend/src/styles/survey-admin.css',
    'frontend/src/styles/survey-employee.css',
    'frontend/src/styles/survey-results.css',
    'frontend/src/styles/tenant-deletion-status.css',
    'frontend/src/styles/unified-navigation.css',
    'frontend/src/styles/user-info-update.css',
  ],

  // Content files to scan for class usage
  content: [
    // SvelteKit components (PRIMARY - most classes are used here!)
    'frontend/src/**/*.svelte',

    // HTML files
    'frontend/src/pages/**/*.html',
    'frontend/src/**/*.html',

    // TypeScript files (main source)
    'frontend/src/scripts/**/*.ts',
    'frontend/src/utils/**/*.ts',
    'frontend/src/**/*.ts',

    // JavaScript files (legacy + compiled)
    'frontend/src/scripts/**/*.js',
    'frontend/src/**/*.js',

    // Storybook stories
    'frontend/.storybook/stories/**/*.js',
    'frontend/.storybook/stories/**/*.ts',

    // Backend templates (might reference frontend classes)
    'backend/templates/**/*.html',
  ],

  // Output directory for cleaned CSS
  output: 'frontend/src/styles-purged/',

  // CRITICAL: Safelist to prevent false positives
  safelist: {
    // Exact class names to always keep
    standard: [
      // HTML/Body basics
      'html',
      'body',
      'root',

      // Common state classes
      'active',
      'disabled',
      'hidden',
      'visible',
      'open',
      'closed',
      'loading',
      'loaded',
      'error',
      'success',
      'warning',
      'info',

      // Focus/hover states
      'focus',
      'hover',
      'focus-visible',

      // Accessibility
      'sr-only',
      'visually-hidden',

      // Third-party libraries
      'tippy-box',
      'tippy-content',
      'tippy-arrow',
      'toastify',
      'Toastify',
    ],

    // Regex patterns - classes matching these are ALWAYS kept
    // This is where we protect dynamically generated classes
    deep: [
      // === DESIGN SYSTEM PATTERNS ===
      // Buttons (btn-primary, btn-danger, btn-sm, etc.)
      /^btn/,

      // Cards (card-stat, card-accent, card-base, etc.)
      /^card/,

      // Badges (badge--success, badge--role-admin, etc.)
      /^badge/,

      // Forms (form-field, form-control, etc.)
      /^form/,

      // Toggles (toggle-switch, toggle-group, etc.)
      /^toggle/,

      // Modals (modal-overlay, modal-header, etc.)
      /^modal/,

      // Tables (data-table, table-striped, etc.)
      /^table/,
      /^data-table/,
      /^data-list/,

      // Navigation (breadcrumb, pagination, tabs, etc.)
      /^breadcrumb/,
      /^pagination/,
      /^tabs/,
      /^stepper/,
      /^accordion/,

      // Feedback (alert, progress, spinner, skeleton, toast)
      /^alert/,
      /^progress/,
      /^spinner/,
      /^skeleton/,
      /^toast/,

      // Pickers (date-picker, time-picker, etc.)
      /^picker/,
      /^date-/,
      /^time-/,

      // File upload
      /^file-upload/,

      // Avatar
      /^avatar/,

      // Search
      /^search/,

      // Empty states
      /^empty-state/,

      // Tooltip
      /^tooltip/,

      // Collapse
      /^collapse/,

      // Choice cards
      /^choice-card/,

      // Containers
      /^page-container/,
      /^container/,

      // Dropdowns
      /^dropdown/,

      // === STATE MODIFIERS (BEM-style) ===
      /--active$/,
      /--disabled$/,
      /--loading$/,
      /--error$/,
      /--success$/,
      /--warning$/,
      /--info$/,
      /--danger$/,
      /--primary$/,
      /--secondary$/,
      /--open$/,
      /--closed$/,
      /--selected$/,
      /--checked$/,
      /--expanded$/,
      /--collapsed$/,

      // === IS-* STATE CLASSES ===
      /^is-/,
      /^has-/,

      // === SIZE MODIFIERS ===
      /--sm$/,
      /--md$/,
      /--lg$/,
      /--xl$/,
      /--xs$/,

      // === COLOR MODIFIERS ===
      /--color-\d+$/,

      // === TAILWIND UTILITIES (keep all) ===
      /^bg-/,
      /^text-/,
      /^border-/,
      /^rounded-/,
      /^shadow-/,
      /^p-/,
      /^px-/,
      /^py-/,
      /^pt-/,
      /^pb-/,
      /^pl-/,
      /^pr-/,
      /^m-/,
      /^mx-/,
      /^my-/,
      /^mt-/,
      /^mb-/,
      /^ml-/,
      /^mr-/,
      /^w-/,
      /^h-/,
      /^min-/,
      /^max-/,
      /^flex/,
      /^grid/,
      /^gap-/,
      /^space-/,
      /^items-/,
      /^justify-/,
      /^self-/,
      /^font-/,
      /^leading-/,
      /^tracking-/,
      /^opacity-/,
      /^z-/,
      /^overflow-/,
      /^cursor-/,
      /^pointer-/,
      /^transition/,
      /^duration-/,
      /^ease-/,
      /^animate-/,
      /^hover:/,
      /^focus:/,
      /^active:/,
      /^disabled:/,
      /^group-/,
      /^peer-/,

      // === FONTAWESOME ===
      /^fa-/,
      /^fa$/,
      /^fas$/,
      /^far$/,
      /^fab$/,
      /^fal$/,
      /^fad$/,

      // === FULLCALENDAR ===
      /^fc-/,
      /^fc$/,

      // === EVENTCALENDAR (@event-calendar) ===
      /^ec-/,
      /^ec$/,

      // === BOOTSTRAP COMPAT (until fully removed) ===
      /^btn-/,
      /^form-/,
      /^input-/,
      /^alert-/,
      /^modal-/,
      /^table-/,
      /^nav-/,
      /^navbar-/,
      /^dropdown-/,
      /^card-/,
      /^list-/,
      /^d-/,
      /^col-/,
      /^row$/,
      /^container$/,

      // === ASSIXX SPECIFIC ===
      // Blackboard
      /^blackboard/,
      /^bb-/,
      /^entry-/,
      /^zoom-/,

      // Calendar
      /^calendar/,
      /^event-/,

      // Chat
      /^chat/,
      /^message/,
      /^conversation/,

      // Documents
      /^doc-/,
      /^document/,
      /^folder/,
      /^file-/,

      // KVP
      /^kvp/,
      /^suggestion/,

      // Shifts
      /^shift/,
      /^rotation/,
      /^schedule/,

      // Survey
      /^survey/,
      /^question/,
      /^answer/,

      // Dashboard
      /^dashboard/,
      /^widget/,
      /^stat-/,
      /^metric/,

      // User/Profile
      /^user-/,
      /^profile/,

      // Navigation
      /^sidebar/,
      /^nav-/,
      /^menu-/,
      /^header-/,

      // Logs
      /^log-/,
      /^audit/,

      // Status indicators
      /^status-/,
      /^online$/,
      /^offline$/,
      /^busy$/,
      /^away$/,

      // Glass/Theme
      /^glass/,
      /^glassmorphism/,
      /^dark-/,
      /^light-/,
      /^theme-/,
    ],

    // Keep classes with these attribute selectors
    greedy: [
      // Data attributes often used for JS targeting
      /data-/,
      /aria-/,
    ],
  },

  // Additional extractors for edge cases
  defaultExtractor: (content) => {
    // Match class names including those in template literals
    const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
    // Match classes in classList.add/remove/toggle
    const classListMatches =
      content.match(/classList\.(add|remove|toggle)\(['"]([^'"]+)['"]\)/g) ||
      [];
    // Match classes in className assignments
    const classNameMatches =
      content.match(/className\s*=\s*['"]([^'"]+)['"]/g) || [];

    // Svelte class: directive — class:foo={condition} → extract "foo"
    const svelteClassDirectiveMatches = [];
    const svelteRegex = /class:([\w-]+)/g;
    let svelteMatch;
    while ((svelteMatch = svelteRegex.exec(content)) !== null) {
      svelteClassDirectiveMatches.push(svelteMatch[1]);
    }

    return [
      ...broadMatches,
      ...classListMatches,
      ...classNameMatches,
      ...svelteClassDirectiveMatches,
    ];
  },

  // Include rejected (removed) selectors in output for review
  rejected: true,

  // true = PURGE unused @font-face rules (false = keep all)
  fontFace: true,

  // true = PURGE unused keyframes (false = keep all)
  keyframes: true,

  // true = PURGE unused CSS custom properties (false = keep all)
  variables: true,
};
