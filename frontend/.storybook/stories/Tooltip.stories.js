/**
 * Tooltip Component Stories
 *
 * Interactive examples of tooltip component with all variants.
 *
 * NOTE: This story demonstrates the CSS-only version.
 * - Auto-positioning
 * - Keyboard triggers
 * - Dynamic content
 */
export default {
  title: 'Design System/Tooltip',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Hover/focus tooltips with auto-positioning, semantic variants, and full keyboard support. Glassmorphism style with arrows.',
      },
    },
  },
};

/**
 * Basic Tooltip - Default dark tooltip on top
 */
export const BasicTooltip = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px; text-align: center;';

  const button = document.createElement('button');
  button.className = 'btn btn-primary';
  button.setAttribute('data-tooltip', 'This is a helpful tooltip');
  button.textContent = 'Hover me';

  container.appendChild(button);

  return container;
};

BasicTooltip.storyName = '1. Basic Tooltip';

/**
 * All Positions - Bottom and Right (stable positions)
 */
export const AllPositions = () => {
  const container = document.createElement('div');
  container.style.cssText =
    'padding: 100px; display: flex; gap: 40px; justify-content: center; align-items: center;';

  const positions = [
    { text: 'Bottom', tooltip: 'Bottom tooltip (default)', position: 'bottom' },
    { text: 'Right', tooltip: 'Right tooltip', position: 'right' },
  ];

  positions.forEach((pos) => {
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.setAttribute('data-tooltip', pos.tooltip);
    button.setAttribute('data-tooltip-position', pos.position);
    button.textContent = pos.text;
    container.appendChild(button);
  });

  return container;
};

AllPositions.storyName = '2. All Positions';

/**
 * Semantic Variants - Info, Warning, Error, Success
 */
export const SemanticVariants = () => {
  const container = document.createElement('div');
  container.style.cssText =
    'padding: 100px; display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;';

  const variants = [
    {
      className: 'btn-cancel',
      text: 'Default',
      tooltip: 'Default dark tooltip',
      variant: '',
    },
    {
      className: 'btn-info',
      text: 'Info',
      tooltip: 'Informational tooltip',
      variant: 'info',
    },
    {
      className: 'btn-warning',
      text: 'Warning',
      tooltip: 'Warning tooltip - be careful!',
      variant: 'warning',
    },
    {
      className: 'btn-danger',
      text: 'Error',
      tooltip: 'Error tooltip - something wrong',
      variant: 'error',
    },
    {
      className: 'btn-success',
      text: 'Success',
      tooltip: 'Success tooltip - all good!',
      variant: 'success',
    },
    {
      className: 'btn-light',
      text: 'Light',
      tooltip: 'Light tooltip on dark background',
      variant: 'light',
    },
  ];

  variants.forEach((v) => {
    const button = document.createElement('button');
    button.className = `btn ${v.className}`;
    button.setAttribute('data-tooltip', v.tooltip);
    if (v.variant) {
      button.setAttribute('data-tooltip-variant', v.variant);
    }
    button.textContent = v.text;
    container.appendChild(button);
  });

  return container;
};

SemanticVariants.storyName = '3. Semantic Variants';

/**
 * Size Variants - Small, Default, Large
 */
export const SizeVariants = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px; display: flex; gap: 30px; justify-content: center;';

  const sizes = [
    { text: 'Small', tooltip: 'Small tooltip', size: 'sm' },
    {
      text: 'Default',
      tooltip: 'Default size tooltip with some helpful information',
      size: '',
    },
    {
      text: 'Large',
      tooltip:
        'Large tooltip with more detailed information that spans multiple lines and provides comprehensive guidance',
      size: 'lg',
    },
  ];

  sizes.forEach((s) => {
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.setAttribute('data-tooltip', s.tooltip);
    if (s.size) {
      button.setAttribute('data-tooltip-size', s.size);
    }
    button.textContent = s.text;
    container.appendChild(button);
  });

  return container;
};

SizeVariants.storyName = '4. Size Variants';

/**
 * On Icons and Inputs - Common use cases
 */
export const OnIconsAndInputs = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px;';

  // Icons section
  const iconsDiv = document.createElement('div');
  iconsDiv.style.cssText =
    'display: flex; gap: 20px; justify-content: center; margin-bottom: 40px;';

  const icons = [
    {
      icon: 'fas fa-info-circle',
      color: 'var(--color-blue-400)',
      tooltip: 'More information',
      variant: 'info',
    },
    {
      icon: 'fas fa-exclamation-triangle',
      color: 'var(--color-orange-400)',
      tooltip: 'Warning: Action required',
      variant: 'warning',
    },
    {
      icon: 'fas fa-check-circle',
      color: 'var(--color-green-400)',
      tooltip: 'Completed successfully',
      variant: 'success',
    },
    {
      icon: 'fas fa-times-circle',
      color: 'var(--color-red-400)',
      tooltip: 'Error occurred',
      variant: 'error',
    },
  ];

  icons.forEach((iconData) => {
    const icon = document.createElement('i');
    icon.className = iconData.icon;
    icon.style.cssText = `font-size: 24px; color: ${iconData.color}; cursor: help;`;
    icon.setAttribute('data-tooltip', iconData.tooltip);
    icon.setAttribute('data-tooltip-variant', iconData.variant);
    iconsDiv.appendChild(icon);
  });

  container.appendChild(iconsDiv);

  // Form section
  const formDiv = document.createElement('div');
  formDiv.style.cssText = 'max-width: 400px; margin: 0 auto;';

  // Email field
  const emailGroup = document.createElement('div');
  emailGroup.className = 'form-group';
  emailGroup.style.cssText = 'margin-bottom: 16px;';

  const emailLabel = document.createElement('label');
  emailLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
  emailLabel.textContent = 'Email Address ';

  const emailIcon = document.createElement('i');
  emailIcon.className = 'fas fa-question-circle';
  emailIcon.style.cssText = 'font-size: 14px; color: var(--color-text-muted); cursor: help;';
  emailIcon.setAttribute('data-tooltip', 'Your work email address');
  emailIcon.setAttribute('data-tooltip-position', 'right');
  emailLabel.appendChild(emailIcon);

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'input';
  emailInput.placeholder = 'user@example.com';

  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);
  formDiv.appendChild(emailGroup);

  // Password field
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';

  const passwordLabel = document.createElement('label');
  passwordLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
  passwordLabel.textContent = 'Password ';

  const passwordIcon = document.createElement('i');
  passwordIcon.className = 'fas fa-question-circle';
  passwordIcon.style.cssText = 'font-size: 14px; color: var(--color-text-muted); cursor: help;';
  passwordIcon.setAttribute(
    'data-tooltip',
    'Must be at least 8 characters with uppercase, lowercase, and numbers',
  );
  passwordIcon.setAttribute('data-tooltip-position', 'right');
  passwordIcon.setAttribute('data-tooltip-size', 'lg');
  passwordLabel.appendChild(passwordIcon);

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.className = 'input';
  passwordInput.placeholder = 'Enter password';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  formDiv.appendChild(passwordGroup);

  container.appendChild(formDiv);

  return container;
};

OnIconsAndInputs.storyName = '5. On Icons & Inputs';

/**
 * With HTML Markup (Manual) - No data attributes
 */
export const ManualHTML = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px; text-align: center;';

  // First tooltip
  const tooltip1 = document.createElement('div');
  tooltip1.className = 'tooltip';
  tooltip1.style.cssText = 'display: inline-block;';

  const button1 = document.createElement('button');
  button1.className = 'btn btn-primary tooltip__trigger';
  button1.textContent = 'Hover me';

  const content1 = document.createElement('div');
  content1.className = 'tooltip__content tooltip__content--bottom';
  content1.setAttribute('role', 'tooltip');
  content1.textContent = 'Manual HTML tooltip without JavaScript';

  tooltip1.appendChild(button1);
  tooltip1.appendChild(content1);
  container.appendChild(tooltip1);

  // Second tooltip
  const tooltip2 = document.createElement('div');
  tooltip2.className = 'tooltip';
  tooltip2.style.cssText = 'display: inline-block; margin-left: 20px;';

  const button2 = document.createElement('button');
  button2.className = 'btn btn-success tooltip__trigger';
  button2.textContent = 'Success tooltip';

  const content2 = document.createElement('div');
  content2.className = 'tooltip__content tooltip__content--bottom tooltip__content--success';
  content2.setAttribute('role', 'tooltip');
  content2.textContent = 'This works with pure CSS!';

  tooltip2.appendChild(button2);
  tooltip2.appendChild(content2);
  container.appendChild(tooltip2);

  return container;
};

ManualHTML.storyName = '6. Manual HTML (No JS)';

/**
 * JavaScript API - Programmatic control
 */
export const JavaScriptAPI = () => {
  // Create container
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px; text-align: center;';

  // Create button
  const button = document.createElement('button');
  button.className = 'btn btn-primary';
  button.textContent = 'Programmatic Tooltip';
  container.appendChild(button);

  // Create control buttons
  const controls = document.createElement('div');
  controls.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; justify-content: center;';

  const showBtn = document.createElement('button');
  showBtn.className = 'btn btn-cancel btn-sm';
  showBtn.textContent = 'Show';

  const hideBtn = document.createElement('button');
  hideBtn.className = 'btn btn-cancel btn-sm';
  hideBtn.textContent = 'Hide';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn btn-cancel btn-sm';
  toggleBtn.textContent = 'Toggle';

  const updateBtn = document.createElement('button');
  updateBtn.className = 'btn btn-cancel btn-sm';
  updateBtn.textContent = 'Update Text';

  controls.appendChild(showBtn);
  controls.appendChild(hideBtn);
  controls.appendChild(toggleBtn);
  controls.appendChild(updateBtn);
  container.appendChild(controls);

  // Initialize tooltip with JS
  setTimeout(() => {
    // Placeholder for tooltip initialization
  }, 0);

  return container;
};

JavaScriptAPI.storyName = '7. JavaScript API';

/**
 * Long Text - Multiline tooltips
 */
export const LongText = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px; text-align: center;';

  const button1 = document.createElement('button');
  button1.className = 'btn btn-primary';
  button1.setAttribute(
    'data-tooltip',
    'This is a longer tooltip that demonstrates how multiline text is handled. It will automatically wrap and maintain readability even with extensive content.',
  );
  button1.setAttribute('data-tooltip-size', 'lg');
  button1.textContent = 'Hover for long text';

  const button2 = document.createElement('button');
  button2.className = 'btn btn-info';
  button2.setAttribute(
    'data-tooltip',
    'Pro tip: You can use tooltips to provide helpful hints and guidance without cluttering the UI. Keep them concise but informative!',
  );
  button2.setAttribute('data-tooltip-position', 'bottom');
  button2.setAttribute('data-tooltip-size', 'lg');
  button2.setAttribute('data-tooltip-variant', 'info');
  button2.style.marginLeft = '20px';
  button2.textContent = 'Bottom long tooltip';

  container.appendChild(button1);
  container.appendChild(button2);

  return container;
};

LongText.storyName = '8. Long Text';

/**
 * Form Validation - Error tooltips
 */
export const FormValidation = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px; max-width: 400px; margin: 0 auto;';

  const title = document.createElement('h3');
  title.style.cssText = 'margin-bottom: 24px; color: var(--color-text-primary);';
  title.textContent = 'Form with Validation Tooltips';
  container.appendChild(title);

  // Username field (error)
  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'form-group';
  usernameGroup.style.cssText = 'margin-bottom: 20px;';

  const usernameLabel = document.createElement('label');
  usernameLabel.style.cssText = 'display: block; margin-bottom: 8px;';
  usernameLabel.textContent = 'Username';
  usernameGroup.appendChild(usernameLabel);

  const usernameDiv = document.createElement('div');
  usernameDiv.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px;';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.className = 'input';
  usernameInput.value = 'ab';
  usernameInput.style.borderColor = 'var(--color-red-400)';
  usernameDiv.appendChild(usernameInput);

  const usernameIcon = document.createElement('i');
  usernameIcon.className = 'fas fa-exclamation-circle';
  usernameIcon.style.cssText = 'color: var(--color-red-400); cursor: help;';
  usernameIcon.setAttribute('data-tooltip', 'Username must be at least 3 characters');
  usernameIcon.setAttribute('data-tooltip-variant', 'error');
  usernameIcon.setAttribute('data-tooltip-position', 'right');
  usernameDiv.appendChild(usernameIcon);

  usernameGroup.appendChild(usernameDiv);
  container.appendChild(usernameGroup);

  // Email field (error)
  const emailGroup = document.createElement('div');
  emailGroup.className = 'form-group';
  emailGroup.style.cssText = 'margin-bottom: 20px;';

  const emailLabel = document.createElement('label');
  emailLabel.style.cssText = 'display: block; margin-bottom: 8px;';
  emailLabel.textContent = 'Email';
  emailGroup.appendChild(emailLabel);

  const emailDiv = document.createElement('div');
  emailDiv.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px;';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'input';
  emailInput.value = 'invalid-email';
  emailInput.style.borderColor = 'var(--color-red-400)';
  emailDiv.appendChild(emailInput);

  const emailIcon = document.createElement('i');
  emailIcon.className = 'fas fa-exclamation-circle';
  emailIcon.style.cssText = 'color: var(--color-red-400); cursor: help;';
  emailIcon.setAttribute('data-tooltip', 'Please enter a valid email address');
  emailIcon.setAttribute('data-tooltip-variant', 'error');
  emailIcon.setAttribute('data-tooltip-position', 'right');
  emailDiv.appendChild(emailIcon);

  emailGroup.appendChild(emailDiv);
  container.appendChild(emailGroup);

  // Phone field (success)
  const phoneGroup = document.createElement('div');
  phoneGroup.className = 'form-group';

  const phoneLabel = document.createElement('label');
  phoneLabel.style.cssText = 'display: block; margin-bottom: 8px;';
  phoneLabel.textContent = 'Phone';
  phoneGroup.appendChild(phoneLabel);

  const phoneDiv = document.createElement('div');
  phoneDiv.style.cssText = 'position: relative; display: flex; align-items: center; gap: 8px;';

  const phoneInput = document.createElement('input');
  phoneInput.type = 'tel';
  phoneInput.className = 'input';
  phoneInput.value = '+1 555-0123';
  phoneInput.style.borderColor = 'var(--color-green-400)';
  phoneDiv.appendChild(phoneInput);

  const phoneIcon = document.createElement('i');
  phoneIcon.className = 'fas fa-check-circle';
  phoneIcon.style.cssText = 'color: var(--color-green-400); cursor: help;';
  phoneIcon.setAttribute('data-tooltip', 'Phone number is valid');
  phoneIcon.setAttribute('data-tooltip-variant', 'success');
  phoneIcon.setAttribute('data-tooltip-position', 'right');
  phoneDiv.appendChild(phoneIcon);

  phoneGroup.appendChild(phoneDiv);
  container.appendChild(phoneGroup);

  return container;
};

FormValidation.storyName = '9. Form Validation';

/**
 * All Variants - Comprehensive showcase
 */
export const AllVariants = () => {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 100px;';

  const title = document.createElement('h2');
  title.style.cssText =
    'text-align: center; margin-bottom: 40px; color: var(--color-text-primary);';
  title.textContent = 'Complete Tooltip System';
  container.appendChild(title);

  // Helper function to create sections
  const createSection = (heading, marginBottom = '60px') => {
    const section = document.createElement('div');
    section.style.cssText = `margin-bottom: ${marginBottom};`;
    const h3 = document.createElement('h3');
    h3.style.cssText = 'margin-bottom: 20px; color: var(--color-text-secondary);';
    h3.textContent = heading;
    section.appendChild(h3);
    return section;
  };

  // Helper function to create button container
  const createButtonContainer = () => {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 20px; flex-wrap: wrap;';
    return div;
  };

  // 1. Positions Section
  const positionsSection = createSection('Positions');
  const positionsContainer = createButtonContainer();

  [
    {
      text: 'Bottom',
      tooltip: 'Bottom position (default)',
      position: 'bottom',
    },
    { text: 'Right', tooltip: 'Right position', position: 'right' },
  ].forEach((pos) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = pos.text;
    btn.setAttribute('data-tooltip', pos.tooltip);
    btn.setAttribute('data-tooltip-position', pos.position);
    positionsContainer.appendChild(btn);
  });

  positionsSection.appendChild(positionsContainer);
  container.appendChild(positionsSection);

  // 2. Semantic Variants Section
  const variantsSection = createSection('Semantic Variants');
  const variantsContainer = createButtonContainer();

  [
    {
      className: 'btn-cancel',
      text: 'Default',
      tooltip: 'Default tooltip',
      variant: '',
    },
    {
      className: 'btn-info',
      text: 'Info',
      tooltip: 'Info tooltip',
      variant: 'info',
    },
    {
      className: 'btn-warning',
      text: 'Warning',
      tooltip: 'Warning tooltip',
      variant: 'warning',
    },
    {
      className: 'btn-danger',
      text: 'Error',
      tooltip: 'Error tooltip',
      variant: 'error',
    },
    {
      className: 'btn-success',
      text: 'Success',
      tooltip: 'Success tooltip',
      variant: 'success',
    },
    {
      className: 'btn-light',
      text: 'Light',
      tooltip: 'Light tooltip',
      variant: 'light',
    },
  ].forEach((v) => {
    const btn = document.createElement('button');
    btn.className = `btn ${v.className}`;
    btn.textContent = v.text;
    btn.setAttribute('data-tooltip', v.tooltip);
    if (v.variant) {
      btn.setAttribute('data-tooltip-variant', v.variant);
    }
    variantsContainer.appendChild(btn);
  });

  variantsSection.appendChild(variantsContainer);
  container.appendChild(variantsSection);

  // 3. Size Variants Section
  const sizesSection = createSection('Size Variants');
  const sizesContainer = createButtonContainer();

  [
    { text: 'Small', tooltip: 'Small', size: 'sm' },
    { text: 'Default', tooltip: 'Default size tooltip', size: '' },
    { text: 'Large', tooltip: 'Large tooltip with more content', size: 'lg' },
  ].forEach((s) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = s.text;
    btn.setAttribute('data-tooltip', s.tooltip);
    if (s.size) {
      btn.setAttribute('data-tooltip-size', s.size);
    }
    sizesContainer.appendChild(btn);
  });

  sizesSection.appendChild(sizesContainer);
  container.appendChild(sizesSection);

  // 4. Icons Section
  const iconsSection = createSection('On Icons', '0');
  const iconsContainer = document.createElement('div');
  iconsContainer.style.cssText = 'display: flex; gap: 30px; font-size: 24px;';

  [
    {
      icon: 'fas fa-info-circle',
      color: 'var(--color-blue-400)',
      tooltip: 'Information',
      variant: 'info',
    },
    {
      icon: 'fas fa-exclamation-triangle',
      color: 'var(--color-orange-400)',
      tooltip: 'Warning',
      variant: 'warning',
    },
    {
      icon: 'fas fa-check-circle',
      color: 'var(--color-green-400)',
      tooltip: 'Success',
      variant: 'success',
    },
    {
      icon: 'fas fa-times-circle',
      color: 'var(--color-red-400)',
      tooltip: 'Error',
      variant: 'error',
    },
  ].forEach((iconData) => {
    const icon = document.createElement('i');
    icon.className = iconData.icon;
    icon.style.cssText = `color: ${iconData.color}; cursor: help;`;
    icon.setAttribute('data-tooltip', iconData.tooltip);
    icon.setAttribute('data-tooltip-variant', iconData.variant);
    iconsContainer.appendChild(icon);
  });

  iconsSection.appendChild(iconsContainer);
  container.appendChild(iconsSection);

  return container;
};

AllVariants.storyName = '10. All Variants';
