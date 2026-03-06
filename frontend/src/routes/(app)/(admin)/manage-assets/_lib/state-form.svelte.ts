// =============================================================================
// MANAGE MACHINES - FORM STATE MODULE
// =============================================================================

import { FORM_DEFAULTS } from './constants';

import type { AssetStatus } from './types';

/** Creates form-related state */
// eslint-disable-next-line max-lines-per-function -- Svelte 5 state factory: all form fields must be in same function scope for reactivity
export function createFormState() {
  let formName = $state('');
  let formModel = $state('');
  let formManufacturer = $state('');
  let formSerialNumber = $state('');
  let formDepartmentId = $state<number | null>(null);
  let formAreaId = $state<number | null>(null);
  let formAssetType = $state('');
  let formStatus = $state<AssetStatus>('operational');
  let formOperatingHours = $state<number | null>(null);
  let formNextMaintenance = $state('');
  let formTeamIds = $state<number[]>([]);
  let currentAssetTeamIds = $state<number[]>([]);

  const resetForm = (): void => {
    formName = FORM_DEFAULTS.name;
    formModel = FORM_DEFAULTS.model;
    formManufacturer = FORM_DEFAULTS.manufacturer;
    formSerialNumber = FORM_DEFAULTS.serialNumber;
    formAssetType = FORM_DEFAULTS.assetType;
    formStatus = FORM_DEFAULTS.status;
    formOperatingHours = FORM_DEFAULTS.operatingHours;
    formNextMaintenance = FORM_DEFAULTS.nextMaintenance;
    formAreaId = FORM_DEFAULTS.areaId;
    formDepartmentId = FORM_DEFAULTS.departmentId;
    formTeamIds = [...FORM_DEFAULTS.teamIds];
    currentAssetTeamIds = [];
  };

  return {
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
    get formAssetType() {
      return formAssetType;
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
    get currentAssetTeamIds() {
      return currentAssetTeamIds;
    },
    setFormName: (v: string) => {
      formName = v;
    },
    setFormModel: (v: string) => {
      formModel = v;
    },
    setFormManufacturer: (v: string) => {
      formManufacturer = v;
    },
    setFormSerialNumber: (v: string) => {
      formSerialNumber = v;
    },
    setFormDepartmentId: (v: number | null) => {
      formDepartmentId = v;
    },
    setFormAreaId: (v: number | null) => {
      formAreaId = v;
    },
    setFormAssetType: (v: string) => {
      formAssetType = v;
    },
    setFormStatus: (v: AssetStatus) => {
      formStatus = v;
    },
    setFormOperatingHours: (v: number | null) => {
      formOperatingHours = v;
    },
    setFormNextMaintenance: (v: string) => {
      formNextMaintenance = v;
    },
    setFormTeamIds: (v: number[]) => {
      formTeamIds = v;
    },
    setCurrentAssetTeamIds: (v: number[]) => {
      currentAssetTeamIds = v;
    },
    resetForm,
  };
}

export type FormState = ReturnType<typeof createFormState>;
