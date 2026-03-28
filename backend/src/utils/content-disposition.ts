/**
 * RFC 5987/6266-compliant Content-Disposition header builder.
 * Uses the `content-disposition` package (same as Express internally)
 * to properly encode non-ASCII filenames (Umlaute, Emojis, etc.).
 */
import contentDisposition from 'content-disposition';

/** Builds a Content-Disposition header for file downloads. */
export function attachmentHeader(filename: string): string {
  return contentDisposition(filename, { type: 'attachment' });
}

/** Builds a Content-Disposition header for inline display (e.g. PDF preview). */
export function inlineHeader(filename: string): string {
  return contentDisposition(filename, { type: 'inline' });
}
