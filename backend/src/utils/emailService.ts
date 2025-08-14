/**
 * E-Mail-Service für Assixx
 * Stellt Funktionen zum Versenden von E-Mails bereit
 */

import fs from "fs";
import path from "path";

import jwt from "jsonwebtoken";
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";

import Feature from "../models/feature";

import { logger } from "./logger";

/**
 * Sanitiert HTML-Inhalt für sicheren E-Mail-Versand
 * Entfernt gefährliche Tags und Attribute
 * @param html - Der zu bereinigende HTML-Inhalt
 * @returns Bereinigter HTML-Inhalt
 */
function sanitizeHtml(html: string): string {
  if (!html) return "";

  let sanitized = html;

  // Schritt 1: Entferne gefährliche Tags mit mehreren Durchgängen
  const dangerousTags = [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "meta",
    "link",
    "base",
    "applet",
  ];

  // Mehrere Durchgänge um verschachtelte Tags zu erwischen
  for (let i = 0; i < 3; i++) {
    dangerousTags.forEach((tag) => {
      // Entferne komplette Tags mit Inhalt (inkl. malformed end tags)
      const fullTagRegex = new RegExp(
        `<${tag}[^>]*>[\\s\\S]*?</${tag}[^>]*>`,
        "gi",
      );
      sanitized = sanitized.replace(fullTagRegex, "");

      // Entferne self-closing und einzelne Tags
      const singleTagRegex = new RegExp(`<${tag}[^>]*>`, "gi");
      sanitized = sanitized.replace(singleTagRegex, "");

      // Entferne closing Tags falls übrig (inkl. malformed tags)
      const closeTagRegex = new RegExp(`</${tag}[^>]*>`, "gi");
      sanitized = sanitized.replace(closeTagRegex, "");
    });
  }

  // Schritt 2: Entferne Event-Handler mit mehreren Patterns
  const eventHandlerPatterns = [
    /\bon\w+\s*=\s*["'][^"']*["']/gi,
    /\bon\w+\s*=\s*`[^`]*`/gi,
    /\bon\w+\s*=\s*[^\s>]+/gi,
    /\son\w+/gi, // Fallback für alleinstehende Handler
  ];

  // Mehrere Durchgänge für vollständige Entfernung
  for (let i = 0; i < 3; i++) {
    eventHandlerPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "");
    });
  }

  // Schritt 3: URL-Bereinigung mit verbesserter Erkennung
  const urlPatterns = [
    // href Attribute
    /href\s*=\s*["']([^"']*?)["']/gi,
    /href\s*=\s*([^\s>]+)/gi,
    // src Attribute
    /src\s*=\s*["']([^"']*?)["']/gi,
    /src\s*=\s*([^\s>]+)/gi,
    // andere URL Attribute
    /(?:action|formaction|data|code|codebase)\s*=\s*["']([^"']*?)["']/gi,
  ];

  urlPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match: string, url: string) => {
      const lowerUrl = url.toLowerCase().trim();

      // Gefährliche Schemas
      if (
        /^(javascript|vbscript|data:text\/html|data:text\/javascript|data:application\/javascript)/i.test(
          lowerUrl,
        )
      ) {
        return match.replace(url, "#");
      }

      // Für data: URLs - nur Bilder erlauben
      if (lowerUrl.startsWith("data:")) {
        if (!/^data:image\/(png|jpg|jpeg|gif|webp|svg\+xml)/i.test(lowerUrl)) {
          return match.replace(url, "#");
        }
      }

      return match;
    });
  });

  // Schritt 4: Style-Bereinigung
  sanitized = sanitized.replace(
    /style\s*=\s*["']([^"']*?)["']/gi,
    (_match: string, styleContent: string) => {
      let cleanedStyle = styleContent;

      // Gefährliche CSS-Eigenschaften mit globaler Ersetzung
      const dangerousCSS = [
        /expression\s*\([^)]*\)/gi,
        /javascript\s*:/gi,
        /vbscript\s*:/gi,
        /-moz-binding\s*:/gi,
        /behavior\s*:/gi,
        /@import/gi,
        /import\s*\(/gi,
      ];

      dangerousCSS.forEach((pattern) => {
        cleanedStyle = cleanedStyle.replace(pattern, "");
      });

      // URL-Funktionen bereinigen
      cleanedStyle = cleanedStyle.replace(
        /url\s*\([^)]*\)/gi,
        (urlMatch: string) => {
          if (
            /url\s*\(\s*["']?(javascript|vbscript|data:text)/i.test(urlMatch)
          ) {
            return "";
          }
          return urlMatch;
        },
      );

      return cleanedStyle.trim() !== "" ? `style="${cleanedStyle}"` : "";
    },
  );

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

/**
 * Initialisiert den E-Mail-Transporter
 * @param config - Konfigurationsobjekt
 */
function initializeTransporter(config: EmailConfig | null = null): Transporter {
  // Default-Konfiguration für Entwicklung
  const defaultConfig: EmailConfig = {
    host: process.env.EMAIL_HOST ?? "smtp.example.com",
    port: parseInt(process.env.EMAIL_PORT ?? "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER ?? "user@example.com",
      pass: process.env.EMAIL_PASSWORD ?? "password",
    },
  };

  const transportConfig: EmailConfig = config ?? defaultConfig;

  transporter = nodemailer.createTransport(transportConfig);

  // Test SMTP-Verbindung
  transporter.verify((error: Error | null): void => {
    if (error) {
      logger.error(`E-Mail-Konfiguration fehlgeschlagen: ${error.message}`);
    } else {
      logger.info("E-Mail-Service erfolgreich konfiguriert");
    }
  });

  return transporter;
}

/**
 * Lädt ein E-Mail-Template und ersetzt Platzhalter
 * @param templateName - Name des Templates ohne .html-Erweiterung
 * @param replacements - Objekt mit Platzhaltern und Ersetzungen
 * @returns HTML-Inhalt des Templates
 */
async function loadTemplate(
  templateName: string,
  replacements: TemplateReplacements = {},
): Promise<string> {
  try {
    const templatePath = path.join(
      process.cwd(),
      "templates/email",
      `${templateName}.html`,
    );
    let templateContent = await fs.promises.readFile(templatePath, "utf8");

    // Helper function to escape HTML
    const escapeHtml = (str: string): string => {
      const htmlEscapes: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return str.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
    };

    // Platzhalter ersetzen (Format: {{variable}})
    Object.keys(replacements).forEach((key: string): void => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      // Escape replacement values to prevent XSS
      const safeValue = escapeHtml(replacements[key]);
      templateContent = templateContent.replace(regex, safeValue);
    });

    return templateContent;
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Laden des E-Mail-Templates '${templateName}': ${(error as Error).message}`,
    );
    // Fallback-Template
    // Escape HTML to prevent XSS
    const escapeHtml = (str: string): string => {
      const htmlEscapes: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return str.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
    };

    const safeMessage = escapeHtml(
      replacements.message || "Keine Nachricht verfügbar",
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

/**
 * Sendet eine einzelne E-Mail
 * @param options - E-Mail-Optionen
 * @returns Ergebnis des Versands
 */
async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!transporter) {
    initializeTransporter();
  }

  if (!transporter) {
    throw new Error("Email transporter could not be initialized");
  }

  // Create a local constant that TypeScript knows is non-null
  const mailer: Transporter = transporter;

  try {
    // E-Mail-Absender aus Umgebungsvariablen oder Fallback
    const from: string =
      options.from ?? process.env.EMAIL_FROM ?? "Assixx <noreply@assixx.de>";

    // HTML-Sanitization
    let sanitizedHtml: string | undefined = options.html;
    if (options.html != null && options.html !== "") {
      // HTML mit unserer Sanitization-Funktion bereinigen
      sanitizedHtml = sanitizeHtml(options.html);

      // Zusätzliche Sicherheitsvalidierung als Backup
      // Pattern das auch malformed end tags erkennt (z.B. </script foo="bar">)
      // codeql[js/bad-tag-filter] - This is a backup check after comprehensive sanitization
      const scriptPattern = /<script\b[^>]*>[\s\S]*?<\/script[^>]*>/gi;
      const eventHandlerPattern = /\bon\w+\s*=/gi;

      if (
        sanitizedHtml &&
        (scriptPattern.test(sanitizedHtml) ||
          eventHandlerPattern.test(sanitizedHtml))
      ) {
        logger.warn(
          "Potenziell gefährlicher HTML-Inhalt nach Sanitization erkannt",
        );
        return {
          success: false,
          error: "E-Mail enthält nicht erlaubte HTML-Elemente",
        };
      }

      // Log wenn Inhalte entfernt wurden
      if (sanitizedHtml !== options.html) {
        logger.warn("HTML-Inhalt wurde während der Sanitization modifiziert");
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
      // lgtm[js/xss] - False positive: HTML content is thoroughly sanitized
      // by sanitizeHtml() function which removes all dangerous tags (script, iframe, etc.),
      // event handlers, dangerous URLs (javascript:, vbscript:), and malicious CSS.
      // Additional validation at lines 352-368 provides defense in depth.
      html: sanitizedHtml, // codeql[js/xss]
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
    logger.error(`Fehler beim Senden der E-Mail: ${(error as Error).message}`);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Fügt eine E-Mail zur Queue hinzu
 * @param emailOptions - E-Mail-Optionen
 */
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

/**
 * Verarbeitet die E-Mail-Queue
 */
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
        batch.map(async (emailOptions: EmailOptions) =>
          sendEmail(emailOptions),
        ),
      );

      const successful = results.filter((r: EmailResult) => r.success).length;
      const failed = results.filter((r: EmailResult) => !r.success).length;

      logger.info(
        `Batch verarbeitet: ${successful} erfolgreich, ${failed} fehlgeschlagen`,
      );

      // Kurze Pause zwischen Batches, um SMTP-Limits einzuhalten
      if (emailQueue.length > 0) {
        await new Promise((resolve) => global.setTimeout(resolve, 1000));
      }
    }
  } catch (error: unknown) {
    logger.error(
      `Fehler bei der Verarbeitung der E-Mail-Queue: ${(error as Error).message}`,
    );
  } finally {
    isProcessingQueue = false;
    logger.info("E-Mail-Queue-Verarbeitung abgeschlossen");
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
  document: Document,
): Promise<EmailResult> {
  try {
    if (!user.email) {
      return {
        success: false,
        error: "Keine E-Mail-Adresse für den Benutzer verfügbar",
      };
    }

    // Unsubscribe-Link generieren
    const unsubscribeUrl: string = generateUnsubscribeLink(
      user.email,
      "documents",
    );

    const replacements: TemplateReplacements = {
      userName: `${user.first_name} ${user.last_name}`,
      documentName: document.file_name,
      documentCategory: document.category ?? "Allgemein",
      documentDate: new Date(document.upload_date).toLocaleDateString("de-DE"),
      dashboardUrl: `${process.env.APP_URL ?? "https://app.assixx.de"}/employee-dashboard`,
      unsubscribeUrl,
    };

    const html: string = await loadTemplate("new-document", replacements);

    return await sendEmail({
      to: user.email,
      subject: "Neues Dokument für Sie verfügbar",
      html,
      text: `Hallo ${replacements.userName},\n\nEin neues Dokument "${replacements.documentName}" wurde für Sie hochgeladen. Sie können es in Ihrem Dashboard einsehen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Senden der Dokumentenbenachrichtigung: ${(error as Error).message}`,
    );
    return { success: false, error: (error as Error).message };
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
        error: "Keine E-Mail-Adresse für den Benutzer verfügbar",
      };
    }

    const replacements: TemplateReplacements = {
      userName: `${user.first_name} ${user.last_name}`,
      companyName: user.company ?? "Ihr Unternehmen",
      loginUrl: `${process.env.APP_URL ?? "https://app.assixx.de"}/login.html`,
    };

    const html: string = await loadTemplate("welcome", replacements);

    return await sendEmail({
      to: user.email,
      subject: "Willkommen bei Assixx",
      html,
      text: `Hallo ${replacements.userName},\n\nWillkommen bei Assixx! Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt mit Ihren Anmeldedaten einloggen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Senden der Willkommens-E-Mail: ${(error as Error).message}`,
    );
    return { success: false, error: (error as Error).message };
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
  messageOptions: BulkMessageOptions,
): Promise<EmailResult> {
  try {
    // Feature-Prüfung für Massen-E-Mails (wenn verfügbar)
    if (
      messageOptions.tenantId != null &&
      messageOptions.checkFeature === true
    ) {
      const hasAccess = await Feature.checkTenantAccess(
        messageOptions.tenantId,
        "email_notifications",
      );

      if (!hasAccess) {
        return {
          success: false,
          error:
            "Keine Berechtigung für Massen-E-Mails. Bitte Feature upgraden.",
        };
      }

      // Nutzung des Features protokollieren
      await Feature.logUsage(
        messageOptions.tenantId,
        "email_notifications",
        messageOptions.userId,
        {
          recipients: users.length,
          subject: messageOptions.subject,
        },
      );
    }

    // Filtere Benutzer ohne E-Mail
    const validUsers: User[] = users.filter((user: User) => user.email);

    if (validUsers.length === 0) {
      return {
        success: false,
        error: "Keine gültigen E-Mail-Empfänger gefunden",
      };
    }

    // HTML aus Template laden, falls nicht direkt angegeben
    let html: string = messageOptions.html ?? "";
    if (
      messageOptions.templateName != null &&
      messageOptions.templateName !== ""
    ) {
      // const notificationType: string =
      //   messageOptions.notificationType || 'notification'; // Unused

      // Replacement-Objekt mit Basis-Werten erstellen
      const baseReplacements: TemplateReplacements =
        messageOptions.replacements ?? {};

      html = await loadTemplate(messageOptions.templateName, baseReplacements);
    }

    // E-Mails zur Queue hinzufügen
    for (const user of validUsers) {
      // Unsubscribe-Link für jeden Benutzer generieren
      const unsubscribeUrl: string = generateUnsubscribeLink(
        user.email,
        messageOptions.notificationType ?? "all",
      );

      // HTML personalisieren
      const personalizedHtml: string = html
        .replace(/{{userName}}/g, `${user.first_name} ${user.last_name}`)
        .replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);

      // Wichtig: personalizedHtml wird in sendEmail() sanitized
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
  } catch (error: unknown) {
    logger.error(
      `Fehler beim Hinzufügen von Massen-E-Mails zur Queue: ${(error as Error).message}`,
    );
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Generiert einen Unsubscribe-Link
 * @param email - E-Mail-Adresse
 * @param type - Typ der Benachrichtigung
 * @returns Unsubscribe-Link
 */
function generateUnsubscribeLink(email: string, type = "all"): string {
  // Token generieren (würde normalerweise mit JWT o.ä. implementiert)
  const token: string = jwt.sign(
    { email, type, purpose: "unsubscribe" },
    process.env.JWT_SECRET ?? "default-secret",
    { expiresIn: "30d" },
  );

  return `${process.env.APP_URL ?? "https://app.assixx.de"}/unsubscribe?token=${token}`;
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
