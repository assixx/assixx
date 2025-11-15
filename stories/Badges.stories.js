/**
 * Badges – Status Indicators & Labels
 *
 * Badges for status, actions, roles, and tags.
 * Source: logs.css + DESIGN-STANDARDS.md
 */

export default {
  title: 'Design System/Badges',
  tags: ['autodocs'],
  globals: {
    backgrounds: {
      value: "assixx-dark"
    }
  },
};

/**
 * Status Badges
 *
 * Standard status indicators for success, warning, error, info states.
 */
export const StatusBadges = {
  args: {
    variant: 'success',
    label: 'Success',
    size: 'default',
    uppercase: false,
    dot: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'danger', 'error', 'info', 'primary', 'dark'],
      description: 'Badge color variant',
    },
    label: {
      control: 'text',
      description: 'Badge text',
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
      description: 'Badge size',
    },
    uppercase: {
      control: 'boolean',
      description: 'Uppercase text',
    },
    dot: {
      control: 'boolean',
      description: 'Show dot indicator',
    },
  },
  render: (args) => {
    const sizeClass = args.size !== 'default' ? `badge--${args.size}` : '';
    const uppercaseClass = args.uppercase ? 'badge--uppercase' : '';
    const dotClass = args.dot ? 'badge--dot' : '';

    const badge = document.createElement('span');
    badge.className = `badge badge--${args.variant} ${sizeClass} ${uppercaseClass} ${dotClass}`.trim();
    badge.textContent = args.label;

    return badge;
  },
};

/**
 * All Status Variants
 *
 * Overview of all available status badge variants.
 */
export const AllStatusVariants = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const variants = [
      { variant: 'success', label: 'Success' },
      { variant: 'warning', label: 'Warning' },
      { variant: 'danger', label: 'Danger' },
      { variant: 'error', label: 'Error' },
      { variant: 'info', label: 'Info' },
      { variant: 'primary', label: 'Primary' },
      { variant: 'dark', label: 'Dark' },
    ];

    variants.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Action Badges
 *
 * Badges for log actions and events (from logs.css).
 */
export const ActionBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const actions = [
      { variant: 'login', label: 'Login' },
      { variant: 'create', label: 'Created' },
      { variant: 'update', label: 'Updated' },
      { variant: 'delete', label: 'Deleted' },
      { variant: 'logout', label: 'Logout' },
      { variant: 'role-switch', label: 'Role Switch' },
      { variant: 'share', label: 'Shared' },
      { variant: 'comment', label: 'Comment' },
      { variant: 'upload', label: 'Uploaded' },
      { variant: 'download', label: 'Downloaded' },
    ];

    actions.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Role Badges
 *
 * Badges for user roles (from logs.css).
 * Note: Role badges typically use badge--sm size.
 */
export const RoleBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const roles = [
      { variant: 'role-root', label: 'Root' },
      { variant: 'role-admin', label: 'Admin' },
      { variant: 'role-employee', label: 'Employee' },
      { variant: 'role-manager', label: 'Manager' },
      { variant: 'role-guest', label: 'Guest' },
    ];

    roles.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--sm badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Size Comparison
 *
 * Shows all available badge sizes.
 */
export const SizeComparison = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';
    container.style.padding = '20px';

    const sizes = [
      { size: 'sm', label: 'Small Badge', description: 'Compact size for roles and tags' },
      { size: '', label: 'Default Badge', description: 'Standard size for most use cases' },
      { size: 'lg', label: 'Large Badge', description: 'Prominent size for emphasis' },
    ];

    sizes.forEach(({ size, label, description }) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '16px';

      const badge = document.createElement('span');
      badge.className = size ? `badge badge--${size} badge--success` : 'badge badge--success';
      badge.textContent = label;

      const desc = document.createElement('span');
      desc.style.color = 'var(--color-text-secondary)';
      desc.style.fontSize = '14px';
      desc.textContent = description;

      row.appendChild(badge);
      row.appendChild(desc);
      container.appendChild(row);
    });

    return container;
  },
};

/**
 * With Dot Indicator
 *
 * Badges with leading dot for status indication.
 */
export const WithDotIndicator = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const badges = [
      { variant: 'success', label: 'Online' },
      { variant: 'warning', label: 'Away' },
      { variant: 'danger', label: 'Offline' },
      { variant: 'info', label: 'Busy' },
    ];

    badges.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--dot badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Uppercase Variant
 *
 * Badges with uppercase text for emphasis.
 */
export const UppercaseVariant = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const badges = [
      { variant: 'primary', label: 'new' },
      { variant: 'warning', label: 'beta' },
      { variant: 'success', label: 'verified' },
      { variant: 'danger', label: 'urgent' },
    ];

    badges.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--uppercase badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * In Table Context
 *
 * Badges used in a typical log table (like logs.html).
 */
export const InTableContext = {
  render: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
              <th style="padding: 12px; text-align: left; color: var(--color-text-secondary); font-size: 12px; text-transform: uppercase;">User</th>
              <th style="padding: 12px; text-align: left; color: var(--color-text-secondary); font-size: 12px; text-transform: uppercase;">Role</th>
              <th style="padding: 12px; text-align: left; color: var(--color-text-secondary); font-size: 12px; text-transform: uppercase;">Action</th>
              <th style="padding: 12px; text-align: left; color: var(--color-text-secondary); font-size: 12px; text-transform: uppercase;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 16px; color: var(--color-text-primary);">Max Mustermann</td>
              <td style="padding: 16px;"><span class="badge badge--sm badge--role-admin">Admin</span></td>
              <td style="padding: 16px;"><span class="badge badge--login">Login</span></td>
              <td style="padding: 16px;"><span class="badge badge--success">Success</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 16px; color: var(--color-text-primary);">Anna Schmidt</td>
              <td style="padding: 16px;"><span class="badge badge--sm badge--role-employee">Employee</span></td>
              <td style="padding: 16px;"><span class="badge badge--create">Created</span></td>
              <td style="padding: 16px;"><span class="badge badge--success">Success</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 16px; color: var(--color-text-primary);">John Doe</td>
              <td style="padding: 16px;"><span class="badge badge--sm badge--role-root">Root</span></td>
              <td style="padding: 16px;"><span class="badge badge--delete">Deleted</span></td>
              <td style="padding: 16px;"><span class="badge badge--danger">Error</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    return container;
  },
};

/**
 * KVP Priority Badges
 *
 * Priority levels for KVP suggestions.
 */
export const KVPPriorityBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const priorities = [
      { variant: 'priority-low', label: 'Low' },
      { variant: 'priority-normal', label: 'Normal' },
      { variant: 'priority-high', label: 'High' },
      { variant: 'priority-urgent', label: 'Urgent' },
    ];

    priorities.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * KVP Status Badges
 *
 * Status indicators for KVP suggestion workflow.
 */
export const KVPStatusBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const statuses = [
      { variant: 'kvp-new', label: 'New' },
      { variant: 'kvp-in-review', label: 'In Review' },
      { variant: 'kvp-approved', label: 'Approved' },
      { variant: 'kvp-implemented', label: 'Implemented' },
      { variant: 'kvp-rejected', label: 'Rejected' },
      { variant: 'kvp-archived', label: 'Archived' },
    ];

    statuses.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Visibility Badges
 *
 * Scope/visibility levels for KVP suggestions.
 */
export const VisibilityBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const visibilities = [
      { variant: 'visibility-team', label: 'Team', icon: 'fa-users' },
      { variant: 'visibility-department', label: 'Department', icon: 'fa-building' },
      { variant: 'visibility-company', label: 'Company', icon: 'fa-globe' },
    ];

    visibilities.forEach(({ variant, label, icon }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Active/Inactive Badges
 *
 * Active and inactive status indicators.
 */
export const ActiveInactiveBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const statuses = [
      { variant: 'active', label: 'Active' },
      { variant: 'inactive', label: 'Inactive' },
    ];

    statuses.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * KVP Card Example
 *
 * Shows how badges are used in a KVP suggestion card.
 */
export const KVPCardExample = {
  render: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 20px; max-width: 600px;">
        <div style="
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(20px);
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <h3 style="color: var(--color-text-primary); margin: 0;">Prozessverbesserung Lager</h3>
            <div style="display: flex; gap: 8px;">
              <span class="badge badge--priority-high">High</span>
              <span class="badge badge--kvp-in-review">In Review</span>
            </div>
          </div>

          <p style="color: var(--color-text-secondary); font-size: 14px; margin-bottom: 16px;">
            Optimierung der Lagerverwaltung durch digitale Bestandsführung...
          </p>

          <div style="display: flex; gap: 12px; align-items: center;">
            <span class="badge badge--sm badge--visibility-department">
              <i class="fas fa-building"></i> Department
            </span>
            <span style="color: var(--color-text-secondary); font-size: 13px;">
              Created by Max Mustermann
            </span>
          </div>
        </div>
      </div>
    `;

    return container;
  },
};

/**
 * Process Status Badges
 *
 * Status indicators for processes and workflows (tenant deletion, jobs, etc.).
 */
export const ProcessStatusBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const statuses = [
      { variant: 'pending', label: 'Pending' },
      { variant: 'pending-approval', label: 'Pending Approval' },
      { variant: 'approved', label: 'Approved' },
      { variant: 'processing', label: 'Processing' },
      { variant: 'completed', label: 'Completed' },
      { variant: 'failed', label: 'Failed' },
      { variant: 'cancelled', label: 'Cancelled' },
      { variant: 'queued', label: 'Queued' },
    ];

    statuses.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Workflow Status Badges
 *
 * Task and workflow states (todo, in-progress, done, etc.).
 */
export const WorkflowStatusBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';
    container.style.padding = '20px';

    const categories = [
      {
        title: 'Task Status',
        badges: [
          { variant: 'todo', label: 'To Do' },
          { variant: 'in-progress', label: 'In Progress' },
          { variant: 'done', label: 'Done' },
          { variant: 'blocked', label: 'Blocked' },
          { variant: 'on-hold', label: 'On Hold' },
        ],
      },
      {
        title: 'Document Status',
        badges: [
          { variant: 'draft', label: 'Draft' },
          { variant: 'under-review', label: 'Under Review' },
          { variant: 'published', label: 'Published' },
          { variant: 'expired', label: 'Expired' },
        ],
      },
      {
        title: 'Health Status',
        badges: [
          { variant: 'online', label: 'Online' },
          { variant: 'offline', label: 'Offline' },
          { variant: 'degraded', label: 'Degraded' },
          { variant: 'maintenance', label: 'Maintenance' },
        ],
      },
    ];

    categories.forEach(({ title, badges }) => {
      const section = document.createElement('div');

      const heading = document.createElement('h4');
      heading.style.color = 'var(--color-text-secondary)';
      heading.style.fontSize = '12px';
      heading.style.textTransform = 'uppercase';
      heading.style.letterSpacing = '1px';
      heading.style.marginBottom = '12px';
      heading.textContent = title;

      const badgeContainer = document.createElement('div');
      badgeContainer.style.display = 'flex';
      badgeContainer.style.flexWrap = 'wrap';
      badgeContainer.style.gap = '8px';

      badges.forEach(({ variant, label }) => {
        const badge = document.createElement('span');
        badge.className = `badge badge--${variant}`;
        badge.textContent = label;
        badgeContainer.appendChild(badge);
      });

      section.appendChild(heading);
      section.appendChild(badgeContainer);
      container.appendChild(section);
    });

    return container;
  },
};

/**
 * Severity Badges
 *
 * Severity levels for issues, incidents, alerts.
 */
export const SeverityBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const severities = [
      { variant: 'critical', label: 'Critical' },
      { variant: 'major', label: 'Major' },
      { variant: 'minor', label: 'Minor' },
    ];

    severities.forEach(({ variant, label }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      badge.textContent = label;
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Count Badges
 *
 * Notification and count indicators (circular and pill shapes).
 */
export const CountBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '32px';
    container.style.padding = '20px';

    // Circle counts
    const circleSection = document.createElement('div');
    const circleTitle = document.createElement('h4');
    circleTitle.style.color = 'var(--color-text-secondary)';
    circleTitle.style.fontSize = '12px';
    circleTitle.style.textTransform = 'uppercase';
    circleTitle.style.marginBottom = '16px';
    circleTitle.textContent = 'Circular Count Badges';

    const circleContainer = document.createElement('div');
    circleContainer.style.display = 'flex';
    circleContainer.style.gap = '16px';
    circleContainer.style.alignItems = 'center';

    [1, 5, 12, 99].forEach((num) => {
      const badge = document.createElement('span');
      badge.className = 'badge badge--count';
      badge.textContent = num;
      circleContainer.appendChild(badge);
    });

    circleSection.appendChild(circleTitle);
    circleSection.appendChild(circleContainer);

    // Pill counts
    const pillSection = document.createElement('div');
    const pillTitle = document.createElement('h4');
    pillTitle.style.color = 'var(--color-text-secondary)';
    pillTitle.style.fontSize = '12px';
    pillTitle.style.textTransform = 'uppercase';
    pillTitle.style.marginBottom = '16px';
    pillTitle.textContent = 'Pill Count Badges';

    const pillContainer = document.createElement('div');
    pillContainer.style.display = 'flex';
    pillContainer.style.gap = '16px';
    pillContainer.style.alignItems = 'center';

    [3, 24, 156, '99+'].forEach((num) => {
      const badge = document.createElement('span');
      badge.className = 'badge badge--count-pill';
      badge.textContent = num;
      pillContainer.appendChild(badge);
    });

    pillSection.appendChild(pillTitle);
    pillSection.appendChild(pillContainer);

    // Colored variants
    const colorSection = document.createElement('div');
    const colorTitle = document.createElement('h4');
    colorTitle.style.color = 'var(--color-text-secondary)';
    colorTitle.style.fontSize = '12px';
    colorTitle.style.textTransform = 'uppercase';
    colorTitle.style.marginBottom = '16px';
    colorTitle.textContent = 'Colored Count Badges';

    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.gap = '16px';
    colorContainer.style.alignItems = 'center';

    const colors = [
      { variant: 'success', num: 5 },
      { variant: 'warning', num: 12 },
      { variant: 'danger', num: 3 },
      { variant: 'info', num: 8 },
    ];

    colors.forEach(({ variant, num }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--count badge--${variant}`;
      badge.textContent = num;
      colorContainer.appendChild(badge);
    });

    colorSection.appendChild(colorTitle);
    colorSection.appendChild(colorContainer);

    container.appendChild(circleSection);
    container.appendChild(pillSection);
    container.appendChild(colorSection);

    return container;
  },
};

/**
 * Count Badge in Context
 *
 * Shows count badges positioned on icons/buttons.
 */
export const CountBadgeInContext = {
  render: () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 20px; display: flex; gap: 32px; align-items: center;">
        <!-- Chat icon with unread count -->
        <div style="position: relative; display: inline-block;">
          <i class="fas fa-comment" style="font-size: 32px; color: var(--color-text-primary);"></i>
          <span class="badge badge--count badge--count-absolute">3</span>
        </div>

        <!-- Bell icon with notifications -->
        <div style="position: relative; display: inline-block;">
          <i class="fas fa-bell" style="font-size: 32px; color: var(--color-text-primary);"></i>
          <span class="badge badge--count badge--count-absolute badge--danger">12</span>
        </div>

        <!-- Shopping cart with items -->
        <div style="position: relative; display: inline-block;">
          <i class="fas fa-shopping-cart" style="font-size: 32px; color: var(--color-text-primary);"></i>
          <span class="badge badge--count badge--count-absolute badge--success">5</span>
        </div>

        <!-- Pulsing notification -->
        <div style="position: relative; display: inline-block;">
          <i class="fas fa-envelope" style="font-size: 32px; color: var(--color-text-primary);"></i>
          <span class="badge badge--count badge--count-absolute badge--count-pulse">1</span>
        </div>
      </div>
    `;

    return container;
  },
};

/**
 * Special Badges
 *
 * Beta, Premium, Verified, etc.
 */
export const SpecialBadges = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '12px';
    container.style.padding = '20px';

    const badges = [
      { variant: 'beta', label: 'Beta' },
      { variant: 'premium', label: 'Premium' },
      { variant: 'verified', label: 'Verified', icon: 'fa-check-circle' },
      { variant: 'unread', label: 'Unread' },
    ];

    badges.forEach(({ variant, label, icon }) => {
      const badge = document.createElement('span');
      badge.className = `badge badge--${variant}`;
      if (icon) {
        badge.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
      } else {
        badge.textContent = label;
      }
      container.appendChild(badge);
    });

    return container;
  },
};

/**
 * Combined Examples
 *
 * Real-world combinations of badge modifiers.
 */
export const CombinedExamples = {
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '20px';
    container.style.padding = '20px';

    const examples = [
      {
        title: 'User Status',
        badges: [
          { classes: 'badge badge--dot badge--success', text: 'Online' },
          { classes: 'badge badge--dot badge--warning', text: 'Away' },
          { classes: 'badge badge--dot badge--danger', text: 'Offline' },
        ],
      },
      {
        title: 'Notifications',
        badges: [
          { classes: 'badge badge--sm badge--uppercase badge--primary', text: 'new' },
          { classes: 'badge badge--sm badge--uppercase badge--warning', text: 'beta' },
          { classes: 'badge badge--sm badge--uppercase badge--success', text: 'pro' },
        ],
      },
      {
        title: 'Log Actions',
        badges: [
          { classes: 'badge badge--login', text: 'Login' },
          { classes: 'badge badge--create', text: 'Created User' },
          { classes: 'badge badge--update', text: 'Updated Profile' },
          { classes: 'badge badge--delete', text: 'Deleted File' },
        ],
      },
    ];

    examples.forEach(({ title, badges }) => {
      const section = document.createElement('div');

      const heading = document.createElement('h4');
      heading.style.color = 'var(--color-text-secondary)';
      heading.style.fontSize = '12px';
      heading.style.textTransform = 'uppercase';
      heading.style.letterSpacing = '1px';
      heading.style.marginBottom = '12px';
      heading.textContent = title;

      const badgeContainer = document.createElement('div');
      badgeContainer.style.display = 'flex';
      badgeContainer.style.flexWrap = 'wrap';
      badgeContainer.style.gap = '8px';

      badges.forEach(({ classes, text }) => {
        const badge = document.createElement('span');
        badge.className = classes;
        badge.textContent = text;
        badgeContainer.appendChild(badge);
      });

      section.appendChild(heading);
      section.appendChild(badgeContainer);
      container.appendChild(section);
    });

    return container;
  },
};
