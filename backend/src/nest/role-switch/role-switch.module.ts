/**
 * Role Switch Module
 *
 * NestJS module for role switching functionality.
 * Allows admin/root users to temporarily view the app as employee.
 */
import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';

import { AppConfigService } from '../config/config.service.js';
import { AppConfigModule } from '../config/index.js';
import { RoleSwitchController } from './role-switch.controller.js';
import { RoleSwitchService } from './role-switch.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService): JwtModuleOptions =>
        ({
          secret: configService.jwtSecret,
          signOptions: {
            expiresIn: configService.jwtAccessExpiry,
          },
        }) as JwtModuleOptions,
    }),
  ],
  controllers: [RoleSwitchController],
  providers: [RoleSwitchService],
  exports: [RoleSwitchService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class RoleSwitchModule {}
