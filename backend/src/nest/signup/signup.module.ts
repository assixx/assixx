/**
 * Signup Module
 *
 * Handles tenant self-service registration.
 * All endpoints are public (no authentication required).
 */
import { Module } from '@nestjs/common';

import { SignupController } from './signup.controller.js';
import { SignupService } from './signup.service.js';

@Module({
  controllers: [SignupController],
  providers: [SignupService],
  exports: [SignupService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class SignupModule {}
