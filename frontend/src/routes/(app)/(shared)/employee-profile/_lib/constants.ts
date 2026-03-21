/**
 * Employee Profile - Constants
 * @module employee-profile/_lib/constants
 */

/** Password validation rules */
export const PASSWORD_RULES = {
  minLength: 12,
  maxLength: 72,
  minStrengthCheck: 4,
} as const;

/** Profile picture constraints */
export const PICTURE_CONSTRAINTS = {
  maxSizeMB: 5,
  maxSizeBytes: 5 * 1024 * 1024,
  acceptedTypes: 'image/*',
} as const;

/** LocalStorage keys */
export const STORAGE_KEYS = {
  accessToken: 'accessToken',
  // profilePictureCache removed - caused bug where all users shared same picture
} as const;

/** UI Messages (German) */
export const MESSAGES = {
  // Picture
  pictureUpdated: 'Profilbild aktualisiert',
  pictureRemoved: 'Profilbild entfernt',
  pictureUploadError: 'Fehler beim Hochladen',
  pictureRemoveError: 'Fehler beim Entfernen',
  invalidImageType: 'Bitte wählen Sie eine Bilddatei',
  fileTooLarge: 'Datei zu groß (max. 5MB)',
  confirmRemovePicture: 'Möchten Sie Ihr Profilbild wirklich entfernen?',

  // Password
  passwordChanged: 'Passwort erfolgreich geändert. Sie werden aus Sicherheitsgründen abgemeldet...',
  passwordChangeError: 'Fehler beim Ändern des Passworts',
  currentPasswordWrong: 'Aktuelles Passwort ist falsch',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  passwordRequirements:
    'Min. 12 Zeichen, 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)',
  passwordTooWeak: 'Passwort ist zu schwach - bitte wählen Sie ein sichereres Passwort',
} as const;

/** Picture upload error code to message mapping */
export const PICTURE_UPLOAD_ERROR_MAP: Record<string, string> = {
  INVALID_TYPE: MESSAGES.invalidImageType,
  FILE_TOO_LARGE: MESSAGES.fileTooLarge,
} as const;

/** Password tooltip text */
export const PASSWORD_TOOLTIP =
  'Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)';

/** Info box text for readonly fields (Employee-specific) */
export const READONLY_INFO_TEXT =
  'Als Mitarbeiter können Sie nur Ihr Passwort ändern. Für Änderungen an Ihrem Namen, E-Mail, Position oder anderen Feldern wenden Sie sich bitte an Ihren Administrator.';

/** Strength labels (German) */
export const STRENGTH_LABELS: Record<number, string> = {
  0: 'Sehr schwach',
  1: 'Schwach',
  2: 'Ausreichend',
  3: 'Gut',
  4: 'Sehr stark',
} as const;

/** Strength bar colors */
export const STRENGTH_COLORS: Record<number, string> = {
  0: '#dc2626',
  1: '#ea580c',
  2: '#ca8a04',
  3: '#65a30d',
  4: '#16a34a',
} as const;
