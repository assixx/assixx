/**
 * Admin Profile - Constants
 * @module admin-profile/_lib/constants
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

/** UI Messages (German) */
export const MESSAGES = {
  // Picture
  pictureUpdated: 'Profilbild aktualisiert',
  pictureRemoved: 'Profilbild entfernt',
  pictureUploadError: 'Fehler beim Hochladen',
  pictureRemoveError: 'Fehler beim Entfernen',
  invalidImageType: 'Bitte wählen Sie eine Bilddatei',
  fileTooLarge: 'Datei zu groß (max. 5MB)',

  // Password
  passwordChanged: 'Passwort erfolgreich geändert. Sie werden aus Sicherheitsgründen abgemeldet...',
  passwordChangeError: 'Fehler beim Ändern des Passworts',
  currentPasswordWrong: 'Aktuelles Passwort ist falsch',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  passwordRequirements:
    'Min. 12 Zeichen, alle 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)',
  passwordTooWeak: 'Passwort ist zu schwach - bitte wählen Sie ein sichereres Passwort',
} as const;

/** Password tooltip text — policy tightened 2026-04-30 to require ALL 4 categories */
export const PASSWORD_TOOLTIP =
  'Min. 12 Zeichen, max. 72 Zeichen. Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl und 1 Sonderzeichen (!@#$%^&* () _ + - = [ ] { } ; \' " \\ | , . < > / ?)';

/** Info box text for readonly fields */
export const READONLY_INFO_TEXT =
  'Als Administrator können Sie nur Ihr Passwort ändern. Für Änderungen an Ihrem Namen, E-Mail, Position oder anderen Feldern wenden Sie sich bitte an den Root-Administrator.';
