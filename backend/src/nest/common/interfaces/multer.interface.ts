/**
 * Multer File Interface
 *
 * Type definition for uploaded files via fastify-multer (MemoryStorage).
 * Replaces Express.Multer.File after Express removal.
 *
 * Note: This interface is for MemoryStorage which always provides buffer.
 * For DiskStorage (path-based), create a separate interface if needed.
 */

/**
 * Uploaded file from fastify-multer with MemoryStorage
 */
export interface MulterFile {
  /** Field name from the form */
  fieldname: string;
  /** Original filename on the user's computer */
  originalname: string;
  /** Encoding type of the file */
  encoding: string;
  /** MIME type of the file */
  mimetype: string;
  /** Size of the file in bytes */
  size: number;
  /** A Buffer of the entire file (MemoryStorage - always present) */
  buffer: Buffer;
  /** Folder to which the file has been saved (DiskStorage only) */
  destination?: string;
  /** The name of the file within destination (DiskStorage only) */
  filename?: string;
  /** Location of the uploaded file (DiskStorage only) */
  path?: string;
}
