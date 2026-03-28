import { DEFAULT_HIERARCHY_LABELS, type HierarchyLabels } from '$lib/types/hierarchy-labels';

import type { ApprovalApproverType } from './types.js';

interface ApproverOption {
  value: ApprovalApproverType;
  label: string;
  icon: string;
}

/** Factory: Approver type options with dynamic hierarchy labels (ADR-034) */
export function createApproverTypeOptions(
  labels: HierarchyLabels = DEFAULT_HIERARCHY_LABELS,
): ApproverOption[] {
  return [
    {
      value: 'team_lead',
      label: `${labels.team} Lead`,
      icon: 'fa-user-friends',
    },
    {
      value: 'department_lead',
      label: `${labels.department} Lead`,
      icon: 'fa-building',
    },
    { value: 'area_lead', label: `${labels.area} Lead`, icon: 'fa-sitemap' },
    { value: 'user', label: 'Bestimmter Benutzer', icon: 'fa-user' },
    { value: 'position', label: 'Position', icon: 'fa-id-badge' },
  ];
}

/** Backward-compat: static export with default labels */
export const APPROVER_TYPE_OPTIONS: readonly ApproverOption[] = createApproverTypeOptions();

/** Addons that support approval workflows */
export const APPROVABLE_ADDONS: readonly { code: string; label: string }[] = [
  { code: 'kvp', label: 'KVP' },
  { code: 'vacation', label: 'Urlaub' },
  { code: 'blackboard', label: 'Schwarzes Brett' },
  { code: 'calendar', label: 'Kalender' },
  { code: 'surveys', label: 'Umfragen' },
] as const;

export const MESSAGES = {
  PAGE_TITLE: 'Freigabe-Master',
  HEADING: 'Freigabe-Master konfigurieren',
  DESCRIPTION:
    'Legen Sie fest, wer Freigaben pro Modul genehmigen darf. Root und Admins mit vollem Zugriff können immer genehmigen.',
  NO_CONFIG: 'Kein Master konfiguriert',
  ADD_MASTER: 'Neuen Master hinzufügen',
  SAVE_SUCCESS: 'Freigabe-Master gespeichert',
  SAVE_ERROR: 'Fehler beim Speichern',
  DELETE_SUCCESS: 'Freigabe-Master entfernt',
  DELETE_ERROR: 'Fehler beim Entfernen',
} as const;
