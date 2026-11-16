import { Body, Controller, Get, HttpCode, Patch, Post, Put, Query, Res } from '@nestjs/common';
import {
  atualizarAlunoSchema,
  cadastroAlunoSchema,
  confirmarTrocaFaculdadeSchema,
  curriculoSchema,
  pedirTrocaFaculdadeSchema,
  trocarSenhaSchema,
  vinculoSchema,
} from '@vagas/contracts';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PermitirInativo, Public, Roles, UsuarioAtual } from '../../common/decorators';
import { Limite } from '../../common/guards/limite.guard';
import type { UsuarioSessao } from '../../common/sessao';
import { gravarCookiesSessao } from '../auth/cookies';
import { AlunosService } from './alunos.service';
import { CurriculoService } from './curriculo.service';

class CadastroDto extends createZodDto(cadastroAlunoSchema) {}
class AtualizarDto extends createZodDto(atualizarAlunoSchema) {}
class SenhaDto extends createZodDto(trocarSenhaSchema) {}
class VinculoDto extends createZodDto(vinculoSchema) {}
class CurriculoDto extends createZodDto(curriculoSchema) {}
class PedirTrocaDto extends createZodDto(pedirTrocaFaculdadeSchema) {}
class ConfirmarTrocaDto extends createZodDto(confirmarTrocaFaculdadeSchema) {}
class EmailQueryDto extends createZodDto(z.object({ email: z.string().trim().max(254) }).strict()) {}
class TokenQueryDto extends createZodDto(z.object({ token: z.string().min(20).max(200) }).strict()) {}

/** Rotas públicas do cadastro (ALU-01). */
@Public()
@Controller()
export class CadastroAlunoController {
  constructor(private readonly alunos: AlunosService) {}

  /** Seção 8.3: consulta de domínio 30/min por IP. */
  @Limite(30, 60_000, 'ip')
  @Get('faculdades/por-dominio')
  porDominio(@Query() q: EmailQueryDto) {
    return this.alunos.porDominio(q.email);
  }

  /** Seção 8.3: cadastro 10/h por IP. */
  @Limite(10, 3_600_000, 'ip')
  @Post('auth/alunos')
  @HttpCode(201)
  async cadastrar(@Body() dto: CadastroDto) {
    await this.alunos.cadastrar(dto);
    return { ok: true, email: dto.email };
  }
}

@Roles('ALUNO')
@Controller('alunos/me')
export class AlunosController {
  constructor(
    private readonly alunos: AlunosService,
    private readonly curriculos: CurriculoService,
  ) {}

  // ---------- ALU-02 ----------
  @PermitirInativo()
  @Get()
  me(@UsuarioAtual() u: UsuarioSessao) {
    return this.alunos.me(u.id);
  }

  @Patch()
  atualizar(@UsuarioAtual() u: UsuarioSessao, @Body() dto: AtualizarDto) {
    return this.alunos.atualizar(u.id, dto);
  }

  @Patch('senha')
  @HttpCode(200)
  async senha(@UsuarioAtual() u: UsuarioSessao, @Body() dto: SenhaDto, @Res({ passthrough: true }) res: Response) {
    gravarCookiesSessao(res, await this.alunos.trocarSenha(u.id, dto.senhaAtual, dto.senha));
    return { ok: true };
  }

  // ---------- ALU-03 ----------
  @Get('vinculo/opcoes')
  opcoesVinculo(@UsuarioAtual() u: UsuarioSessao) {
    return this.alunos.opcoesVinculo(u.id);
  }

  @Patch('vinculo')
  vinculo(@UsuarioAtual() u: UsuarioSessao, @Body() dto: VinculoDto) {
    return this.alunos.atualizarVinculo(u.id, dto);
  }

  // ---------- ALU-04 ----------
  @Get('curriculo')
  async curriculo(@UsuarioAtual() u: UsuarioSessao) {
    return this.curriculos.obter((await this.alunos.alunoDoUsuario(u.id)).id);
  }

  @Put('curriculo')
  async salvarCurriculo(@UsuarioAtual() u: UsuarioSessao, @Body() dto: CurriculoDto) {
    const { id } = await this.alunos.alunoDoUsuario(u.id);
    await this.curriculos.salvar(id, dto);
    return this.curriculos.obter(id);
  }

  // ---------- ALU-12 (inclusive inativo) ----------
  @PermitirInativo()
  @Post('troca-faculdade')
  @HttpCode(202)
  async pedirTroca(@UsuarioAtual() u: UsuarioSessao, @Body() dto: PedirTrocaDto) {
    await this.alunos.pedirTrocaFaculdade(u.id, dto.email);
    return { ok: true };
  }

  @PermitirInativo()
  @Get('troca-faculdade')
  opcoesTroca(@UsuarioAtual() u: UsuarioSessao, @Query() q: TokenQueryDto) {
    return this.alunos.opcoesTrocaFaculdade(u.id, q.token);
  }

  @PermitirInativo()
  @Post('troca-faculdade/confirmar')
  @HttpCode(200)
  confirmarTroca(@UsuarioAtual() u: UsuarioSessao, @Body() { token, ...vinculo }: ConfirmarTrocaDto) {
    return this.alunos.confirmarTrocaFaculdade(u.id, token, vinculo);
  }
}
