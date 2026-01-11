// =============================================================================
// MANAGE ROOT - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================

import type { RootUser, StatusFilter, FormIsActiveStatus } from './types';

// =============================================================================
// DATA STATE
// =============================================================================

export const dataState = $state({
  allRootUsers: [] as RootUser[],
  filteredUsers: [] as RootUser[],
  loading: true,
  error: null as string | null,
});

// =============================================================================
// FILTER STATE
// =============================================================================

export const filterState = $state({
  status: 'active' as StatusFilter,
  searchQuery: '',
  searchOpen: false,
});

// =============================================================================
// MODAL STATE
// =============================================================================

export const modalState = $state({
  showRoot: false,
  showDelete: false,
  showDeleteConfirm: false,
  editId: null as number | null,
  deleteUserId: null as number | null,
});

// =============================================================================
// FORM STATE
// =============================================================================

export const formState = $state({
  firstName: '',
  lastName: '',
  email: '',
  emailConfirm: '',
  password: '',
  passwordConfirm: '',
  employeeNumber: '',
  position: '',
  notes: '',
  isActive: 1 as FormIsActiveStatus,
  submitting: false,
});

// =============================================================================
// DROPDOWN STATE
// =============================================================================

export const dropdownState = $state({
  positionOpen: false,
  statusOpen: false,
});

// =============================================================================
// PASSWORD STATE
// =============================================================================

export const passwordState = $state({
  showPassword: false,
  showPasswordConfirm: false,
  score: -1,
  label: '',
  time: '',
});

// =============================================================================
// VALIDATION STATE
// =============================================================================

export const validationState = $state({
  emailError: false,
  passwordError: false,
});

// =============================================================================
// DERIVED VALUES
// =============================================================================

export const isEditMode = $derived(modalState.editId !== null);

// =============================================================================
// STATE RESET FUNCTIONS
// =============================================================================

/**
 * Reset form state to defaults
 */
export function resetFormState(): void {
  formState.firstName = '';
  formState.lastName = '';
  formState.email = '';
  formState.emailConfirm = '';
  formState.password = '';
  formState.passwordConfirm = '';
  formState.employeeNumber = '';
  formState.position = '';
  formState.notes = '';
  formState.isActive = 1;
  formState.submitting = false;

  validationState.emailError = false;
  validationState.passwordError = false;

  passwordState.score = -1;
  passwordState.label = '';
  passwordState.time = '';
  passwordState.showPassword = false;
  passwordState.showPasswordConfirm = false;

  dropdownState.positionOpen = false;
  dropdownState.statusOpen = false;
}

/**
 * Reset modal state
 */
export function resetModalState(): void {
  modalState.showRoot = false;
  modalState.showDelete = false;
  modalState.showDeleteConfirm = false;
  modalState.editId = null;
  modalState.deleteUserId = null;
}

/**
 * Reset filter state
 */
export function resetFilterState(): void {
  filterState.status = 'active';
  filterState.searchQuery = '';
  filterState.searchOpen = false;
}
