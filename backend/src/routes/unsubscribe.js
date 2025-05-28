/**
 * Routen für die Abmeldung von E-Mail-Benachrichtigungen
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { logger } = require('../utils/logger');
const router = express.Router();

/**
 * GET /unsubscribe
 * Verarbeitet Abmeldungen von E-Mail-Benachrichtigungen
 */
router.get('/', async (req, res) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Fehler - Ungültiger Link</title>
            <style>
              body { font-family: 'Ubuntu', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
              .error { color: #d32f2f; }
              .container { background-color: #f5f5f5; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">Ungültiger Link</h1>
              <p>Der Abmeldelink ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.</p>
              <p><a href="/">Zurück zur Startseite</a></p>
            </div>
          </body>
        </html>
      `);
    }

    // Token verifizieren
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default-secret'
    );

    if (
      !decoded.email ||
      !decoded.purpose ||
      decoded.purpose !== 'unsubscribe'
    ) {
      throw new Error('Ungültiger Token');
    }

    // Benutzer finden
    const user = await User.findByEmail(decoded.email);

    if (!user) {
      throw new Error('Benutzer nicht gefunden');
    }

    // Bestimmte oder alle Benachrichtigungen deaktivieren
    const notificationType = decoded.type || 'all';
    let notificationSettings = user.notification_settings
      ? JSON.parse(user.notification_settings)
      : {};

    if (notificationType === 'all') {
      notificationSettings = { ...notificationSettings, enabled: false };
    } else {
      notificationSettings = {
        ...notificationSettings,
        categories: {
          ...(notificationSettings.categories || {}),
          [notificationType]: false,
        },
      };
    }

    // Einstellungen speichern
    await User.update(user.id, {
      notification_settings: JSON.stringify(notificationSettings),
    });

    logger.info(
      `Benutzer ${user.email} hat sich von ${notificationType === 'all' ? 'allen Benachrichtigungen' : `${notificationType}-Benachrichtigungen`} abgemeldet`
    );

    // Erfolgsseite anzeigen
    res.send(`
      <html>
        <head>
          <title>Erfolgreich abgemeldet</title>
          <style>
            body { font-family: 'Ubuntu', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
            .success { color: #43a047; }
            .container { background-color: #f5f5f5; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">Erfolgreich abgemeldet</h1>
            <p>Sie haben sich erfolgreich von ${notificationType === 'all' ? 'allen E-Mail-Benachrichtigungen' : `${notificationType}-Benachrichtigungen`} abgemeldet.</p>
            <p>Sie können Ihre Einstellungen jederzeit in Ihrem Profil ändern.</p>
            <p><a href="/login.html">Zum Login</a></p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error(
      `Fehler bei der Abmeldung von Benachrichtigungen: ${error.message}`
    );

    res.status(400).send(`
      <html>
        <head>
          <title>Fehler - Abmeldung fehlgeschlagen</title>
          <style>
            body { font-family: 'Ubuntu', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
            .error { color: #d32f2f; }
            .container { background-color: #f5f5f5; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Abmeldung fehlgeschlagen</h1>
            <p>Bei der Abmeldung ist ein Fehler aufgetreten. Der Link ist möglicherweise ungültig oder abgelaufen.</p>
            <p><a href="/">Zurück zur Startseite</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;
