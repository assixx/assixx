/**
 * Vacation module constants: labels, colors, type mappings.
 */
import type {
  OverallCapacityStatus,
  VacationHalfDay,
  VacationRequestStatus,
  VacationType,
} from './types';

// ─── Status labels (German) ──────────────────────────────────────────

export const STATUS_LABELS: Record<VacationRequestStatus, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  denied: 'Abgelehnt',
  withdrawn: 'Zurückgezogen',
  cancelled: 'Storniert',
};

export const STATUS_BADGE_CLASS: Record<VacationRequestStatus, string> = {
  pending: 'badge--warning',
  approved: 'badge--success',
  denied: 'badge--danger',
  withdrawn: 'badge--info',
  cancelled: 'badge--danger',
};

// ─── Vacation type labels ────────────────────────────────────────────

export const TYPE_LABELS: Record<VacationType, string> = {
  regular: 'Erholungsurlaub',
  special_doctor: 'Arztbesuch',
  special_bereavement: 'Trauerfall',
  special_birth: 'Geburt',
  special_wedding: 'Hochzeit',
  special_move: 'Umzug',
  unpaid: 'Unbezahlter Urlaub',
};

// ─── Half-day labels ─────────────────────────────────────────────────

export const HALF_DAY_LABELS: Record<VacationHalfDay, string> = {
  none: 'Ganzer Tag',
  morning: 'Vormittag',
  afternoon: 'Nachmittag',
};

// ─── Capacity status labels ──────────────────────────────────────────

export const CAPACITY_STATUS_LABELS: Record<OverallCapacityStatus, string> = {
  ok: 'Kapazität  OK',
  warning: 'Engpass moeglich',
  blocked: 'Kapazität  nicht ausreichend',
};

export const CAPACITY_STATUS_CLASS: Record<OverallCapacityStatus, string> = {
  ok: 'badge--success',
  warning: 'badge--warning',
  blocked: 'badge--danger',
};

// ─── Filter/view constants ───────────────────────────────────────────

export const STATUS_FILTER_OPTIONS: {
  value: VacationRequestStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'Alle' },
  { value: 'pending', label: 'Ausstehend' },
  { value: 'approved', label: 'Genehmigt' },
  { value: 'denied', label: 'Abgelehnt' },
  { value: 'withdrawn', label: 'Zurückgezogen' },
  { value: 'cancelled', label: 'Storniert' },
];

export type ViewTab = 'my-requests' | 'incoming';

export const VIEW_TABS: { value: ViewTab; label: string }[] = [
  { value: 'my-requests', label: 'Meine Anträge' },
  { value: 'incoming', label: 'Eingehende Anträge' },
];

/** Default pagination */
export const DEFAULT_PAGE_SIZE = 10;

/** Debounce for capacity check (ms) */
export const CAPACITY_DEBOUNCE_MS = 300;
