// =============================================================================
// SHIFTS - ADMIN ACTIONS
// Pure async functions for admin operations (save, discard, favorites)
// =============================================================================

import {
  createShiftPlan,
  updateShiftPlan,
  deleteRotationHistoryByWeek,
  deleteRotationHistoryByTeam,
  deleteShiftsByWeek,
  deleteFavorite as apiDeleteFavorite,
  saveFavorite as apiSaveFavorite,
} from './api';
import { DEFAULT_SHIFT_TIMES } from './constants';
import { buildShiftSaveData } from './data-loader';
import { formatDate, getWeekStart, getWeekNumber } from './utils';

import type {
  SelectedContext,
  Team,
  Area,
  Department,
  Asset,
  ShiftFavorite,
  ShiftTimesMap,
} from './types';

// =============================================================================
// SAVE SCHEDULE
// =============================================================================

export interface SaveScheduleParams {
  weeklyShifts: Map<string, Map<string, number[]>>;
  weeklyNotes: string;
  currentWeek: Date;
  currentPlanId: number | null;
  selectedContext: SelectedContext;
  teams: Team[];
  shiftTimesMap?: ShiftTimesMap;
}

export interface SaveScheduleResult {
  success: boolean;
  planId?: number;
  error?: string;
}

export async function saveSchedule(
  params: SaveScheduleParams,
): Promise<SaveScheduleResult> {
  const {
    weeklyShifts,
    weeklyNotes,
    currentWeek,
    currentPlanId,
    selectedContext,
    teams,
    shiftTimesMap,
  } = params;

  const effectiveShiftTimes = shiftTimesMap ?? DEFAULT_SHIFT_TIMES;
  const shifts = buildShiftSaveData(weeklyShifts, effectiveShiftTimes);
  const weekStart = getWeekStart(currentWeek);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const teamName =
    teams.find((t) => t.id === selectedContext.teamId)?.name ?? 'Team';

  const planData = {
    teamId: selectedContext.teamId ?? 0,
    departmentId: selectedContext.departmentId ?? undefined,
    assetId: selectedContext.assetId ?? undefined,
    areaId: selectedContext.areaId ?? undefined,
    startDate: formatDate(weekStart),
    endDate: formatDate(weekEnd),
    name: `${teamName} - KW ${getWeekNumber(weekStart)}`,
    shiftNotes: weeklyNotes,
    shifts,
  };

  const result =
    currentPlanId !== null ?
      await updateShiftPlan(currentPlanId, planData)
    : await createShiftPlan(planData);

  return { success: true, planId: result.planId };
}

// =============================================================================
// DISCARD WEEK
// =============================================================================

export interface DiscardWeekParams {
  teamId: number;
  currentWeek: Date;
}

export interface DiscardWeekResult {
  success: boolean;
  historyDeleted?: number;
  shiftsDeleted?: number;
  error?: string;
}

export async function discardWeek(
  params: DiscardWeekParams,
): Promise<DiscardWeekResult> {
  const { teamId, currentWeek } = params;

  const weekStart = getWeekStart(currentWeek);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const startDate = formatDate(weekStart);
  const endDate = formatDate(weekEnd);

  // Delete both rotation history AND shifts for this week
  const [rotationResult, shiftsResult] = await Promise.all([
    deleteRotationHistoryByWeek(teamId, startDate, endDate),
    deleteShiftsByWeek(teamId, startDate, endDate),
  ]);

  return {
    success: true,
    historyDeleted: rotationResult.historyDeleted,
    shiftsDeleted: shiftsResult.shiftsDeleted,
  };
}

// =============================================================================
// DISCARD TEAM PLAN (deletes current pattern only)
// =============================================================================

export interface DiscardTeamPlanParams {
  teamId: number;
  patternId: number; // REQUIRED: the specific pattern to delete
}

export interface DiscardTeamPlanResult {
  success: boolean;
  historyDeleted?: number;
  assignmentsDeleted?: number;
  patternsDeleted?: number;
  shiftsDeleted?: number;
  plansDeleted?: number;
  error?: string;
}

/**
 * Discard the CURRENT rotation pattern (not all patterns!)
 * Deletes only the specified pattern and its related shifts/history/assignments
 */
export async function discardTeamPlan(
  params: DiscardTeamPlanParams,
): Promise<DiscardTeamPlanResult> {
  const { teamId, patternId } = params;

  // Backend deletes ONLY this specific pattern:
  // - Deletes shifts that are in rotation_history for this pattern
  // - Deletes rotation history, assignments for this pattern
  // - Deletes this pattern only (not other patterns!)
  // - Does NOT delete shift_plans (those are separate)
  const result = await deleteRotationHistoryByTeam(teamId, patternId);

  return {
    success: true,
    historyDeleted: result.historyDeleted,
    assignmentsDeleted: result.assignmentsDeleted,
    patternsDeleted: result.patternsDeleted,
    shiftsDeleted: result.shiftsDeleted,
    plansDeleted: result.plansDeleted,
  };
}

// =============================================================================
// DISCARD YEAR PLAN (deletes ALL patterns for a team)
// =============================================================================

export interface DiscardYearPlanParams {
  teamId: number;
}

/**
 * Discard ALL rotation patterns for a team (year reset)
 * WARNING: This deletes EVERYTHING - all patterns, shifts, history, assignments, plans!
 */
export async function discardYearPlan(
  params: DiscardYearPlanParams,
): Promise<DiscardTeamPlanResult> {
  const { teamId } = params;

  // Backend deletes EVERYTHING for this team (no patternId = delete all):
  // - Deletes ALL shifts in rotation_history
  // - Deletes ALL rotation history, assignments, patterns
  // - Deletes ALL shift_plans
  const result = await deleteRotationHistoryByTeam(teamId); // No patternId = delete ALL

  return {
    success: true,
    historyDeleted: result.historyDeleted,
    assignmentsDeleted: result.assignmentsDeleted,
    patternsDeleted: result.patternsDeleted,
    shiftsDeleted: result.shiftsDeleted,
    plansDeleted: result.plansDeleted,
  };
}

// =============================================================================
// FAVORITES
// =============================================================================

export async function deleteFavoriteById(favoriteId: number): Promise<boolean> {
  await apiDeleteFavorite(favoriteId);
  return true;
}

export interface AddFavoriteParams {
  selectedContext: SelectedContext;
  areas: Area[];
  departments: Department[];
  assets: Asset[];
  teams: Team[];
}

interface FavoriteEntities {
  area: Area;
  dept: Department;
  asset: Asset | undefined;
  team: Team;
  areaId: number;
  departmentId: number;
  assetId: number | null;
  teamId: number;
}

/**
 * Finds and validates all required entities for a favorite
 * Returns null if required IDs are missing or entities not found
 */
function findFavoriteEntities(
  params: AddFavoriteParams,
): FavoriteEntities | null {
  const { selectedContext, areas, departments, assets, teams } = params;
  const { areaId, departmentId, assetId, teamId } = selectedContext;

  if (areaId === null || departmentId === null || teamId === null) {
    return null;
  }

  const area = areas.find((a) => a.id === areaId);
  const dept = departments.find((d) => d.id === departmentId);
  const team = teams.find((t) => t.id === teamId);

  if (area === undefined || dept === undefined || team === undefined) {
    return null;
  }

  const asset =
    assetId !== null ? assets.find((m) => m.id === assetId) : undefined;
  return { area, dept, asset, team, areaId, departmentId, assetId, teamId };
}

export async function addToFavorites(
  params: AddFavoriteParams,
): Promise<ShiftFavorite | null> {
  const entities = findFavoriteEntities(params);
  if (entities === null) return null;

  const { area, dept, asset, team, areaId, departmentId, assetId, teamId } =
    entities;

  const favoriteName =
    asset !== undefined ? `${team.name} - ${asset.name}` : team.name;

  return await apiSaveFavorite({
    name: favoriteName,
    areaId,
    areaName: area.name,
    departmentId,
    departmentName: dept.name,
    assetId: assetId ?? 0,
    assetName: asset?.name ?? '',
    teamId,
    teamName: team.name,
  });
}
