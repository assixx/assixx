// =============================================================================
// MANAGE MACHINES - DATA STATE MODULE
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { Asset, Department, Area, Team } from './types';

/**
 * Creates data-related state (assets, departments, areas, teams, labels)
 */
export function createDataState() {
  let allAssets = $state<Asset[]>([]);
  let filteredAssets = $state<Asset[]>([]);
  let allDepartments = $state<Department[]>([]);
  let allAreas = $state<Area[]>([]);
  let allTeams = $state<Team[]>([]);
  let labels = $state(DEFAULT_HIERARCHY_LABELS);

  return {
    get allAssets() {
      return allAssets;
    },
    get filteredAssets() {
      return filteredAssets;
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
    get labels() {
      return labels;
    },
    setAssets: (v: Asset[]) => {
      allAssets = v;
    },
    setFilteredAssets: (v: Asset[]) => {
      filteredAssets = v;
    },
    setDepartments: (v: Department[]) => {
      allDepartments = v;
    },
    setAreas: (v: Area[]) => {
      allAreas = v;
    },
    setTeams: (v: Team[]) => {
      allTeams = v;
    },
    setLabels: (v: HierarchyLabels) => {
      labels = v;
    },
  };
}

export type DataState = ReturnType<typeof createDataState>;
