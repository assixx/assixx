/**
 * Root Profile - Constants
 * @module root-profile/_lib/constants
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
  // Profile
  profileSaved: 'Profil erfolgreich gespeichert',
  profileLoadError: 'Fehler beim Laden des Profils',
  profileSaveError: 'Fehler beim Speichern',

  // Picture
  pictureUpdated: 'Profilbild aktualisiert',
  pictureRemoved: 'Profilbild entfernt',
  pictureUploadError: 'Fehler beim Hochladen',
  pictureRemoveError: 'Fehler beim Entfernen',
  invalidImageType: 'Bitte wählen Sie eine Bilddatei',
  fileTooLarge: 'Datei zu groß (max. 5MB)',

  // Password
  passwordChanged: 'Passwort erfolgreich geändert',
  passwordChangeError: 'Fehler beim Ändern des Passworts',
  currentPasswordWrong: 'Aktuelles Passwort ist falsch',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  passwordRequirements:
    'Min. 12 Zeichen, 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)',

  // Approvals
  approvalApproved: 'Löschung genehmigt',
  approvalRejected: 'Löschung abgelehnt',
  approvalError: 'Fehler beim Genehmigen',
  rejectError: 'Fehler beim Ablehnen',
  pendingStatus: 'Ausstehend',
} as const;

/** Password tooltip text */
export const PASSWORD_TOOLTIP =
  'Min. 12 Zeichen, max. 72 Zeichen. Enthält 3 von 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)';
