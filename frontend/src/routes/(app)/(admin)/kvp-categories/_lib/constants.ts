/**
 * KVP Categories Admin - Constants
 */

export const MESSAGES = {
  SAVE_SUCCESS: 'Änderungen wurden gespeichert',
  SAVE_ERROR: 'Fehler beim Speichern',
  DELETE_SUCCESS: 'Kategorie wurde gelöscht',
  DELETE_ERROR: 'Fehler beim löschen',
  DELETE_CONFIRM: 'Möchten Sie diese Kategorie wirklich löschen?',
  DELETE_HAS_SUGGESTIONS:
    'Diese Kategorie wird von bestehenden Vorschlägen verwendet. Trotzdem löschen?',
  CREATE_SUCCESS: 'Neue Kategorie wurde erstellt',
  CREATE_ERROR: 'Fehler beim Erstellen der Kategorie',
  LIMIT_REACHED: 'Maximale Anzahl an Kategorien erreicht (20)',
  RESET_SUCCESS: 'Bezeichnung wurde zurückgesetzt',
} as const;

export const LABELS = {
  PAGE_TITLE: 'Definitionen verwalten',
  PAGE_DESCRIPTION:
    'Passen Sie die Bezeichnungen der Definitionen für Ihr Unternehmen an und erstellen Sie eigene.',
  SECTION_DEFAULTS: 'Standard-Kategorien umbenennen',
  SECTION_CUSTOM: 'Eigene Kategorien',
  COL_DEFAULT: 'Standard',
  COL_CUSTOM_NAME: 'Eigene Bezeichnung',
  COL_ACTION: 'Aktion',
  COL_NAME: 'Name',
  COL_COLOR: 'Farbe',
  COL_ICON: 'Icon',
  BTN_SAVE: 'Änderungen speichern',
  BTN_RESET: 'Zurücksetzen',
  BTN_DELETE: 'löschen',
  BTN_ADD: 'Neue Kategorie hinzufügen',
  counter: (used: number, max: number) =>
    `${used} / ${max} Kategorien verwendet`,
  remaining: (slots: number) => `${slots} von 14 verfügbar`,
} as const;

/** Predefined icon options for custom categories */
export const ICON_OPTIONS = [
  { value: 'lightbulb', label: 'Glühbirne' },
  { value: 'cogs', label: 'Zahnräder' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'truck', label: 'LKW' },
  { value: 'leaf', label: 'Blatt' },
  { value: 'chart-line', label: 'Diagramm' },
  { value: 'tools', label: 'Werkzeuge' },
  { value: 'users', label: 'Team' },
  { value: 'clipboard-check', label: 'Checkliste' },
  { value: 'recycle', label: 'Recycling' },
  { value: 'bolt', label: 'Blitz' },
  { value: 'shield-alt', label: 'Schild' },
] as const;
