const { body, validationResult } = require('express-validator');

// Gemeinsame Fehlerbehandlungsfunktion
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validierungsfehler: ' + errors.array().map(err => err.msg).join(', '), 
      errors: errors.array() 
    });
  }
  next();
};

const validateCreateEmployee = [
  body('username').isLength({ min: 3 }).trim().escape()
    .withMessage('Benutzername muss mindestens 3 Zeichen lang sein'),
  body('email').isEmail().normalizeEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein'),
  body('password').isLength({ min: 6 })
    .withMessage('Passwort muss mindestens 6 Zeichen lang sein'),
  body('first_name').notEmpty().trim().escape()
    .withMessage('Vorname darf nicht leer sein'),
  body('last_name').notEmpty().trim().escape()
    .withMessage('Nachname darf nicht leer sein'),
  body('age').isInt({ min: 18, max: 100 })
    .withMessage('Alter muss zwischen 18 und 100 liegen'),
  body('employee_id').notEmpty().trim().escape()
    .withMessage('Mitarbeiter-ID darf nicht leer sein'),
  // Optionale Felder
  body('department_id').optional({ nullable: true }).isNumeric()
    .withMessage('Abteilungs-ID muss eine Zahl sein'),
  body('position').optional().trim().escape(),
  handleValidationErrors
];

const validateUpdateEmployee = [
  body('username').optional().isLength({ min: 3 }).trim().escape()
    .withMessage('Benutzername muss mindestens 3 Zeichen lang sein'),
  body('email').optional().isEmail().normalizeEmail()
    .withMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein'),
  body('first_name').optional().notEmpty().trim().escape()
    .withMessage('Vorname darf nicht leer sein'),
  body('last_name').optional().notEmpty().trim().escape()
    .withMessage('Nachname darf nicht leer sein'),
  body('age').optional().isInt({ min: 18, max: 100 })
    .withMessage('Alter muss zwischen 18 und 100 liegen'),
  body('employee_id').optional().notEmpty().trim().escape()
    .withMessage('Mitarbeiter-ID darf nicht leer sein'),
  body('department_id').optional({ nullable: true }).isNumeric()
    .withMessage('Abteilungs-ID muss eine Zahl sein'),
  body('position').optional().trim().escape(),
  body('status').optional().isIn(['active', 'inactive'])
    .withMessage('Status muss entweder "active" oder "inactive" sein'),
  handleValidationErrors
];

const validateToggleEmployeeStatus = [
  body('status').isIn(['active', 'inactive'])
    .withMessage('Status muss entweder "active" oder "inactive" sein'),
  handleValidationErrors
];

module.exports = {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateToggleEmployeeStatus
};