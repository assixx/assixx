// =============================================================================
// SHARED MACHINE AVAILABILITY CONSTANTS
// =============================================================================
// Used by manage-assets and related pages

/**
 * Asset availability status type
 * Matches DB enum asset_availability_status
 */
export type AssetAvailabilityStatus =
  | 'operational'
  | 'maintenance'
  | 'repair'
  | 'standby'
  | 'cleaning'
  | 'other';

/**
 * Asset availability status options for select dropdown
 */
export const MACHINE_AVAILABILITY_STATUS_OPTIONS: {
  value: AssetAvailabilityStatus;
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
 * Asset availability status badge classes
 */
export const MACHINE_AVAILABILITY_BADGE_CLASSES: Record<AssetAvailabilityStatus, string> = {
  operational: 'badge--avail-operational',
  maintenance: 'badge--avail-maintenance',
  repair: 'badge--avail-repair',
  standby: 'badge--avail-standby',
  cleaning: 'badge--avail-cleaning',
  other: 'badge--avail-other',
};

/**
 * Asset availability status icons (FontAwesome classes)
 */
export const MACHINE_AVAILABILITY_ICONS: Record<AssetAvailabilityStatus, string> = {
  operational: 'fa-check-circle',
  maintenance: 'fa-wrench',
  repair: 'fa-tools',
  standby: 'fa-pause-circle',
  cleaning: 'fa-broom',
  other: 'fa-clock',
};

/**
 * Asset availability status labels (German)
 */
export const MACHINE_AVAILABILITY_LABELS: Record<AssetAvailabilityStatus, string> = {
  operational: 'Betriebsbereit',
  maintenance: 'Wartung',
  repair: 'Reparatur',
  standby: 'Stillstand',
  cleaning: 'Reinigung',
  other: 'Sonstiges',
};
