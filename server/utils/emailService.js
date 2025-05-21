/**
 * E-Mail-Service für Assixx
 * Stellt Funktionen zum Versenden von E-Mails bereit
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Queue für Massen-E-Mails
const emailQueue = [];
let isProcessingQueue = false;
const MAX_EMAILS_PER_BATCH = 50; // Maximale Anzahl von E-Mails pro Batch

// Konfiguration des Transport-Objekts (wird später aus .env geladen)
let transporter;

/**
 * Initialisiert den E-Mail-Transporter
 * @param {Object} config - Konfigurationsobjekt
 */
function initializeTransporter(config = null) {
  // Default-Konfiguration für Entwicklung
  const defaultConfig = {
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'user@example.com',
      pass: process.env.EMAIL_PASSWORD || 'password'
    }
  };

  const transportConfig = config || defaultConfig;
  
  transporter = nodemailer.createTransport(transportConfig);
  
  // Test SMTP-Verbindung
  transporter.verify((error) => {
    if (error) {
      logger.error(`E-Mail-Konfiguration fehlgeschlagen: ${error.message}`);
    } else {
      logger.info('E-Mail-Service erfolgreich konfiguriert');
    }
  });
  
  return transporter;
}

/**
 * Lädt ein E-Mail-Template und ersetzt Platzhalter
 * @param {string} templateName - Name des Templates ohne .html-Erweiterung
 * @param {Object} replacements - Objekt mit Platzhaltern und Ersetzungen
 * @returns {Promise<string>} - HTML-Inhalt des Templates
 */
async function loadTemplate(templateName, replacements = {}) {
  try {
    const templatePath = path.join(__dirname, '../templates/email', `${templateName}.html`);
    let templateContent = await fs.promises.readFile(templatePath, 'utf8');
    
    // Platzhalter ersetzen (Format: {{variable}})
    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      templateContent = templateContent.replace(regex, replacements[key]);
    });
    
    return templateContent;
  } catch (error) {
    logger.error(`Fehler beim Laden des E-Mail-Templates '${templateName}': ${error.message}`);
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
 * @param {Object} options - E-Mail-Optionen
 * @returns {Promise<Object>} - Ergebnis des Versands
 */
async function sendEmail(options) {
  if (!transporter) {
    initializeTransporter();
  }

  try {
    // E-Mail-Absender aus Umgebungsvariablen oder Fallback
    const from = options.from || process.env.EMAIL_FROM || 'Assixx <noreply@assixx.de>';
    
    // E-Mail senden
    const info = await transporter.sendMail({
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments
    });
    
    logger.info(`E-Mail gesendet: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Fehler beim Senden der E-Mail: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fügt eine E-Mail zur Queue hinzu
 * @param {Object} emailOptions - E-Mail-Optionen
 */
function addToQueue(emailOptions) {
  emailQueue.push(emailOptions);
  logger.info(`E-Mail zur Queue hinzugefügt. Queue-Länge: ${emailQueue.length}`);
  
  // Starte die Queue-Verarbeitung, falls sie nicht bereits läuft
  if (!isProcessingQueue) {
    processQueue();
  }
}

/**
 * Verarbeitet die E-Mail-Queue
 */
async function processQueue() {
  if (isProcessingQueue || emailQueue.length === 0) {
    return;
  }
  
  isProcessingQueue = true;
  logger.info(`Starte Verarbeitung der E-Mail-Queue: ${emailQueue.length} E-Mails in der Warteschlange`);
  
  try {
    // E-Mails in Batches verarbeiten
    while (emailQueue.length > 0) {
      const batch = emailQueue.splice(0, MAX_EMAILS_PER_BATCH);
      logger.info(`Verarbeite Batch von ${batch.length} E-Mails`);
      
      // E-Mails parallel senden, aber mit Limit
      const results = await Promise.all(
        batch.map(emailOptions => sendEmail(emailOptions))
      );
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      logger.info(`Batch verarbeitet: ${successful} erfolgreich, ${failed} fehlgeschlagen`);
      
      // Kurze Pause zwischen Batches, um SMTP-Limits einzuhalten
      if (emailQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    logger.error(`Fehler bei der Verarbeitung der E-Mail-Queue: ${error.message}`);
  } finally {
    isProcessingQueue = false;
    logger.info('E-Mail-Queue-Verarbeitung abgeschlossen');
  }
}

/**
 * Sendet eine Benachrichtigung über ein neues Dokument
 * @param {Object} user - Benutzer-Objekt
 * @param {Object} document - Dokument-Objekt
 * @returns {Promise<Object>} - Ergebnis des Versands
 */
async function sendNewDocumentNotification(user, document) {
  try {
    if (!user.email) {
      return { success: false, error: 'Keine E-Mail-Adresse für den Benutzer verfügbar' };
    }
    
    const replacements = {
      userName: `${user.first_name} ${user.last_name}`,
      documentName: document.file_name,
      documentCategory: document.category || 'Allgemein',
      documentDate: new Date(document.upload_date).toLocaleDateString('de-DE'),
      dashboardUrl: `${process.env.APP_URL || 'https://app.assixx.de'}/employee-dashboard.html`
    };
    
    const html = await loadTemplate('new-document', replacements);
    
    return await sendEmail({
      to: user.email,
      subject: 'Neues Dokument für Sie verfügbar',
      html,
      text: `Hallo ${replacements.userName},\n\nEin neues Dokument "${replacements.documentName}" wurde für Sie hochgeladen. Sie können es in Ihrem Dashboard einsehen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`
    });
  } catch (error) {
    logger.error(`Fehler beim Senden der Dokumentenbenachrichtigung: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Sendet eine Willkommensnachricht an einen neuen Benutzer
 * @param {Object} user - Benutzer-Objekt
 * @returns {Promise<Object>} - Ergebnis des Versands
 */
async function sendWelcomeEmail(user) {
  try {
    if (!user.email) {
      return { success: false, error: 'Keine E-Mail-Adresse für den Benutzer verfügbar' };
    }
    
    const replacements = {
      userName: `${user.first_name} ${user.last_name}`,
      companyName: user.company || 'Ihr Unternehmen',
      loginUrl: `${process.env.APP_URL || 'https://app.assixx.de'}/login.html`
    };
    
    const html = await loadTemplate('welcome', replacements);
    
    return await sendEmail({
      to: user.email,
      subject: 'Willkommen bei Assixx',
      html,
      text: `Hallo ${replacements.userName},\n\nWillkommen bei Assixx! Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt mit Ihren Anmeldedaten einloggen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`
    });
  } catch (error) {
    logger.error(`Fehler beim Senden der Willkommens-E-Mail: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Sendet eine Massenbenachrichtigung an mehrere Benutzer
 * @param {Array} users - Array von Benutzer-Objekten
 * @param {Object} messageOptions - Optionen für die Nachricht
 * @returns {Promise<Object>} - Ergebnis des Versands
 */
async function sendBulkNotification(users, messageOptions) {
  try {
    // Feature-Prüfung für Massen-E-Mails (wenn verfügbar)
    if (messageOptions.tenantId && messageOptions.checkFeature) {
      const Feature = require('../models/feature');
      const hasAccess = await Feature.checkTenantAccess(messageOptions.tenantId, 'email_notifications');
      
      if (!hasAccess) {
        return { success: false, error: 'Keine Berechtigung für Massen-E-Mails. Bitte Feature upgraden.' };
      }
      
      // Nutzung des Features protokollieren
      await Feature.logUsage(messageOptions.tenantId, 'email_notifications', messageOptions.userId, {
        recipients: users.length,
        subject: messageOptions.subject
      });
    }
    
    // Filtere Benutzer ohne E-Mail
    const validUsers = users.filter(user => user.email);
    
    if (validUsers.length === 0) {
      return { success: false, error: 'Keine gültigen E-Mail-Empfänger gefunden' };
    }
    
    // HTML aus Template laden, falls nicht direkt angegeben
    let html = messageOptions.html;
    if (messageOptions.templateName) {
      html = await loadTemplate(messageOptions.templateName, messageOptions.replacements || {});
    }
    
    // E-Mails zur Queue hinzufügen
    for (const user of validUsers) {
      const personalizedHtml = html.replace(/{{userName}}/g, `${user.first_name} ${user.last_name}`);
      
      addToQueue({
        to: user.email,
        subject: messageOptions.subject,
        html: personalizedHtml,
        text: messageOptions.text,
        attachments: messageOptions.attachments
      });
    }
    
    return { 
      success: true, 
      message: `${validUsers.length} E-Mails zur Versandwarteschlange hinzugefügt` 
    };
  } catch (error) {
    logger.error(`Fehler beim Hinzufügen von Massen-E-Mails zur Queue: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Generiert einen Unsubscribe-Link
 * @param {string} email - E-Mail-Adresse
 * @param {string} type - Typ der Benachrichtigung
 * @returns {string} - Unsubscribe-Link
 */
function generateUnsubscribeLink(email, type = 'all') {
  // Token generieren (würde normalerweise mit JWT o.ä. implementiert)
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { email, type, purpose: 'unsubscribe' },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '30d' }
  );
  
  return `${process.env.APP_URL || 'https://app.assixx.de'}/unsubscribe?token=${token}`;
}

module.exports = {
  initializeTransporter,
  sendEmail,
  sendNewDocumentNotification,
  sendWelcomeEmail,
  sendBulkNotification,
  addToQueue,
  processQueue,
  generateUnsubscribeLink
};