/**
 * Avatar Component – WhatsApp-style User Avatars
 *
 * User profile avatars with initials fallback and consistent color assignment.
 * 10 color variants, status indicators, and avatar groups.
 */

export default {
  title: 'Design System/Avatar',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    name: {
      control: 'text',
      description: 'Full name for initials',
    },
    username: {
      control: 'text',
      description: 'Username for consistent color assignment',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Avatar size',
    },
    shape: {
      control: 'select',
      options: ['circle', 'square'],
      description: 'Avatar shape',
    },
    status: {
      control: 'select',
      options: ['none', 'online', 'offline', 'busy', 'away'],
      description: 'Status indicator',
    },
    imageUrl: {
      control: 'text',
      description: 'Optional image URL',
    },
  },

  globals: {
    backgrounds: {
      value: 'assixx-dark',
    },
  },
};

/**
 * Helper to get initials from name
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Helper to get consistent color class
 */
function getColorClass(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash = hash & hash;
  }
  return `avatar--color-${Math.abs(hash) % 10}`;
}

/**
 * Basic Avatar with Initials
 */
export const BasicAvatar = {
  args: {
    name: 'John Doe',
    username: 'john.doe',
    size: 'md',
    shape: 'circle',
    status: 'none',
    imageUrl: '',
  },
  render: (args) => {
    const sizeClass = args.size !== 'md' ? `avatar--${args.size}` : '';
    const shapeClass = args.shape === 'square' ? 'avatar--square' : '';
    const colorClass = getColorClass(args.username);
    const initials = getInitials(args.name);

    const statusHtml =
      args.status !== 'none' ?
        `<span class="avatar__status avatar__status--${args.status}"></span>`
      : '';

    const wrapper = document.createElement('div');

    if (args.imageUrl) {
      wrapper.innerHTML = `
        <div class="avatar ${sizeClass} ${shapeClass}">
          <img src="${args.imageUrl}" alt="${args.name}" class="avatar__image">
          ${statusHtml}
        </div>
      `;
    } else {
      wrapper.innerHTML = `
        <div class="avatar ${colorClass} ${sizeClass} ${shapeClass}">
          <span class="avatar__initials">${initials}</span>
          ${statusHtml}
        </div>
      `;
    }

    return wrapper;
  },
};

/**
 * All Size Variants
 */
export const SizeVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="avatar avatar--xs avatar--color-4">
          <span class="avatar__initials">XS</span>
        </div>
        <div class="avatar avatar--sm avatar--color-4">
          <span class="avatar__initials">SM</span>
        </div>
        <div class="avatar avatar--color-4">
          <span class="avatar__initials">MD</span>
        </div>
        <div class="avatar avatar--lg avatar--color-4">
          <span class="avatar__initials">LG</span>
        </div>
        <div class="avatar avatar--xl avatar--color-4">
          <span class="avatar__initials">XL</span>
        </div>
      </div>
    `;
    return wrapper;
  },
};

/**
 * All 10 Color Variants (WhatsApp Style)
 */
export const ColorVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map(
            (i) => `
          <div class="avatar avatar--color-${i}">
            <span class="avatar__initials">C${i}</span>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
    return wrapper;
  },
};

/**
 * Status Indicators
 */
export const WithStatus = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; gap: 2rem;">
        <div>
          <div class="avatar avatar--lg avatar--color-7">
            <span class="avatar__initials">JD</span>
            <span class="avatar__status avatar__status--online"></span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Online</p>
        </div>
        <div>
          <div class="avatar avatar--lg avatar--color-2">
            <span class="avatar__initials">AB</span>
            <span class="avatar__status avatar__status--offline"></span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Offline</p>
        </div>
        <div>
          <div class="avatar avatar--lg avatar--color-0">
            <span class="avatar__initials">MC</span>
            <span class="avatar__status avatar__status--busy"></span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Busy</p>
        </div>
        <div>
          <div class="avatar avatar--lg avatar--color-8">
            <span class="avatar__initials">SK</span>
            <span class="avatar__status avatar__status--away"></span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Away</p>
        </div>
      </div>
    `;
    return wrapper;
  },
};

/**
 * Circle vs Square
 */
export const ShapeVariants = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; gap: 2rem;">
        <div>
          <div class="avatar avatar--lg avatar--color-3">
            <span class="avatar__initials">JD</span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Circle</p>
        </div>
        <div>
          <div class="avatar avatar--lg avatar--square avatar--color-3">
            <span class="avatar__initials">JD</span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Square</p>
        </div>
      </div>
    `;
    return wrapper;
  },
};

/**
 * Image vs Initials Fallback
 */
export const ImageFallback = {
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; gap: 2rem; align-items: center;">
        <div>
          <div class="avatar avatar--lg">
            <img src="https://i.pravatar.cc/150?img=12" alt="User" class="avatar__image">
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">With Image</p>
        </div>
        <div>
          <div class="avatar avatar--lg avatar--color-5">
            <span class="avatar__initials">JD</span>
          </div>
          <p style="text-align: center; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted);">Initials Fallback</p>
        </div>
      </div>
    `;
    return wrapper;
  },
};

/**
 * Avatar Group (Stacked)
 */
export const AvatarGroup = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Small Group (5 members)</h4>
          <div class="avatar-group">
            <div class="avatar avatar--color-0">
              <span class="avatar__initials">JD</span>
            </div>
            <div class="avatar avatar--color-1">
              <span class="avatar__initials">AB</span>
            </div>
            <div class="avatar avatar--color-2">
              <span class="avatar__initials">MC</span>
            </div>
            <div class="avatar avatar--color-3">
              <span class="avatar__initials">SK</span>
            </div>
            <div class="avatar avatar--color-4">
              <span class="avatar__initials">TW</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Large Group (8+ members)</h4>
          <div class="avatar-group">
            <div class="avatar avatar--color-0">
              <span class="avatar__initials">JD</span>
            </div>
            <div class="avatar avatar--color-1">
              <span class="avatar__initials">AB</span>
            </div>
            <div class="avatar avatar--color-2">
              <span class="avatar__initials">MC</span>
            </div>
            <div class="avatar avatar--color-3">
              <span class="avatar__initials">SK</span>
            </div>
            <div class="avatar avatar--color-4">
              <span class="avatar__initials">TW</span>
            </div>
            <div class="avatar-group__count">+3</div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Large Size Group</h4>
          <div class="avatar-group avatar-group--lg">
            <div class="avatar avatar--lg avatar--color-5">
              <span class="avatar__initials">JD</span>
            </div>
            <div class="avatar avatar--lg avatar--color-6">
              <span class="avatar__initials">AB</span>
            </div>
            <div class="avatar avatar--lg avatar--color-7">
              <span class="avatar__initials">MC</span>
            </div>
          </div>
        </div>
      </div>
    `;
    return wrapper;
  },
};

/**
 * Real-World Example: User Profile Card
 */
export const UserProfileCard = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 400px; padding: 2rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; backdrop-filter: blur(10px);">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
          <div class="avatar avatar--xl avatar--color-4">
            <span class="avatar__initials">JD</span>
            <span class="avatar__status avatar__status--online"></span>
          </div>
          <div>
            <h3 style="margin: 0; color: var(--color-text-primary);">John Doe</h3>
            <p style="margin: 0.25rem 0 0 0; color: var(--color-text-muted); font-size: 0.875rem;">Senior Developer</p>
          </div>
        </div>
        <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
          <p style="margin: 0; color: var(--color-text-secondary); font-size: 0.875rem;">
            "Building amazing products with modern technologies. Coffee enthusiast and open-source contributor."
          </p>
        </div>
      </div>
    `;
    return wrapper;
  },
};

/**
 * Real-World Example: Comment Section
 */
export const CommentSection = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 600px;">
        <h4 style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">Comments (3)</h4>

        ${[
          {
            name: 'Sarah Johnson',
            initials: 'SJ',
            color: 1,
            time: '2 hours ago',
            comment:
              'Great work on this feature! The glassmorphism design really makes it stand out.',
          },
          {
            name: 'Mike Chen',
            initials: 'MC',
            color: 5,
            time: '5 hours ago',
            comment:
              'Love the attention to detail. The color palette is perfect for our brand.',
          },
          {
            name: 'Emily Rodriguez',
            initials: 'ER',
            color: 8,
            time: '1 day ago',
            comment:
              "This will be a huge improvement for the user experience. Can't wait to see it live!",
          },
        ]
          .map(
            (c) => `
          <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 255, 255, 0.02); border-radius: 8px;">
            <div class="avatar avatar--color-${c.color}">
              <span class="avatar__initials">${c.initials}</span>
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <strong style="color: var(--color-text-primary);">${c.name}</strong>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">${c.time}</span>
              </div>
              <p style="margin: 0; color: var(--color-text-secondary);">${c.comment}</p>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
    return wrapper;
  },
};

/**
 * Real-World Example: Team Members List
 */
export const TeamMembersList = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="max-width: 500px;">
        <h4 style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">Team Members (5)</h4>

        ${[
          {
            name: 'John Doe',
            initials: 'JD',
            color: 4,
            role: 'Team Lead',
            status: 'online',
          },
          {
            name: 'Alice Brown',
            initials: 'AB',
            color: 2,
            role: 'Senior Developer',
            status: 'online',
          },
          {
            name: 'Mike Chen',
            initials: 'MC',
            color: 5,
            role: 'Designer',
            status: 'away',
          },
          {
            name: 'Sarah Kim',
            initials: 'SK',
            color: 7,
            role: 'Product Manager',
            status: 'busy',
          },
          {
            name: 'Tom Wilson',
            initials: 'TW',
            color: 0,
            role: 'QA Engineer',
            status: 'offline',
          },
        ]
          .map(
            (member) => `
          <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
            <div class="avatar avatar--color-${member.color}">
              <span class="avatar__initials">${member.initials}</span>
              <span class="avatar__status avatar__status--${member.status}"></span>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.25rem;">${member.name}</div>
              <div style="font-size: 0.875rem; color: var(--color-text-muted);">${member.role}</div>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
    return wrapper;
  },
};

/**
 * All Variants Showcase
 */
export const AllVariants = {
  parameters: {
    layout: 'padded',
  },
  render: () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 3rem;">
        <!-- Sizes -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Sizes</h3>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="avatar avatar--xs avatar--color-4">
              <span class="avatar__initials">XS</span>
            </div>
            <div class="avatar avatar--sm avatar--color-4">
              <span class="avatar__initials">SM</span>
            </div>
            <div class="avatar avatar--color-4">
              <span class="avatar__initials">MD</span>
            </div>
            <div class="avatar avatar--lg avatar--color-4">
              <span class="avatar__initials">LG</span>
            </div>
            <div class="avatar avatar--xl avatar--color-4">
              <span class="avatar__initials">XL</span>
            </div>
          </div>
        </div>

        <!-- Colors -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Colors (10 Variants)</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
              .map(
                (i) => `
              <div class="avatar avatar--color-${i}">
                <span class="avatar__initials">C${i}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>

        <!-- Status -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Status Indicators</h3>
          <div style="display: flex; gap: 1.5rem;">
            <div class="avatar avatar--lg avatar--color-7">
              <span class="avatar__initials">ON</span>
              <span class="avatar__status avatar__status--online"></span>
            </div>
            <div class="avatar avatar--lg avatar--color-2">
              <span class="avatar__initials">OF</span>
              <span class="avatar__status avatar__status--offline"></span>
            </div>
            <div class="avatar avatar--lg avatar--color-0">
              <span class="avatar__initials">BS</span>
              <span class="avatar__status avatar__status--busy"></span>
            </div>
            <div class="avatar avatar--lg avatar--color-8">
              <span class="avatar__initials">AW</span>
              <span class="avatar__status avatar__status--away"></span>
            </div>
          </div>
        </div>

        <!-- Shapes -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Shapes</h3>
          <div style="display: flex; gap: 1.5rem;">
            <div class="avatar avatar--lg avatar--color-3">
              <span class="avatar__initials">CR</span>
            </div>
            <div class="avatar avatar--lg avatar--square avatar--color-3">
              <span class="avatar__initials">SQ</span>
            </div>
          </div>
        </div>

        <!-- Groups -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--color-text-secondary);">Avatar Groups</h3>
          <div class="avatar-group">
            <div class="avatar avatar--color-0">
              <span class="avatar__initials">JD</span>
            </div>
            <div class="avatar avatar--color-1">
              <span class="avatar__initials">AB</span>
            </div>
            <div class="avatar avatar--color-2">
              <span class="avatar__initials">MC</span>
            </div>
            <div class="avatar avatar--color-3">
              <span class="avatar__initials">SK</span>
            </div>
            <div class="avatar avatar--color-4">
              <span class="avatar__initials">TW</span>
            </div>
            <div class="avatar-group__count">+5</div>
          </div>
        </div>
      </div>
    `;
    return wrapper;
  },
};
