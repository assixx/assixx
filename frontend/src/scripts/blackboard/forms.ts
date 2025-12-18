/**
 * Blackboard Forms Management
 * Handles form population, validation, and submission
 * Following MANAGE pattern (like manage/areas/forms.ts)
 */

import { $$id } from '../../utils/dom-utils';
import { blackboardState, loadEntries } from './data';
import { closeEntryModal } from './modals';
import type { BlackboardEntry, CreateEntryData, UpdateEntryData } from './types';

// ============================================================================
// Constants
// ============================================================================

const DROPDOWN_OPTION_SELECTOR = '.dropdown__option';
const DROPDOWN_OPEN_CLASS = 'active';

// ============================================================================
// Form State
// ============================================================================

let formMode: 'create' | 'edit' = 'create';
let editingEntryId: number | null = null;
let selectedFiles: File[] = [];

// ============================================================================
// Form Population
// ============================================================================

/**
 * Populate basic form fields
 * Extracted to reduce cognitive complexity of populateEntryForm()
 */
function populateBasicFields(entry: BlackboardEntry): void {
  const titleInput = $$id('entryTitle') as HTMLInputElement | null;
  const contentInput = $$id('entryContent') as HTMLTextAreaElement | null;
  const priorityInput = $$id('entryPriority') as HTMLInputElement | null;
  const colorInput = $$id('entryColor') as HTMLInputElement | null;
  const orgLevelInput = $$id('entryOrgLevel') as HTMLInputElement | null;

  if (titleInput !== null) titleInput.value = entry.title;
  if (contentInput !== null) contentInput.value = entry.content;
  if (priorityInput !== null) priorityInput.value = entry.priority;
  if (colorInput !== null) colorInput.value = entry.color;
  if (orgLevelInput !== null) orgLevelInput.value = entry.orgLevel;
}

/**
 * Populate entry form with data (for editing)
 */
export function populateEntryForm(entry: BlackboardEntry): void {
  formMode = 'edit';
  editingEntryId = entry.id;

  // Populate basic fields
  populateBasicFields(entry);

  // Company-wide toggle - CRITICAL: Must be set before org selects
  const companyWideToggle = $$id('entry-company-wide') as HTMLInputElement | null;
  const isCompanyWide = entry.orgLevel === 'company';

  if (companyWideToggle !== null) {
    companyWideToggle.checked = isCompanyWide;

    // Trigger change event to update UI (disable/enable org selects)
    companyWideToggle.dispatchEvent(new Event('change'));
  }

  // Org ID (department/team/area) - only if NOT company-wide
  if (!isCompanyWide && entry.orgId !== null) {
    const orgIdInput = $$id('entryOrgId') as HTMLInputElement | null;
    if (orgIdInput !== null) orgIdInput.value = entry.orgId.toString();
  }

  // Update modal title (HTML uses entryFormModalLabel)
  const modalTitle = $$id('entryFormModalLabel');
  if (modalTitle !== null) {
    modalTitle.textContent = 'Eintrag bearbeiten';
  }

  console.info('[Forms] Form populated for editing entry ID:', entry.id, '| Company-wide:', isCompanyWide);
}

/**
 * Reset entry form to create mode
 */
export function resetEntryForm(): void {
  formMode = 'create';
  editingEntryId = null;
  selectedFiles = [];

  const form = $$id('entryForm') as HTMLFormElement | null;
  if (form !== null) {
    form.reset();
  }

  // Reset company-wide toggle and re-enable org selects
  const companyWideToggle = $$id('entry-company-wide') as HTMLInputElement | null;
  if (companyWideToggle !== null) {
    companyWideToggle.checked = false;
    // Trigger change event to re-enable org selects
    companyWideToggle.dispatchEvent(new Event('change'));
  }

  // Update modal title (HTML uses entryFormModalLabel)
  const modalTitle = $$id('entryFormModalLabel');
  if (modalTitle !== null) {
    modalTitle.textContent = 'Neuer Eintrag';
  }

  console.info('[Forms] Form reset to create mode');
}

// ============================================================================
// Form Validation
// ============================================================================

/**
 * Validate entry form
 * Multi-org: Organization selection is optional (empty = company-wide)
 */
function validateEntryForm(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const titleInput = $$id('entryTitle') as HTMLInputElement | null;
  const contentInput = $$id('entryContent') as HTMLTextAreaElement | null;

  const titleValue = titleInput?.value.trim();
  if (titleValue === undefined || titleValue === '') {
    errors.push('Titel ist erforderlich');
  }

  const contentValue = contentInput?.value.trim();
  if (contentValue === undefined || contentValue === '') {
    errors.push('Inhalt ist erforderlich');
  }

  // Note: Organization selection is optional - empty selections = company-wide entry

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Form Submission
// ============================================================================

/**
 * Handle entry form submission
 */
export async function handleEntryFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const state = blackboardState;
  if (!state.api) {
    console.error('[Forms] API not initialized');
    return;
  }

  // Validate form
  const validation = validateEntryForm();
  if (!validation.valid) {
    alert('Bitte füllen Sie alle Pflichtfelder aus:\n' + validation.errors.join('\n'));
    return;
  }

  // Collect form data (HTML uses camelCase IDs)
  const titleInput = $$id('entryTitle') as HTMLInputElement;
  const contentInput = $$id('entryContent') as HTMLTextAreaElement;
  const priorityInput = $$id('entryPriority') as HTMLInputElement;
  const colorInput = $$id('entryColor') as HTMLInputElement;

  // Collect multi-organization selections
  const { areaIds, departmentIds, teamIds } = collectSelectedOrganizations();

  const data = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    priority: priorityInput.value as 'low' | 'medium' | 'high' | 'urgent',
    color: colorInput.value as 'yellow' | 'blue' | 'green' | 'red' | 'orange' | 'pink',
    // Multi-organization arrays
    areaIds,
    departmentIds,
    teamIds,
  };

  try {
    if (formMode === 'create') {
      // Create new entry
      const createData: CreateEntryData = data;
      const newEntry = await state.api.create(createData);

      // Add to state
      state.addEntry(newEntry);

      // Upload attachments if any
      if (selectedFiles.length > 0) {
        await uploadAttachments(newEntry.id);
      }
    } else if (editingEntryId !== null) {
      // Update existing entry (formMode is 'edit' since it's not 'create')
      const updateData: UpdateEntryData = data;
      const updatedEntry = await state.api.update(editingEntryId, updateData);

      // Update in state
      state.updateEntry(editingEntryId, updatedEntry);

      // Upload new attachments if any
      if (selectedFiles.length > 0) {
        await uploadAttachments(editingEntryId);
      }
    }

    // Reload entries
    await loadEntries();

    // Close modal and reset form
    closeEntryModal();
    resetEntryForm();
  } catch (error) {
    console.error('[Forms] Error submitting entry form:', error);
  }
}

/**
 * Handle delete entry
 */
export async function handleDeleteEntry(id: number): Promise<void> {
  const state = blackboardState;
  if (!state.api) return;

  try {
    await state.api.delete(id);

    // Remove from state
    state.removeEntry(id);

    // Reload entries
    await loadEntries();
  } catch (error) {
    console.error('[Forms] Error deleting entry:', error);
  }
}

// ============================================================================
// Attachment Handling
// ============================================================================

/**
 * Handle file selection
 */
export function handleFileSelect(e: Event): void {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  selectedFiles = Array.from(input.files);

  console.info('[Forms] Selected files:', selectedFiles.length);
}

/**
 * Upload attachments to entry
 */
async function uploadAttachments(entryId: number): Promise<void> {
  const state = blackboardState;
  if (!state.api) return;

  for (const file of selectedFiles) {
    try {
      await state.api.uploadAttachment(entryId, file);
    } catch (error) {
      console.error('[Forms] Error uploading file:', file.name, error);
    }
  }

  // Clear selected files
  selectedFiles = [];
}

// ============================================================================
// Confirmation Handling
// ============================================================================

/**
 * Handle entry confirmation
 */
export async function handleConfirmEntry(entryId: number): Promise<void> {
  const state = blackboardState;
  if (!state.api) return;

  try {
    await state.api.confirm(entryId);

    // Reload entries to update confirmation status
    await loadEntries();
  } catch (error) {
    console.error('[Forms] Error confirming entry:', error);
  }
}

// ============================================================================
// Export Form State Getters
// ============================================================================

export function getFormMode(): 'create' | 'edit' {
  return formMode;
}

export function getEditingEntryId(): number | null {
  return editingEntryId;
}

export function getSelectedFiles(): File[] {
  return selectedFiles;
}

// ============================================================================
// Custom Dropdown Initialization
// ============================================================================

/**
 * Helper: Populate a single select element with items
 * @param selectId - DOM element ID
 * @param items - Array of items with id and name
 */
function populateSelect(selectId: string, items: { id: number; name: string }[]): void {
  const select = $$id(selectId) as HTMLSelectElement | null;
  if (select === null) {
    return;
  }

  select.innerHTML = '';
  items.forEach((item: { id: number; name: string }) => {
    const option = document.createElement('option');
    option.value = item.id.toString();
    option.textContent = item.name;
    select.appendChild(option);
  });
}

/**
 * Populate multi-select dropdowns with organization data
 */
function populateMultiSelects(): void {
  const state = blackboardState;

  // Populate Entry Form Selects
  populateSelect('entry-area-select', state.getAreas());
  populateSelect('entry-department-select', state.getDepartments());
  populateSelect('entry-team-select', state.getTeams());

  console.info('[Forms] Multi-select dropdowns populated');
}

/**
 * Collect selected organization IDs from multi-selects
 */
function collectSelectedOrganizations(): {
  areaIds: number[];
  departmentIds: number[];
  teamIds: number[];
} {
  const areaSelect = $$id('entry-area-select') as HTMLSelectElement | null;
  const deptSelect = $$id('entry-department-select') as HTMLSelectElement | null;
  const teamSelect = $$id('entry-team-select') as HTMLSelectElement | null;

  const areaIds = areaSelect ? Array.from(areaSelect.selectedOptions).map((opt) => Number.parseInt(opt.value, 10)) : [];
  const departmentIds = deptSelect
    ? Array.from(deptSelect.selectedOptions).map((opt) => Number.parseInt(opt.value, 10))
    : [];
  const teamIds = teamSelect ? Array.from(teamSelect.selectedOptions).map((opt) => Number.parseInt(opt.value, 10)) : [];

  return { areaIds, departmentIds, teamIds };
}

/**
 * Initialize organization multi-select dropdowns
 * Populates area, department, and team multi-selects with data
 */
export function initOrganizationMultiSelects(): void {
  populateMultiSelects();
  console.info('[Forms] Organization multi-selects initialized');
}

/**
 * Initialize entry priority dropdown
 */
export function initEntryPriorityDropdown(): void {
  const trigger = $$id('entry-priority-trigger');
  const menu = $$id('entry-priority-menu');
  const hiddenInput = $$id('entryPriority') as HTMLInputElement | null;

  if (!trigger || !menu || !hiddenInput) {
    console.error('[Forms] Entry priority dropdown elements not found');
    return;
  }

  const options = menu.querySelectorAll(DROPDOWN_OPTION_SELECTOR);

  // Toggle menu on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    trigger.classList.toggle(DROPDOWN_OPEN_CLASS);
    menu.classList.toggle(DROPDOWN_OPEN_CLASS);
  });

  // Handle option selection
  options.forEach((option) => {
    option.addEventListener('click', function (this: HTMLElement) {
      const value = this.dataset['value'] ?? '';
      const text = this.textContent.trim();

      // Update hidden input
      hiddenInput.value = value;

      // Update trigger text
      const triggerSpan = trigger.querySelector('span');
      if (triggerSpan) {
        triggerSpan.textContent = text;
      }

      // Close menu
      menu.classList.remove(DROPDOWN_OPEN_CLASS);
      trigger.classList.remove(DROPDOWN_OPEN_CLASS);
    });
  });

  // Close menu on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const dropdown = $$id('entry-priority-dropdown');
    if (dropdown && !dropdown.contains(target)) {
      menu.classList.remove(DROPDOWN_OPEN_CLASS);
      trigger.classList.remove(DROPDOWN_OPEN_CLASS);
    }
  });
}
