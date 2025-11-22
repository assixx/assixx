/**
 * Machine Management - Data Layer
 * API calls, data fetching, and state management
 */

import { ApiClient } from '../../../utils/api-client';
import type { Machine, Department, Area, MachineFormData } from './types';

// ===== GLOBAL STATE =====
export let currentMachineId: number | null = null;
export let machines: Machine[] = [];
export let departments: Department[] = [];
export let areas: Area[] = [];

// Functions to modify state (needed for import safety)
export function setCurrentMachineId(id: number | null): void {
  currentMachineId = id;
}

export function setMachines(newMachines: Machine[]): void {
  machines = newMachines;
}

export function setDepartments(newDepartments: Department[]): void {
  departments = newDepartments;
}

export function setAreas(newAreas: Area[]): void {
  areas = newAreas;
}

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== API FUNCTIONS =====

/**
 * Load all machines from API
 * Supports filtering by status and search term
 */
export async function loadMachines(statusFilter?: string, searchTerm?: string): Promise<void> {
  try {
    console.info('[MachinesData] Loading machines...');
    const params: Record<string, string> = {};

    if (statusFilter !== undefined && statusFilter !== 'all') {
      params.status = statusFilter;
    }

    if (searchTerm !== undefined && searchTerm.length > 0) {
      params.search = searchTerm;
    }

    // Build query string from params
    const queryParams = new URLSearchParams(params);
    const queryString = queryParams.toString();
    const endpoint = queryString.length > 0 ? `/machines?${queryString}` : '/machines';

    console.info('[MachinesData] API endpoint:', endpoint);

    // Using v2 API - backend already returns camelCase via fieldMapping
    const loadedMachines = await apiClient.request<Machine[]>(endpoint, {
      method: 'GET',
    });

    console.info('[MachinesData] Loaded machines:', loadedMachines.length);
    setMachines(loadedMachines);
  } catch (error) {
    console.error('Error loading machines:', error);
    setMachines([]);
    throw new Error('Fehler beim Laden der Maschinen');
  }
}

/**
 * Load all departments from API
 */
export async function loadDepartments(): Promise<void> {
  try {
    const response = await apiClient.request<Department[] | { success: boolean; data: Department[] }>(
      '/departments',
      { method: 'GET' },
      { version: 'v2' },
    );

    if (Array.isArray(response)) {
      setDepartments(response);
    } else if ('data' in response && Array.isArray(response.data)) {
      setDepartments(response.data);
    } else {
      setDepartments([]);
    }

    console.info('[MachinesData] Loaded departments:', departments.length);
  } catch (error) {
    console.error('Error loading departments:', error);
    setDepartments([]);
    throw new Error('Fehler beim Laden der Abteilungen');
  }
}

/**
 * Load all areas from API
 */
export async function loadAreas(): Promise<void> {
  try {
    const response = await apiClient.request<Area[] | { success: boolean; data: Area[] }>(
      '/areas',
      { method: 'GET' },
      { version: 'v2' },
    );

    if (Array.isArray(response)) {
      setAreas(response);
    } else if ('data' in response && Array.isArray(response.data)) {
      setAreas(response.data);
    } else {
      setAreas([]);
    }

    console.info('[MachinesData] Loaded areas:', areas.length);
  } catch (error) {
    console.error('Error loading areas:', error);
    setAreas([]);
    throw new Error('Fehler beim Laden der Bereiche');
  }
}

/**
 * Get single machine details by ID
 */
export async function getMachineById(machineId: number): Promise<Machine | null> {
  try {
    return await apiClient.request<Machine>(`/machines/${machineId}`, {
      method: 'GET',
    });
  } catch (error) {
    console.error(`Error loading machine ${machineId}:`, error);
    return null;
  }
}

/**
 * Create a new machine
 */
export async function createMachine(machineData: MachineFormData): Promise<Machine> {
  try {
    const response = await apiClient.request<Machine>('/machines', {
      method: 'POST',
      body: JSON.stringify(machineData),
    });

    console.info('[MachinesData] Machine created:', response);
    return response;
  } catch (error) {
    console.error('Error creating machine:', error);
    throw new Error('Fehler beim Erstellen der Maschine');
  }
}

/**
 * Update existing machine
 */
export async function updateMachine(machineId: number, machineData: MachineFormData): Promise<Machine> {
  try {
    const response = await apiClient.request<Machine>(`/machines/${machineId}`, {
      method: 'PUT',
      body: JSON.stringify(machineData),
    });

    console.info('[MachinesData] Machine updated:', response);
    return response;
  } catch (error) {
    console.error('Error updating machine:', error);
    throw new Error('Fehler beim Aktualisieren der Maschine');
  }
}

/**
 * Delete machine by ID
 */
export async function deleteMachine(machineId: number): Promise<void> {
  try {
    await apiClient.request(`/machines/${machineId}`, {
      method: 'DELETE',
    });

    console.info('[MachinesData] Machine deleted:', machineId);
  } catch (error) {
    console.error('Error deleting machine:', error);
    const errorObj = error as { message?: string; code?: string };

    if (
      errorObj.code === 'FOREIGN_KEY_CONSTRAINT' ||
      errorObj.message?.includes('foreign key') === true ||
      errorObj.message?.includes('Cannot delete machine') === true
    ) {
      throw new Error('Maschine kann nicht gelöscht werden, da noch Zuordnungen existieren');
    }

    throw new Error('Fehler beim Löschen der Maschine');
  }
}

/**
 * Save machine (create or update based on currentMachineId)
 */
export async function saveMachine(formData: MachineFormData): Promise<number> {
  // Type narrowing: ensure currentMachineId is number before passing to updateMachine
  if (currentMachineId !== null && currentMachineId !== 0) {
    // Inside this block, TypeScript knows currentMachineId is number (not null)
    const machineId: number = currentMachineId;
    const result = await updateMachine(machineId, formData);
    return result.id;
  } else {
    const result = await createMachine(formData);
    return result.id;
  }
}
