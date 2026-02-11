/**
 * E2E Key Escrow Module
 *
 * Provides zero-knowledge encrypted private key backup endpoints.
 * The server stores only encrypted blobs — it cannot decrypt them.
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import { Module } from '@nestjs/common';

import { E2eEscrowController } from './e2e-escrow.controller.js';
import { E2eEscrowService } from './e2e-escrow.service.js';

@Module({
  controllers: [E2eEscrowController],
  providers: [E2eEscrowService],
  exports: [E2eEscrowService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class E2eEscrowModule {}
