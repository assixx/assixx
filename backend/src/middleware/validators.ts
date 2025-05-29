const { body, validationResult } = require('express-validator');
import { ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Type for middleware array including validation chains and error handler
type ValidationMiddleware = ValidationChain | ((req: Request, res: Response, next: NextFunction) => void);

// Gemeinsame Fehlerbehandlungsfunktion
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: `Validierungsfehler: ${errors
        .array()
        .map((err) => err.msg)
        .join(', ')}`,
      errors: errors.array(),
    });
    return;
  }
  next();
};

export const validateCreateEmployee: ValidationMiddleware[] = [
  body('username')
    .isLength({ min: 3 })
    .trim()
    .escape()
    .withMessage('Benutzername muss mindestens 3 Zeichen lang sein'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Passwort muss mindestens 6 Zeichen lang sein'),
  body('first_name')
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Vorname darf nicht leer sein'),
  body('last_name')
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Nachname darf nicht leer sein'),
  body('age')
    .isInt({ min: 18, max: 100 })
    .withMessage('Alter muss zwischen 18 und 100 liegen'),
  body('employee_id')
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Mitarbeiter-ID darf nicht leer sein'),
  // Optionale Felder
  body('department_id')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('Abteilungs-ID muss eine Zahl sein'),
  body('position').optional().trim().escape(),
  handleValidationErrors,
];

export const validateUpdateEmployee: ValidationMiddleware[] = [
  body('username')
    .optional()
    .isLength({ min: 3 })
    .trim()
    .escape()
    .withMessage('Benutzername muss mindestens 3 Zeichen lang sein'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein'),
  body('first_name')
    .optional()
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Vorname darf nicht leer sein'),
  body('last_name')
    .optional()
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Nachname darf nicht leer sein'),
  body('age')
    .optional()
    .isInt({ min: 18, max: 100 })
    .withMessage('Alter muss zwischen 18 und 100 liegen'),
  body('employee_id')
    .optional()
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Mitarbeiter-ID darf nicht leer sein'),
  body('department_id')
    .optional({ nullable: true })
    .isNumeric()
    .withMessage('Abteilungs-ID muss eine Zahl sein'),
  body('position').optional().trim().escape(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status muss entweder "active" oder "inactive" sein'),
  handleValidationErrors,
];

export const validateToggleEmployeeStatus: ValidationMiddleware[] = [
  body('status')
    .isIn(['active', 'inactive'])
    .withMessage('Status muss entweder "active" oder "inactive" sein'),
  handleValidationErrors,
];

// Additional validators for other features
export const validateLogin: ValidationMiddleware[] = [
  body('username')
    .notEmpty()
    .trim()
    .withMessage('Benutzername ist erforderlich'),
  body('password')
    .notEmpty()
    .withMessage('Passwort ist erforderlich'),
  handleValidationErrors,
];

export const validateSignup: ValidationMiddleware[] = [
  body('companyName')
    .notEmpty()
    .trim()
    .withMessage('Firmenname ist erforderlich'),
  body('subdomain')
    .notEmpty()
    .trim()
    .isAlphanumeric()
    .isLength({ min: 3, max: 30 })
    .withMessage('Subdomain muss 3-30 alphanumerische Zeichen lang sein'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Gültige E-Mail-Adresse erforderlich'),
  body('username')
    .isLength({ min: 3 })
    .trim()
    .withMessage('Benutzername muss mindestens 3 Zeichen lang sein'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Passwort muss mindestens 8 Zeichen lang sein und Groß-, Kleinbuchstaben sowie Zahlen enthalten'),
  body('firstName')
    .notEmpty()
    .trim()
    .withMessage('Vorname ist erforderlich'),
  body('lastName')
    .notEmpty()
    .trim()
    .withMessage('Nachname ist erforderlich'),
  handleValidationErrors,
];

// CommonJS compatibility
module.exports = {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateToggleEmployeeStatus,
  validateLogin,
  validateSignup,
};