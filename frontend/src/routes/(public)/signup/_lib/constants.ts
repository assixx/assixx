// =============================================================================
// SIGNUP PAGE - CONSTANTS
// =============================================================================

import type { Country } from './types';

/**
 * Available country codes for phone number prefix
 * Sorted by most common usage in DACH region
 */
export const COUNTRIES: readonly Country[] = [
  { flag: '🇩🇪', code: '+49' },
  { flag: '🇦🇹', code: '+43' },
  { flag: '🇨🇭', code: '+41' },
  { flag: '🇫🇷', code: '+33' },
  { flag: '🇮🇹', code: '+39' },
  { flag: '🇪🇸', code: '+34' },
  { flag: '🇳🇱', code: '+31' },
  { flag: '🇧🇪', code: '+32' },
  { flag: '🇱🇺', code: '+352' },
  { flag: '🇵🇱', code: '+48' },
  { flag: '🇨🇿', code: '+420' },
  { flag: '🇺🇸', code: '+1' },
  { flag: '🇬🇧', code: '+44' },
] as const;

/**
 * Default country selection (Germany)
 */
export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

/**
 * Password requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  maxLength: 72,
} as const;

/**
 * Redirect delay after successful registration (in ms)
 */
export const SUCCESS_REDIRECT_DELAY = 5000;

/**
 * Validation error messages
 */
export const ERROR_MESSAGES = {
  subdomainInvalid: 'Nur Kleinbuchstaben und Bindestriche',
  emailMismatch: 'E-Mail-Adressen stimmen nicht überein',
  phoneInvalid: 'Bitte geben Sie eine gültige Telefonnummer ein (7-15 Ziffern)',
  passwordMismatch: 'Passwörter stimmen nicht überein',
  formIncomplete: 'Bitte füllen Sie alle Pflichtfelder korrekt aus.',
  registrationFailed: 'Registrierung fehlgeschlagen',
  unknownError: 'Ein Fehler ist aufgetreten',
} as const;

/**
 * Email-validation error codes emitted by the backend signup-validation layer
 * (`validateBusinessEmail` per masterplan §2.3 + ADR-048). Three codes —
 * `DOMAIN_NO_MX` is intentionally NOT here per §0.2.5 #6 (no MX/SMTP at
 * signup, only synchronous list-based validation: format + disposable
 * (mailchecker) + freemail (committed `freemail-domains.json` Set).
 *
 * The keys MUST match the backend constants in
 * `backend/src/nest/domains/email-validator.ts` byte-for-byte. The §5.4.2
 * unit test asserts this drift-guard for each code.
 *
 * @see masterplan §5.2 (this wiring), §5.4.2 (drift-guard test)
 */
export const EMAIL_VALIDATION_MESSAGES: Record<string, string> = {
  INVALID_FORMAT: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  DISPOSABLE_EMAIL: 'Wegwerf-E-Mail-Adressen sind nicht erlaubt. Bitte nutze Deine Firmen-E-Mail.',
  FREE_EMAIL_PROVIDER:
    'Bitte nutze Deine Firmen-E-Mail-Adresse. Gmail, Outlook, GMX & Co. sind nicht erlaubt.',
};

/**
 * Help message content
 */
export const HELP_MESSAGE =
  'Hilfe: 1. Firmendaten eingeben 2. Subdomain wählen 3. Sicheres Passwort 4. 14 Tage kostenlos testen! Fragen: support@assixx.com';
