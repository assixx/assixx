// =============================================================================
// SIGNUP PAGE - CONSTANTS
// =============================================================================

import type { Country, Plan } from './types';

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
 * Available subscription plans
 * Ordered by price (highest first for upselling)
 */
export const PLANS: readonly Plan[] = [
  { value: 'enterprise', name: 'Enterprise', price: '€149/M' },
  { value: 'professional', name: 'Professional', price: '€99/M' },
  { value: 'basic', name: 'Basic', price: '€49/M' },
] as const;

/**
 * Default country selection (Germany)
 */
export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

/**
 * Default plan selection (Enterprise)
 */
export const DEFAULT_PLAN: Plan = PLANS[0];

/**
 * Password requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  maxLength: 72,
} as const;

/**
 * Phone number requirements
 */
export const PHONE_REQUIREMENTS = {
  minDigits: 7,
  maxDigits: 15,
} as const;

/**
 * Redirect delay after successful registration (in ms)
 */
export const SUCCESS_REDIRECT_DELAY = 5000;

/**
 * Password strength labels by score
 */
export const PASSWORD_STRENGTH_LABELS: Record<number, string> = {
  0: 'Sehr schwach',
  1: 'Schwach',
  2: 'Mittel',
  3: 'Stark',
  4: 'Sehr stark',
} as const;

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
 * Help message content
 */
export const HELP_MESSAGE =
  'Hilfe: 1. Firmendaten eingeben 2. Subdomain wählen 3. Sicheres Passwort 4. 14 Tage kostenlos testen! Fragen: support@assixx.com';
