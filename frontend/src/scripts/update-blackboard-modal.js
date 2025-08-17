// Update Script für Blackboard Modal Design Standards

// HTML-Entities escapen
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

  dropdown.innerHTML = `
    <div class="dropdown-display" id="${id}Display" onclick="toggleDropdown('${id}')">
      <span>${defaultText}</span>
      <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
        <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="dropdown-options" id="${id}Dropdown">
      ${options
        .map(
          (opt) =>
            `<div class="dropdown-option" onclick="select${id.charAt(0).toUpperCase() + id.slice(1)}('${opt.value}', '${opt.text}')">${opt.text}</div>`,
        )
        .join('')}
    </div>
    <input type="hidden" name="${id === 'orgLevel' ? 'org_level' : 'priority_level'}" id="${id}Value" ${id === 'priority' ? 'value="medium"' : 'required'} />
  `;

  return dropdown;
}

// Dropdown Functions
window.toggleDropdown = function (type) {
  const display = document.getElementById(`${type}Display`);
  const dropdown = document.getElementById(`${type}Dropdown`);

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
      customDropdown.innerHTML = `
        <div class="dropdown-display" id="orgIdDisplay" onclick="toggleDropdown('orgId')">
          <span>Bitte wählen</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="dropdown-options" id="orgIdDropdown">
          <div class="dropdown-option">Laden...</div>
        </div>
        <input type="hidden" name="org_id" id="orgIdValue" />
      `;
      orgIdSelect.parentNode.append(customDropdown);
      orgIdSelect.style.display = 'none';
    }
  }

  const dropdownOptions = document.querySelector('#orgIdDropdown');
  dropdownOptions.innerHTML = '<div class="dropdown-option">Laden...</div>';

  try {
    const endpoint = type === 'department' ? '/api/departments' : '/api/teams';
    const response = await fetch(endpoint);
    const items = await response.json();

    dropdownOptions.innerHTML = items
      .map(
        (item) =>
          `<div class="dropdown-option" onclick="selectOrgId('${escapeHtml(String(item.id))}', '${escapeHtml(item.name)}')">${escapeHtml(item.name)}</div>`,
      )
      .join('');
  } catch (error) {
    console.error('Error loading organization units:', error);
    dropdownOptions.innerHTML = '<div class="dropdown-option">Fehler beim Laden</div>';
  }
}

// Update modal structure
function updateModalStructure() {
  const modal = document.querySelector('#entryFormModal');
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
      closeBtn.setAttribute('onclick', "hideModal('entryFormModal')");
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
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }
};

window.hideModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
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
