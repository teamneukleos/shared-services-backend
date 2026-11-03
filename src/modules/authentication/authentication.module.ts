import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { AuthenticationService } from './application/authentication.service';
import { AuthenticationController } from './authentication.controller';
import { AUTHENTICATION_REPOSITORY } from './domain/authentication.repository';
import { GOOGLE_IDENTITY_VERIFIER } from './domain/google-identity-verifier';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleIdTokenVerifier } from './infrastructure/google-id-token.verifier';
import { JwtAccessStrategy } from './infrastructure/jwt-access.strategy';
import { PrismaAuthenticationRepository } from './infrastructure/prisma-authentication.repository';

@Module({
  imports: [
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.getOrThrow<string>(
          'jwt.accessExpiresIn',
        );

        return {
          secret: configService.getOrThrow<string>('jwt.accessSecret'),
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
  ],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationService,
    JwtAccessStrategy,
    JwtAuthGuard,
    {
      provide: AUTHENTICATION_REPOSITORY,
      useClass: PrismaAuthenticationRepository,
    },
    {
      provide: GOOGLE_IDENTITY_VERIFIER,
      useClass: GoogleIdTokenVerifier,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [AuthenticationService, JwtModule, GOOGLE_IDENTITY_VERIFIER],
})
export class AuthenticationModule {}
