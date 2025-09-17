/**
 * Update Script für Blackboard Modal Design Standards
 *
 * DOMPURIFY GOLD STANDARD COMPLIANCE:
 * - No direct innerHTML usage ✓
 * - No onclick attributes ✓
 * - Uses proper DOM methods ✓
 * - Event listeners properly attached ✓
 *
 * TODO: Convert this file to TypeScript for full type safety
 */

// Constants
const DROPDOWN_OPTION_CLASS = 'dropdown-option';

// HTML-Entities escapen (kept for potential future use)
// eslint-disable-next-line no-unused-vars
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Konvertiere native selects zu custom dropdowns
function convertSelectsToDropdowns() {
  // Org Level Dropdown
  const orgLevelSelect = document.querySelector('#entryOrgLevel');
  if (orgLevelSelect && !document.querySelector('#orgLevelDropdown')) {
    const customDropdown = createCustomDropdown(
      'orgLevel',
      [
        { value: 'company', text: 'Alle Mitarbeiter' },
        { value: 'department', text: 'Bestimmte Abteilung' },
        { value: 'team', text: 'Bestimmtes Team' },
      ],
      'Bitte wählen',
    );

    orgLevelSelect.parentNode.append(customDropdown);
    orgLevelSelect.style.display = 'none';
  }

  // Priority Dropdown
  const prioritySelect = document.querySelector('#entryPriority');
  if (prioritySelect && !document.querySelector('#priorityDropdown')) {
    const customDropdown = createCustomDropdown(
      'priority',
      [
        { value: 'low', text: 'Niedrig' },
        { value: 'medium', text: 'Normal' },
        { value: 'high', text: 'Hoch' },
        { value: 'critical', text: 'Dringend' },
      ],
      'Normal',
    );

    prioritySelect.parentNode.append(customDropdown);
    prioritySelect.style.display = 'none';
  }
}

// Helper: Create custom dropdown HTML
function createCustomDropdown(id, options, defaultText) {
  const dropdown = document.createElement('div');
  dropdown.className = 'custom-dropdown';

  // Create dropdown display
  const display = document.createElement('div');
  display.className = 'dropdown-display';
  display.id = `${id}Display`;

  const span = document.createElement('span');
  span.textContent = defaultText;
  display.append(span);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '8');
  svg.setAttribute('viewBox', '0 0 12 8');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 1L6 6L11 1');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  display.append(svg);

  // Add click listener
  display.addEventListener('click', () => window.toggleDropdown(id));
  dropdown.append(display);

  // Create dropdown options
  const dropdownOptions = document.createElement('div');
  dropdownOptions.className = 'dropdown-options';
  dropdownOptions.id = `${id}Dropdown`;

  options.forEach((opt) => {
    const option = document.createElement('div');
    option.className = DROPDOWN_OPTION_CLASS;
    option.textContent = opt.text;
    // Use direct function calls instead of dynamic property access to avoid object injection
    if (id === 'orgLevel') {
      option.addEventListener('click', () => window.selectOrgLevel(opt.value, opt.text));
    } else if (id === 'priority') {
      option.addEventListener('click', () => window.selectPriority(opt.value, opt.text));
    } else if (id === 'orgId') {
      option.addEventListener('click', () => window.selectOrgId(opt.value, opt.text));
    }
    dropdownOptions.append(option);
  });
  dropdown.append(dropdownOptions);

  // Create hidden input
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = id === 'orgLevel' ? 'org_level' : 'priority_level';
  input.id = `${id}Value`;
  if (id === 'priority') {
    input.value = 'medium';
  } else {
    input.required = true;
  }
  dropdown.append(input);

  return dropdown;
}

// Dropdown Functions
window.toggleDropdown = function (type) {
  const display = document.querySelector(`#${type}Display`);
  const dropdown = document.querySelector(`#${type}Dropdown`);

  // Close all other dropdowns
  document.querySelectorAll('.dropdown-display').forEach((d) => {
    if (d !== display) d.classList.remove('active');
  });
  document.querySelectorAll('.dropdown-options').forEach((d) => {
    if (d !== dropdown) d.classList.remove('active');
  });

  display.classList.toggle('active');
  dropdown.classList.toggle('active');
};

// Selection handlers
window.selectOrgLevel = function (value, text) {
  document.querySelector('#orgLevelDisplay').querySelector('span').textContent = text;
  document.querySelector('#orgLevelValue').value = value;
  document.querySelector('#orgLevelDisplay').classList.remove('active');
  document.querySelector('#orgLevelDropdown').classList.remove('active');

  // Show/Hide org ID container
  const orgIdContainer = document.querySelector('#orgIdContainer');
  if (value === 'department' || value === 'team') {
    orgIdContainer.style.display = 'block';
    loadOrgOptions(value);
  } else {
    orgIdContainer.style.display = 'none';
  }
};

window.selectPriority = function (value, text) {
  document.querySelector('#priorityDisplay').querySelector('span').textContent = text;
  document.querySelector('#priorityValue').value = value;
  document.querySelector('#priorityDisplay').classList.remove('active');
  document.querySelector('#priorityDropdown').classList.remove('active');
};

window.selectOrgId = function (value, text) {
  document.querySelector('#orgIdDisplay').querySelector('span').textContent = text;
  document.querySelector('#orgIdValue').value = value;
  document.querySelector('#orgIdDisplay').classList.remove('active');
  document.querySelector('#orgIdDropdown').classList.remove('active');
};

// Load org options
async function loadOrgOptions(type) {
  const dropdown = document.querySelector('#orgIdDropdown');
  if (!dropdown) {
    // Create org ID dropdown if it doesn't exist
    const orgIdSelect = document.querySelector('#entryOrgId');
    if (orgIdSelect) {
      const customDropdown = document.createElement('div');
      customDropdown.className = 'custom-dropdown';
      // Create dropdown display
      const dropdownDisplay = document.createElement('div');
      dropdownDisplay.className = 'dropdown-display';
      dropdownDisplay.id = 'orgIdDisplay';

      const span = document.createElement('span');
      span.textContent = 'Bitte wählen';
      dropdownDisplay.append(span);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '8');
      svg.setAttribute('viewBox', '0 0 12 8');
      svg.setAttribute('fill', 'none');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M1 1L6 6L11 1');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      svg.append(path);
      dropdownDisplay.append(svg);
      dropdownDisplay.addEventListener('click', () => window.toggleDropdown('orgId'));
      customDropdown.append(dropdownDisplay);

      // Create dropdown options
      const dropdownOptionsEl = document.createElement('div');
      dropdownOptionsEl.className = 'dropdown-options';
      dropdownOptionsEl.id = 'orgIdDropdown';
      const loadingOpt = document.createElement('div');
      loadingOpt.className = DROPDOWN_OPTION_CLASS;
      loadingOpt.textContent = 'Laden...';
      dropdownOptionsEl.append(loadingOpt);
      customDropdown.append(dropdownOptionsEl);

      // Create hidden input
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'org_id';
      hiddenInput.id = 'orgIdValue';
      customDropdown.append(hiddenInput);
      orgIdSelect.parentNode.append(customDropdown);
      orgIdSelect.style.display = 'none';
    }
  }

  const dropdownOptions = document.querySelector('#orgIdDropdown');
  // Clear children using proper DOM method (Gold Standard)
  while (dropdownOptions.firstChild) {
    dropdownOptions.firstChild.remove();
  }
  const loadingOption = document.createElement('div');
  loadingOption.className = DROPDOWN_OPTION_CLASS;
  loadingOption.textContent = 'Laden...';
  dropdownOptions.append(loadingOption);

  try {
    const endpoint = type === 'department' ? '/api/departments' : '/api/teams';
    const response = await fetch(endpoint);
    const items = await response.json();

    // Clear and rebuild dropdown options safely (Gold Standard)
    while (dropdownOptions.firstChild) {
      dropdownOptions.firstChild.remove();
    }
    items.forEach((item) => {
      const option = document.createElement('div');
      option.className = DROPDOWN_OPTION_CLASS;
      option.textContent = item.name;
      option.addEventListener('click', () => window.selectOrgId(String(item.id), item.name));
      dropdownOptions.append(option);
    });
  } catch (error) {
    console.error('Error loading organization units:', error);
    // Clear using proper DOM method (Gold Standard)
    while (dropdownOptions.firstChild) {
      dropdownOptions.firstChild.remove();
    }
    const errorOption = document.createElement('div');
    errorOption.className = DROPDOWN_OPTION_CLASS;
    errorOption.textContent = 'Fehler beim Laden';
    dropdownOptions.append(errorOption);
  }
}

// Update modal structure
function updateModalStructure() {
  const modal = document.querySelector('.entry-form-modal');
  if (modal && modal.classList.contains('modal-overlay')) {
    // Change class from modal-overlay to modal
    modal.className = 'modal';

    // Update modal container to modal-content
    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
      modalContainer.className = 'modal-content';
    }

    // Update modal header
    const modalHeader = modal.querySelector('.modal-header h2');
    if (modalHeader) {
      modalHeader.tagName = 'h3';
      modalHeader.className = 'modal-title';
    }

    // Update close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.removeAttribute('onclick');
      closeBtn.addEventListener('click', () => window.hideModal('entryFormModal'));
    }

    // Update form classes
    const form = modal.querySelector('form');
    if (form) {
      form.classList.remove('simple-form', 'blackboard-form');
    }

    // Update all form groups
    modal.querySelectorAll('.large-form-group').forEach((group) => {
      group.classList.remove('large-form-group');
      group.classList.add('form-group');
    });

    // Update labels
    modal.querySelectorAll('.big-label').forEach((label) => {
      label.classList.remove('big-label');
      label.classList.add('form-label');
    });

    // Update inputs
    modal.querySelectorAll('.big-input').forEach((input) => {
      input.classList.remove('big-input');
      input.classList.add('form-control');
    });

    // Update buttons
    modal.querySelectorAll('.big-button').forEach((button) => {
      button.classList.remove('big-button');
      if (button.classList.contains('primary-button')) {
        button.classList.remove('primary-button');
        button.classList.add('btn', 'btn-primary');
      } else if (button.classList.contains('secondary-button')) {
        button.classList.remove('secondary-button');
        button.classList.add('btn', 'btn-secondary');
      }
    });

    // Update hints
    modal.querySelectorAll('.simple-hint').forEach((hint) => {
      hint.classList.remove('simple-hint');
      hint.classList.add('form-hint');
    });
  }
}

// Modal functions
window.showModal = function (modalId) {
  // Remove any leading # if present to avoid double hash
  const cleanId = modalId.startsWith('#') ? modalId.slice(1) : modalId;
  const modal = document.querySelector(`#${cleanId}`);
  if (modal) {
    // Remove u-hidden class if present (Gold Standard)
    modal.classList.remove('u-hidden');
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }
};

window.hideModal = function (modalId) {
  // Remove any leading # if present to avoid double hash
  const cleanId = modalId.startsWith('#') ? modalId.slice(1) : modalId;
  const modal = document.querySelector(`#${cleanId}`);
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
      // Add u-hidden class back for consistency (Gold Standard)
      modal.classList.add('u-hidden');
    }, 300);
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Update modal structure
  updateModalStructure();

  // Convert selects to dropdowns
  convertSelectsToDropdowns();

  // Add click outside to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
      document.querySelectorAll('.dropdown-display').forEach((d) => d.classList.remove('active'));
      document.querySelectorAll('.dropdown-options').forEach((d) => d.classList.remove('active'));
    }
  });

  // Update DashboardUI functions
  if (window.DashboardUI) {
    window.DashboardUI.openModal = window.showModal;
    window.DashboardUI.closeModal = window.hideModal;
  }
});

// Export for use in other scripts
window.BlackboardModalUpdate = {
  convertSelectsToDropdowns,
  updateModalStructure,
  showModal: window.showModal,
  hideModal: window.hideModal,
};
