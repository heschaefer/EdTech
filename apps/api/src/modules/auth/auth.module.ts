import { Global, Module } from '@nestjs/common';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChavesJwtService } from './chaves-jwt.service';
import { MeService } from './me.service';
import { TokensEmailService } from './tokens-email.service';

@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, ChavesJwtService, TokensEmailService, MeService],
  exports: [AuthService, ChavesJwtService, TokensEmailService],
})
export class AuthModule {}
