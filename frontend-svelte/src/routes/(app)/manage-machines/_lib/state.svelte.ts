// =============================================================================
// MANAGE MACHINES - REACTIVE STATE (Svelte 5 Runes)
// =============================================================================

import type { Machine, Department, Area, Team, MachineStatusFilter, MachineStatus } from './types';
import { FORM_DEFAULTS, MESSAGES } from './constants';
import { getMachineTypeLabel } from './utils';

/**
 * Machine Management State using Svelte 5 Runes
 */
function createMachineState() {
  // Machine Data
  let allMachines = $state<Machine[]>([]);
  let filteredMachines = $state<Machine[]>([]);

  // Organization Data (for dropdowns)
  let allDepartments = $state<Department[]>([]);
  let allAreas = $state<Area[]>([]);
  let allTeams = $state<Team[]>([]);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter = $state<MachineStatusFilter>('all');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showMachineModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteMachineId = $state<number | null>(null);

  // Form Fields
  let formName = $state('');
  let formModel = $state('');
  let formManufacturer = $state('');
  let formSerialNumber = $state('');
  let formDepartmentId = $state<number | null>(null);
  let formAreaId = $state<number | null>(null);
  let formMachineType = $state('');
  let formStatus = $state<MachineStatus>('operational');
  let formOperatingHours = $state<number | null>(null);
  let formNextMaintenance = $state('');
  let formTeamIds = $state<number[]>([]);

  // Track original team IDs for change detection
  let currentMachineTeamIds = $state<number[]>([]);

  // Dropdown States
  let departmentDropdownOpen = $state(false);
  let areaDropdownOpen = $state(false);
  let typeDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
  let teamsDropdownOpen = $state(false);

  // Form Submit Loading
  let submitting = $state(false);

  // ==========================================================================
  // DERIVED VALUES
  // ==========================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_EDIT_TITLE : MESSAGES.MODAL_ADD_TITLE);

  // Get selected department name for dropdown display
  const selectedDepartmentName = $derived.by(() => {
    if (formDepartmentId === null) return MESSAGES.PLACEHOLDER_DEPARTMENT;
    const dept = allDepartments.find((d) => d.id === formDepartmentId);
    return dept?.name ?? MESSAGES.PLACEHOLDER_DEPARTMENT;
  });

  // Get selected area name for dropdown display
  const selectedAreaName = $derived.by(() => {
    if (formAreaId === null) return MESSAGES.PLACEHOLDER_AREA;
    const area = allAreas.find((a) => a.id === formAreaId);
    return area?.name ?? MESSAGES.PLACEHOLDER_AREA;
  });

  // Get selected machine type label for dropdown display
  const selectedTypeLabel = $derived.by(() => {
    if (!formMachineType) return MESSAGES.PLACEHOLDER_TYPE;
    return getMachineTypeLabel(formMachineType);
  });

  // Filter departments by selected area (cascading)
  const filteredDepartments = $derived.by(() => {
    if (formAreaId === null) return [];
    return allDepartments.filter((dept) => dept.areaId === formAreaId);
  });

  // Filter teams by selected department (cascading)
  const filteredTeams = $derived.by(() => {
    if (formDepartmentId === null) return [];
    return allTeams.filter((team) => team.departmentId === formDepartmentId);
  });

  // Get teams display text for dropdown trigger
  const teamsDisplayText = $derived.by(() => {
    if (formDepartmentId === null) return MESSAGES.PLACEHOLDER_SELECT_DEPT_FIRST;
    if (formTeamIds.length === 0) return MESSAGES.PLACEHOLDER_TEAMS;
    if (formTeamIds.length <= 2) {
      const selectedTeams = allTeams.filter((t) => formTeamIds.includes(t.id));
      return selectedTeams.map((t) => t.name).join(', ');
    }
    return `${formTeamIds.length} Teams ausgewählt`;
  });

  // Check if cascading dropdowns should be disabled
  const isDepartmentDisabled = $derived(formAreaId === null);
  const isTeamsDisabled = $derived(formDepartmentId === null);

  // ==========================================================================
  // METHODS
  // ==========================================================================

  function setMachines(machines: Machine[]) {
    allMachines = machines;
  }

  function setFilteredMachines(machines: Machine[]) {
    filteredMachines = machines;
  }

  function setDepartments(departments: Department[]) {
    allDepartments = departments;
  }

  function setAreas(areas: Area[]) {
    allAreas = areas;
  }

  function setTeams(teams: Team[]) {
    allTeams = teams;
  }

  function setLoading(val: boolean) {
    loading = val;
  }

  function setError(val: string | null) {
    error = val;
  }

  function setCurrentStatusFilter(val: MachineStatusFilter) {
    currentStatusFilter = val;
  }

  function setCurrentSearchQuery(val: string) {
    currentSearchQuery = val;
  }

  function setSearchOpen(val: boolean) {
    searchOpen = val;
  }

  function openMachineModal() {
    showMachineModal = true;
  }

  function closeMachineModal() {
    showMachineModal = false;
    currentEditId = null;
    resetForm();
  }

  function openDeleteModal(machineId: number) {
    deleteMachineId = machineId;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteMachineId = null;
  }

  function openDeleteConfirmModal() {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeDeleteConfirmModal() {
    showDeleteConfirmModal = false;
    deleteMachineId = null;
  }

  function setCurrentEditId(id: number | null) {
    currentEditId = id;
  }

  function setSubmitting(val: boolean) {
    submitting = val;
  }

  // Form field setters
  function setFormName(val: string) {
    formName = val;
  }
  function setFormModel(val: string) {
    formModel = val;
  }
  function setFormManufacturer(val: string) {
    formManufacturer = val;
  }
  function setFormSerialNumber(val: string) {
    formSerialNumber = val;
  }
  function setFormDepartmentId(val: number | null) {
    formDepartmentId = val;
  }
  function setFormAreaId(val: number | null) {
    formAreaId = val;
  }
  function setFormMachineType(val: string) {
    formMachineType = val;
  }
  function setFormStatus(val: MachineStatus) {
    formStatus = val;
  }
  function setFormOperatingHours(val: number | null) {
    formOperatingHours = val;
  }
  function setFormNextMaintenance(val: string) {
    formNextMaintenance = val;
  }
  function setFormTeamIds(val: number[]) {
    formTeamIds = val;
  }
  function setCurrentMachineTeamIds(val: number[]) {
    currentMachineTeamIds = val;
  }

  // Dropdown state setters
  function setDepartmentDropdownOpen(val: boolean) {
    departmentDropdownOpen = val;
  }
  function setAreaDropdownOpen(val: boolean) {
    areaDropdownOpen = val;
  }
  function setTypeDropdownOpen(val: boolean) {
    typeDropdownOpen = val;
  }
  function setStatusDropdownOpen(val: boolean) {
    statusDropdownOpen = val;
  }
  function setTeamsDropdownOpen(val: boolean) {
    teamsDropdownOpen = val;
  }

  function closeAllDropdowns() {
    departmentDropdownOpen = false;
    areaDropdownOpen = false;
    typeDropdownOpen = false;
    statusDropdownOpen = false;
    teamsDropdownOpen = false;
  }

  function resetForm() {
    formName = FORM_DEFAULTS.name;
    formModel = FORM_DEFAULTS.model;
    formManufacturer = FORM_DEFAULTS.manufacturer;
    formSerialNumber = FORM_DEFAULTS.serialNumber;
    formMachineType = FORM_DEFAULTS.machineType;
    formStatus = FORM_DEFAULTS.status;
    formOperatingHours = FORM_DEFAULTS.operatingHours;
    formNextMaintenance = FORM_DEFAULTS.nextMaintenance;
    formAreaId = FORM_DEFAULTS.areaId;
    formDepartmentId = FORM_DEFAULTS.departmentId;
    formTeamIds = [...FORM_DEFAULTS.teamIds];
    currentMachineTeamIds = [];
    closeAllDropdowns();
  }

  return {
    // Getters (reactive)
    get allMachines() {
      return allMachines;
    },
    get filteredMachines() {
      return filteredMachines;
    },
    get allDepartments() {
      return allDepartments;
    },
    get allAreas() {
      return allAreas;
    },
    get allTeams() {
      return allTeams;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get currentStatusFilter() {
      return currentStatusFilter;
    },
    get currentSearchQuery() {
      return currentSearchQuery;
    },
    get searchOpen() {
      return searchOpen;
    },
    get showMachineModal() {
      return showMachineModal;
    },
    get showDeleteModal() {
      return showDeleteModal;
    },
    get showDeleteConfirmModal() {
      return showDeleteConfirmModal;
    },
    get currentEditId() {
      return currentEditId;
    },
    get deleteMachineId() {
      return deleteMachineId;
    },
    get formName() {
      return formName;
    },
    get formModel() {
      return formModel;
    },
    get formManufacturer() {
      return formManufacturer;
    },
    get formSerialNumber() {
      return formSerialNumber;
    },
    get formDepartmentId() {
      return formDepartmentId;
    },
    get formAreaId() {
      return formAreaId;
    },
    get formMachineType() {
      return formMachineType;
    },
    get formStatus() {
      return formStatus;
    },
    get formOperatingHours() {
      return formOperatingHours;
    },
    get formNextMaintenance() {
      return formNextMaintenance;
    },
    get formTeamIds() {
      return formTeamIds;
    },
    get currentMachineTeamIds() {
      return currentMachineTeamIds;
    },
    get departmentDropdownOpen() {
      return departmentDropdownOpen;
    },
    get areaDropdownOpen() {
      return areaDropdownOpen;
    },
    get typeDropdownOpen() {
      return typeDropdownOpen;
    },
    get statusDropdownOpen() {
      return statusDropdownOpen;
    },
    get teamsDropdownOpen() {
      return teamsDropdownOpen;
    },
    get submitting() {
      return submitting;
    },

    // Derived values
    get isEditMode() {
      return isEditMode;
    },
    get modalTitle() {
      return modalTitle;
    },
    get selectedDepartmentName() {
      return selectedDepartmentName;
    },
    get selectedAreaName() {
      return selectedAreaName;
    },
    get selectedTypeLabel() {
      return selectedTypeLabel;
    },
    get filteredDepartments() {
      return filteredDepartments;
    },
    get filteredTeams() {
      return filteredTeams;
    },
    get teamsDisplayText() {
      return teamsDisplayText;
    },
    get isDepartmentDisabled() {
      return isDepartmentDisabled;
    },
    get isTeamsDisabled() {
      return isTeamsDisabled;
    },

    // Methods
    setMachines,
    setFilteredMachines,
    setDepartments,
    setAreas,
    setTeams,
    setLoading,
    setError,
    setCurrentStatusFilter,
    setCurrentSearchQuery,
    setSearchOpen,
    openMachineModal,
    closeMachineModal,
    openDeleteModal,
    closeDeleteModal,
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    setCurrentEditId,
    setSubmitting,
    setFormName,
    setFormModel,
    setFormManufacturer,
    setFormSerialNumber,
    setFormDepartmentId,
    setFormAreaId,
    setFormMachineType,
    setFormStatus,
    setFormOperatingHours,
    setFormNextMaintenance,
    setFormTeamIds,
    setCurrentMachineTeamIds,
    setDepartmentDropdownOpen,
    setAreaDropdownOpen,
    setTypeDropdownOpen,
    setStatusDropdownOpen,
    setTeamsDropdownOpen,
    closeAllDropdowns,
    resetForm,
  };
}

// Singleton export
export const machineState = createMachineState();
