import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from './jwt.service';
import { RefreshTokenStore } from './refresh-token.store';
import { AuthInterceptor } from './auth.interceptor';
import { ProofaAuthController } from './auth.controller';

@Module({
  controllers: [ProofaAuthController],
  providers: [
    JwtService,
    RefreshTokenStore,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuthInterceptor,
    },
  ],
})
export class ProofaAuthModule {}
