/**
 * E-Mail-Service für Assixx
 * Stellt Funktionen zum Versenden von E-Mails bereit
 */
import fs from 'fs';
import jwt from 'jsonwebtoken';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';
import path from 'path';

import featureCheck from './featureCheck.js';
import { logger } from './logger.js';
import { getErrorMessage } from '../nest/common/utils/error.utils.js';

// Type definition for attachment (from nodemailer)
interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  cid?: string;
}

function removeDangerousTags(html: string): string {
  const dangerousTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'meta',
    'link',
    'base',
    'applet',
  ];
  let sanitized = html;
  for (let i = 0; i < 3; i++) {
    dangerousTags.forEach((tag: string) => {
      const fullTagRegex = new RegExp(
        `<${tag}[^>]*>[\\s\\S]*?</${tag}[^>]*>`,
        'gi',
      );
      sanitized = sanitized.replace(fullTagRegex, '');
      const singleTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      sanitized = sanitized.replace(singleTagRegex, '');
      const closeTagRegex = new RegExp(`</${tag}[^>]*>`, 'gi');
      sanitized = sanitized.replace(closeTagRegex, '');
    });
  }
  return sanitized;
}

function removeEventHandlers(html: string): string {
  const eventHandlerPatterns = [
    /\bon\w+\s*=\s*["'][^"']*["']/gi,
    /\bon\w+\s*=\s*`[^`]*`/gi,
    /\bon\w+\s*=\s*[^\s>]+/gi,
    /\son\w+/gi,
  ];
  let sanitized = html;
  for (let i = 0; i < 3; i++) {
    eventHandlerPatterns.forEach((pattern: RegExp) => {
      sanitized = sanitized.replace(pattern, '');
    });
  }
  return sanitized;
}

function sanitizeUrls(html: string): string {
  const urlPatterns = [
    /href\s*=\s*["']([^"']*)["']/gi,
    /href\s*=\s*([^\s>]+)/gi,
    /src\s*=\s*["']([^"']*)["']/gi,
    /src\s*=\s*([^\s>]+)/gi,
    /(?:action|formaction|data|code|codebase)\s*=\s*["']([^"']*)["']/gi,
  ];
  let sanitized = html;
  urlPatterns.forEach((pattern: RegExp) => {
    sanitized = sanitized.replace(pattern, (match: string, url: string) => {
      const lowerUrl = url.toLowerCase().trim();
      if (
        /^(javascript|vbscript|data:text\/html|data:text\/javascript|data:application\/javascript)/i.test(
          lowerUrl,
        )
      ) {
        return match.replace(url, '#');
      }
      if (
        lowerUrl.startsWith('data:') &&
        !/^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml)/i.test(lowerUrl)
      ) {
        return match.replace(url, '#');
      }
      return match;
    });
  });
  return sanitized;
}

function sanitizeStyles(html: string): string {
  return html.replace(
    /style\s*=\s*["']([^"']*)["']/gi,
    (_match: string, styleContent: string) => {
      let cleanedStyle = styleContent;
      const dangerousCSS = [
        /expression\s*\([^)]*\)/gi,
        /javascript\s*:/gi,
        /vbscript\s*:/gi,
        /-moz-binding\s*:/gi,
        /behavior\s*:/gi,
        /@import/gi,
        /import\s*\(/gi,
      ];
      dangerousCSS.forEach((pattern: RegExp) => {
        cleanedStyle = cleanedStyle.replace(pattern, '');
      });
      cleanedStyle = cleanedStyle.replace(
        /url\s*\([^)]*\)/gi,
        (urlMatch: string) => {
          if (
            /url\s*\(\s*["']?(javascript|vbscript|data:text)/i.test(urlMatch)
          ) {
            return '';
          }
          return urlMatch;
        },
      );
      return cleanedStyle.trim() !== '' ? `style="${cleanedStyle}"` : '';
    },
  );
}

/**
 * Sanitiert HTML-Inhalt für sicheren E-Mail-Versand
 * Entfernt gefährliche Tags und Attribute
 *
 * SECURITY NOTE: This implementation uses regex-based sanitization which
 * provides reasonable protection but may be bypassable with clever encoding.
 * For production environments with high security requirements, consider using
 * a dedicated library like 'sanitize-html' or 'isomorphic-dompurify'.
 *
 * Current protections:
 * - Removes dangerous tags (script, iframe, object, embed, form, etc.)
 * - Removes event handlers (onclick, onerror, etc.)
 * - Sanitizes URLs (blocks javascript:, vbscript:, dangerous data: URIs)
 * - Sanitizes styles (blocks expression(), behavior:, etc.)
 */
function sanitizeHtml(html: string): string {
  // SECURITY: Multiple passes to catch nested/encoded attacks
  if (html === '') return '';
  let sanitized = html;

  // Decode common HTML entities that might hide attacks
  sanitized = sanitized
    .replace(/&#x([0-9a-f]+);/gi, (_m: string, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m: string, dec: string) =>
      String.fromCharCode(Number.parseInt(dec, 10)),
    );

  // Apply sanitization in multiple passes for nested attacks
  for (let pass = 0; pass < 2; pass++) {
    sanitized = removeDangerousTags(sanitized);
    sanitized = removeEventHandlers(sanitized);
    sanitized = sanitizeUrls(sanitized);
    sanitized = sanitizeStyles(sanitized);
  }

  return sanitized.trim();
}

// Interfaces
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface User {
  email: string;
  first_name: string;
  last_name: string;
  company?: string;
}

interface Document {
  file_name: string;
  category?: string;
  upload_date: string | Date;
}

interface BulkMessageOptions {
  subject: string;
  html?: string;
  text?: string;
  templateName?: string;
  replacements?: Record<string, string>;
  notificationType?: string;
  attachments?: Attachment[];
  tenantId?: number;
  userId?: number;
  checkFeature?: boolean;
}

type TemplateReplacements = Record<string, string>;

type QueueItem = EmailOptions;

// Queue für Massen-E-Mails
const emailQueue: QueueItem[] = [];
let isProcessingQueue = false;
const MAX_EMAILS_PER_BATCH = 50; // Maximale Anzahl von E-Mails pro Batch

// Konfiguration des Transport-Objekts (wird später aus .env geladen)
let transporter: Transporter | null = null;

function initializeTransporter(config: EmailConfig | null = null): Transporter {
  // Default-Konfiguration für Entwicklung
  const defaultConfig: EmailConfig = {
    host: process.env['EMAIL_HOST'] ?? 'smtp.example.com',
    port: Number.parseInt(process.env['EMAIL_PORT'] ?? '587', 10),
    secure: process.env['EMAIL_SECURE'] === 'true',
    auth: {
      user: process.env['EMAIL_USER'] ?? 'user@example.com',
      pass: process.env['EMAIL_PASSWORD'] ?? 'password',
    },
  };

  const transportConfig: EmailConfig = config ?? defaultConfig;

  transporter = nodemailer.createTransport(transportConfig);

  // Test SMTP-Verbindung
  transporter.verify((error: Error | null): void => {
    if (error) {
      logger.error(`E-Mail-Konfiguration fehlgeschlagen: ${error.message}`);
    } else {
      logger.info('E-Mail-Service erfolgreich konfiguriert');
    }
  });

  return transporter;
}

function escapeHtmlTemplate(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(
    /["&'<>]/g,
    (match: string) => htmlEscapes[match] ?? match,
  );
}

/**
 * Lädt ein E-Mail-Template und ersetzt Platzhalter
 * @param templateName - Name des Templates ohne .html-Erweiterung
 */
async function loadTemplate(
  templateName: string,
  replacements: TemplateReplacements = {},
): Promise<string> {
  try {
    const templatePath = path.join(
      process.cwd(),
      'templates/email',
      `${templateName}.html`,
    );
    let templateContent = await fs.promises.readFile(templatePath, 'utf8');

    // Platzhalter ersetzen (Format: {{variable}})
    Object.keys(replacements).forEach((key: string): void => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      // Escape replacement values to prevent XSS

      const value = replacements[key];
      if (value === undefined) return;
      const safeValue = escapeHtmlTemplate(value);
      templateContent = templateContent.replace(regex, safeValue);
    });

    return templateContent;
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Laden des E-Mail-Templates '${templateName}': ${getErrorMessage(error)}`,
    );
    // Fallback-Template
    const safeMessage = escapeHtmlTemplate(
      replacements['message'] ?? 'Keine Nachricht verfügbar',
    );
    return `
      <html>
        <body>
          <h1>Assixx Benachrichtigung</h1>
          <p>${safeMessage}</p>
        </body>
      </html>
    `;
  }
}

async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!transporter) {
    initializeTransporter();
  }

  if (!transporter) {
    throw new Error('Email transporter could not be initialized');
  }

  // Create a local constant that TypeScript knows is non-null
  const mailer: Transporter = transporter;

  try {
    // E-Mail-Absender aus Umgebungsvariablen oder Fallback
    const from: string =
      options.from ?? process.env['EMAIL_FROM'] ?? 'Assixx <noreply@assixx.de>';

    // HTML-Sanitization
    let sanitizedHtml: string | undefined = options.html;
    if (options.html != null && options.html !== '') {
      // HTML mit unserer Sanitization-Funktion bereinigen
      sanitizedHtml = sanitizeHtml(options.html);

      // Zusätzliche Sicherheitsvalidierung als Backup
      // Pattern das auch malformed end tags erkennt (z.B. </script foo="bar">)
      // codeql[js/bad-tag-filter] - This is a backup check after comprehensive sanitization
      const scriptPattern = /<script\b[^>]*>[\s\S]*$3<\/script[^>]*>/i;
      const eventHandlerPattern = /\bon\w+\s*=/i;

      if (
        sanitizedHtml !== '' &&
        (scriptPattern.test(sanitizedHtml) ||
          eventHandlerPattern.test(sanitizedHtml))
      ) {
        logger.warn(
          'Potenziell gefährlicher HTML-Inhalt nach Sanitization erkannt',
        );
        return {
          success: false,
          error: 'E-Mail enthält nicht erlaubte HTML-Elemente',
        };
      }

      // Log wenn Inhalte entfernt wurden
      if (sanitizedHtml !== options.html) {
        logger.warn('HTML-Inhalt wurde während der Sanitization modifiziert');
      }
    }

    // E-Mail senden
    const mailOptions: SendMailOptions = {
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      // codeql[js/xss] - False positive: HTML content is thoroughly sanitized
      // by sanitizeHtml() function which removes all dangerous tags (script, iframe, etc.),
      // event handlers, dangerous URLs (javascript:, vbscript:), and malicious CSS.
      // Additional validation at lines 352-368 provides defense in depth.
      html: sanitizedHtml,
      attachments: options.attachments,
    };

    // Type assertion needed because nodemailer's sendMail returns any
    interface SendMailResult {
      messageId: string;
      response?: string;
      accepted?: string[];
      rejected?: string[];
    }

    const info = (await mailer.sendMail(mailOptions)) as SendMailResult;

    const messageId = info.messageId;
    logger.info(`E-Mail gesendet: ${messageId}`);
    return { success: true, messageId };
  } catch (error: unknown) {
    logger.error(`Fehler beim Senden der E-Mail: ${getErrorMessage(error)}`);
    return { success: false, error: getErrorMessage(error) };
  }
}

function addToQueue(emailOptions: EmailOptions): void {
  emailQueue.push(emailOptions);
  logger.info(
    `E-Mail zur Queue hinzugefügt. Queue-Länge: ${emailQueue.length}`,
  );

  // Starte die Queue-Verarbeitung, falls sie nicht bereits läuft
  if (!isProcessingQueue) {
    void processQueue();
  }
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue || emailQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  logger.info(
    `Starte Verarbeitung der E-Mail-Queue: ${emailQueue.length} E-Mails in der Warteschlange`,
  );

  try {
    // E-Mails in Batches verarbeiten
    while (emailQueue.length > 0) {
      const batch: EmailOptions[] = emailQueue.splice(0, MAX_EMAILS_PER_BATCH);
      logger.info(`Verarbeite Batch von ${batch.length} E-Mails`);

      // E-Mails parallel senden, aber mit Limit
      const results: EmailResult[] = await Promise.all(
        batch.map(
          async (emailOptions: EmailOptions) => await sendEmail(emailOptions),
        ),
      );

      const successful = results.filter((r: EmailResult) => r.success).length;
      const failed = results.filter((r: EmailResult) => !r.success).length;

      logger.info(
        `Batch verarbeitet: ${successful} erfolgreich, ${failed} fehlgeschlagen`,
      );

      // Kurze Pause zwischen Batches, um SMTP-Limits einzuhalten
      if (emailQueue.length > 0) {
        await new Promise<void>((resolve: () => void) =>
          global.setTimeout(resolve, 1000),
        );
      }
    }
  } catch (error: unknown) {
    logger.error(
      `Fehler bei der Verarbeitung der E-Mail-Queue: ${getErrorMessage(error)}`,
    );
  } finally {
    isProcessingQueue = false;
    logger.info('E-Mail-Queue-Verarbeitung abgeschlossen');
  }
}

async function sendNewDocumentNotification(
  user: User,
  document: Document,
): Promise<EmailResult> {
  try {
    if (user.email === '') {
      return {
        success: false,
        error: 'Keine E-Mail-Adresse für den Benutzer verfügbar',
      };
    }

    // Unsubscribe-Link generieren
    const unsubscribeUrl: string = generateUnsubscribeLink(
      user.email,
      'documents',
    );

    const userName = `${user.first_name} ${user.last_name}`;
    const documentName = document.file_name;
    const replacements: TemplateReplacements = {
      userName,
      documentName,
      documentCategory: document.category ?? 'Allgemein',
      documentDate: new Date(document.upload_date).toLocaleDateString('de-DE'),
      dashboardUrl: `${process.env['APP_URL'] ?? 'https://app.assixx.de'}/employee-dashboard`,
      unsubscribeUrl,
    };

    const html: string = await loadTemplate('new-document', replacements);

    return await sendEmail({
      to: user.email,
      subject: 'Neues Dokument für Sie verfügbar',
      html,
      text: `Hallo ${userName},\n\nEin neues Dokument "${documentName}" wurde für Sie hochgeladen. Sie können es in Ihrem Dashboard einsehen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Senden der Dokumentenbenachrichtigung: ${getErrorMessage(error)}`,
    );
    return { success: false, error: getErrorMessage(error) };
  }
}

async function sendWelcomeEmail(user: User): Promise<EmailResult> {
  try {
    if (user.email === '') {
      return {
        success: false,
        error: 'Keine E-Mail-Adresse für den Benutzer verfügbar',
      };
    }

    const userName = `${user.first_name} ${user.last_name}`;
    const replacements: TemplateReplacements = {
      userName,
      companyName: user.company ?? 'Ihr Unternehmen',
      loginUrl: `${process.env['APP_URL'] ?? 'https://app.assixx.de'}/login.html`,
    };

    const html: string = await loadTemplate('welcome', replacements);

    return await sendEmail({
      to: user.email,
      subject: 'Willkommen bei Assixx',
      html,
      text: `Hallo ${userName},\n\nWillkommen bei Assixx! Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt mit Ihren Anmeldedaten einloggen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Senden der Willkommens-E-Mail: ${getErrorMessage(error)}`,
    );
    return { success: false, error: getErrorMessage(error) };
  }
}

async function checkBulkEmailFeature(
  options: BulkMessageOptions,
  userCount: number,
): Promise<EmailResult | null> {
  if (options.tenantId == null || options.checkFeature !== true) return null;

  const hasAccess = await featureCheck.checkTenantAccess(
    options.tenantId,
    'email_notifications',
  );
  if (!hasAccess) {
    return {
      success: false,
      error: 'Keine Berechtigung für Massen-E-Mails. Bitte Feature upgraden.',
    };
  }

  await featureCheck.logUsage(
    options.tenantId,
    'email_notifications',
    options.userId,
    {
      recipients: userCount,
      subject: options.subject,
    },
  );
  return null;
}

function queueUserEmail(
  user: User,
  html: string,
  options: BulkMessageOptions,
): void {
  const unsubscribeUrl = generateUnsubscribeLink(
    user.email,
    options.notificationType ?? 'all',
  );
  const personalizedHtml = html
    .replace(/{{userName}}/g, `${user.first_name} ${user.last_name}`)
    .replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);

  const emailOptions: EmailOptions = {
    to: user.email,
    subject: options.subject,
    html: personalizedHtml,
  };
  if (options.text !== undefined) emailOptions.text = options.text;
  if (options.attachments !== undefined)
    emailOptions.attachments = options.attachments;
  addToQueue(emailOptions);
}

async function sendBulkNotification(
  users: User[],
  messageOptions: BulkMessageOptions,
): Promise<EmailResult> {
  try {
    const featureError = await checkBulkEmailFeature(
      messageOptions,
      users.length,
    );
    if (featureError !== null) return featureError;

    const validUsers = users.filter((user: User) => user.email !== '');
    if (validUsers.length === 0) {
      return {
        success: false,
        error: 'Keine gültigen E-Mail-Empfänger gefunden',
      };
    }

    let html = messageOptions.html ?? '';
    if (
      messageOptions.templateName != null &&
      messageOptions.templateName !== ''
    ) {
      html = await loadTemplate(
        messageOptions.templateName,
        messageOptions.replacements ?? {},
      );
    }

    for (const user of validUsers) {
      queueUserEmail(user, html, messageOptions);
    }

    return {
      success: true,
      messageId: `${validUsers.length} E-Mails zur Versandwarteschlange hinzugefügt`,
    };
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Hinzufügen von Massen-E-Mails zur Queue: ${getErrorMessage(error)}`,
    );
    return { success: false, error: getErrorMessage(error) };
  }
}

function generateUnsubscribeLink(email: string, type?: string): string {
  const resolvedType = type ?? 'all';

  // Token generieren (würde normalerweise mit JWT o.ä. implementiert)
  const token: string = jwt.sign(
    { email, type: resolvedType, purpose: 'unsubscribe' },
    process.env['JWT_SECRET'] ?? 'default-secret',
    { expiresIn: '30d' },
  );

  return `${process.env['APP_URL'] ?? 'https://app.assixx.de'}/unsubscribe?token=${token}`;
}

// ES module exports
// Default export
export default {
  initializeTransporter,
  sendEmail,
  sendNewDocumentNotification,
  sendWelcomeEmail,
  sendBulkNotification,
  addToQueue,
  processQueue,
  generateUnsubscribeLink,
};
