// =============================================================================
// SHIFTS - FAVORITES UTILITIES
// Based on: frontend/src/scripts/shifts/favorites.ts
// Adapted for Svelte 5 (no DOM manipulation)
// =============================================================================

import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';
import { createLogger } from '$lib/utils/logger';

import { saveFavorite as apiSaveFavorite, deleteFavorite as apiDeleteFavorite } from './api';

import type { ShiftFavorite, SelectedContext, Area, Department, Asset, Team } from './types';

const log = createLogger('ShiftsFavorites');

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
    context.assetId !== null &&
    context.assetId !== 0 &&
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
      fav.assetId === context.assetId &&
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
  assets: Asset[],
  teams: Team[],
): { area: Area; department: Department; asset: Asset; team: Team } | null {
  const area = areas.find((a) => a.id === context.areaId);
  const department = departments.find((d) => d.id === context.departmentId);
  const asset = assets.find((m) => m.id === context.assetId);
  const team = teams.find((t) => t.id === context.teamId);

  if (area === undefined || department === undefined || asset === undefined || team === undefined) {
    return null;
  }

  return { area, department, asset, team };
}

// =============================================================================
// ACTIONS
// =============================================================================

interface AddFavoriteValidation {
  valid: boolean;
  error?: string;
  names?: { area: Area; department: Department; asset: Asset; team: Team };
}

/**
 * Validate context before adding to favorites
 */
function validateAddToFavorites(
  context: SelectedContext,
  favorites: ShiftFavorite[],
  areas: Area[],
  departments: Department[],
  assets: Asset[],
  teams: Team[],
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): AddFavoriteValidation {
  if (!isContextCompleteForFavorite(context)) {
    return {
      valid: false,
      error: `Bitte wählen Sie alle Filter aus (${labels.area}, ${labels.department}, ${labels.team} und ${labels.asset})`,
    };
  }

  if (isCombinationFavorited(favorites, context)) {
    const existing = favorites.find(
      (fav) =>
        fav.areaId === context.areaId &&
        fav.departmentId === context.departmentId &&
        fav.assetId === context.assetId &&
        fav.teamId === context.teamId,
    );
    return {
      valid: false,
      error: `Diese Kombination ist bereits als Favorit "${existing?.name ?? 'unbekannt'}" gespeichert!`,
    };
  }

  const names = getContextNames(context, areas, departments, assets, teams);
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

/** Persist favorite via API, returning success/failure result */
async function persistFavorite(
  context: SelectedContext,
  names: { area: Area; department: Department; asset: Asset; team: Team },
  favorites: ShiftFavorite[],
): Promise<AddFavoriteResult> {
  const savedFavorite = await apiSaveFavorite({
    name: `${names.team.name} – ${names.asset.name}`,
    areaId: context.areaId ?? 0,
    areaName: names.area.name,
    departmentId: context.departmentId ?? 0,
    departmentName: names.department.name,
    assetId: context.assetId ?? 0,
    assetName: names.asset.name,
    teamId: context.teamId ?? 0,
    teamName: names.team.name,
  });

  if (savedFavorite === null) {
    return {
      success: false,
      favorites,
      error: 'Fehler beim Speichern des Favoriten',
    };
  }

  return {
    success: true,
    favorites: [...favorites, savedFavorite],
    favorite: savedFavorite,
  };
}

/**
 * Add current context to favorites
 */
export async function addToFavorites(
  context: SelectedContext,
  favorites: ShiftFavorite[],
  areas: Area[],
  departments: Department[],
  assets: Asset[],
  teams: Team[],
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): Promise<AddFavoriteResult> {
  const validation = validateAddToFavorites(
    context,
    favorites,
    areas,
    departments,
    assets,
    teams,
    labels,
  );
  if (!validation.valid || validation.names === undefined) {
    return { success: false, favorites, error: validation.error };
  }

  try {
    return await persistFavorite(context, validation.names, favorites);
  } catch (err: unknown) {
    log.error({ err }, 'Error saving favorite');
    return {
      success: false,
      favorites,
      error: err instanceof Error ? err.message : 'Fehler beim Speichern des Favoriten',
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
  } catch (err: unknown) {
    log.error({ err }, 'Error deleting favorite');
    return {
      success: false,
      favorites,
      error: err instanceof Error ? err.message : 'Fehler beim Löschen des Favoriten',
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
  return `${favorite.areaName} → ${favorite.departmentName} → ${favorite.teamName} → ${favorite.assetName}`;
}

/**
 * Check if a favorite is currently active
 */
export function isFavoriteActive(favorite: ShiftFavorite, context: SelectedContext): boolean {
  return (
    favorite.areaId === context.areaId &&
    favorite.departmentId === context.departmentId &&
    favorite.assetId === context.assetId &&
    favorite.teamId === context.teamId
  );
}
