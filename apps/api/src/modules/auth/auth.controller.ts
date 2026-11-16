import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  aceitarConviteSchema,
  esqueciSenhaSchema,
  loginSchema,
  redefinirSenhaSchema,
  reenviarVerificacaoSchema,
  tokenSchema,
} from '@vagas/contracts';
import type { Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { PermitirInativo, Public, UsuarioAtual } from '../../common/decorators';
import { Limite } from '../../common/guards/limite.guard';
import { COOKIE_REFRESH, type UsuarioSessao } from '../../common/sessao';
import { AuthService } from './auth.service';
import { gravarCookiesSessao, limparCookiesSessao } from './cookies';
import { MeService } from './me.service';

class LoginDto extends createZodDto(loginSchema) {}
class TokenDto extends createZodDto(tokenSchema) {}
class EmailDto extends createZodDto(reenviarVerificacaoSchema) {}
class EsqueciDto extends createZodDto(esqueciSenhaSchema) {}
class RedefinirDto extends createZodDto(redefinirSenhaSchema) {}
class ConviteDto extends createZodDto(aceitarConviteSchema) {}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly me: MeService,
  ) {}

  /** AUTH-01 · SEG-05: 5/min por IP + e-mail. */
  @Public()
  @Limite(5, 60_000, 'ip+email')
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { sessao, usuario, painel } = await this.auth.login(dto);
    gravarCookiesSessao(res, sessao);
    return { painel, usuario: await this.me.de(usuario.id) };
  }

  /** AUTH-02: autenticado só pelo cookie `rt` (SameSite=Strict, Path=/api/v1/auth). */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const sessao = await this.auth.renovar(req.cookies?.[COOKIE_REFRESH]);
      gravarCookiesSessao(res, sessao);
      return { ok: true };
    } catch (e) {
      limparCookiesSessao(res);
      throw e;
    }
  }

  /** AUTH-03 */
  @PermitirInativo()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE_REFRESH]);
    limparCookiesSessao(res);
  }

  /** AUTH-05 */
  @Public()
  @Post('verificar-email')
  @HttpCode(200)
  async verificarEmail(@Body() dto: TokenDto) {
    await this.auth.verificarEmail(dto.token);
    return { ok: true };
  }

  /** AUTH-05: reenvio limitado a 3 por hora. */
  @Public()
  @Limite(3, 3_600_000, 'email')
  @Post('reenviar-verificacao')
  @HttpCode(202)
  async reenviar(@Body() dto: EmailDto) {
    await this.auth.reenviarVerificacao(dto.email);
    return { ok: true };
  }

  /** AUTH-04: sempre 202; 3/h por e-mail. */
  @Public()
  @Limite(3, 3_600_000, 'email')
  @Post('senha/esqueci')
  @HttpCode(202)
  async esqueci(@Body() dto: EsqueciDto) {
    await this.auth.esqueciSenha(dto.email);
    return { ok: true };
  }

  @Public()
  @Post('senha/redefinir')
  @HttpCode(200)
  async redefinir(@Body() dto: RedefinirDto) {
    await this.auth.redefinirSenha(dto.token, dto.senha);
    return { ok: true };
  }

  /** FAC-01 */
  @Public()
  @Post('convite/aceitar')
  @HttpCode(200)
  async aceitarConvite(@Body() dto: ConviteDto) {
    await this.auth.aceitarConvite(dto.token, dto.senha);
    return { ok: true };
  }
}

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** AUTH-01: quem sou eu (o front usa para montar o painel). */
  @PermitirInativo()
  @Get()
  get(@UsuarioAtual() u: UsuarioSessao) {
    return this.me.de(u.id);
  }
}

