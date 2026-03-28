// =============================================================================
// SIGNUP PAGE - VALIDATION FUNCTIONS (Pure Functions)
// =============================================================================

import { PASSWORD_REQUIREMENTS } from './constants';

/**
 * Subdomain pattern: lowercase letters, numbers, and hyphens only
 */
const SUBDOMAIN_PATTERN = /^[a-z0-9-]+$/;

/**
 * Phone pattern: 7-15 digits (whitespace removed before check)
 */
const PHONE_PATTERN = /^\d{7,15}$/;

/** Validates subdomain format */
export function isSubdomainValid(subdomain: string): boolean {
  if (subdomain === '') return true;
  return SUBDOMAIN_PATTERN.test(subdomain);
}

/** Validates email format (basic check) */
export function isEmailValid(email: string): boolean {
  if (email === '') return true;
  return email.includes('@') && email.includes('.');
}

/** Checks if two email addresses match */
export function emailsMatch(email: string, emailConfirm: string): boolean {
  if (emailConfirm === '') return true;
  return email === emailConfirm;
}

/** Checks if two passwords match */
export function passwordsMatch(password: string, passwordConfirm: string): boolean {
  if (passwordConfirm === '') return true;
  return password === passwordConfirm;
}

/** Validates phone number format (7-15 digits, whitespace removed before check) */
export function isPhoneValid(phone: string): boolean {
  if (phone === '') return true;
  const digitsOnly = phone.replace(/\s/g, '');
  return PHONE_PATTERN.test(digitsOnly);
}

/** Validates password meets minimum requirements */
export function isPasswordValid(password: string): boolean {
  return password.length >= PASSWORD_REQUIREMENTS.minLength;
}

/**
 * Calculates a simple password strength score based on length.
 * Note: This is a simplified version. For production, use zxcvbn.
 */
export function getPasswordStrengthScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) return 0;
  if (password.length < 8) return 1;
  if (password.length < 12) return 2;
  if (password.length < 16) return 3;
  return 4;
}

/** Gets password strength label based on score */
export function getPasswordStrengthLabel(score: 0 | 1 | 2 | 3 | 4): string {
  switch (score) {
    case 0:
      return 'Sehr schwach';
    case 1:
      return 'Schwach';
    case 2:
      return 'Mittel';
    case 3:
      return 'Stark';
    case 4:
      return 'Sehr stark';
  }
}

/**
 * Validation result for the entire form
 */
export interface FormValidation {
  isValid: boolean;
  errors: {
    subdomain: string | null;
    emailMatch: string | null;
    phone: string | null;
    passwordMatch: string | null;
  };
}

/** Form data structure for validation */
interface FormData {
  companyName: string;
  subdomain: string;
  email: string;
  emailConfirm: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  termsAccepted: boolean;
}

/** Validate company section fields */
function isCompanySectionValid(data: FormData, subdomainValid: boolean): boolean {
  return data.companyName !== '' && data.subdomain !== '' && subdomainValid;
}

/** Validate contact section fields */
function isContactSectionValid(data: FormData, emailValid: boolean, emailMatch: boolean): boolean {
  return data.email !== '' && emailValid && data.emailConfirm !== '' && emailMatch;
}

/** Validate user section fields */
function isUserSectionValid(data: FormData, phoneValid: boolean): boolean {
  return data.firstName !== '' && data.lastName !== '' && data.phone !== '' && phoneValid;
}

/** Validate security section fields */
function isSecuritySectionValid(
  data: FormData,
  passwordValid: boolean,
  passwordMatch: boolean,
): boolean {
  return passwordValid && data.passwordConfirm !== '' && passwordMatch && data.termsAccepted;
}

/** Validates the entire signup form */
export function validateForm(data: FormData): FormValidation {
  const subdomainValid = isSubdomainValid(data.subdomain);
  const emailValid = isEmailValid(data.email);
  const emailMatch = emailsMatch(data.email, data.emailConfirm);
  const phoneValid = isPhoneValid(data.phone);
  const passwordValid = isPasswordValid(data.password);
  const passwordMatch = passwordsMatch(data.password, data.passwordConfirm);

  const isValid =
    isCompanySectionValid(data, subdomainValid) &&
    isContactSectionValid(data, emailValid, emailMatch) &&
    isUserSectionValid(data, phoneValid) &&
    isSecuritySectionValid(data, passwordValid, passwordMatch);

  return {
    isValid,
    errors: {
      subdomain: !subdomainValid ? 'Nur Kleinbuchstaben und Bindestriche' : null,
      emailMatch: !emailMatch ? 'E-Mail-Adressen stimmen nicht überein' : null,
      phone: !phoneValid ? 'Bitte geben Sie eine gültige Telefonnummer ein (7-15 Ziffern)' : null,
      passwordMatch: !passwordMatch ? 'Passwörter stimmen nicht überein' : null,
    },
  };
}
