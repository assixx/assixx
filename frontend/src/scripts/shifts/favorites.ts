/**
 * Favorites Management for Shift Planning System
 * Functions for managing shift planning favorites
 */

import { showSuccessAlert, showErrorAlert } from '../utils/alerts';
import { createElement } from '../../utils/dom-utils';
import { getAuthToken } from '../auth/index';
import type { ShiftFavorite, SelectedContext, Area, Department, Machine, Team } from './types';

// ============== FAVORITES API ==============

/**
 * Load favorites from API
 */
export async function loadFavorites(): Promise<ShiftFavorite[]> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      throw new Error('No authentication token');
    }

    const response = await fetch('/api/v2/shifts/favorites', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error('Failed to load favorites');
    }

    const result = (await response.json()) as { data?: ShiftFavorite[]; favorites?: ShiftFavorite[] };
    // Handle both possible response formats
    const favoritesData = result.data ?? result.favorites ?? [];
    return Array.isArray(favoritesData) ? favoritesData : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
}

/**
 * Save a new favorite via API
 */
export async function saveFavorite(favoriteData: {
  name: string;
  areaId: number;
  areaName: string;
  departmentId: number;
  departmentName: string;
  machineId: number;
  machineName: string;
  teamId: number;
  teamName: string;
}): Promise<{ success: boolean; favorite?: ShiftFavorite; error?: string }> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    const response = await fetch('/api/v2/shifts/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(favoriteData),
    });

    if (!response.ok) {
      if (response.status === 409) {
        return { success: false, error: 'Ein Favorit mit diesem Namen existiert bereits' };
      }
      const errorResponse = (await response.json()) as { error?: { message?: string } };
      return { success: false, error: errorResponse.error?.message ?? 'Fehler beim Speichern des Favoriten' };
    }

    const result = (await response.json()) as { favorite: ShiftFavorite };
    return { success: true, favorite: result.favorite };
  } catch (error) {
    console.error('Error saving favorite:', error);
    return { success: false, error: 'Fehler beim Speichern des Favoriten' };
  }
}

/**
 * Delete a favorite via API
 */
export async function deleteFavorite(favoriteId: string | number): Promise<{ success: boolean; error?: string }> {
  try {
    const token = getAuthToken();
    if (token === null || token === '') {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    const response = await fetch(`/api/v2/shifts/favorites/${String(favoriteId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorResponse = (await response.json()) as { error?: { message?: string } };
      return { success: false, error: errorResponse.error?.message ?? 'Fehler beim Löschen des Favoriten' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting favorite:', error);
    return { success: false, error: 'Fehler beim Löschen des Favoriten' };
  }
}

// ============== FAVORITES VALIDATION ==============

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
export function isCombinationFavorited(favorites: ShiftFavorite[], context: SelectedContext): boolean {
  return favorites.some(
    (fav) =>
      fav.areaId === context.areaId &&
      fav.departmentId === context.departmentId &&
      fav.machineId === context.machineId &&
      fav.teamId === context.teamId,
  );
}

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

  if (area === undefined || department === undefined || machine === undefined || team === undefined) {
    return null;
  }

  return { area, department, machine, team };
}

// ============== FAVORITES CONTAINER ==============

const FAVORITES_CONTAINER_ID = 'favoritesContainer';
const FAVORITES_LIST_ID = 'favoritesList';

/**
 * Ensure favorites container exists in the DOM
 * Creates the container dynamically if it doesn't exist
 * Returns the favorites list element where items should be rendered
 */
export function ensureFavoritesContainer(): HTMLElement | null {
  // Check if container already exists
  const existing = document.getElementById(FAVORITES_CONTAINER_ID);
  if (existing !== null) {
    return document.getElementById(FAVORITES_LIST_ID);
  }

  // Find insertion point - after .shift-info-row
  const shiftInfoRow = document.querySelector('.shift-info-row');
  if (shiftInfoRow === null) {
    console.warn('[FAVORITES] .shift-info-row not found, cannot create favorites container');
    return null;
  }

  // Create container structure
  const container = createElement('div', {
    className: 'favorites-container',
    id: FAVORITES_CONTAINER_ID,
  });

  const header = createElement('div', { className: 'favorites-header' });
  const label = createElement('span', { className: 'favorites-label' }, '⭐ Favoriten:');
  const list = createElement('div', { className: 'favorites-list', id: FAVORITES_LIST_ID });

  header.append(label, list);
  container.append(header);

  // Insert after shift-info-row
  shiftInfoRow.parentElement?.insertBefore(container, shiftInfoRow.nextSibling);

  console.info('[FAVORITES] Container created dynamically');
  return list;
}

/**
 * Get the favorites list element, creating container if needed
 */
export function getFavoritesListElement(): HTMLElement | null {
  const existingList = document.getElementById(FAVORITES_LIST_ID);
  if (existingList !== null) {
    return existingList;
  }
  return ensureFavoritesContainer();
}

// ============== FAVORITES UI ==============

/**
 * Create favorite button element (matching legacy design)
 * Uses <button class="favorite-btn"> with teamName as text
 */
export function createFavoriteItem(
  favorite: ShiftFavorite,
  onSelect: (favorite: ShiftFavorite) => void,
  onDelete: (favoriteId: string | number) => void,
  isActive: boolean = false,
): HTMLButtonElement {
  // Create main button element
  const button = document.createElement('button');
  button.className = `favorite-btn${isActive ? ' active' : ''}`;
  button.dataset['favoriteId'] = String(favorite.id);
  button.title = `${favorite.areaName} → ${favorite.departmentName} → ${favorite.machineName} → ${favorite.teamName}`;

  // Add team name as text
  button.append(document.createTextNode(favorite.teamName));

  // Add remove button (× symbol)
  const removeBtn = document.createElement('span');
  removeBtn.className = 'remove-favorite';
  removeBtn.dataset['favoriteId'] = String(favorite.id);
  removeBtn.textContent = '×';
  button.append(removeBtn);

  // Add click handler
  button.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Check if remove button was clicked
    if (target.classList.contains('remove-favorite')) {
      e.stopPropagation();
      const favId = target.dataset['favoriteId'];
      if (favId !== undefined && favId !== '') {
        onDelete(favId);
      }
      return;
    }

    // Otherwise, select the favorite
    onSelect(favorite);
  });

  return button;
}

/**
 * Render favorites list
 */
export function renderFavoritesList(
  container: Element,
  favorites: ShiftFavorite[],
  onSelect: (favorite: ShiftFavorite) => void,
  onDelete: (favoriteId: string | number) => void,
  activeTeamId?: number | null,
): void {
  // Clear container
  while (container.firstChild !== null) {
    container.firstChild.remove();
  }

  if (favorites.length === 0) {
    const emptyMessage = createElement('div', { className: 'favorites-empty' }, 'Keine Favoriten gespeichert');
    container.append(emptyMessage);
    return;
  }

  favorites.forEach((favorite) => {
    const isActive = activeTeamId !== undefined && favorite.teamId === activeTeamId;
    const item = createFavoriteItem(favorite, onSelect, onDelete, isActive);
    container.append(item);
  });
}

// ============== FAVORITES ACTIONS ==============

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
): Promise<{ success: boolean; favorites: ShiftFavorite[]; error?: string }> {
  // Check if team is already favorited
  if (isTeamAlreadyFavorited(favorites, context.teamId)) {
    const existingFavorite = favorites.find((fav) => fav.teamId === context.teamId);
    return {
      success: false,
      favorites,
      error: `Diese Kombination ist bereits als Favorit "${existingFavorite?.name ?? 'unbekannt'}" gespeichert!`,
    };
  }

  // Check if context is complete
  if (!isContextCompleteForFavorite(context)) {
    return {
      success: false,
      favorites,
      error: 'Bitte wählen Sie alle Filter aus (Bereich, Abteilung, Maschine und Team)',
    };
  }

  // Check if exact combination is already favorited
  if (isCombinationFavorited(favorites, context)) {
    return {
      success: false,
      favorites,
      error: 'Diese Kombination existiert bereits als Favorit!',
    };
  }

  // Get names for display
  const names = getContextNames(context, areas, departments, machines, teams);
  if (names === null) {
    return {
      success: false,
      favorites,
      error: 'Fehler beim Ermitteln der Namen',
    };
  }

  // Save favorite via API
  const result = await saveFavorite({
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

  if (!result.success) {
    return { success: false, favorites, error: result.error ?? 'Unbekannter Fehler' };
  }

  // Reload favorites from API
  const updatedFavorites = await loadFavorites();
  showSuccessAlert(`Favorit "${names.team.name}" wurde gespeichert`);

  return { success: true, favorites: updatedFavorites };
}

/**
 * Remove a favorite
 */
export async function removeFavorite(
  favoriteId: string | number,
  favorites: ShiftFavorite[],
): Promise<{ success: boolean; favorites: ShiftFavorite[]; error?: string }> {
  const favoriteToRemove = favorites.find((f) => String(f.id) === String(favoriteId));

  const result = await deleteFavorite(favoriteId);

  if (!result.success) {
    const errorMsg = result.error ?? 'Fehler beim Löschen des Favoriten';
    showErrorAlert(errorMsg);
    return { success: false, favorites, error: errorMsg };
  }

  // Update local favorites list
  const updatedFavorites = favorites.filter((f) => String(f.id) !== String(favoriteId));
  showSuccessAlert(`Favorit "${favoriteToRemove?.name ?? ''}" wurde gelöscht`);

  return { success: true, favorites: updatedFavorites };
}

/**
 * Apply favorite context
 */
export function applyFavorite(favorite: ShiftFavorite): SelectedContext {
  return {
    areaId: favorite.areaId,
    departmentId: favorite.departmentId,
    machineId: favorite.machineId,
    teamId: favorite.teamId,
    teamLeaderId: null,
  };
}

// ============== ADD FAVORITE BUTTON ==============

const ADD_FAVORITE_BUTTON_ID = 'add-favorite-btn';

/**
 * Check if add favorite button should be visible
 */
export function shouldShowAddFavoriteButton(context: SelectedContext, favorites: ShiftFavorite[]): boolean {
  // Must have complete context
  if (!isContextCompleteForFavorite(context)) {
    return false;
  }

  // Must not already be favorited
  return !isCombinationFavorited(favorites, context);
}

/**
 * Render add favorite button (idempotent)
 * - Creates button if shouldShow=true and button doesn't exist
 * - Removes button if shouldShow=false and button exists
 * - Does nothing if button is already in correct state
 *
 * @param containerSelector - CSS selector for container where button should be inserted
 * @param context - Current selected context
 * @param favorites - List of existing favorites
 */
export function renderAddFavoriteButton(
  containerSelector: string,
  context: SelectedContext,
  favorites: ShiftFavorite[],
): void {
  const container = document.querySelector(containerSelector);
  if (container === null) {
    console.warn('[FAVORITES] Container not found:', containerSelector);
    return;
  }

  const existingBtn = document.getElementById(ADD_FAVORITE_BUTTON_ID);
  const shouldShow = shouldShowAddFavoriteButton(context, favorites);

  if (shouldShow && existingBtn === null) {
    // Create button
    const btn = createElement('button', {
      className: 'btn btn-success add-favorite-btn',
      id: ADD_FAVORITE_BUTTON_ID,
    });
    btn.dataset['action'] = 'add-to-favorites';

    const starIcon = createElement('i', { className: 'fas fa-star' });
    const textSpan = createElement('span', {}, ' Zu Favoriten');

    btn.append(starIcon, textSpan);

    // Insert after container
    container.parentElement?.insertBefore(btn, container.nextSibling);

    console.info('[FAVORITES] Add button created');
  } else if (!shouldShow && existingBtn !== null) {
    // Remove button
    existingBtn.remove();
    console.info('[FAVORITES] Add button removed');
  }
  // If button exists and shouldShow, or button doesn't exist and !shouldShow → do nothing
}

/**
 * Update add favorite button visibility (legacy compatibility)
 * @deprecated Use renderAddFavoriteButton instead
 */
export function updateAddFavoriteButtonVisibility(
  button: HTMLElement | null,
  context: SelectedContext,
  favorites: ShiftFavorite[],
): void {
  // If button is provided, use legacy behavior
  if (button !== null) {
    const shouldShow = shouldShowAddFavoriteButton(context, favorites);
    button.style.display = shouldShow ? 'inline-flex' : 'none';
    return;
  }

  // Otherwise, use new idempotent render
  renderAddFavoriteButton('.shift-info-row', context, favorites);
}
