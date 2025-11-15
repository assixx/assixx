/**
 * Feedback & Notification Components - Storybook Stories
 *
 * Components:
 * - Alerts (inline messages)
 * - Progress Bars
 * - Spinners
 * - Skeletons
 * - Toasts
 */

export default {
  title: 'Design System/Feedback',

  parameters: {
    layout: 'padded',
  },

  tags: ['autodocs'],

  globals: {
    backgrounds: {
      value: 'assixx-dark',
    },
  },
};

/* ========== ALERTS ========== */

export const AlertVariants = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Alert Variants</h3>

      <!-- Success -->
      <div class="alert alert--success">
        <div class="alert__icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">Success!</div>
          <div class="alert__message">Your changes have been saved successfully.</div>
        </div>
        <button class="alert__close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Warning -->
      <div class="alert alert--warning">
        <div class="alert__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">Warning</div>
          <div class="alert__message">This action cannot be undone. Proceed with caution.</div>
        </div>
        <button class="alert__close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Error -->
      <div class="alert alert--error">
        <div class="alert__icon">
          <i class="fas fa-times-circle"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">Error</div>
          <div class="alert__message">Something went wrong. Please try again later.</div>
        </div>
        <button class="alert__close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Info -->
      <div class="alert alert--info">
        <div class="alert__icon">
          <i class="fas fa-info-circle"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">Information</div>
          <div class="alert__message">You have 3 pending tasks to complete today.</div>
        </div>
        <button class="alert__close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Neutral -->
      <div class="alert alert--neutral">
        <div class="alert__icon">
          <i class="fas fa-bell"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">Notification</div>
          <div class="alert__message">You have a new message from the team.</div>
        </div>
        <button class="alert__close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;
  return wrapper;
};

export const AlertSolidVariants = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Solid Alert Variants (Stronger Visual)</h3>

      <div class="alert alert--success-solid">
        <div class="alert__icon"><i class="fas fa-check-circle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Payment Successful</div>
          <div class="alert__message">Your payment has been processed successfully.</div>
        </div>
      </div>

      <div class="alert alert--warning-solid">
        <div class="alert__icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Storage Almost Full</div>
          <div class="alert__message">You're using 95% of your available storage.</div>
        </div>
      </div>

      <div class="alert alert--error-solid">
        <div class="alert__icon"><i class="fas fa-times-circle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Upload Failed</div>
          <div class="alert__message">File size exceeds the maximum limit of 10MB.</div>
        </div>
      </div>

      <div class="alert alert--info-solid">
        <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Scheduled Maintenance</div>
          <div class="alert__message">System will be offline from 2 AM to 4 AM tonight.</div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const AlertSizes = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Alert Sizes</h3>

      <!-- Extra Small -->
      <div class="alert alert--success alert--xs">
        <div class="alert__icon"><i class="fas fa-check-circle"></i></div>
        <div class="alert__content">
          <div class="alert__message">Extra small inline alert</div>
        </div>
      </div>

      <!-- Small -->
      <div class="alert alert--success alert--sm">
        <div class="alert__icon"><i class="fas fa-check-circle"></i></div>
        <div class="alert__content">
          <div class="alert__message">Small compact alert</div>
        </div>
      </div>

      <!-- Default (Medium) -->
      <div class="alert alert--info">
        <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Default Size</div>
          <div class="alert__message">Standard alert with title and message</div>
        </div>
      </div>

      <!-- Large -->
      <div class="alert alert--warning alert--lg">
        <div class="alert__icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Large Alert</div>
          <div class="alert__message">Larger alert for more prominent notifications with detailed information.</div>
        </div>
        <button class="alert__close"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `;
  return wrapper;
};

export const AlertWithActions = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Alert with Action Buttons</h3>

      <div class="alert alert--warning">
        <div class="alert__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="alert__content">
          <div class="alert__title">Unsaved Changes</div>
          <div class="alert__message">You have unsaved changes. Do you want to save before leaving this page?</div>
          <div class="alert__actions">
            <button class="btn btn-primary">Save Changes</button>
            <button class="btn btn-cancel">Discard</button>
          </div>
        </div>
        <button class="alert__close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  `;
  return wrapper;
};

/* ========== PROGRESS BARS ========== */

export const ProgressBars = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Progress Bars</h3>

      <div>
        <div class="progress__label">Uploading file... 25%</div>
        <div class="progress">
          <div class="progress__bar progress__bar--primary" style="width: 25%">25%</div>
        </div>
      </div>

      <div>
        <div class="progress__label">Processing data... 50%</div>
        <div class="progress">
          <div class="progress__bar progress__bar--info" style="width: 50%">50%</div>
        </div>
      </div>

      <div>
        <div class="progress__label">Installation complete! 100%</div>
        <div class="progress">
          <div class="progress__bar progress__bar--success" style="width: 100%">100%</div>
        </div>
      </div>

      <div>
        <div class="progress__label">Storage warning: 85% used</div>
        <div class="progress">
          <div class="progress__bar progress__bar--warning" style="width: 85%"></div>
        </div>
      </div>

      <div>
        <div class="progress__label">Critical: 95% used</div>
        <div class="progress">
          <div class="progress__bar progress__bar--danger" style="width: 95%"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const ProgressSizes = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Progress Bar Sizes</h3>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Small</p>
        <div class="progress progress--sm">
          <div class="progress__bar" style="width: 60%"></div>
        </div>
      </div>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Medium (Default)</p>
        <div class="progress progress--md">
          <div class="progress__bar" style="width: 60%"></div>
        </div>
      </div>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Large</p>
        <div class="progress progress--lg">
          <div class="progress__bar" style="width: 60%">60%</div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const ProgressIndeterminate = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Indeterminate Progress (Unknown Duration)</h3>

      <div>
        <div class="progress__label">Processing... Please wait</div>
        <div class="progress progress--indeterminate">
          <div class="progress__bar"></div>
        </div>
      </div>

      <p style="color: var(--color-text-secondary); font-size: 14px;">
        <i class="fas fa-info-circle"></i>
        Use when you don't know the exact progress percentage
      </p>
    </div>
  `;
  return wrapper;
};

export const ProgressStriped = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Striped & Animated Progress</h3>

      <div>
        <div class="progress__label">Animated striped progress</div>
        <div class="progress progress--striped-animated">
          <div class="progress__bar progress__bar--primary" style="width: 70%"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const ProgressStacked = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Stacked Progress (Multiple Categories)</h3>

      <div>
        <div class="progress__label">Disk Usage Distribution</div>
        <div class="progress progress--stacked">
          <div class="progress__bar progress__bar--success" style="width: 40%" title="Documents: 40%"></div>
          <div class="progress__bar progress__bar--info" style="width: 30%" title="Images: 30%"></div>
          <div class="progress__bar progress__bar--warning" style="width: 20%" title="Videos: 20%"></div>
          <div class="progress__bar progress__bar--danger" style="width: 10%" title="Other: 10%"></div>
        </div>

        <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 13px;">
          <div style="color: var(--color-success);">
            <span style="display: inline-block; width: 12px; height: 12px; background: var(--color-success); border-radius: 2px; margin-right: 6px;"></span>
            Documents (40%)
          </div>
          <div style="color: var(--color-primary);">
            <span style="display: inline-block; width: 12px; height: 12px; background: var(--color-primary); border-radius: 2px; margin-right: 6px;"></span>
            Images (30%)
          </div>
          <div style="color: var(--color-warning);">
            <span style="display: inline-block; width: 12px; height: 12px; background: var(--color-warning); border-radius: 2px; margin-right: 6px;"></span>
            Videos (20%)
          </div>
          <div style="color: var(--color-danger);">
            <span style="display: inline-block; width: 12px; height: 12px; background: var(--color-danger); border-radius: 2px; margin-right: 6px;"></span>
            Other (10%)
          </div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

/* ========== SPINNERS ========== */

export const SpinnerVariants = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Spinner Variants</h3>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; text-align: center;">
        <div>
          <div class="spinner"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 12px;">Circular</p>
        </div>

        <div>
          <div class="spinner-dots">
            <div class="spinner-dots__dot"></div>
            <div class="spinner-dots__dot"></div>
            <div class="spinner-dots__dot"></div>
          </div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 12px;">Dots</p>
        </div>

        <div>
          <div class="spinner-pulse"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 12px;">Pulse</p>
        </div>

        <div>
          <div class="spinner-ring"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 12px;">Ring</p>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SpinnerSizes = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Spinner Sizes</h3>

      <div style="display: flex; gap: 32px; align-items: center;">
        <div style="text-align: center;">
          <div class="spinner spinner--sm"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 8px;">Small</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--md"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 8px;">Medium</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--lg"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 8px;">Large</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--xl"></div>
          <p style="color: var(--color-text-secondary); font-size: 13px; margin-top: 8px;">XL</p>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SpinnerColors = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Spinner Colors</h3>

      <div style="display: flex; gap: 32px; align-items: center;">
        <div style="text-align: center;">
          <div class="spinner spinner--primary"></div>
          <p style="color: var(--color-primary); font-size: 13px; margin-top: 8px;">Primary</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--success"></div>
          <p style="color: var(--color-success); font-size: 13px; margin-top: 8px;">Success</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--warning"></div>
          <p style="color: var(--color-warning); font-size: 13px; margin-top: 8px;">Warning</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--danger"></div>
          <p style="color: var(--color-danger); font-size: 13px; margin-top: 8px;">Danger</p>
        </div>

        <div style="text-align: center;">
          <div class="spinner spinner--white"></div>
          <p style="color: #fff; font-size: 13px; margin-top: 8px;">White</p>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SpinnerInButton = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Spinners in Buttons</h3>

      <div style="display: flex; gap: 16px;">
        <button class="btn btn-primary">
          <div class="spinner-inline spinner--white"></div>
          Loading...
        </button>

        <button class="btn btn-success">
          <div class="spinner-inline spinner--white"></div>
          Processing
        </button>

        <button class="btn btn-cancel">
          <div class="spinner-inline"></div>
          Please wait
        </button>
      </div>
    </div>
  `;
  return wrapper;
};

export const SpinnerContainer = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Spinner in Container (Centered)</h3>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
        <div class="spinner-container">
          <div class="spinner"></div>
        </div>
      </div>

      <p style="color: var(--color-text-secondary); font-size: 14px; margin-top: 12px;">
        <i class="fas fa-info-circle"></i>
        Use for empty tables, panels, or content areas
      </p>
    </div>
  `;
  return wrapper;
};

/* ========== SKELETONS ========== */

export const SkeletonText = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 600px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Text Skeletons</h3>

      <!-- Heading -->
      <div class="skeleton skeleton--heading"></div>

      <!-- Paragraph -->
      <div class="skeleton--paragraph">
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text skeleton--w-75"></div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SkeletonUserCard = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 500px;">
      <h3 style="color: #fff; margin-bottom: 16px;">User Card Skeleton</h3>

      <div class="skeleton-user-card">
        <div class="skeleton skeleton--avatar skeleton-user-card__avatar"></div>
        <div class="skeleton-user-card__content">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text skeleton--w-75"></div>
          <div class="skeleton skeleton--text skeleton--w-50"></div>
        </div>
      </div>

      <div class="skeleton-user-card">
        <div class="skeleton skeleton--avatar skeleton-user-card__avatar"></div>
        <div class="skeleton-user-card__content">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text skeleton--w-75"></div>
          <div class="skeleton skeleton--text skeleton--w-50"></div>
        </div>
      </div>

      <div class="skeleton-user-card">
        <div class="skeleton skeleton--avatar skeleton-user-card__avatar"></div>
        <div class="skeleton-user-card__content">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text skeleton--w-75"></div>
          <div class="skeleton skeleton--text skeleton--w-50"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SkeletonCard = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; max-width: 400px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Card Skeleton</h3>

      <div class="skeleton-card">
        <div class="skeleton-card__header">
          <div class="skeleton skeleton--avatar"></div>
          <div style="flex: 1;">
            <div class="skeleton skeleton--text skeleton--w-50"></div>
          </div>
        </div>
        <div class="skeleton-card__body">
          <div class="skeleton skeleton--rect-md"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text skeleton--w-75"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SkeletonTable = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Table Skeleton</h3>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; overflow: hidden;">
        <div class="skeleton-table-row">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
        </div>
        <div class="skeleton-table-row">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
        </div>
        <div class="skeleton-table-row">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
        </div>
        <div class="skeleton-table-row">
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
          <div class="skeleton skeleton--text"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const SkeletonAnimations = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px; max-width: 600px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Skeleton Animation Variants</h3>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Shimmer (Default)</p>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text skeleton--w-75"></div>
      </div>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Pulse</p>
        <div class="skeleton skeleton--text skeleton--pulse"></div>
        <div class="skeleton skeleton--text skeleton--pulse skeleton--w-75"></div>
      </div>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Wave</p>
        <div class="skeleton skeleton--text skeleton--wave"></div>
        <div class="skeleton skeleton--text skeleton--wave skeleton--w-75"></div>
      </div>

      <div>
        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: 8px;">Static (No Animation)</p>
        <div class="skeleton skeleton--text skeleton--static"></div>
        <div class="skeleton skeleton--text skeleton--static skeleton--w-75"></div>
      </div>
    </div>
  `;
  return wrapper;
};

/* ========== TOASTS ========== */

export const ToastVariants = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Toast Variants</h3>

      <div class="toast toast--success">
        <div class="toast__icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">Success!</div>
          <div class="toast__message">Changes saved successfully</div>
        </div>
        <button class="toast__close">
          <i class="fas fa-times"></i>
        </button>
        <div class="toast__progress">
          <div class="toast__progress-bar" style="animation-duration: 5s"></div>
        </div>
      </div>

      <div class="toast toast--warning">
        <div class="toast__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">Warning</div>
          <div class="toast__message">Storage is almost full</div>
        </div>
        <button class="toast__close">
          <i class="fas fa-times"></i>
        </button>
        <div class="toast__progress">
          <div class="toast__progress-bar" style="animation-duration: 5s"></div>
        </div>
      </div>

      <div class="toast toast--error">
        <div class="toast__icon">
          <i class="fas fa-times-circle"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">Error</div>
          <div class="toast__message">Failed to upload file</div>
        </div>
        <button class="toast__close">
          <i class="fas fa-times"></i>
        </button>
        <div class="toast__progress">
          <div class="toast__progress-bar" style="animation-duration: 5s"></div>
        </div>
      </div>

      <div class="toast toast--info">
        <div class="toast__icon">
          <i class="fas fa-info-circle"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">New Update Available</div>
          <div class="toast__message">Version 2.0 is now available</div>
        </div>
        <button class="toast__close">
          <i class="fas fa-times"></i>
        </button>
        <div class="toast__progress">
          <div class="toast__progress-bar" style="animation-duration: 5s"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const ToastWithActions = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 16px;">Toast with Actions</h3>

      <div class="toast toast--info">
        <div class="toast__icon">
          <i class="fas fa-trash"></i>
        </div>
        <div class="toast__content">
          <div class="toast__title">Item Deleted</div>
          <div class="toast__message">The item has been removed</div>
          <div class="toast__actions">
            <button class="toast__action">Undo</button>
          </div>
        </div>
        <button class="toast__close">
          <i class="fas fa-times"></i>
        </button>
        <div class="toast__progress">
          <div class="toast__progress-bar" style="animation-duration: 5s"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};

export const ToastSizes = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <h3 style="color: #fff; margin-bottom: 8px;">Toast Sizes</h3>

      <div class="toast toast--success toast--sm">
        <div class="toast__icon"><i class="fas fa-check-circle"></i></div>
        <div class="toast__content">
          <div class="toast__message">Small toast notification</div>
        </div>
      </div>

      <div class="toast toast--info">
        <div class="toast__icon"><i class="fas fa-info-circle"></i></div>
        <div class="toast__content">
          <div class="toast__title">Default Size</div>
          <div class="toast__message">Standard toast notification</div>
        </div>
        <button class="toast__close"><i class="fas fa-times"></i></button>
      </div>

      <div class="toast toast--warning toast--lg">
        <div class="toast__icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="toast__content">
          <div class="toast__title">Large Toast</div>
          <div class="toast__message">Larger toast for more prominent notifications</div>
        </div>
        <button class="toast__close"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `;
  return wrapper;
};

/* ========== COMPLETE EXAMPLE ========== */

export const CompleteExample = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="padding: 24px;">
      <h3 style="color: #fff; margin-bottom: 24px;">Complete Feedback System Example</h3>

      <!-- Alert -->
      <div class="alert alert--info" style="margin-bottom: 24px;">
        <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
        <div class="alert__content">
          <div class="alert__title">Data Import in Progress</div>
          <div class="alert__message">We're importing your data. This may take a few minutes.</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="margin-bottom: 32px;">
        <div class="progress__label">Import Progress: 67%</div>
        <div class="progress progress--lg">
          <div class="progress__bar progress__bar--primary" style="width: 67%">67%</div>
        </div>
      </div>

      <!-- Loading Content (Skeletons) -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h4 style="color: #fff; margin-bottom: 16px;">Loading Data...</h4>
        <div class="skeleton-user-card">
          <div class="skeleton skeleton--avatar skeleton-user-card__avatar"></div>
          <div class="skeleton-user-card__content">
            <div class="skeleton skeleton--text"></div>
            <div class="skeleton skeleton--text skeleton--w-75"></div>
          </div>
        </div>
        <div class="skeleton-user-card">
          <div class="skeleton skeleton--avatar skeleton-user-card__avatar"></div>
          <div class="skeleton-user-card__content">
            <div class="skeleton skeleton--text"></div>
            <div class="skeleton skeleton--text skeleton--w-75"></div>
          </div>
        </div>
      </div>

      <!-- Spinner in Container -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
        <div class="spinner-container spinner-container--sm">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `;
  return wrapper;
};
