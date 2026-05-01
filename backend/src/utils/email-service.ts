/**
 * Email service for Assixx.
 * Provides functions for sending emails.
 */
import fs from 'fs';
import jwt from 'jsonwebtoken';
import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import path from 'path';
import sanitizeHtmlLib, { type IOptions } from 'sanitize-html';

import { getErrorMessage } from '../nest/common/utils/error.utils.js';
import {
  type TwoFactorCodeTemplatePurpose,
  build2faCodeTemplate,
} from './email-templates/2fa-code.template.js';
import { build2faSuspiciousActivityTemplate } from './email-templates/2fa-suspicious-activity.template.js';
import { logger } from './logger.js';

// Type definition for attachment (from nodemailer)
interface Attachment {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  cid?: string;
}

/**
 * Allow-list config for outgoing transactional/bulk emails.
 *
 * Why default-deny via `sanitize-html` instead of the previous regex deny-list?
 * The old custom sanitizer was documented in this very file as "may be
 * bypassable with clever encoding". `sanitize-html` (htmlparser2-based)
 * eliminates the entire class of bypass risks (nested attacks, encoded
 * entities, malformed tags) by parsing real HTML and only re-emitting
 * tags/attributes that are explicitly listed.
 *
 * Scope: full HTML email documents — skeleton (html/head/body), styling
 * (style block, inline style attribute, meta charset/viewport/color-scheme),
 * email-typical layout (tables) and inline content (links, images).
 * Outlook MSO-conditional comments (`<!--[if mso]>...<![endif]-->`) are
 * stripped by sanitize-html (which removes ALL comments and offers no
 * preserve option) — see `sanitizeHtml()` below for the extract / restore
 * workaround used by listmonk and posthtml-mso.
 *
 * Inline-style sanitization is delegated to `sanitizeStyleContent()` rather
 * than `sanitize-html`'s `allowedStyles` because allowedStyles requires a
 * per-property regex allow-list — too restrictive for the legitimate Email
 * CSS we use (`mso-line-height-rule`, `-webkit-text-size-adjust`, etc.).
 * We only need to strip the documented CSS-injection vectors, which
 * `sanitizeStyleContent()` already does.
 */
const SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    // Document skeleton
    'html',
    'head',
    'body',
    'title',
    'meta',
    'style',
    // Block-level layout
    'div',
    'span',
    'p',
    'br',
    'hr',
    'center',
    // Tables (Email-layout standard)
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Inline text
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'small',
    'sub',
    'sup',
    'code',
    'pre',
    'blockquote',
    'abbr',
    'cite',
    'q',
    // Lists
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    // Inline media + links
    'a',
    'img',
    'font',
    // No-JS fallback — harmless, used inside Outlook MSO blocks
    'noscript',
  ],
  allowedAttributes: {
    // Universal layout / a11y attributes — usable on any allowed tag
    '*': [
      'class',
      'id',
      'style',
      'lang',
      'dir',
      'role',
      'align',
      'valign',
      'bgcolor',
      'width',
      'height',
      'aria-label',
      'aria-hidden',
      'aria-describedby',
    ],
    // <html>: xmlns + Outlook namespace declarations (xmlns:v / xmlns:o /
    // xmlns:w) are required for VML-button rendering in Outlook desktop.
    // Without them the inline namespace declarations inside <v:roundrect>
    // still work — but having them on <html> is the cross-client best
    // practice and is present in our existing templates.
    html: ['lang', 'xmlns', 'xmlns:v', 'xmlns:o', 'xmlns:w', 'xmlns:x'],
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'border'],
    table: ['cellpadding', 'cellspacing', 'border'],
    td: ['colspan', 'rowspan', 'scope'],
    th: ['colspan', 'rowspan', 'scope'],
    font: ['color', 'face', 'size'],
    // <meta>: explicitly NO `http-equiv` — phishing vector (refresh-redirect,
    // set-cookie, CSP bypass). `charset` / `name` / `content` are harmless.
    meta: ['charset', 'name', 'content'],
    // <style>: only `type` (e.g. `type="text/css"`)
    style: ['type'],
  },
  // URL schemes accepted in href / src / cite. `cid` is required for the
  // inline-attached branding logo (Nodemailer CID-attachment).
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cid'],
  // <img src="data:image/..."> is OK (inline images), but data: URLs are
  // NOT allowed in <a href> (phishing vector via data:text/html).
  allowedSchemesByTag: {
    img: ['http', 'https', 'cid', 'data'],
  },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  // <style> blocks are needed for media queries + dark-mode CSS. The library
  // emits a "vulnerable tag" warning unless this is set; we acknowledge:
  // <style> is required AND its body is filtered separately for CSS-injection
  // patterns (see sanitizeStyleContent).
  allowVulnerableTags: true,
  // Skip sanitize-html's built-in inline-style filter — see file-level
  // comment above. We run sanitizeStyleContent() over inline styles
  // post-pass so legitimate Email CSS (mso-*, -webkit-*) is preserved while
  // still stripping expression() / behavior: / javascript:.
  parseStyleAttributes: false,
};

/**
 * Strips dangerous CSS from inline `style` attributes.
 *
 * BUG-HISTORY (2026-04-29): the previous regex `style\s*=\s*["']([^"']*)["']`
 * was buggy — its `[^"']` character class forbids BOTH quote types inside
 * the value. For an attribute like `style="font-family: 'Segoe UI', ..."`
 * (a perfectly normal CSS value), the regex matched up to the first `'` of
 * the inner quoted font name, then "closed" the style with a synthesised
 * `"`, leaving the rest of the original value as garbage outside the
 * attribute. Symptom: `style="display: inline-block; font-family: "` —
 * font-size / font-weight / letter-spacing dropped → tokens rendered in
 * UA-default size. Affected every transactional mail with a quoted font
 * name in inline styles (FEAT_2FA_EMAIL §2.9b token, password-reset H1/P).
 *
 * Fix: process double-quoted and single-quoted style attributes in
 * separate passes, each using `[^X]*` where X is the OUTER quote — so the
 * other quote type is allowed inside the value.
 */
function sanitizeStyleContent(styleContent: string): string {
  let cleaned = styleContent;
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
    cleaned = cleaned.replace(pattern, '');
  });
  cleaned = cleaned.replace(/url\s*\([^)]*\)/gi, (urlMatch: string) => {
    if (/url\s*\(\s*["']?(javascript|vbscript|data:text)/i.test(urlMatch)) {
      return '';
    }
    return urlMatch;
  });
  return cleaned;
}

function sanitizeStyles(html: string): string {
  // Pass 1: double-quoted style="..." (the common case in our templates).
  // `[^"]*` allows ANY char except `"` inside — so single quotes for nested
  // CSS string literals like 'Segoe UI' survive.
  let result = html.replace(/style\s*=\s*"([^"]*)"/gi, (_match: string, content: string) => {
    const cleaned = sanitizeStyleContent(content);
    return cleaned.trim() !== '' ? `style="${cleaned}"` : '';
  });
  // Pass 2: single-quoted style='...' (rare but valid). Mirror logic.
  result = result.replace(/style\s*=\s*'([^']*)'/gi, (_match: string, content: string) => {
    const cleaned = sanitizeStyleContent(content);
    return cleaned.trim() !== '' ? `style='${cleaned}'` : '';
  });
  return result;
}

// Exported for unit-testing — see email-service.test.ts. Internal use only.
// `_sanitizeStylesForTest`: legacy regression-test entry point for the
//   FEAT_2FA_EMAIL §2.9b quote-handling bug fix in inline `style="..."`.
// `_sanitizeHtmlForTest`: end-to-end pipeline (sanitize-html allow-list +
//   MSO-conditional preserve + inline + <style>-block CSS strip) — added
//   2026-04-30 with the regex→sanitize-html refactor.
export { sanitizeStyles as _sanitizeStylesForTest, sanitizeHtml as _sanitizeHtmlForTest };

/**
 * Sanitizes HTML for outgoing email delivery via a 5-step pipeline.
 *
 * Why not just `sanitize-html` end-to-end?
 *   - sanitize-html strips ALL HTML comments by design (no preserve option).
 *     Outlook MSO-conditionals (`<!--[if mso]>...<![endif]-->`) carry the
 *     VML buttons + Office-XML rendering hints. Without them, Outlook
 *     buttons break. Workaround: extract → sanitize → restore.
 *   - sanitize-html's `allowedStyles` requires a per-property regex
 *     allow-list — too restrictive for legitimate Email CSS (mso-*,
 *     -webkit-*). We delegate inline-style + <style>-block CSS sanitization
 *     to `sanitizeStyleContent()` which only strips the documented
 *     CSS-injection vectors (expression / behavior / javascript: / @import).
 *
 * Replaces the previous regex-based custom sanitizer (documented bypass
 * risk: "may be bypassable with clever encoding"). The backup tripwire in
 * `sendEmail()` (residual <script> / on*= regex check) is kept as
 * defense-in-depth.
 *
 * Reference: same pattern as posthtml-mso, listmonk #1273.
 */
function sanitizeHtml(html: string): string {
  if (html === '') return '';

  // Step 0: extract leading <!DOCTYPE ...> if present — sanitize-html
  // drops doctype declarations unconditionally (no allow-list option),
  // but they are essential for Email rendering: without DOCTYPE Outlook,
  // Apple Mail and Gmail fall back to quirks mode → broken spacing,
  // collapsed margins, mis-aligned tables. We extract → sanitize → prepend.
  const doctypeMatch = /^\s*<!doctype[^>]*>/i.exec(html);
  const doctype = doctypeMatch !== null ? doctypeMatch[0] : '';
  let working = doctype !== '' ? html.slice(doctype.length) : html;

  // Step 1: extract MSO-conditional comments via placeholder so they
  // survive sanitize-html's comment-strip. Placeholder uses uppercase +
  // numeric ID to make collision with template content effectively
  // impossible.
  const msoComments: string[] = [];
  const PLACEHOLDER_PREFIX = '__ASSIXX_MSO_COMMENT_';
  const PLACEHOLDER_SUFFIX = '__';
  working = working.replace(/<!--\[if [\s\S]*?<!\[endif\]-->/gi, (match: string): string => {
    const idx = msoComments.length;
    msoComments.push(match);
    return `${PLACEHOLDER_PREFIX}${String(idx)}${PLACEHOLDER_SUFFIX}`;
  });

  // Step 2: default-deny sanitization via allow-list.
  working = sanitizeHtmlLib(working, SANITIZE_OPTIONS);

  // Step 3: restore MSO-conditionals verbatim (extracted pre-sanitize, so
  // they cannot have been tampered with by user input).
  if (msoComments.length > 0) {
    const restoreRegex = new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`, 'g');
    working = working.replace(restoreRegex, (_match: string, idxStr: string): string => {
      const idx = Number.parseInt(idxStr, 10);
      return msoComments[idx] ?? '';
    });
  }

  // Step 4: inline-style CSS-injection strip (sanitize-html passes inline
  // styles through unchanged because parseStyleAttributes is false).
  working = sanitizeStyles(working);

  // Step 5: <style>-block CSS-injection strip — sanitize-html passes block
  // body through unchanged.
  working = working.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (match: string, content: string): string =>
      match.replace(content, sanitizeStyleContent(content)),
  );

  // Re-prepend the original DOCTYPE (extracted in Step 0).
  return (doctype + working).trim();
}

// Interfaces
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  // Optional: when omitted entirely, nodemailer connects anonymously.
  // WHY: dev-SMTP capture (Mailpit) accepts only anonymous SMTP — sending
  // `auth: { user: '', pass: '' }` makes nodemailer attempt AUTH PLAIN
  // and throw `Missing credentials for "PLAIN"`. See FEAT_2FA_EMAIL §0.5.5.
  auth?: {
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
}

type TemplateReplacements = Record<string, string>;

type QueueItem = EmailOptions;

// Queue for bulk emails
const emailQueue: QueueItem[] = [];
let isProcessingQueue = false;
const MAX_EMAILS_PER_BATCH = 50; // Maximum number of emails per batch

// Transport configuration (loaded from .env later)
let transporter: Transporter | null = null;

function initializeTransporter(config: EmailConfig | null = null): Transporter {
  const user = process.env['SMTP_USER'] ?? process.env['EMAIL_USER'] ?? '';
  const pass = process.env['SMTP_PASS'] ?? process.env['EMAIL_PASSWORD'] ?? '';
  // Tri-state credential decision (FEAT_2FA_EMAIL §0.5.5):
  //   both set     → production SMTP (real provider, AUTH required)
  //   both empty   → dev SMTP capture (Mailpit) — anonymous, omit auth block
  //   partial      → misconfiguration → warn loudly, omit auth (fail-fast in prod)
  // Nodemailer throws `Missing credentials for "PLAIN"` if `auth` is present
  // with empty strings, so we MUST omit the block (not pass empties).
  const hasFullCreds = user !== '' && pass !== '';
  const partialCreds = (user !== '') !== (pass !== '');

  const defaultConfig: EmailConfig = {
    host: process.env['SMTP_HOST'] ?? process.env['EMAIL_HOST'] ?? 'smtp.example.com',
    port: Number.parseInt(process.env['SMTP_PORT'] ?? process.env['EMAIL_PORT'] ?? '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true' || process.env['EMAIL_SECURE'] === 'true',
    ...(hasFullCreds ? { auth: { user, pass } } : {}),
  };

  if (partialCreds) {
    logger.warn(
      'SMTP_USER and SMTP_PASS must both be set or both empty — partial config detected, treating as anonymous',
    );
  } else if (!hasFullCreds) {
    logger.info('SMTP credentials empty — using anonymous SMTP (dev capture, e.g. Mailpit)');
  }

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

  return str.replace(/["&'<>]/g, (match: string) => htmlEscapes[match] ?? match);
}

// Branding logo: inlined as CID attachment so it renders in every mail client
// (no external image-blocking, no APP_URL dependency, works offline).
// Asset is the dark-mode logo resized to ~280px (retina @2x for 140px display).
const BRANDING_LOGO_CID = 'assixx-logo';
const BRANDING_LOGO_FILENAME = 'logo.png';
// Cache the Promise (not the Buffer) so the assignment is synchronous and
// concurrent callers share a single fs.readFile — no race condition.
let cachedBrandingLogo: Promise<Buffer> | null = null;

interface BrandedTemplate {
  html: string;
  attachments: Attachment[];
}

function getBrandingLogoBuffer(): Promise<Buffer> {
  if (cachedBrandingLogo !== null) return cachedBrandingLogo;
  const logoPath = path.join(process.cwd(), 'templates/email/assets/logo.png');
  const promise = fs.promises.readFile(logoPath);
  cachedBrandingLogo = promise;
  // On failure, drop the cache so the next call retries — otherwise a
  // transient FS error would permanently break logo embedding.
  promise.catch((): void => {
    cachedBrandingLogo = null;
  });
  return promise;
}

async function getBrandingLogoAttachment(): Promise<Attachment> {
  const content = await getBrandingLogoBuffer();
  return {
    filename: BRANDING_LOGO_FILENAME,
    content,
    cid: BRANDING_LOGO_CID,
    contentType: 'image/png',
  };
}

/**
 * Loads an email template and replaces placeholders.
 * @param templateName - Template name without the .html extension
 */
async function loadTemplate(
  templateName: string,
  replacements: TemplateReplacements = {},
): Promise<string> {
  try {
    const templatePath = path.join(process.cwd(), 'templates/email', `${templateName}.html`);
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
    const safeMessage = escapeHtmlTemplate(replacements['message'] ?? 'Keine Nachricht verfügbar');
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
 * Loads a template AND attaches the branding logo as a CID attachment.
 * Caller passes both `html` and `attachments` to sendEmail() — the logo
 * appears via `<img src="cid:assixx-logo">` in the template.
 */
async function loadBrandedTemplate(
  templateName: string,
  replacements: TemplateReplacements = {},
): Promise<BrandedTemplate> {
  const html = await loadTemplate(templateName, replacements);
  const logoAttachment = await getBrandingLogoAttachment();
  return { html, attachments: [logoAttachment] };
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
      options.from ??
      process.env['SMTP_FROM'] ??
      process.env['EMAIL_FROM'] ??
      'Assixx <noreply@assixx.de>';

    // HTML-Sanitization
    let sanitizedHtml: string | undefined = options.html;
    if (options.html != null && options.html !== '') {
      // Sanitize HTML via our sanitization function
      sanitizedHtml = sanitizeHtml(options.html);

      // Additional security validation as backup
      // Pattern that also catches malformed end tags (e.g. </script foo="bar">)
      // codeql[js/bad-tag-filter] - This is a backup check after comprehensive sanitization
      const scriptPattern = /<script\b[^>]*>[\s\S]*$3<\/script[^>]*>/i;
      const eventHandlerPattern = /\bon\w+\s*=/i;

      if (
        sanitizedHtml !== '' &&
        (scriptPattern.test(sanitizedHtml) || eventHandlerPattern.test(sanitizedHtml))
      ) {
        logger.warn('Potenziell gefährlicher HTML-Inhalt nach Sanitization erkannt');
        return {
          success: false,
          error: 'E-Mail enthält nicht erlaubte HTML-Elemente',
        };
      }

      // NOTE (2026-04-30): the previous "content was modified" WARN was
      // removed with the regex→sanitize-html refactor. With the old custom
      // regex sanitiser, "modified" reliably meant "danger removed" — worth
      // alerting on. With sanitize-html, "modified" almost always means
      // cosmetic normalisation (void-elements rewritten as `<br />` instead
      // of `<br>`, harmless `<meta http-equiv="X-UA-Compatible">` attribute
      // stripped, whitespace adjusted). Those events are not actionable and
      // produced log spam. The script/event-handler tripwire above is the
      // real security alert and stays. See FEAT_2FA_EMAIL refactor session.
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
  logger.info(`Email added to queue. Queue length: ${emailQueue.length}`);

  // Start queue processing if it isn't already running
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
        batch.map(async (emailOptions: EmailOptions) => await sendEmail(emailOptions)),
      );

      const successful = results.filter((r: EmailResult) => r.success).length;
      const failed = results.filter((r: EmailResult) => !r.success).length;

      logger.info(`Batch verarbeitet: ${successful} erfolgreich, ${failed} fehlgeschlagen`);

      // Kurze Pause zwischen Batches, um SMTP-Limits einzuhalten
      if (emailQueue.length > 0) {
        await new Promise<void>((resolve: () => void) => global.setTimeout(resolve, 1000));
      }
    }
  } catch (error: unknown) {
    logger.error(`Fehler bei der Verarbeitung der E-Mail-Queue: ${getErrorMessage(error)}`);
  } finally {
    isProcessingQueue = false;
    logger.info('E-Mail-Queue-Verarbeitung abgeschlossen');
  }
}

async function sendNewDocumentNotification(user: User, document: Document): Promise<EmailResult> {
  try {
    if (user.email === '') {
      return {
        success: false,
        error: 'Keine E-Mail-Adresse für den Benutzer verfügbar',
      };
    }

    // Unsubscribe-Link generieren
    const unsubscribeUrl: string = generateUnsubscribeLink(user.email, 'documents');

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

    const branded = await loadBrandedTemplate('new-document', replacements);

    return await sendEmail({
      to: user.email,
      subject: 'Neues Dokument für Sie verfügbar',
      html: branded.html,
      attachments: branded.attachments,
      text: `Hallo ${userName},\n\nEin neues Dokument "${documentName}" wurde für Sie hochgeladen. Sie können es in Ihrem Dashboard einsehen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: unknown) {
    logger.error(`Fehler beim Senden der Dokumentenbenachrichtigung: ${getErrorMessage(error)}`);
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

    const branded = await loadBrandedTemplate('welcome', replacements);

    return await sendEmail({
      to: user.email,
      subject: 'Willkommen bei Assixx',
      html: branded.html,
      attachments: branded.attachments,
      text: `Hallo ${userName},\n\nWillkommen bei Assixx! Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt mit Ihren Anmeldedaten einloggen.\n\nMit freundlichen Grüßen,\nIhr Assixx-Team`,
    });
  } catch (error: unknown) {
    logger.error(`Fehler beim Senden der Willkommens-E-Mail: ${getErrorMessage(error)}`);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Bulk email feature check — always allows access.
 * The deprecated feature-check stub was removed (ADR-033).
 * Proper addon-based gating will use AddonCheckService via NestJS DI.
 */
function checkBulkEmailFeature(
  _options: BulkMessageOptions,
  _userCount: number,
): EmailResult | null {
  return null;
}

function queueUserEmail(user: User, html: string, options: BulkMessageOptions): void {
  const unsubscribeUrl = generateUnsubscribeLink(user.email, options.notificationType ?? 'all');
  const personalizedHtml = html
    .replace(/{{userName}}/g, `${user.first_name} ${user.last_name}`)
    .replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);

  const emailOptions: EmailOptions = {
    to: user.email,
    subject: options.subject,
    html: personalizedHtml,
  };
  if (options.text !== undefined) emailOptions.text = options.text;
  if (options.attachments !== undefined) emailOptions.attachments = options.attachments;
  addToQueue(emailOptions);
}

async function sendBulkNotification(
  users: User[],
  messageOptions: BulkMessageOptions,
): Promise<EmailResult> {
  try {
    const featureError = checkBulkEmailFeature(messageOptions, users.length);
    if (featureError !== null) return featureError;

    const validUsers = users.filter((user: User) => user.email !== '');
    if (validUsers.length === 0) {
      return {
        success: false,
        error: 'Keine gültigen E-Mail-Empfänger gefunden',
      };
    }

    let html = messageOptions.html ?? '';
    if (messageOptions.templateName != null && messageOptions.templateName !== '') {
      html = await loadTemplate(messageOptions.templateName, messageOptions.replacements ?? {});
    }

    for (const user of validUsers) {
      queueUserEmail(user, html, messageOptions);
    }

    return {
      success: true,
      messageId: `${validUsers.length} E-Mails zur Versandwarteschlange hinzugefügt`,
    };
  } catch (error: unknown) {
    logger.error(`Fehler beim Hinzufügen von Massen-E-Mails zur Queue: ${getErrorMessage(error)}`);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Send a 2FA verification code email.
 *
 * Throws on transport failure — callers (TwoFactorAuthService.issueChallenge)
 * convert the error to `ServiceUnavailableException` per DD-14 (login: plain
 * 503; signup: 503 + caller-side cleanup of pending user/tenant rows). The
 * `Promise<void>` return contract is intentional — we never want a "code sent
 * but the user got nothing" silent-success path.
 *
 * Template payload is built by `build2faCodeTemplate` (typed inputs, fixed
 * subject per DD-13, no code in the subject line).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9)
 */
async function send2faCode(
  to: string,
  code: string,
  purpose: TwoFactorCodeTemplatePurpose,
  ttlMinutes: number,
): Promise<void> {
  const template = build2faCodeTemplate({ code, purpose, ttlMinutes });
  // §2.9b: template references `cid:assixx-logo` in the dark-mode shell —
  // attach the branding logo so the CID resolves in every mail client.
  // Same helper the password-reset path uses (single source of truth).
  const logoAttachment = await getBrandingLogoAttachment();
  const result = await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    attachments: [logoAttachment],
  });
  if (!result.success) {
    // Fail-loud per DD-14 — caller catches and decides login vs signup cleanup.
    throw new Error(`2FA code email transport failed: ${result.error ?? 'unknown error'}`);
  }
}

/**
 * Send the suspicious-activity notification to a user whose account just
 * tripped the 5-wrong-codes lockout (DD-5/DD-6).
 *
 * DD-20: recipient is the user only (no tenant-admin cc — would create a
 * user-enumeration side-channel).
 *
 * Silent-swallow on transport failure — this is a paper-trail email, not a
 * gating event. If SMTP is down we still want the lockout to apply and the
 * primary verify response to return; logging suffices for ops.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9, DD-20)
 */
async function send2faSuspiciousActivity(to: string): Promise<void> {
  const template = build2faSuspiciousActivityTemplate();
  // §2.9b: template references `cid:assixx-logo` — attach the branding logo
  // so the CID resolves. Same dark-mode shell as the code mail above.
  const logoAttachment = await getBrandingLogoAttachment();
  const result = await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    attachments: [logoAttachment],
  });
  if (!result.success) {
    logger.warn(
      `2FA suspicious-activity email transport failed for ${to}: ${result.error ?? 'unknown error'}`,
    );
  }
}

function generateUnsubscribeLink(email: string, type?: string): string {
  const jwtSecret = process.env['JWT_SECRET'];
  if (jwtSecret === undefined || jwtSecret === '') {
    logger.error(
      'JWT_SECRET environment variable is not set — unsubscribe link cannot be generated',
    );
    return '#';
  }

  const resolvedType = type ?? 'all';

  const token: string = jwt.sign({ email, type: resolvedType, purpose: 'unsubscribe' }, jwtSecret, {
    expiresIn: '30d',
  });

  return `${process.env['APP_URL'] ?? 'https://app.assixx.de'}/unsubscribe?token=${token}`;
}

// ES module exports

// Named exports for callers that prefer direct imports (added with the
// 2FA module — see FEAT_2FA_EMAIL_MASTERPLAN §2.9). The default export below
// keeps every function reachable for legacy consumers that already use
// `import emailService from '...'; emailService.foo(...)`.
export { send2faCode, send2faSuspiciousActivity };

// Default export
export default {
  initializeTransporter,
  sendEmail,
  sendNewDocumentNotification,
  sendWelcomeEmail,
  sendBulkNotification,
  send2faCode,
  send2faSuspiciousActivity,
  addToQueue,
  processQueue,
  generateUnsubscribeLink,
  loadBrandedTemplate,
};
