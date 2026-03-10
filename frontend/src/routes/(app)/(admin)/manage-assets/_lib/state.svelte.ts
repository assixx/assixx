// =============================================================================
// MANAGE MACHINES - COMPOSED STATE (Svelte 5 Runes)
// =============================================================================

import { createDataState } from './state-data.svelte';
import { createDerivedState } from './state-derived.svelte';
import { createDropdownState } from './state-dropdowns.svelte';
import { createFormState } from './state-form.svelte';
import { createUIState } from './state-ui.svelte';

/**
 * Asset Management State Factory
 * Composes data, UI, form, dropdown, and derived state modules
 */
// eslint-disable-next-line max-lines-per-function -- Facade pattern: composing 5 sub-modules into unified API. Actual reactive logic is in sub-modules.
function createAssetState() {
  const data = createDataState();
  const ui = createUIState();
  const form = createFormState();
  const dropdowns = createDropdownState();
  const derived = createDerivedState(data, ui, form);

  // Modal action methods
  const openAssetModal = () => {
    ui.setShowAssetModal(true);
  };
  const closeAssetModal = () => {
    ui.setShowAssetModal(false);
    ui.setCurrentEditId(null);
    form.resetForm();
    dropdowns.closeAllDropdowns();
  };
  const openDeleteModal = (id: number) => {
    ui.setDeleteAssetId(id);
    ui.setShowDeleteModal(true);
  };
  const closeDeleteModal = () => {
    ui.setShowDeleteModal(false);
    ui.setDeleteAssetId(null);
  };
  return {
    // Data (pass through getters and setters)
    get allAssets() {
      return data.allAssets;
    },
    get filteredAssets() {
      return data.filteredAssets;
    },
    get allDepartments() {
      return data.allDepartments;
    },
    get allAreas() {
      return data.allAreas;
    },
    get allTeams() {
      return data.allTeams;
    },
    setAssets: data.setAssets,
    setFilteredAssets: data.setFilteredAssets,
    setDepartments: data.setDepartments,
    setAreas: data.setAreas,
    setTeams: data.setTeams,
    get labels() {
      return data.labels;
    },
    setLabels: data.setLabels,
    // UI (pass through getters and setters)
    get loading() {
      return ui.loading;
    },
    get error() {
      return ui.error;
    },
    get currentStatusFilter() {
      return ui.currentStatusFilter;
    },
    get currentSearchQuery() {
      return ui.currentSearchQuery;
    },
    get searchOpen() {
      return ui.searchOpen;
    },
    get submitting() {
      return ui.submitting;
    },
    get showAssetModal() {
      return ui.showAssetModal;
    },
    get showDeleteModal() {
      return ui.showDeleteModal;
    },
    get currentEditId() {
      return ui.currentEditId;
    },
    get deleteAssetId() {
      return ui.deleteAssetId;
    },
    setLoading: ui.setLoading,
    setError: ui.setError,
    setCurrentStatusFilter: ui.setCurrentStatusFilter,
    setCurrentSearchQuery: ui.setCurrentSearchQuery,
    setSearchOpen: ui.setSearchOpen,
    setSubmitting: ui.setSubmitting,
    setCurrentEditId: ui.setCurrentEditId,
    // Form (pass through getters and setters)
    get formName() {
      return form.formName;
    },
    get formModel() {
      return form.formModel;
    },
    get formManufacturer() {
      return form.formManufacturer;
    },
    get formSerialNumber() {
      return form.formSerialNumber;
    },
    get formDepartmentId() {
      return form.formDepartmentId;
    },
    get formAreaId() {
      return form.formAreaId;
    },
    get formAssetType() {
      return form.formAssetType;
    },
    get formStatus() {
      return form.formStatus;
    },
    get formOperatingHours() {
      return form.formOperatingHours;
    },
    get formNextMaintenance() {
      return form.formNextMaintenance;
    },
    get formTeamIds() {
      return form.formTeamIds;
    },
    get currentAssetTeamIds() {
      return form.currentAssetTeamIds;
    },
    setFormName: form.setFormName,
    setFormModel: form.setFormModel,
    setFormManufacturer: form.setFormManufacturer,
    setFormSerialNumber: form.setFormSerialNumber,
    setFormDepartmentId: form.setFormDepartmentId,
    setFormAreaId: form.setFormAreaId,
    setFormAssetType: form.setFormAssetType,
    setFormStatus: form.setFormStatus,
    setFormOperatingHours: form.setFormOperatingHours,
    setFormNextMaintenance: form.setFormNextMaintenance,
    setFormTeamIds: form.setFormTeamIds,
    setCurrentAssetTeamIds: form.setCurrentAssetTeamIds,
    resetForm: form.resetForm,
    // Dropdowns (pass through getters and setters)
    get departmentDropdownOpen() {
      return dropdowns.departmentDropdownOpen;
    },
    get areaDropdownOpen() {
      return dropdowns.areaDropdownOpen;
    },
    get typeDropdownOpen() {
      return dropdowns.typeDropdownOpen;
    },
    get statusDropdownOpen() {
      return dropdowns.statusDropdownOpen;
    },
    get teamsDropdownOpen() {
      return dropdowns.teamsDropdownOpen;
    },
    setDepartmentDropdownOpen: dropdowns.setDepartmentDropdownOpen,
    setAreaDropdownOpen: dropdowns.setAreaDropdownOpen,
    setTypeDropdownOpen: dropdowns.setTypeDropdownOpen,
    setStatusDropdownOpen: dropdowns.setStatusDropdownOpen,
    setTeamsDropdownOpen: dropdowns.setTeamsDropdownOpen,
    closeAllDropdowns: dropdowns.closeAllDropdowns,
    // Derived (pass through getters)
    get isEditMode() {
      return derived.isEditMode;
    },
    get modalTitle() {
      return derived.modalTitle;
    },
    get selectedDepartmentName() {
      return derived.selectedDepartmentName;
    },
    get selectedAreaName() {
      return derived.selectedAreaName;
    },
    get selectedTypeLabel() {
      return derived.selectedTypeLabel;
    },
    get filteredDepartments() {
      return derived.filteredDepartments;
    },
    get filteredTeams() {
      return derived.filteredTeams;
    },
    get teamsDisplayText() {
      return derived.teamsDisplayText;
    },
    get isDepartmentDisabled() {
      return derived.isDepartmentDisabled;
    },
    get isTeamsDisabled() {
      return derived.isTeamsDisabled;
    },
    // Modal methods
    openAssetModal,
    closeAssetModal,
    openDeleteModal,
    closeDeleteModal,
  };
}

// Singleton export
export const assetState = createAssetState();
