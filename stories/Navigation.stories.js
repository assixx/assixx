/**
 * Navigation Components
 *
 * Wayfinding and content organization primitives
 * Phase 6 of Design System
 *
 * NOTE: This story demonstrates the CSS-only version.
 * - Auto-initialization
 * - Keyboard navigation
 * - Animation timing
 */

export default {
  title: 'Design System/Navigation',
  parameters: {
    layout: 'padded',
  },
};

// ========== BREADCRUMBS ==========

export const Breadcrumbs = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Default Breadcrumbs (Production)</h3>
      <nav class="breadcrumb">
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-home breadcrumb-icon"></i>
            Home
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-user-shield breadcrumb-icon"></i>
            Admin
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <span class="breadcrumb-current">
            <i class="fas fa-users breadcrumb-icon"></i>
            Benutzer verwalten
          </span>
        </div>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">Root Dashboard Example</h3>
      <nav class="breadcrumb">
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-home breadcrumb-icon"></i>
            Home
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-shield-alt breadcrumb-icon"></i>
            Root Dashboard
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <span class="breadcrumb-current">
            <i class="fas fa-user-lock breadcrumb-icon"></i>
            Root User Verwaltung
          </span>
        </div>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">Employee Dashboard Example</h3>
      <nav class="breadcrumb">
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-home breadcrumb-icon"></i>
            Home
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-user breadcrumb-icon"></i>
            Mitarbeiter Dashboard
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <span class="breadcrumb-current">
            <i class="fas fa-user-circle breadcrumb-icon"></i>
            Profil
          </span>
        </div>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">Deep Hierarchy (5 Levels)</h3>
      <nav class="breadcrumb">
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-home breadcrumb-icon"></i>
            Home
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-building breadcrumb-icon"></i>
            Organisation
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-sitemap breadcrumb-icon"></i>
            Abteilungen
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">
            <i class="fas fa-users breadcrumb-icon"></i>
            Entwicklung
          </a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <span class="breadcrumb-current">
            <i class="fas fa-user breadcrumb-icon"></i>
            Max Mustermann
          </span>
        </div>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">Without Icons</h3>
      <nav class="breadcrumb">
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">Home</a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <a href="#" class="breadcrumb-link">Settings</a>
        </div>
        <div class="breadcrumb-separator">
          <i class="fas fa-chevron-right"></i>
        </div>
        <div class="breadcrumb-item">
          <span class="breadcrumb-current">Account</span>
        </div>
      </nav>
    </div>
  `;
  return wrapper;
};

// ========== PAGINATION ==========

export const Pagination = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Default Pagination</h3>
      <nav class="pagination">
        <button class="pagination__btn pagination__btn--prev" disabled>
          <i class="fas fa-chevron-left"></i>
          Previous
        </button>
        <div class="pagination__pages">
          <button class="pagination__page pagination__page--active">1</button>
          <button class="pagination__page">2</button>
          <button class="pagination__page">3</button>
          <button class="pagination__page">4</button>
          <button class="pagination__page">5</button>
        </div>
        <button class="pagination__btn pagination__btn--next">
          Next
          <i class="fas fa-chevron-right"></i>
        </button>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">With Ellipsis</h3>
      <nav class="pagination">
        <button class="pagination__btn pagination__btn--prev">Previous</button>
        <div class="pagination__pages">
          <button class="pagination__page">1</button>
          <button class="pagination__page">2</button>
          <button class="pagination__page pagination__page--active">3</button>
          <button class="pagination__page">4</button>
          <button class="pagination__page">5</button>
          <span class="pagination__ellipsis">...</span>
          <button class="pagination__page">20</button>
        </div>
        <button class="pagination__btn pagination__btn--next">Next</button>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">With Page Info</h3>
      <nav class="pagination">
        <button class="pagination__btn">
          <i class="fas fa-chevron-left"></i>
          Previous
        </button>
        <span class="pagination__info">Page 5 of 20</span>
        <button class="pagination__btn">
          Next
          <i class="fas fa-chevron-right"></i>
        </button>
      </nav>

      <h3 style="color: #fff; margin-top: 32px; margin-bottom: 16px;">Compact (Mobile)</h3>
      <nav class="pagination pagination--compact">
        <button class="pagination__btn">Previous</button>
        <div class="pagination__pages">
          <button class="pagination__page pagination__page--active">1</button>
          <button class="pagination__page">2</button>
          <button class="pagination__page">3</button>
        </div>
        <button class="pagination__btn">Next</button>
      </nav>
    </div>
  `;
  return wrapper;
};

// ========== TABS ==========

export const TabsUnderline = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Underline Tabs (Default)</h3>
      <div class="tabs">
        <div class="tabs__nav">
          <button class="tabs__tab tabs__tab--active">Overview</button>
          <button class="tabs__tab">Details</button>
          <button class="tabs__tab">Settings</button>
          <button class="tabs__tab" disabled>Disabled</button>
        </div>
        <div class="tabs__content tabs__content--active">
          <p style="color: #fff;">Overview content goes here...</p>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">With Icons</h3>
      <div class="tabs">
        <div class="tabs__nav">
          <button class="tabs__tab tabs__tab--active">
            <i class="fas fa-home"></i>Dashboard
          </button>
          <button class="tabs__tab">
            <i class="fas fa-chart-line"></i>Analytics
          </button>
          <button class="tabs__tab">
            <i class="fas fa-cog"></i>Settings
          </button>
        </div>
        <div class="tabs__content tabs__content--active">
          <p style="color: #fff;">Dashboard with icon content...</p>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">Centered</h3>
      <div class="tabs tabs--centered">
        <div class="tabs__nav">
          <button class="tabs__tab">Overview</button>
          <button class="tabs__tab tabs__tab--active">Details</button>
          <button class="tabs__tab">Settings</button>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const TabsGlass = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Glass Tabs</h3>
      <div class="tabs tabs--glass">
        <div class="tabs__nav">
          <button class="tabs__tab tabs__tab--active">Calendar</button>
          <button class="tabs__tab">List</button>
          <button class="tabs__tab">Week</button>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">Glass Tabs with Icons</h3>
      <div class="tabs tabs--glass">
        <div class="tabs__nav">
          <button class="tabs__tab tabs__tab--active">
            <i class="fas fa-list"></i>List
          </button>
          <button class="tabs__tab">
            <i class="fas fa-th"></i>Grid
          </button>
          <button class="tabs__tab">
            <i class="fas fa-calendar"></i>Calendar
          </button>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">Icon Only Tabs</h3>
      <div class="tabs tabs--glass">
        <div class="tabs__nav">
          <button class="tabs__tab tabs__tab--icon-only tabs__tab--active">
            <i class="fas fa-list"></i>
          </button>
          <button class="tabs__tab tabs__tab--icon-only">
            <i class="fas fa-th"></i>
          </button>
          <button class="tabs__tab tabs__tab--icon-only">
            <i class="fas fa-calendar"></i>
          </button>
          <button class="tabs__tab tabs__tab--icon-only">
            <i class="fas fa-chart-bar"></i>
          </button>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">Compact Glass Tabs</h3>
      <div class="tabs tabs--glass tabs--compact">
        <div class="tabs__nav">
          <button class="tabs__tab">Active</button>
          <button class="tabs__tab tabs__tab--active">Archived</button>
          <button class="tabs__tab">All</button>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

// ========== STEPPER ==========

export const StepperHorizontal = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 48px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Horizontal Stepper</h3>
      <div class="stepper">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Account</div>
        </div>
        <div class="stepper__connector stepper__connector--active"></div>
        <div class="stepper__step stepper__step--active">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Profile</div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Complete</div>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 64px; margin-bottom: 24px;">With Descriptions</h3>
      <div class="stepper">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Create Account</div>
            <div class="stepper__description">Set up credentials</div>
          </div>
        </div>
        <div class="stepper__connector stepper__connector--completed"></div>
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Company Info</div>
            <div class="stepper__description">Tell us about you</div>
          </div>
        </div>
        <div class="stepper__connector stepper__connector--active"></div>
        <div class="stepper__step stepper__step--active">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Billing</div>
            <div class="stepper__description">Payment details</div>
          </div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">4</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Complete</div>
            <div class="stepper__description">Review & submit</div>
          </div>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 64px; margin-bottom: 24px;">With Error</h3>
      <div class="stepper">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Step 1</div>
        </div>
        <div class="stepper__connector stepper__connector--completed"></div>
        <div class="stepper__step stepper__step--error">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Step 2 (Error)</div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step stepper__step--inactive">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Step 3</div>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 64px; margin-bottom: 24px;">Compact Stepper</h3>
      <div class="stepper stepper--compact">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Cart</div>
        </div>
        <div class="stepper__connector stepper__connector--active"></div>
        <div class="stepper__step stepper__step--active">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Checkout</div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Payment</div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">4</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Done</div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const StepperVertical = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 48px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Vertical Stepper</h3>
      <div class="stepper stepper--vertical">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Order Placed</div>
            <div class="stepper__description">Your order has been received</div>
          </div>
        </div>
        <div class="stepper__connector stepper__connector--completed"></div>
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Processing</div>
            <div class="stepper__description">We're preparing your order</div>
          </div>
        </div>
        <div class="stepper__connector stepper__connector--active"></div>
        <div class="stepper__step stepper__step--active">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Shipped</div>
            <div class="stepper__description">Your package is on the way</div>
          </div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">4</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div>
            <div class="stepper__label">Delivered</div>
            <div class="stepper__description">Package delivered to your door</div>
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const StepperClickable = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 48px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Clickable Stepper (hover to see effect)</h3>
      <div class="stepper stepper--clickable">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Personal Info</div>
        </div>
        <div class="stepper__connector stepper__connector--active"></div>
        <div class="stepper__step stepper__step--active">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Address</div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Review</div>
        </div>
      </div>
      <p style="color: #9e9e9e; font-size: 13px; margin-top: 16px;">
        Click on any step to jump to that section
      </p>
    </div>
  `;
  return wrapper;
};

// ========== ACCORDION ==========

export const AccordionDefault = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Default Accordion</h3>
      <div class="accordion">
        <div class="accordion__item accordion__item--active">
          <button class="accordion__header">
            <span class="accordion__title">What is Assixx?</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Assixx is a comprehensive multi-tenant SaaS platform designed for industrial companies to manage employees, shifts, documents, and more.
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">How does multi-tenancy work?</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Each company (tenant) has completely isolated data. Users can only access data for their assigned tenant_id.
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">What features are included?</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Employee management, shift planning, document management, KVP suggestions, blackboard announcements, calendar, and more.
            </div>
          </div>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">With Icons</h3>
      <div class="accordion">
        <div class="accordion__item">
          <button class="accordion__header">
            <div class="accordion__header-icon">
              <i class="fas fa-users"></i>
              <span class="accordion__title">Employee Management</span>
            </div>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Manage employee profiles, departments, teams, and permissions from a single dashboard.
            </div>
          </div>
        </div>
        <div class="accordion__item accordion__item--active">
          <button class="accordion__header">
            <div class="accordion__header-icon">
              <i class="fas fa-calendar-alt"></i>
              <span class="accordion__title">Shift Planning</span>
            </div>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Create and manage shifts with calendar integration, automatic conflict detection, and notifications.
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <div class="accordion__header-icon">
              <i class="fas fa-file-alt"></i>
              <span class="accordion__title">Document Management</span>
            </div>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Store and organize company documents with version control and access permissions.
            </div>
          </div>
        </div>
      </div>

      <h3 style="color: #fff; margin-top: 48px; margin-bottom: 16px;">With Badges</h3>
      <div class="accordion">
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Notifications</span>
            <span class="accordion__badge">3</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              You have 3 unread notifications
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Messages</span>
            <span class="accordion__badge">7</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              You have 7 unread messages
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize accordions

  return wrapper;
};

export const AccordionFlush = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Flush Accordion (No gaps)</h3>
      <div class="accordion accordion--flush">
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">General Settings</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              General application settings go here
            </div>
          </div>
        </div>
        <div class="accordion__item accordion__item--active">
          <button class="accordion__header">
            <span class="accordion__title">Security Settings</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Configure password policies, two-factor authentication, and session timeouts
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Notification Settings</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Manage email and in-app notification preferences
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Integration Settings</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Connect third-party services and APIs
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize accordions

  return wrapper;
};

export const AccordionBordered = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Bordered Accordion</h3>
      <div class="accordion accordion--bordered">
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Getting Started</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Learn the basics of using Assixx
            </div>
          </div>
        </div>
        <div class="accordion__item accordion__item--active">
          <button class="accordion__header">
            <span class="accordion__title">Advanced Features</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Explore advanced features like automation, custom workflows, and integrations
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Troubleshooting</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Common issues and solutions
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize accordions

  return wrapper;
};

export const AccordionCompact = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Compact Accordion</h3>
      <div class="accordion accordion--compact">
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">API Documentation</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              REST API endpoints and authentication
            </div>
          </div>
        </div>
        <div class="accordion__item accordion__item--active">
          <button class="accordion__header">
            <span class="accordion__title">SDK Libraries</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              JavaScript, Python, and PHP client libraries
            </div>
          </div>
        </div>
        <div class="accordion__item">
          <button class="accordion__header">
            <span class="accordion__title">Code Examples</span>
            <i class="fas fa-chevron-down accordion__icon"></i>
          </button>
          <div class="accordion__content">
            <div class="accordion__body">
              Sample code for common use cases
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize accordions

  return wrapper;
};

// ========== COMBINED EXAMPLES ==========

export const NavigationInDashboard = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Dashboard with Navigation</h3>

      <!-- Breadcrumbs -->
      <nav class="breadcrumb" style="margin-bottom: 24px;">
        <a href="#" class="breadcrumb__item">Home</a>
        <span class="breadcrumb__separator">/</span>
        <a href="#" class="breadcrumb__item">Admin</a>
        <span class="breadcrumb__separator">/</span>
        <span class="breadcrumb__item breadcrumb__item--active">User Management</span>
      </nav>

      <!-- Tabs -->
      <div class="tabs" style="margin-bottom: 24px;">
        <div class="tabs__nav">
          <button class="tabs__tab tabs__tab--active">
            <i class="fas fa-users"></i>Active Users
          </button>
          <button class="tabs__tab">
            <i class="fas fa-archive"></i>Archived
          </button>
          <button class="tabs__tab">
            <i class="fas fa-cog"></i>Settings
          </button>
        </div>
      </div>

      <!-- Mock table -->
      <div style="padding: 16px; background: rgb(255 255 255 / 5%); border-radius: 8px; margin-bottom: 24px;">
        <p style="color: #fff; margin-bottom: 8px;">User 1</p>
        <p style="color: #fff; margin-bottom: 8px;">User 2</p>
        <p style="color: #fff; margin-bottom: 8px;">User 3</p>
        <p style="color: #fff;">...</p>
      </div>

      <!-- Pagination -->
      <nav class="pagination">
        <button class="pagination__btn" disabled>Previous</button>
        <div class="pagination__pages">
          <button class="pagination__page pagination__page--active">1</button>
          <button class="pagination__page">2</button>
          <button class="pagination__page">3</button>
        </div>
        <button class="pagination__btn">Next</button>
      </nav>
    </div>
  `;
  return wrapper;
};

export const OnboardingFlow = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 48px;">
      <h3 style="color: #fff; margin-bottom: 32px; text-align: center;">Company Onboarding</h3>

      <!-- Stepper -->
      <div class="stepper" style="margin-bottom: 48px;">
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">1</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Account</div>
        </div>
        <div class="stepper__connector stepper__connector--completed"></div>
        <div class="stepper__step stepper__step--completed">
          <div class="stepper__indicator">
            <span class="stepper__number">2</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Company</div>
        </div>
        <div class="stepper__connector stepper__connector--active"></div>
        <div class="stepper__step stepper__step--active">
          <div class="stepper__indicator">
            <span class="stepper__number">3</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Features</div>
        </div>
        <div class="stepper__connector"></div>
        <div class="stepper__step">
          <div class="stepper__indicator">
            <span class="stepper__number">4</span>
            <i class="fas fa-check stepper__check"></i>
          </div>
          <div class="stepper__label">Complete</div>
        </div>
      </div>

      <!-- Content -->
      <div style="max-width: 600px; margin: 0 auto;">
        <h4 style="color: #fff; margin-bottom: 16px;">Select Features</h4>
        <p style="color: #9e9e9e; margin-bottom: 24px;">Choose which features you want to enable for your company</p>

        <!-- Accordion for features -->
        <div class="accordion accordion--compact">
          <div class="accordion__item accordion__item--active">
            <button class="accordion__header">
              <div class="accordion__header-icon">
                <i class="fas fa-calendar-alt"></i>
                <span class="accordion__title">Shift Planning</span>
              </div>
              <i class="fas fa-chevron-down accordion__icon"></i>
            </button>
            <div class="accordion__content">
              <div class="accordion__body">
                Create and manage employee shifts with calendar integration
              </div>
            </div>
          </div>
          <div class="accordion__item">
            <button class="accordion__header">
              <div class="accordion__header-icon">
                <i class="fas fa-file-alt"></i>
                <span class="accordion__title">Document Management</span>
              </div>
              <i class="fas fa-chevron-down accordion__icon"></i>
            </button>
            <div class="accordion__content">
              <div class="accordion__body">
                Store and organize company documents
              </div>
            </div>
          </div>
          <div class="accordion__item">
            <button class="accordion__header">
              <div class="accordion__header-icon">
                <i class="fas fa-lightbulb"></i>
                <span class="accordion__title">KVP Suggestions</span>
              </div>
              <i class="fas fa-chevron-down accordion__icon"></i>
            </button>
            <div class="accordion__content">
              <div class="accordion__body">
                Continuous improvement suggestion system
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top: 32px; display: flex; gap: 16px; justify-content: flex-end;">
          <button class="btn btn-cancel">Back</button>
          <button class="btn btn-primary">Continue</button>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};
