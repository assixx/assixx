/**
 * Company Module
 *
 * Manages tenant company data (address, contact info).
 */
import { Module } from '@nestjs/common';

import { CompanyController } from './company.controller.js';
import { CompanyService } from './company.service.js';

@Module({
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern requires decorated empty class
export class CompanyModule {}
