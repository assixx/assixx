import { body, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Type for middleware array including validation chains and error handler
type ValidationMiddleware =
  | ValidationChain
  | ((req: Request, res: Response, next: NextFunction) => void);

// Gemeinsame Fehlerbehandlungsfunktion
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: `Validierungsfehler: ${errors
        .array()
        .map((err: any) => err.msg)
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

// Authentication validators
export const validateLogin: ValidationMiddleware[] = [
  body('username')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 3, max: 50 })
    .withMessage(
      'Benutzername ist erforderlich und muss 3-50 Zeichen lang sein'
    ),
  body('password')
    .notEmpty()
    .isLength({ min: 1, max: 128 })
    .withMessage('Passwort ist erforderlich'),
  handleValidationErrors,
];

export const validateSignup: ValidationMiddleware[] = [
  body('companyName')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 2, max: 100 })
    .withMessage('Firmenname ist erforderlich (2-100 Zeichen)'),
  body('subdomain')
    .notEmpty()
    .trim()
    .isAlphanumeric()
    .isLength({ min: 3, max: 30 })
    .withMessage('Subdomain muss 3-30 alphanumerische Zeichen lang sein'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Gültige E-Mail-Adresse erforderlich'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      'Benutzername muss 3-30 Zeichen lang sein (nur Buchstaben, Zahlen, _ und -)'
    ),
  body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
    .withMessage(
      'Passwort muss 8-128 Zeichen lang sein mit Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen'
    ),
  body('firstName')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 1, max: 50 })
    .withMessage('Vorname ist erforderlich (1-50 Zeichen)'),
  body('lastName')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 1, max: 50 })
    .withMessage('Nachname ist erforderlich (1-50 Zeichen)'),
  handleValidationErrors,
];

// Survey validators
export const validateCreateSurvey: ValidationMiddleware[] = [
  body('title')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 3, max: 200 })
    .withMessage('Titel ist erforderlich (3-200 Zeichen)'),
  body('description')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 1000 })
    .withMessage('Beschreibung darf maximal 1000 Zeichen lang sein'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Startdatum muss ein gültiges Datum sein'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('Enddatum muss ein gültiges Datum sein'),
  body('is_anonymous')
    .optional()
    .isBoolean()
    .withMessage('Anonym muss ein Boolean-Wert sein'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'completed', 'archived'])
    .withMessage('Status muss draft, active, completed oder archived sein'),
  body('questions')
    .optional()
    .isArray()
    .withMessage('Fragen müssen als Array übermittelt werden'),
  body('questions.*.question_text')
    .if(body('questions').exists())
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 5, max: 500 })
    .withMessage('Fragetext ist erforderlich (5-500 Zeichen)'),
  body('questions.*.question_type')
    .if(body('questions').exists())
    .isIn([
      'text',
      'single_choice',
      'multiple_choice',
      'number',
      'rating',
      'date',
    ])
    .withMessage(
      'Fragetyp muss text, single_choice, multiple_choice, number, rating oder date sein'
    ),
  body('questions.*.required')
    .optional()
    .isBoolean()
    .withMessage('Required muss ein Boolean-Wert sein'),
  body('questions.*.order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Reihenfolge muss eine positive Zahl sein'),
  handleValidationErrors,
];

export const validateUpdateSurvey: ValidationMiddleware[] = [
  body('title')
    .optional()
    .trim()
    .escape()
    .isLength({ min: 3, max: 200 })
    .withMessage('Titel muss 3-200 Zeichen lang sein'),
  body('description')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 1000 })
    .withMessage('Beschreibung darf maximal 1000 Zeichen lang sein'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Startdatum muss ein gültiges Datum sein'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('Enddatum muss ein gültiges Datum sein'),
  body('is_anonymous')
    .optional()
    .isBoolean()
    .withMessage('Anonym muss ein Boolean-Wert sein'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'completed', 'archived'])
    .withMessage('Status muss draft, active, completed oder archived sein'),
  handleValidationErrors,
];

export const validateSurveyResponse: ValidationMiddleware[] = [
  body('answers')
    .isArray({ min: 1 })
    .withMessage(
      'Antworten sind erforderlich und müssen als Array übermittelt werden'
    ),
  body('answers.*.question_id')
    .isInt({ min: 1 })
    .withMessage('Fragen-ID ist erforderlich und muss eine positive Zahl sein'),
  body('answers.*.answer_text')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 2000 })
    .withMessage('Antworttext darf maximal 2000 Zeichen lang sein'),
  body('answers.*.option_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Option-ID muss eine positive Zahl sein'),
  body('answers.*.answer_number')
    .optional()
    .isNumeric()
    .withMessage('Zahlenwert muss numerisch sein'),
  body('answers.*.answer_date')
    .optional()
    .isISO8601()
    .withMessage('Datum muss ein gültiges Datum sein'),
  handleValidationErrors,
];

// Document validators
export const validateDocumentUpload: ValidationMiddleware[] = [
  body('userId')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage(
      'Benutzer-ID ist erforderlich und muss eine positive Zahl sein'
    ),
  body('category')
    .optional()
    .trim()
    .escape()
    .isIn(['salary', 'contract', 'certificate', 'other'])
    .withMessage(
      'Kategorie muss salary, contract, certificate oder other sein'
    ),
  body('description')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 500 })
    .withMessage('Beschreibung darf maximal 500 Zeichen lang sein'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Jahr muss zwischen 2000 und 2100 liegen'),
  body('month')
    .optional()
    .isIn([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
    ])
    .withMessage('Monat muss zwischen 01 und 12 liegen'),
  handleValidationErrors,
];

// Calendar/Shift validators
export const validateCreateShift: ValidationMiddleware[] = [
  body('employee_id')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage(
      'Mitarbeiter-ID ist erforderlich und muss eine positive Zahl sein'
    ),
  body('start_time')
    .notEmpty()
    .isISO8601()
    .withMessage(
      'Startzeit ist erforderlich und muss ein gültiges Datum/Zeit sein'
    ),
  body('end_time')
    .notEmpty()
    .isISO8601()
    .withMessage(
      'Endzeit ist erforderlich und muss ein gültiges Datum/Zeit sein'
    ),
  body('shift_type')
    .optional()
    .trim()
    .escape()
    .isIn(['morning', 'afternoon', 'night', 'overtime'])
    .withMessage(
      'Schichttyp muss morning, afternoon, night oder overtime sein'
    ),
  body('notes')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 500 })
    .withMessage('Notizen dürfen maximal 500 Zeichen lang sein'),
  handleValidationErrors,
];

// Blackboard validators
export const validateCreatePost: ValidationMiddleware[] = [
  body('title')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 3, max: 100 })
    .withMessage('Titel ist erforderlich (3-100 Zeichen)'),
  body('content')
    .notEmpty()
    .trim()
    .escape()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Inhalt ist erforderlich (10-2000 Zeichen)'),
  body('category')
    .optional()
    .trim()
    .escape()
    .isIn(['announcement', 'news', 'event', 'general'])
    .withMessage('Kategorie muss announcement, news, event oder general sein'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priorität muss low, medium, high oder urgent sein'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Farbe muss ein gültiger Hex-Farbcode sein'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags müssen als Array übermittelt werden'),
  body('tags.*')
    .if(body('tags').exists())
    .trim()
    .escape()
    .isLength({ min: 1, max: 30 })
    .withMessage('Tags müssen 1-30 Zeichen lang sein'),
  handleValidationErrors,
];

// Parameter validators
export const validateIdParam: ValidationMiddleware[] = [
  body('id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID muss eine positive Zahl sein'),
  handleValidationErrors,
];

// Query parameter validators for pagination and filtering
export const validatePaginationQuery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { page, limit } = req.query;

  if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    res.status(400).json({ message: 'Page muss eine positive Zahl sein' });
    return;
  }

  if (
    limit &&
    (!Number.isInteger(Number(limit)) ||
      Number(limit) < 1 ||
      Number(limit) > 100)
  ) {
    res.status(400).json({ message: 'Limit muss zwischen 1 und 100 liegen' });
    return;
  }

  next();
};

// File validation helper
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file) {
      res.status(400).json({ message: 'Datei ist erforderlich' });
      return;
    }

    const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      res.status(400).json({
        message: `Dateityp nicht erlaubt. Erlaubte Typen: ${allowedTypes.join(', ')}`,
      });
      return;
    }

    if (req.file.size > maxSize) {
      res.status(400).json({
        message: `Datei zu groß. Maximum: ${Math.round(maxSize / 1024 / 1024)}MB`,
      });
      return;
    }

    next();
  };
};

// SQL injection prevention for dynamic queries
export const sanitizeSQLInput = (input: string): string => {
  return input.replace(/[^\w\s-_.@]/g, '');
};

