// =============================================================================
// MANAGE HALLS - UTILITY FUNCTIONS
// =============================================================================

import { STATUS_BADGE_CLASSES, STATUS_LABELS, FORM_DEFAULTS } from './constants';

import type { Hall, Area, IsActiveStatus, FormIsActiveStatus } from './types';

export function getStatusBadgeClass(isActive: IsActiveStatus): string {
  return STATUS_BADGE_CLASSES[isActive];
}

export function getStatusLabel(isActive: IsActiveStatus): string {
  return STATUS_LABELS[isActive];
}

export function getAreaDisplay(areaName: string | null | undefined): string {
  return areaName ?? 'Nicht zugewiesen';
}

export function getSelectedAreaName(areaId: number | null, areas: Area[]): string {
  if (areaId === null) return 'Nicht zugewiesen';
  const area = areas.find((a) => a.id === areaId);
  return area?.name ?? 'Nicht zugewiesen';
}

export function populateFormFromHall(hall: Hall): {
  name: string;
  description: string;
  areaId: number | null;
  isActive: FormIsActiveStatus;
} {
  return {
    name: hall.name,
    description: hall.description ?? '',
    areaId: hall.areaId ?? null,
    isActive: (hall.isActive === 4 ? 0 : hall.isActive) as FormIsActiveStatus,
  };
}

export function getDefaultFormValues(): typeof FORM_DEFAULTS {
  return { ...FORM_DEFAULTS };
}
