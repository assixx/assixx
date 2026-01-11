// =============================================================================
// SHIFTS - FAVORITES UTILITIES
// Based on: frontend/src/scripts/shifts/favorites.ts
// Adapted for Svelte 5 (no DOM manipulation)
// =============================================================================

import { saveFavorite as apiSaveFavorite, deleteFavorite as apiDeleteFavorite } from './api';

import type { ShiftFavorite, SelectedContext, Area, Department, Machine, Team } from './types';

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Check if context is complete for creating a favorite
 */
export function isContextCompleteForFavorite(context: SelectedContext): boolean {
  return (
    context.areaId !== null &&
    context.areaId !== 0 &&
    context.departmentId !== null &&
    context.departmentId !== 0 &&
    context.machineId !== null &&
    context.machineId !== 0 &&
    context.teamId !== null &&
    context.teamId !== 0
  );
}

/**
 * Check if a team is already in favorites
 */
export function isTeamAlreadyFavorited(favorites: ShiftFavorite[], teamId: number | null): boolean {
  if (teamId === null) return false;
  return favorites.some((fav) => fav.teamId === teamId);
}

/**
 * Check if exact combination is already favorited
 */
export function isCombinationFavorited(
  favorites: ShiftFavorite[],
  context: SelectedContext,
): boolean {
  return favorites.some(
    (fav) =>
      fav.areaId === context.areaId &&
      fav.departmentId === context.departmentId &&
      fav.machineId === context.machineId &&
      fav.teamId === context.teamId,
  );
}

/**
 * Check if add favorite button should be visible
 */
export function shouldShowAddFavoriteButton(
  context: SelectedContext,
  favorites: ShiftFavorite[],
): boolean {
  // Must have complete context
  if (!isContextCompleteForFavorite(context)) {
    return false;
  }

  // Must not already be favorited
  return !isCombinationFavorited(favorites, context);
}

// =============================================================================
// CONTEXT HELPERS
// =============================================================================

/**
 * Get context names from entity arrays
 */
export function getContextNames(
  context: SelectedContext,
  areas: Area[],
  departments: Department[],
  machines: Machine[],
  teams: Team[],
): { area: Area; department: Department; machine: Machine; team: Team } | null {
  const area = areas.find((a) => a.id === context.areaId);
  const department = departments.find((d) => d.id === context.departmentId);
  const machine = machines.find((m) => m.id === context.machineId);
  const team = teams.find((t) => t.id === context.teamId);

  if (
    area === undefined ||
    department === undefined ||
    machine === undefined ||
    team === undefined
  ) {
    return null;
  }

  return { area, department, machine, team };
}

// =============================================================================
// ACTIONS
// =============================================================================

interface AddFavoriteValidation {
  valid: boolean;
  error?: string;
  names?: { area: Area; department: Department; machine: Machine; team: Team };
}

/**
 * Validate context before adding to favorites
 */
function validateAddToFavorites(
  context: SelectedContext,
  favorites: ShiftFavorite[],
  areas: Area[],
  departments: Department[],
  machines: Machine[],
  teams: Team[],
): AddFavoriteValidation {
  if (isTeamAlreadyFavorited(favorites, context.teamId)) {
    const existing = favorites.find((fav) => fav.teamId === context.teamId);
    return {
      valid: false,
      error: `Diese Kombination ist bereits als Favorit "${existing?.name ?? 'unbekannt'}" gespeichert!`,
    };
  }

  if (!isContextCompleteForFavorite(context)) {
    return {
      valid: false,
      error: 'Bitte wählen Sie alle Filter aus (Bereich, Abteilung, Maschine und Team)',
    };
  }

  if (isCombinationFavorited(favorites, context)) {
    return { valid: false, error: 'Diese Kombination existiert bereits als Favorit!' };
  }

  const names = getContextNames(context, areas, departments, machines, teams);
  if (names === null) {
    return { valid: false, error: 'Fehler beim Ermitteln der Namen' };
  }

  return { valid: true, names };
}

interface AddFavoriteResult {
  success: boolean;
  favorites: ShiftFavorite[];
  error?: string;
  favorite?: ShiftFavorite;
}

/**
 * Add current context to favorites
 */
export async function addToFavorites(
  context: SelectedContext,
  favorites: ShiftFavorite[],
  areas: Area[],
  departments: Department[],
  machines: Machine[],
  teams: Team[],
): Promise<AddFavoriteResult> {
  const validation = validateAddToFavorites(
    context,
    favorites,
    areas,
    departments,
    machines,
    teams,
  );
  if (!validation.valid || validation.names === undefined) {
    return { success: false, favorites, error: validation.error };
  }

  const { names } = validation;

  try {
    const savedFavorite = await apiSaveFavorite({
      name: names.team.name,
      areaId: context.areaId ?? 0,
      areaName: names.area.name,
      departmentId: context.departmentId ?? 0,
      departmentName: names.department.name,
      machineId: context.machineId ?? 0,
      machineName: names.machine.name,
      teamId: context.teamId ?? 0,
      teamName: names.team.name,
    });

    if (savedFavorite === null) {
      return { success: false, favorites, error: 'Fehler beim Speichern des Favoriten' };
    }

    return { success: true, favorites: [...favorites, savedFavorite], favorite: savedFavorite };
  } catch (error) {
    console.error('[FAVORITES] Error saving favorite:', error);
    return {
      success: false,
      favorites,
      error: error instanceof Error ? error.message : 'Fehler beim Speichern des Favoriten',
    };
  }
}

/**
 * Remove a favorite
 */
export async function removeFavorite(
  favoriteId: string | number,
  favorites: ShiftFavorite[],
): Promise<{ success: boolean; favorites: ShiftFavorite[]; error?: string }> {
  const favoriteToRemove = favorites.find((f) => String(f.id) === String(favoriteId));

  // Check if favorite exists before attempting delete
  if (favoriteToRemove === undefined) {
    return {
      success: false,
      favorites,
      error: 'Favorit nicht gefunden',
    };
  }

  try {
    await apiDeleteFavorite(favoriteId);

    // Update local favorites list
    const updatedFavorites = favorites.filter((f) => String(f.id) !== String(favoriteId));

    return {
      success: true,
      favorites: updatedFavorites,
    };
  } catch (error) {
    console.error('[FAVORITES] Error deleting favorite:', error);
    return {
      success: false,
      favorites,
      error: error instanceof Error ? error.message : 'Fehler beim Löschen des Favoriten',
    };
  }
}

// =============================================================================
// UI HELPERS
// =============================================================================

/**
 * Get favorite tooltip text
 */
export function getFavoriteTooltip(favorite: ShiftFavorite): string {
  return `${favorite.areaName} → ${favorite.departmentName} → ${favorite.machineName} → ${favorite.teamName}`;
}

/**
 * Check if a favorite is currently active
 */
export function isFavoriteActive(favorite: ShiftFavorite, context: SelectedContext): boolean {
  return (
    favorite.areaId === context.areaId &&
    favorite.departmentId === context.departmentId &&
    favorite.machineId === context.machineId &&
    favorite.teamId === context.teamId
  );
}
