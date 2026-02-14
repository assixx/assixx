// =============================================================================
// SHARED MACHINE AVAILABILITY CONSTANTS
// =============================================================================
// Used by manage-machines and related pages

/**
 * Machine availability status type
 * Matches DB enum machine_availability_status
 */
export type MachineAvailabilityStatus =
  | 'operational'
  | 'maintenance'
  | 'repair'
  | 'standby'
  | 'cleaning'
  | 'other';

/**
 * Machine availability status options for select dropdown
 */
export const MACHINE_AVAILABILITY_STATUS_OPTIONS: {
  value: MachineAvailabilityStatus;
  label: string;
}[] = [
  { value: 'operational', label: 'Betriebsbereit' },
  { value: 'maintenance', label: 'Wartung' },
  { value: 'repair', label: 'Reparatur' },
  { value: 'standby', label: 'Stillstand' },
  { value: 'cleaning', label: 'Reinigung' },
  { value: 'other', label: 'Sonstiges' },
];

/**
 * Machine availability status badge classes
 */
export const MACHINE_AVAILABILITY_BADGE_CLASSES: Record<
  MachineAvailabilityStatus,
  string
> = {
  operational: 'badge--success',
  maintenance: 'badge--warning',
  repair: 'badge--danger',
  standby: 'badge--info',
  cleaning: 'badge--secondary',
  other: 'badge--dark',
};

/**
 * Machine availability status icons (FontAwesome classes)
 */
export const MACHINE_AVAILABILITY_ICONS: Record<
  MachineAvailabilityStatus,
  string
> = {
  operational: 'fa-check-circle',
  maintenance: 'fa-wrench',
  repair: 'fa-tools',
  standby: 'fa-pause-circle',
  cleaning: 'fa-broom',
  other: 'fa-clock',
};

/**
 * Machine availability status labels (German)
 */
export const MACHINE_AVAILABILITY_LABELS: Record<
  MachineAvailabilityStatus,
  string
> = {
  operational: 'Betriebsbereit',
  maintenance: 'Wartung',
  repair: 'Reparatur',
  standby: 'Stillstand',
  cleaning: 'Reinigung',
  other: 'Sonstiges',
};
