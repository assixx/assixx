/**
 * Beispielskript zum Versenden von Massen-E-Mails
 *
 * Dieses Skript demonstriert die Verwendung des E-Mail-Systems für Massen-E-Mails
 * Es kann als Vorlage für verschiedene E-Mail-Kampagnen verwendet werden.
 *
 * Nutzung:
 * node scripts/send-bulk-email.js --department=1 --template=notification --subject="Wichtige Mitteilung"
 */

require("dotenv").config();
const emailService = require("../utils/emailService");
const User = require("../models/user");
const Feature = require("../models/feature");
const logger = require("../utils/logger");
const db = require("../database");

// Kommandozeilenargumente parsen
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  acc[key] = value;
  return acc;
}, {});

// Email-Konfiguration aus .env laden
const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
};

// Hauptfunktion
async function sendBulkEmails() {
  try {
    // SMTP-Transporter initialisieren
    emailService.initializeTransporter(emailConfig);
    logger.info("E-Mail-Transporter initialisiert");

    // Parameter für die E-Mail-Kampagne
    const departmentId = args.department || null;
    const template = args.template || "notification";
    const subject = args.subject || "Wichtige Mitteilung von Assixx";
    const message =
      args.message || "Dies ist eine wichtige Mitteilung für alle Mitarbeiter.";
    const tenantId = args.tenant || 1;

    // Feature-Prüfung
    const hasEmailFeature = await Feature.checkTenantAccess(
      tenantId,
      "email_notifications",
    );
    if (!hasEmailFeature) {
      logger.error(
        `Tenant ${tenantId} hat keine Berechtigung für E-Mail-Benachrichtigungen.`,
      );
      process.exit(1);
    }

    // Parameter für die Benutzersuche
    const filters = {
      role: "employee",
      is_archived: false,
    };

    // Benutzer aus einer bestimmten Abteilung filtern, falls angegeben
    if (departmentId) {
      filters.department_id = departmentId;
    }

    // Benutzer abrufen
    const users = await User.search(filters);
    logger.info(`${users.length} Benutzer gefunden für E-Mail-Versand`);

    if (users.length === 0) {
      logger.warn(
        "Keine Benutzer gefunden, die den Filterkriterien entsprechen",
      );
      process.exit(0);
    }

    // E-Mail-Optionen vorbereiten
    const messageOptions = {
      tenantId,
      subject,
      templateName: template,
      replacements: {
        message,
        subject,
        actionUrl: process.env.APP_URL || "https://app.assixx.de",
        actionText: "Zur Plattform",
      },
      checkFeature: true,
      userId: 1, // Admin/System-ID
    };

    // E-Mails senden
    const result = await emailService.sendBulkNotification(
      users,
      messageOptions,
    );

    if (result.success) {
      logger.info(result.message);

      // Da die E-Mails in einer Queue verarbeitet werden, starten wir die Verarbeitung manuell
      await emailService.processQueue();

      logger.info("E-Mail-Queue erfolgreich verarbeitet");
    } else {
      logger.error("Fehler beim Senden der E-Mails:", result.error);
    }

    // Feature-Nutzung protokollieren
    await Feature.logUsage(tenantId, "email_notifications", 1, {
      recipients: users.length,
      subject,
      template,
    });

    // Verbindung schließen
    await db.end();
    logger.info("Skript erfolgreich abgeschlossen");
  } catch (error) {
    logger.error("Fehler beim Ausführen des Skripts:", error);
    process.exit(1);
  }
}

// Skript starten
sendBulkEmails();
