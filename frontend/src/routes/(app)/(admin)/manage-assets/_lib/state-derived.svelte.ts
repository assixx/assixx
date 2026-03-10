// =============================================================================
// MANAGE MACHINES - DERIVED STATE MODULE
// =============================================================================

import { createMessages } from './constants';
import { getAssetTypeLabel } from './utils';

import type { DataState } from './state-data.svelte';
import type { FormState } from './state-form.svelte';
import type { UIState } from './state-ui.svelte';

/**
 * Creates derived values from composed state modules
 */
// eslint-disable-next-line max-lines-per-function -- Svelte 5 derived factory: all $derived values must be in same function scope for reactivity
export function createDerivedState(
  data: DataState,
  ui: UIState,
  form: FormState,
) {
  const messages = $derived(createMessages(data.labels));

  const isEditMode = $derived(ui.currentEditId !== null);
  const modalTitle = $derived(
    isEditMode ? messages.MODAL_EDIT_TITLE : messages.MODAL_ADD_TITLE,
  );

  const selectedDepartmentName = $derived.by(() => {
    if (form.formDepartmentId === null) return messages.PLACEHOLDER_DEPARTMENT;
    return (
      data.allDepartments.find((d) => d.id === form.formDepartmentId)?.name ??
      messages.PLACEHOLDER_DEPARTMENT
    );
  });

  const selectedAreaName = $derived.by(() => {
    if (form.formAreaId === null) return messages.PLACEHOLDER_AREA;
    return (
      data.allAreas.find((a) => a.id === form.formAreaId)?.name ??
      messages.PLACEHOLDER_AREA
    );
  });

  const selectedTypeLabel = $derived.by(() => {
    return form.formAssetType !== '' ?
        getAssetTypeLabel(form.formAssetType)
      : messages.PLACEHOLDER_TYPE;
  });

  const filteredDepartments = $derived.by(() => {
    return form.formAreaId === null ?
        []
      : data.allDepartments.filter((d) => d.areaId === form.formAreaId);
  });

  const filteredTeams = $derived.by(() => {
    return form.formDepartmentId === null ?
        []
      : data.allTeams.filter((t) => t.departmentId === form.formDepartmentId);
  });

  const teamsDisplayText = $derived.by(() => {
    if (form.formDepartmentId === null)
      return messages.PLACEHOLDER_SELECT_DEPT_FIRST;
    if (form.formTeamIds.length === 0) return messages.PLACEHOLDER_TEAMS;
    if (form.formTeamIds.length <= 2) {
      return data.allTeams
        .filter((t) => form.formTeamIds.includes(t.id))
        .map((t) => t.name)
        .join(', ');
    }
    return messages.teamsSelected(form.formTeamIds.length);
  });

  const isDepartmentDisabled = $derived(form.formAreaId === null);
  const isTeamsDisabled = $derived(form.formDepartmentId === null);

  return {
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
  };
}

export type DerivedState = ReturnType<typeof createDerivedState>;
