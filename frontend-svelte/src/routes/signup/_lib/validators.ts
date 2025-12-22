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

/**
 * Validates subdomain format
 * @param subdomain - The subdomain to validate
 * @returns true if valid or empty, false otherwise
 */
export function isSubdomainValid(subdomain: string): boolean {
  if (subdomain === '') return true;
  return SUBDOMAIN_PATTERN.test(subdomain);
}

/**
 * Validates email format (basic check)
 * @param email - The email to validate
 * @returns true if valid or empty, false otherwise
 */
export function isEmailValid(email: string): boolean {
  if (email === '') return true;
  return email.includes('@') && email.includes('.');
}

/**
 * Checks if two email addresses match
 * @param email - Primary email
 * @param emailConfirm - Confirmation email
 * @returns true if they match or confirm is empty
 */
export function emailsMatch(email: string, emailConfirm: string): boolean {
  if (emailConfirm === '') return true;
  return email === emailConfirm;
}

/**
 * Checks if two passwords match
 * @param password - Primary password
 * @param passwordConfirm - Confirmation password
 * @returns true if they match or confirm is empty
 */
export function passwordsMatch(password: string, passwordConfirm: string): boolean {
  if (passwordConfirm === '') return true;
  return password === passwordConfirm;
}

/**
 * Validates phone number format (7-15 digits)
 * @param phone - The phone number to validate (whitespace will be removed)
 * @returns true if valid or empty, false otherwise
 */
export function isPhoneValid(phone: string): boolean {
  if (phone === '') return true;
  const digitsOnly = phone.replace(/\s/g, '');
  return PHONE_PATTERN.test(digitsOnly);
}

/**
 * Validates password meets minimum requirements
 * @param password - The password to validate
 * @returns true if password meets minimum length
 */
export function isPasswordValid(password: string): boolean {
  return password.length >= PASSWORD_REQUIREMENTS.minLength;
}

/**
 * Calculates a simple password strength score based on length
 * Note: This is a simplified version. For production, use zxcvbn.
 * @param password - The password to score
 * @returns score from 0-4
 */
export function getPasswordStrengthScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) return 0;
  if (password.length < 8) return 1;
  if (password.length < 12) return 2;
  if (password.length < 16) return 3;
  return 4;
}

/**
 * Gets password strength label based on score
 * @param score - Password strength score (0-4)
 * @returns Human-readable strength label
 */
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

/**
 * Validates the entire signup form
 * @param data - Form data to validate
 * @returns Validation result with errors
 */
export function validateForm(data: {
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
}): FormValidation {
  const subdomainValid = isSubdomainValid(data.subdomain);
  const emailValid = isEmailValid(data.email);
  const emailMatch = emailsMatch(data.email, data.emailConfirm);
  const phoneValid = isPhoneValid(data.phone);
  const passwordValid = isPasswordValid(data.password);
  const passwordMatch = passwordsMatch(data.password, data.passwordConfirm);

  const isValid =
    data.companyName !== '' &&
    data.subdomain !== '' &&
    subdomainValid &&
    data.email !== '' &&
    emailValid &&
    data.emailConfirm !== '' &&
    emailMatch &&
    data.firstName !== '' &&
    data.lastName !== '' &&
    data.phone !== '' &&
    phoneValid &&
    passwordValid &&
    data.passwordConfirm !== '' &&
    passwordMatch &&
    data.termsAccepted;

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
