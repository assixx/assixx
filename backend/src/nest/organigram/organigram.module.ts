import { Module } from '@nestjs/common';

import { OrganigramLayoutService } from './organigram-layout.service.js';
import { OrganigramSettingsService } from './organigram-settings.service.js';
import { OrganigramController } from './organigram.controller.js';
import { OrganigramService } from './organigram.service.js';

@Module({
  controllers: [OrganigramController],
  providers: [
    OrganigramService,
    OrganigramSettingsService,
    OrganigramLayoutService,
  ],
  exports: [OrganigramService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class OrganigramModule {}
