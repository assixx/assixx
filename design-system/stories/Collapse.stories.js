/**
 * Collapse Component Stories
 *
 * Standalone expandable/collapsible sections.
 * Simpler than accordion - for single expandable content.
 *
 * NOTE: This story demonstrates the CSS-only version.
 * JavaScript enhancement (initCollapse) can be added later for:
 * - Smooth animations
 * - Keyboard navigation
 * - ARIA state management
 */
import '../frontend/src/design-system/index.css';

export default {
  title: 'Design System/Collapse',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Standalone expandable sections for "Show more" buttons, filter panels, and expandable content. Simpler than accordion.',
      },
    },
  },
};

/**
 * 1. Basic Collapse - Simple show/hide
 */
export const BasicCollapse = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 40px; max-width: 600px;';

  const title = document.createElement('h3');
  title.style.cssText =
    'color: var(--color-text-primary); margin-bottom: 24px;';
  title.textContent = 'Basic Collapse';
  container.appendChild(title);

  // First collapse - NO .collapse wrapper!
  const trigger1 = document.createElement('button');
  trigger1.className = 'collapse__trigger';
  trigger1.style.marginBottom = '12px';
  trigger1.innerHTML =
    'Show more information <i class="fas fa-chevron-down collapse__icon"></i>';

  const content1 = document.createElement('div');
  content1.className = 'collapse__content';

  const body1 = document.createElement('div');
  body1.className = 'collapse__body';
  body1.style.cssText =
    'padding: 16px; background: rgb(255 255 255 / 5%); border-radius: 8px;';
  body1.innerHTML =
    '<p style="margin: 0;">This is hidden content that appears when you click the trigger button. Perfect for "Read more" sections, additional details, or progressive disclosure.</p>';

  content1.appendChild(body1);
  container.appendChild(trigger1);
  container.appendChild(content1);

  // Spacer
  const spacer = document.createElement('div');
  spacer.style.height = '40px';
  container.appendChild(spacer);

  // Second collapse - NO .collapse wrapper!
  const trigger2 = document.createElement('button');
  trigger2.className = 'collapse__trigger';
  trigger2.innerHTML =
    'Advanced settings <i class="fas fa-chevron-down collapse__icon"></i>';

  const content2 = document.createElement('div');
  content2.className = 'collapse__content';
  content2.style.marginTop = '12px';

  const body2 = document.createElement('div');
  body2.className = 'collapse__body';
  body2.style.cssText =
    'padding: 16px; background: rgb(255 255 255 / 5%); border-radius: 8px;';
  body2.innerHTML =
    '<p style="margin: 0 0 12px 0;">Configure advanced options:</p><ul style="margin: 0; padding-left: 20px;"><li>Auto-save enabled</li><li>Notification preferences</li><li>Theme customization</li></ul>';

  content2.appendChild(body2);
  container.appendChild(trigger2);
  container.appendChild(content2);

  return container;
};

BasicCollapse.storyName = '1. Basic Collapse';

/**
 * 2. Card Variant - With border and background
 */
export const CardVariant = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 40px; max-width: 600px;';

  const title = document.createElement('h3');
  title.style.cssText =
    'color: var(--color-text-primary); margin-bottom: 24px;';
  title.textContent = 'Card Variant';
  container.appendChild(title);

  // First card with .collapse--card on wrapper div
  const card1 = document.createElement('div');
  card1.className = 'collapse--card';

  const trigger1 = document.createElement('button');
  trigger1.className = 'collapse__trigger';
  trigger1.innerHTML = `
    <span class="collapse__trigger-icon">
      <i class="fas fa-filter"></i>
      <span>Filter options</span>
    </span>
    <i class="fas fa-chevron-down collapse__icon"></i>
  `;

  const content1 = document.createElement('div');
  content1.className = 'collapse__content';
  content1.innerHTML = `
    <div class="collapse__body">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" checked> Active items only
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox"> Show archived
        </label>
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" checked> Include drafts
        </label>
      </div>
    </div>
  `;

  card1.appendChild(trigger1);
  card1.appendChild(content1);
  container.appendChild(card1);

  // Spacer
  const spacer = document.createElement('div');
  spacer.style.height = '24px';
  container.appendChild(spacer);

  // Second card
  const card2 = document.createElement('div');
  card2.className = 'collapse--card';

  const trigger2 = document.createElement('button');
  trigger2.className = 'collapse__trigger';
  trigger2.innerHTML = `
    <span class="collapse__trigger-icon">
      <i class="fas fa-cog"></i>
      <span>Display settings</span>
    </span>
    <i class="fas fa-chevron-down collapse__icon"></i>
  `;

  const content2 = document.createElement('div');
  content2.className = 'collapse__content';
  content2.innerHTML = `
    <div class="collapse__body">
      <p style="margin: 0 0 12px 0;">Customize your view:</p>
      <select style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--glass-border); background: rgb(255 255 255 / 5%);">
        <option>Compact view</option>
        <option>Comfortable view</option>
        <option>Spacious view</option>
      </select>
    </div>
  `;

  card2.appendChild(trigger2);
  card2.appendChild(content2);
  container.appendChild(card2);

  return container;
};

CardVariant.storyName = '2. Card Variant';

/**
 * 3. Data Attribute API - Using data-collapse-trigger
 */
export const DataAttributeAPI = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 40px; max-width: 600px;';

  container.innerHTML = `
    <h3 style="color: var(--color-text-primary); margin-bottom: 24px;">Data Attribute API</h3>

    <p style="color: var(--color-text-secondary); margin-bottom: 16px;">
      Use <code>data-collapse-trigger</code> for quick setup without wrapper.
    </p>

    <button
      data-collapse-trigger="demo-content-1"
      class="collapse__trigger"
      style="margin-bottom: 12px;">
      Toggle content #1
      <i class="fas fa-chevron-down collapse__icon"></i>
    </button>

    <div id="demo-content-1" class="collapse__content">
      <div class="collapse__body" style="padding: 16px; background: rgb(255 255 255 / 5%); border-radius: 8px;">
        <p style="margin: 0;">Content controlled by data attribute.</p>
      </div>
    </div>

    <div style="height: 32px;"></div>

    <button
      data-collapse-trigger="demo-content-2"
      data-collapse-initial="open"
      class="collapse__trigger">
      Initially open content
      <i class="fas fa-chevron-down collapse__icon"></i>
    </button>

    <div id="demo-content-2" class="collapse__content show">
      <div class="collapse__body" style="padding: 16px; background: rgb(255 255 255 / 5%); border-radius: 8px; margin-top: 12px;">
        <p style="margin: 0;">This content starts in the open state using <code>data-collapse-initial="open"</code>.</p>
      </div>
    </div>
  `;

  return container;
};

DataAttributeAPI.storyName = '3. Data Attribute API';

/**
 * 4. Size Variants - Small and Large
 */
export const SizeVariants = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 40px; max-width: 600px;';

  const title = document.createElement('h3');
  title.style.cssText =
    'color: var(--color-text-primary); margin-bottom: 24px;';
  title.textContent = 'Size Variants';
  container.appendChild(title);

  // Small
  const wrapper1 = document.createElement('div');
  wrapper1.className = 'collapse--sm collapse--bordered';

  const trigger1 = document.createElement('button');
  trigger1.className = 'collapse__trigger';
  trigger1.innerHTML =
    'Small collapse <i class="fas fa-chevron-down collapse__icon"></i>';

  const content1 = document.createElement('div');
  content1.className = 'collapse__content';
  content1.innerHTML =
    '<div class="collapse__body">Compact size for tight spaces or secondary information.</div>';

  wrapper1.appendChild(trigger1);
  wrapper1.appendChild(content1);
  container.appendChild(wrapper1);

  // Spacer
  const spacer1 = document.createElement('div');
  spacer1.style.height = '24px';
  container.appendChild(spacer1);

  // Default
  const wrapper2 = document.createElement('div');
  wrapper2.className = 'collapse--bordered';

  const trigger2 = document.createElement('button');
  trigger2.className = 'collapse__trigger';
  trigger2.innerHTML =
    'Default size collapse <i class="fas fa-chevron-down collapse__icon"></i>';

  const content2 = document.createElement('div');
  content2.className = 'collapse__content';
  content2.innerHTML =
    '<div class="collapse__body">Standard size for most use cases. Balanced readability and spacing.</div>';

  wrapper2.appendChild(trigger2);
  wrapper2.appendChild(content2);
  container.appendChild(wrapper2);

  // Spacer
  const spacer2 = document.createElement('div');
  spacer2.style.height = '24px';
  container.appendChild(spacer2);

  // Large
  const wrapper3 = document.createElement('div');
  wrapper3.className = 'collapse--lg collapse--bordered';

  const trigger3 = document.createElement('button');
  trigger3.className = 'collapse__trigger';
  trigger3.innerHTML =
    'Large collapse <i class="fas fa-chevron-down collapse__icon"></i>';

  const content3 = document.createElement('div');
  content3.className = 'collapse__content';
  content3.innerHTML =
    '<div class="collapse__body">Larger size for primary content or emphasis. Better for touch targets.</div>';

  wrapper3.appendChild(trigger3);
  wrapper3.appendChild(content3);
  container.appendChild(wrapper3);

  return container;
};

SizeVariants.storyName = '4. Size Variants';

/**
 * 5. All Variants - Comprehensive showcase
 */
export const AllVariants = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 40px;';

  const mainTitle = document.createElement('h2');
  mainTitle.style.cssText =
    'color: var(--color-text-primary); margin-bottom: 32px;';
  mainTitle.textContent = 'Complete Collapse System';
  container.appendChild(mainTitle);

  const triggers = [];
  const contents = [];

  // Helper to create section
  function createSection(title, variantClass, text, iconHtml = '') {
    const section = document.createElement('section');
    section.style.marginBottom = '48px';

    const h3 = document.createElement('h3');
    h3.style.cssText =
      'color: var(--color-text-secondary); margin-bottom: 16px;';
    h3.textContent = title;
    section.appendChild(h3);

    const wrapper = document.createElement('div');
    if (variantClass) wrapper.className = variantClass;

    const trigger = document.createElement('button');
    trigger.className = 'collapse__trigger';
    trigger.innerHTML =
      (iconHtml || text) +
      ' <i class="fas fa-chevron-down collapse__icon"></i>';

    const content = document.createElement('div');
    content.className = 'collapse__content';
    content.innerHTML = `<div class="collapse__body">${text}</div>`;

    wrapper.appendChild(trigger);
    wrapper.appendChild(content);
    section.appendChild(wrapper);
    container.appendChild(section);

    triggers.push(trigger);
    contents.push(content);
  }

  createSection(
    'Basic',
    '',
    'Basic unstyled collapse for flexible integration.',
    'Show details',
  );
  createSection(
    'Card Style',
    'collapse--card',
    'Glassmorphism card with hover effects.',
    '<span class="collapse__trigger-icon"><i class="fas fa-info-circle"></i><span>Product information</span></span>',
  );
  createSection(
    'Bordered',
    'collapse--bordered',
    'Minimal style with bottom border.',
    'Technical specifications',
  );
  createSection(
    'Filled',
    'collapse--filled',
    'Subtle background for visual grouping.',
    'Shipping information',
  );

  return container;
};

AllVariants.storyName = '5. All Variants';
