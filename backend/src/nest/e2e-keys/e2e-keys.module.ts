/**
 * E2E Keys Module
 *
 * Provides X25519 public key management for end-to-end encrypted messaging.
 * Exports E2eKeysService so that ChatModule can validate key versions
 * when accepting encrypted messages.
 */
import { Module } from '@nestjs/common';

import { E2eKeysController } from './e2e-keys.controller.js';
import { E2eKeysService } from './e2e-keys.service.js';

@Module({
  controllers: [E2eKeysController],
  providers: [E2eKeysService],
  exports: [E2eKeysService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class E2eKeysModule {}
