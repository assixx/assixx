/**
 * Design Tokens - Assixx Design System
 *
 * Visual documentation of all design tokens
 * Colors, Spacing, Typography, Shadows, Gradients
 */

export default {
  title: 'Design System/Tokens',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
};

/**
 * COLORS
 * Material Design color palette
 */
export const Colors = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '40px';

    const title = document.createElement('h2');
    title.textContent = 'Color Palette';
    title.style.color = 'var(--color-white)';
    title.style.marginBottom = '32px';
    container.appendChild(title);

    const colorGroups = [
      {
        name: 'Grayscale',
        colors: [
          { name: 'Black', value: '--color-black' },
          { name: 'Gray 950', value: '--color-gray-950' },
          { name: 'Gray 900', value: '--color-gray-900' },
          { name: 'Gray 800', value: '--color-gray-800' },
          { name: 'Gray 700', value: '--color-gray-700' },
          { name: 'Gray 600', value: '--color-gray-600' },
          { name: 'Gray 500', value: '--color-gray-500' },
          { name: 'Gray 400', value: '--color-gray-400' },
          { name: 'Gray 300', value: '--color-gray-300' },
          { name: 'Gray 200', value: '--color-gray-200' },
          { name: 'Gray 100', value: '--color-gray-100' },
          { name: 'Gray 50', value: '--color-gray-50' },
          { name: 'White', value: '--color-white' },
        ],
      },
      {
        name: 'Blue (Primary)',
        colors: [
          { name: 'Blue 900', value: '--color-blue-900' },
          { name: 'Blue 800', value: '--color-blue-800' },
          { name: 'Blue 700', value: '--color-blue-700' },
          { name: 'Blue 600', value: '--color-blue-600' },
          { name: 'Blue 500', value: '--color-blue-500' },
          { name: 'Blue 400', value: '--color-blue-400' },
          { name: 'Blue 300', value: '--color-blue-300' },
          { name: 'Blue 200', value: '--color-blue-200' },
          { name: 'Blue 100', value: '--color-blue-100' },
          { name: 'Blue 50', value: '--color-blue-50' },
        ],
      },
      {
        name: 'Semantic Colors',
        colors: [
          { name: 'Red 600 (Danger)', value: '--color-red-600' },
          { name: 'Red 500', value: '--color-red-500' },
          { name: 'Red 400', value: '--color-red-400' },
          { name: 'Green 600 (Success)', value: '--color-green-600' },
          { name: 'Green 500', value: '--color-green-500' },
          { name: 'Green 400', value: '--color-green-400' },
          { name: 'Orange 600 (Warning)', value: '--color-orange-600' },
          { name: 'Orange 500', value: '--color-orange-500' },
          { name: 'Orange 400', value: '--color-orange-400' },
        ],
      },
    ];

    colorGroups.forEach((group) => {
      const groupTitle = document.createElement('h3');
      groupTitle.textContent = group.name;
      groupTitle.style.color = 'var(--color-text-secondary)';
      groupTitle.style.marginTop = '32px';
      groupTitle.style.marginBottom = '16px';
      container.appendChild(groupTitle);

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
      grid.style.gap = '16px';

      group.colors.forEach((color) => {
        const swatch = document.createElement('div');
        swatch.style.padding = '16px';
        swatch.style.background = 'rgba(255, 255, 255, 0.02)';
        swatch.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        swatch.style.borderRadius = '8px';

        const colorBox = document.createElement('div');
        colorBox.style.width = '100%';
        colorBox.style.height = '80px';
        colorBox.style.background = `var(${color.value})`;
        colorBox.style.borderRadius = '4px';
        colorBox.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        colorBox.style.marginBottom = '12px';

        const name = document.createElement('div');
        name.textContent = color.name;
        name.style.color = 'var(--color-white)';
        name.style.fontSize = '14px';
        name.style.fontWeight = '500';
        name.style.marginBottom = '4px';

        const token = document.createElement('div');
        token.textContent = color.value;
        token.style.color = 'var(--color-text-secondary)';
        token.style.fontSize = '12px';
        token.style.fontFamily = 'monospace';

        swatch.appendChild(colorBox);
        swatch.appendChild(name);
        swatch.appendChild(token);
        grid.appendChild(swatch);
      });

      container.appendChild(grid);
    });

    return container;
  },
};

/**
 * SPACING
 * Spacing scale tokens
 */
export const Spacing = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '40px';

    const title = document.createElement('h2');
    title.textContent = 'Spacing Scale';
    title.style.color = 'var(--color-white)';
    title.style.marginBottom = '32px';
    container.appendChild(title);

    const spacings = [
      { name: '0', value: '--spacing-0', px: '0px' },
      { name: '1', value: '--spacing-1', px: '4px' },
      { name: '2', value: '--spacing-2', px: '8px' },
      { name: '3', value: '--spacing-3', px: '12px' },
      { name: '4', value: '--spacing-4', px: '16px' },
      { name: '5', value: '--spacing-5', px: '20px' },
      { name: '6', value: '--spacing-6', px: '24px' },
      { name: '8', value: '--spacing-8', px: '32px' },
      { name: '10', value: '--spacing-10', px: '40px' },
      { name: '12', value: '--spacing-12', px: '48px' },
      { name: '16', value: '--spacing-16', px: '64px' },
      { name: '20', value: '--spacing-20', px: '80px' },
      { name: '24', value: '--spacing-24', px: '96px' },
    ];

    spacings.forEach((spacing) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.marginBottom = '16px';
      row.style.gap = '24px';

      const label = document.createElement('div');
      label.style.minWidth = '100px';
      label.style.color = 'var(--color-white)';
      label.style.fontSize = '14px';
      label.textContent = `${spacing.name} (${spacing.px})`;

      const token = document.createElement('div');
      token.style.minWidth = '150px';
      token.style.color = 'var(--color-text-secondary)';
      token.style.fontSize = '12px';
      token.style.fontFamily = 'monospace';
      token.textContent = spacing.value;

      const visual = document.createElement('div');
      visual.style.height = '24px';
      visual.style.width = `var(${spacing.value})`;
      visual.style.background = 'var(--color-primary)';
      visual.style.borderRadius = '2px';

      row.appendChild(label);
      row.appendChild(token);
      row.appendChild(visual);
      container.appendChild(row);
    });

    return container;
  },
};

/**
 * TYPOGRAPHY
 * Font sizes and weights
 */
export const Typography = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '40px';

    const title = document.createElement('h2');
    title.textContent = 'Typography';
    title.style.color = 'var(--color-white)';
    title.style.marginBottom = '32px';
    container.appendChild(title);

    const sizes = [
      { name: 'XS', value: '--font-size-xs', text: '12px' },
      { name: 'SM', value: '--font-size-sm', text: '13px' },
      { name: 'Base', value: '--font-size-base', text: '14px (Default for dashboards)' },
      { name: 'LG', value: '--font-size-lg', text: '16px' },
      { name: 'XL', value: '--font-size-xl', text: '18px' },
    ];

    sizes.forEach((size) => {
      const row = document.createElement('div');
      row.style.marginBottom = '20px';

      const label = document.createElement('div');
      label.style.color = 'var(--color-text-secondary)';
      label.style.fontSize = '12px';
      label.style.marginBottom = '8px';
      label.textContent = `${size.name} - ${size.value}`;

      const sample = document.createElement('div');
      sample.style.color = 'var(--color-white)';
      sample.style.fontSize = `var(${size.value})`;
      sample.textContent = size.text;

      row.appendChild(label);
      row.appendChild(sample);
      container.appendChild(row);
    });

    return container;
  },
};

/**
 * SHADOWS
 * Shadow tokens for depth
 */
export const Shadows = {
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '40px';

    const title = document.createElement('h2');
    title.textContent = 'Shadows';
    title.style.color = 'var(--color-white)';
    title.style.marginBottom = '32px';
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
    grid.style.gap = '24px';

    const shadows = [
      { name: 'None', value: '--shadow-none' },
      { name: 'SM', value: '--shadow-sm' },
      { name: 'Default', value: '--shadow' },
      { name: 'MD', value: '--shadow-md' },
      { name: 'LG', value: '--shadow-lg' },
      { name: 'XL', value: '--shadow-xl' },
      { name: '2XL', value: '--shadow-2xl' },
      { name: 'Inner', value: '--shadow-inner' },
    ];

    shadows.forEach((shadow) => {
      const card = document.createElement('div');
      card.style.padding = '24px';
      card.style.background = 'rgba(255, 255, 255, 0.05)';
      card.style.borderRadius = '8px';
      card.style.boxShadow = `var(${shadow.value})`;

      const name = document.createElement('div');
      name.textContent = shadow.name;
      name.style.color = 'var(--color-white)';
      name.style.fontSize = '14px';
      name.style.fontWeight = '500';
      name.style.marginBottom = '8px';

      const token = document.createElement('div');
      token.textContent = shadow.value;
      token.style.color = 'var(--color-text-secondary)';
      token.style.fontSize = '12px';
      token.style.fontFamily = 'monospace';

      card.appendChild(name);
      card.appendChild(token);
      grid.appendChild(card);
    });

    container.appendChild(grid);
    return container;
  },
};
