/**
 * Document Storage Service
 *
 * Handles file I/O operations: reading from disk, writing to disk,
 * resolving file content from database or filesystem, and serving
 * document content for downloads.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';

import { DatabaseService } from '../database/database.service.js';
import type { DbDocument, DocumentContentResponse } from './documents.service.js';

@Injectable()
export class DocumentStorageService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get document content for download.
   * Expects a pre-verified document (access already checked by facade).
   * Increments download count and resolves file content.
   */
  async getDocumentContent(document: DbDocument): Promise<DocumentContentResponse> {
    // Increment download count
    await this.databaseService.tenantQuery(
      `UPDATE documents SET download_count = download_count + 1 WHERE id = $1 AND tenant_id = $2`,
      [document.id, document.tenant_id],
    );

    // Get content
    const content = await this.resolveFileContent(document);

    return {
      content,
      originalName: document.original_name ?? document.filename,
      mimeType: document.mime_type ?? 'application/octet-stream',
      fileSize: document.file_size ?? 0,
    };
  }

  /** Resolve file content from database blob or filesystem */
  async resolveFileContent(document: DbDocument): Promise<Buffer> {
    if (document.file_content !== null) {
      return document.file_content;
    }
    if (document.file_path !== null) {
      return await this.readFileFromDisk(document.file_path);
    }
    throw new NotFoundException('Document has no content or file path');
  }

  /** Write file to disk with path traversal protection */
  async writeFileToDisk(filePath: string, content: Buffer): Promise<void> {
    const baseDir = process.cwd();
    const absolutePath = path.join(baseDir, filePath);

    // Security: Validate path
    if (!absolutePath.startsWith(baseDir)) {
      throw new BadRequestException('Invalid file path');
    }

    const directory = path.dirname(absolutePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(absolutePath, content);
  }

  /** Read file from disk with path traversal protection */
  async readFileFromDisk(filePath: string): Promise<Buffer> {
    const baseDir = process.cwd();
    const absolutePath = path.join(baseDir, filePath);

    // Security: Validate path
    if (!absolutePath.startsWith(baseDir)) {
      throw new ForbiddenException('Invalid file path');
    }

    try {
      return await fs.readFile(absolutePath);
    } catch {
      throw new NotFoundException('Document file not found');
    }
  }
}
