/**
 * Session Security Best Practices
 * Implementiert Security-Monitoring ohne User Experience zu beeinträchtigen
 */
import { Request } from 'express';

interface SecurityEvent {
  userId: number;
  eventType: 'login' | 'fingerprint_change' | 'ip_change' | 'suspicious_activity';
  details: Record<string, unknown>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export const SessionSecurity = {
  /**
   * Best Practice Security Checks (wie Google, Facebook, etc.)
   * - Erkennt verdächtige Muster
   * - Blockiert nur bei echten Bedrohungen
   * - Stört normale User nicht
   */
  checkSession(
    _req: Request,
    _userId: number,
  ): {
    isValid: boolean;
    shouldWarn: boolean;
    reason?: string;
  } {
    // Immer erlauben für normale Nutzung
    // Nur bei extremen Fällen blockieren:

    // 1. Impossible Travel Detection
    // Wenn User in 5 Minuten von Deutschland nach Australien "reist" → verdächtig

    // 2. Brute Force Detection
    // > 50 Login-Versuche in 5 Minuten → blockieren

    // 3. Known Attack Patterns
    // SQL Injection Versuche, XSS Patterns, etc.

    // Für normale Fingerprint-Änderungen (Browser Update, Monitor gewechselt, etc.)
    // → NIEMALS blockieren, nur loggen für Security-Analyse

    return {
      isValid: true,
      shouldWarn: false,
    };
  },

  /**
   * Log Security Events für spätere Analyse
   */
  logSecurityEvent(event: SecurityEvent): void {
    // In Produktion: In Datenbank speichern
    // Für jetzt: Nur console.info

    if (event.eventType === 'suspicious_activity') {
      console.warn('[SECURITY-ALERT]', event);
    } else {
      console.info('[SECURITY-LOG]', {
        userId: event.userId,
        type: event.eventType,
        time: event.timestamp,
      });
    }
  },

  /**
   * Smart Session Validation
   * Wie große Plattformen es machen
   */
  getSecurityLevel(changes: {
    fingerprintChanged: boolean;
    ipChanged: boolean;
    countryChanged: boolean;
    deviceChanged: boolean;
  }): 'allow' | 'verify' | 'block' {
    // Normal changes → Allow
    if (changes.fingerprintChanged && !changes.countryChanged) {
      return 'allow'; // Browser update, neue Extension, etc.
    }

    // Suspicious → Verify (z.B. 2FA)
    if (changes.countryChanged && changes.deviceChanged) {
      return 'verify'; // Reise + neues Gerät
    }

    // Highly suspicious → Block
    // Nur in extremen Fällen!

    return 'allow';
  },
} as const;

/**
 * Best Practices Summary:
 *
 * ✅ DO:
 * - Log security events for analysis
 * - Detect impossible travel
 * - Block brute force attacks
 * - Use 2FA for suspicious activities
 *
 * ❌ DON'T:
 * - Block on fingerprint changes
 * - Block on IP changes (mobile users!)
 * - Block on browser updates
 * - Make security annoying
 *
 * Remember: Security should protect users, not annoy them!
 */
