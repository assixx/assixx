/**
 * Documents Module
 *
 * Encapsulates document management functionality.
 * Provides document CRUD, download/preview, and statistics.
 */
import { Module } from '@nestjs/common';

import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class DocumentsModule {}
