/**
 * E-Mail-Service für Assixx
 * Stellt Funktionen zum Versenden von E-Mails bereit
 */

import nodemailer, {
  Transporter,
  SendMailOptions,
  SentMessageInfo,
} from 'nodemailer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { logger } from './logger';
import Feature from '../models/feature';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  attachments?: any[];
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
  replacements?: { [key: string]: string };
  notificationType?: string;
  attachments?: any[];
  tenantId?: number;
  userId?: number;
  checkFeature?: boolean;
}

interface TemplateReplacements {
  [key: string]: string;
}

interface QueueItem extends EmailOptions {}

// Queue für Massen-E-Mails
const emailQueue: QueueItem[] = [];
let isProcessingQueue: boolean = false;
const MAX_EMAILS_PER_BATCH: number = 50; // Maximale Anzahl von E-Mails pro Batch

// Konfiguration des Transport-Objekts (wird später aus .env geladen)
let transporter: Transporter | null = null;

/**
 * Initialisiert den E-Mail-Transporter
 * @param config - Konfigurationsobjekt
 */
function initializeTransporter(config: EmailConfig | null = null): Transporter {
  // Default-Konfiguration für Entwicklung
  const defaultConfig: EmailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'user@example.com',
      pass: process.env.EMAIL_PASSWORD || 'password',
    },
  };

  const transportConfig: EmailConfig = config || defaultConfig;

  transporter = nodemailer.createTransport(transportConfig);

  // Test SMTP-Verbindung
  transporter!.verify((error: Error | null): void => {
    if (error) {
      logger.error(`E-Mail-Konfiguration fehlgeschlagen: ${error.message}`);
    } else {
      logger.info('E-Mail-Service erfolgreich konfiguriert');
    }
  });

  return transporter!;
}

/**
 * Lädt ein E-Mail-Template und ersetzt Platzhalter
 * @param templateName - Name des Templates ohne .html-Erweiterung
 * @param replacements - Objekt mit Platzhaltern und Ersetzungen
 * @returns HTML-Inhalt des Templates
 */
async function loadTemplate(
  templateName: string,
  replacements: TemplateReplacements = {}
): Promise<string> {
  try {
    const templatePath = path.join(
      __dirname,
      '../templates/email',
      `${templateName}.html`
    );
    let templateContent = await fs.promises.readFile(templatePath, 'utf8');

    // Platzhalter ersetzen (Format: {{variable}})
    Object.keys(replacements).forEach((key: string): void => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      templateContent = templateContent.replace(regex, replacements[key]);
    });

    return templateContent;
  } catch (error: any) {
    logger.error(
      `Fehler beim Laden des E-Mail-Templates '${templateName}': ${error.message}`
    );
    // Fallback-Template
    return `
      <html>
        <body>
          <h1>Assixx Benachrichtigung</h1>
          <p>${replacements.message || 'Keine Nachricht verfügbar'}</p>
        </body>
      </html>
    `;
  }
}

/**
 * Sendet eine einzelne E-Mail
 * @param options - E-Mail-Optionen
 * @returns Ergebnis des Versands
 */
async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!transporter) {
    initializeTransporter();
  }

  try {
    // E-Mail-Absender aus Umgebungsvariablen oder Fallback
    const from: string =
      options.from || process.env.EMAIL_FROM || 'Assixx <noreply@assixx.de>';

    // E-Mail senden
    const mailOptions: SendMailOptions = {
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    };

    const info: SentMessageInfo = await transporter!.sendMail(mailOptions);

    logger.info(`E-Mail gesendet: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    logger.error(`Fehler beim Senden der E-Mail: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fügt eine E-Mail zur Queue hinzu
 * @param emailOptions - E-Mail-Optionen
 */
function addToQueue(emailOptions: EmailOptions): void {
  emailQueue.push(emailOptions);
  logger.info(
    `E-Mail zur Queue hinzugefügt. Queue-Länge: ${emailQueue.length}`
  );

  // Starte die Queue-Verarbeitung, falls sie nicht bereits läuft
  if (!isProcessingQueue) {
    processQueue();
  }
}

/**
 * Verarbeitet die E-Mail-Queue
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || emailQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  logger.info(
    `Starte Verarbeitung der E-Mail-Queue: ${emailQueue.length} E-Mails in der Warteschlange`
  );

  try {
    // E-Mails in Batches verarbeiten
    while (emailQueue.length > 0) {
      const batch: EmailOptions[] = emailQueue.splice(0, MAX_EMAILS_PER_BATCH);
      logger.info(`Verarbeite Batch von ${batch.length} E-Mails`);

      // E-Mails parallel senden, aber mit Limit
      const results: EmailResult[] = await Promise.all(
        batch.map((emailOptions: EmailOptions) => sendEmail(emailOptions))
      );

      const successful = results.filter((r: EmailResult) => r.success).length;
      const failed = results.filter((r: EmailResult) => !r.success).length;

      logger.info(
        `Batch verarbeitet: ${successful} erfolgreich, ${failed} fehlgeschlagen`
      );

      // Kurze Pause zwischen Batches, um SMTP-Limits einzuhalten
      if (emailQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error: any) {
    logger.error(
      `Fehler bei der Verarbeitung der E-Mail-Queue: ${error.message}`
    );
  } finally {
    isProcessingQueue = false;
    logger.info('E-Mail-Queue-Verarbeitung abgeschlossen');
  }
}

/**
 * Sendet eine Benachrichtigung über ein neues Dokument
 * @param user - Benutzer-Objekt
 * @param document - Dokument-Objekt
 * @returns Ergebnis des Versands
 */
async function sendNewDocumentNotification(
  user: User,
  document: Document
): Promise<EmailResult> {
  try {
    if (!user.email) {
      return {
        success: false,
        error: 'Keine E-Mail-Adresse für den Benutzer verfügbar',
      };
    }

    // Unsubscribe-Link generieren
    const unsubscribeUrl: string = generateUnsubscribeLink(
      user.email,
      'documents'
    );

    const replacements: TemplateReplacements = {
      userName: `${user.first_name} ${user.last_name}`,
      documentName: document.file_name,
      documentCategory: document.category || 'Allgemein',
      documentDate: new Date(document.upload_date).toLocaleDateString('de-DE'),
      dashboardUrl: `${process.env.APP_URL || 'https://app.assixx.de'}/employee-dashboard.html`,
      unsubscribeUrl,
    };

    const html: string = await loadTemplate('new-document', replacements);

    return await sendEmail({
      to: user.email,
      subject: 'Neues Dokument für Sie verfügbar',
      html,
      text: `Hallo ${replacements.userName},\n\nEin neues Dokument "${replacements.documentName}" wurde für Sie hochgeladen. Sie können es in Ihrem Dashboard einsehen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: any) {
    logger.error(
      `Fehler beim Senden der Dokumentenbenachrichtigung: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Sendet eine Willkommensnachricht an einen neuen Benutzer
 * @param user - Benutzer-Objekt
 * @returns Ergebnis des Versands
 */
async function sendWelcomeEmail(user: User): Promise<EmailResult> {
  try {
    if (!user.email) {
      return {
        success: false,
        error: 'Keine E-Mail-Adresse für den Benutzer verfügbar',
      };
    }

    const replacements: TemplateReplacements = {
      userName: `${user.first_name} ${user.last_name}`,
      companyName: user.company || 'Ihr Unternehmen',
      loginUrl: `${process.env.APP_URL || 'https://app.assixx.de'}/login.html`,
    };

    const html: string = await loadTemplate('welcome', replacements);

    return await sendEmail({
      to: user.email,
      subject: 'Willkommen bei Assixx',
      html,
      text: `Hallo ${replacements.userName},\n\nWillkommen bei Assixx! Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt mit Ihren Anmeldedaten einloggen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: any) {
    logger.error(`Fehler beim Senden der Willkommens-E-Mail: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Sendet eine Massenbenachrichtigung an mehrere Benutzer
 * @param users - Array von Benutzer-Objekten
 * @param messageOptions - Optionen für die Nachricht
 * @returns Ergebnis des Versands
 */
async function sendBulkNotification(
  users: User[],
  messageOptions: BulkMessageOptions
): Promise<EmailResult> {
  try {
    // Feature-Prüfung für Massen-E-Mails (wenn verfügbar)
    if (messageOptions.tenantId && messageOptions.checkFeature) {
      const hasAccess = await Feature.checkTenantAccess(
        messageOptions.tenantId,
        'email_notifications'
      );

      if (!hasAccess) {
        return {
          success: false,
          error:
            'Keine Berechtigung für Massen-E-Mails. Bitte Feature upgraden.',
        };
      }

      // Nutzung des Features protokollieren
      await Feature.logUsage(
        messageOptions.tenantId,
        'email_notifications',
        messageOptions.userId,
        {
          recipients: users.length,
          subject: messageOptions.subject,
        }
      );
    }

    // Filtere Benutzer ohne E-Mail
    const validUsers: User[] = users.filter((user: User) => user.email);

    if (validUsers.length === 0) {
      return {
        success: false,
        error: 'Keine gültigen E-Mail-Empfänger gefunden',
      };
    }

    // HTML aus Template laden, falls nicht direkt angegeben
    let html: string = messageOptions.html || '';
    if (messageOptions.templateName) {
      // const notificationType: string =
      //   messageOptions.notificationType || 'notification'; // Unused

      // Replacement-Objekt mit Basis-Werten erstellen
      const baseReplacements: TemplateReplacements =
        messageOptions.replacements || {};

      html = await loadTemplate(messageOptions.templateName, baseReplacements);
    }

    // E-Mails zur Queue hinzufügen
    for (const user of validUsers) {
      // Unsubscribe-Link für jeden Benutzer generieren
      const unsubscribeUrl: string = generateUnsubscribeLink(
        user.email,
        messageOptions.notificationType || 'all'
      );

      // HTML personalisieren
      const personalizedHtml: string = html
        .replace(/{{userName}}/g, `${user.first_name} ${user.last_name}`)
        .replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);

      addToQueue({
        to: user.email,
        subject: messageOptions.subject,
        html: personalizedHtml,
        text: messageOptions.text,
        attachments: messageOptions.attachments,
      });
    }

    return {
      success: true,
      messageId: `${validUsers.length} E-Mails zur Versandwarteschlange hinzugefügt`,
    };
  } catch (error: any) {
    logger.error(
      `Fehler beim Hinzufügen von Massen-E-Mails zur Queue: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

/**
 * Generiert einen Unsubscribe-Link
 * @param email - E-Mail-Adresse
 * @param type - Typ der Benachrichtigung
 * @returns Unsubscribe-Link
 */
function generateUnsubscribeLink(email: string, type: string = 'all'): string {
  // Token generieren (würde normalerweise mit JWT o.ä. implementiert)
  const token: string = jwt.sign(
    { email, type, purpose: 'unsubscribe' },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '30d' }
  );

  return `${process.env.APP_URL || 'https://app.assixx.de'}/unsubscribe?token=${token}`;
}

// ES module exports
export {
  initializeTransporter,
  sendEmail,
  sendNewDocumentNotification,
  sendWelcomeEmail,
  sendBulkNotification,
  addToQueue,
  processQueue,
  generateUnsubscribeLink,
};

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
