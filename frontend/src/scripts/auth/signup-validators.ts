/**
 * Signup Form Validators
 *
 * Pure validation functions for signup form
 * No DOM manipulation, only validation logic
 * Best Practice 2025: Separation of Concerns
 */

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone validation regex (7-15 digits, must not start with 0)
 */
const PHONE_REGEX = /^[1-9][0-9]{6,14}$/;

/**
 * Subdomain validation regex (lowercase letters, numbers, hyphens)
 */
const SUBDOMAIN_REGEX = /^[a-z0-9-]+$/;

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (email === '') {
    return {
      valid: false,
      message: 'E-Mail ist ein Pflichtfeld',
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    };
  }

  return { valid: true };
}

/**
 * Validate email confirmation matches
 */
export function validateEmailMatch(email: string, emailConfirm: string): ValidationResult {
  if (email !== emailConfirm) {
    return {
      valid: false,
      message: 'E-Mail-Adressen stimmen nicht überein',
    };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  // eslint-disable-next-line security/detect-possible-timing-attacks -- Safe: checking empty string (validation), not comparing against secret
  if (password === '') {
    return {
      valid: false,
      message: 'Passwort ist ein Pflichtfeld',
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      message: 'Passwort muss mindestens 8 Zeichen lang sein',
    };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validate password confirmation matches
 */
export function validatePasswordMatch(password: string, passwordConfirm: string): ValidationResult {
  if (!timingSafeEqual(password, passwordConfirm)) {
    return {
      valid: false,
      message: 'Passwörter stimmen nicht überein',
    };
  }

  return { valid: true };
}

/**
 * Check if country code is DACH region (Germany, Austria, Switzerland)
 */
export function isDACHCountry(countryCode: string): boolean {
  return countryCode === '+49' || countryCode === '+43' || countryCode === '+41';
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string, countryCode: string): ValidationResult {
  if (phone === '') {
    return {
      valid: false,
      message: 'Telefonnummer ist ein Pflichtfeld',
    };
  }

  // Check for leading zero in DACH countries
  if (isDACHCountry(countryCode) && phone.startsWith('0')) {
    return {
      valid: false,
      message: 'Bitte ohne führende 0 eingeben (die Ländervorwahl ersetzt die 0)',
    };
  }

  // Validate phone format (7-15 digits, must not start with 0)
  if (!PHONE_REGEX.test(phone)) {
    return {
      valid: false,
      message: 'Bitte geben Sie eine gültige Telefonnummer ein (7-15 Ziffern)',
    };
  }

  return { valid: true };
}

/**
 * Validate subdomain format
 */
export function validateSubdomain(subdomain: string): ValidationResult {
  if (subdomain === '') {
    return {
      valid: false,
      message: 'Subdomain ist ein Pflichtfeld',
    };
  }

  if (!SUBDOMAIN_REGEX.test(subdomain)) {
    return {
      valid: false,
      message: 'Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt',
    };
  }

  return { valid: true };
}

/**
 * Validate company name
 */
export function validateCompanyName(name: string): ValidationResult {
  if (name === '') {
    return {
      valid: false,
      message: 'Firmenname ist ein Pflichtfeld',
    };
  }

  if (name.length < 2) {
    return {
      valid: false,
      message: 'Firmenname muss mindestens 2 Zeichen lang sein',
    };
  }

  return { valid: true };
}

/**
 * Validate first name
 */
export function validateFirstName(name: string): ValidationResult {
  if (name === '') {
    return {
      valid: false,
      message: 'Vorname ist ein Pflichtfeld',
    };
  }

  return { valid: true };
}

/**
 * Validate last name
 */
export function validateLastName(name: string): ValidationResult {
  if (name === '') {
    return {
      valid: false,
      message: 'Nachname ist ein Pflichtfeld',
    };
  }

  return { valid: true };
}
