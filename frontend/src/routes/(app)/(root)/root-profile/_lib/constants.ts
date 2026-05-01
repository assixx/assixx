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
  passwordChanged: 'Passwort erfolgreich geändert. Sie werden aus Sicherheitsgründen abgemeldet...',
  passwordChangeError: 'Fehler beim Ändern des Passworts',
  currentPasswordWrong: 'Aktuelles Passwort ist falsch',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  passwordRequirements:
    'Min. 12 Zeichen, alle 4: Großbuchstaben, Kleinbuchstaben, Zahlen, Sonderzeichen (!@#$%^&*)',

  // Approvals
  approvalApproved: 'Löschung genehmigt',
  approvalRejected: 'Löschung abgelehnt',
  approvalError: 'Fehler beim Genehmigen',
  rejectError: 'Fehler beim Ablehnen',
  pendingStatus: 'Ausstehend',
} as const;

/** Password tooltip text — policy tightened 2026-04-30 to require ALL 4 categories */
export const PASSWORD_TOOLTIP =
  'Min. 12 Zeichen, max. 72 Zeichen. Mindestens 1 Großbuchstabe, 1 Kleinbuchstabe, 1 Zahl und 1 Sonderzeichen (!@#$%^&* () _ + - = [ ] { } ; \' " \\ | , . < > / ?)';

// =============================================================================
// SELF-TERMINATION MESSAGES (FEAT_ROOT_ACCOUNT_PROTECTION §5.1, German UX)
// =============================================================================

/** Heading + section copy for the danger-zone card. */
export const SELF_TERMINATION_MESSAGES = {
  // Section header
  sectionTitle: 'Konto-Löschung (Selbstantrag)',
  sectionSubtitle:
    'Beantragen Sie die Löschung Ihres eigenen Root-Kontos. Ein anderer Root-Benutzer muss den Antrag genehmigen.',

  // State 1 — eligible
  ctaRequest: 'Konto löschen beantragen',

  // State 2 — pending
  pendingHeading: 'Antrag ausstehend',
  pendingExpiresPrefix: 'Läuft ab am',
  ctaCancel: 'Antrag zurückziehen',

  // State 3 — last root
  lastRootDisabledTooltip:
    'Sie sind der letzte Root. Befördern Sie zuerst einen anderen Benutzer, bevor Sie Ihr Konto löschen können.',
  lastRootHeading: 'Konto-Löschung nicht möglich',

  // State 4 — cooldown
  cooldownHeading: 'Cooldown nach Ablehnung',
  cooldownTooltipPrefix: 'Cooldown bis',
  cooldownReasonPrefix: 'Letzter Antrag wurde abgelehnt:',

  // Modal
  modalTitle: 'Root-Konto wirklich löschen?',
  modalWarning:
    'Diese Aktion erfordert die Genehmigung eines anderen Root-Benutzers. Nach Genehmigung wird Ihr Konto deaktiviert (is_active = 4).',
  modalReasonLabel: 'Begründung (optional)',
  modalReasonPlaceholder:
    'Optionale Begründung — wird Ihren Root-Kollegen zur Bewertung angezeigt.',
  modalSubmit: 'Antrag einreichen',
  modalCancel: 'Abbrechen',

  // Toasts
  toastRequested: 'Antrag eingereicht. Andere Root-Benutzer wurden benachrichtigt.',
  toastCancelled: 'Antrag zurückgezogen.',
  toastError: 'Fehler bei der Antragsverarbeitung.',
  toastErrorLastRoot: 'Sie sind der letzte Root — Antrag nicht möglich.',
  toastErrorCooldown: 'Cooldown aktiv — bitte warten Sie 24 Stunden nach Ablehnung.',
  toastErrorAlreadyPending: 'Ein Antrag ist bereits aktiv.',
} as const;

/** Maximum reason length (matches backend Zod schema). */
export const SELF_TERMINATION_REASON_MAX = 1000;
