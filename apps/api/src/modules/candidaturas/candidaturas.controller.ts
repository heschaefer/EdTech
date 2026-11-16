import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { filtroCandidatosSchema, filtroCandidaturasAlunoSchema, moverEtapaSchema } from '@vagas/contracts';
import type { Request, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { PermitirInativo, Roles, UsuarioAtual } from '../../common/decorators';
import type { UsuarioSessao } from '../../common/sessao';
import { CandidaturasAlunoService } from './candidaturas-aluno.service';
import { CandidaturasEmpresaService } from './candidaturas-empresa.service';

class FiltroAlunoDto extends createZodDto(filtroCandidaturasAlunoSchema) {}
class FiltroCandidatosDto extends createZodDto(filtroCandidatosSchema) {}
class MoverEtapaDto extends createZodDto(moverEtapaSchema) {}

const Id = () => Param('id', ParseUUIDPipe);

@Roles('ALUNO')
@Controller()
export class CandidaturasAlunoController {
  constructor(private readonly candidaturas: CandidaturasAlunoService) {}

  /** ALU-07: 201 quando cria (ou reativa); 200 quando a candidatura já existia (duplo clique). */
  @Post('vagas/:id/candidaturas')
  async candidatar(@UsuarioAtual() u: UsuarioSessao, @Id() vagaId: string, @Res({ passthrough: true }) res: Response) {
    const { criada, id } = await this.candidaturas.candidatar(u.id, vagaId);
    res.status(criada ? HttpStatus.CREATED : HttpStatus.OK);
    return this.candidaturas.obter(u.id, id);
  }

  /** ALU-09 / ALU-10 (inclusive inativo: RN-22 mantém o histórico). */
  @PermitirInativo()
  @Get('alunos/me/candidaturas')
  listar(@UsuarioAtual() u: UsuarioSessao, @Query() q: FiltroAlunoDto) {
    return this.candidaturas.listar(u.id, q);
  }

  @PermitirInativo()
  @Get('candidaturas/:id')
  obter(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.candidaturas.obter(u.id, id);
  }

  /** ALU-08 */
  @Delete('candidaturas/:id')
  @HttpCode(200)
  remover(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.candidaturas.remover(u.id, id);
  }
}

@Roles('EMPRESA')
@Controller('empresa')
export class CandidaturasEmpresaController {
  constructor(private readonly candidaturas: CandidaturasEmpresaService) {}

  /** EMP-08 */
  @Get('vagas/:id/candidaturas')
  listar(@UsuarioAtual() u: UsuarioSessao, @Id() vagaId: string, @Query() q: FiltroCandidatosDto) {
    return this.candidaturas.listar(u.id, vagaId, q);
  }

  /** EMP-09 */
  @Get('candidaturas/:id')
  obter(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Req() req: Request) {
    return this.candidaturas.obter({ id: u.id, ip: req.ip }, id);
  }

  /** EMP-10 */
  @Patch('candidaturas/:id/etapa')
  moverEtapa(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: MoverEtapaDto) {
    return this.candidaturas.moverEtapa(u.id, id, dto.etapaId);
  }

  @Post('candidaturas/:id/nao-selecionar')
  @HttpCode(200)
  naoSelecionar(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.candidaturas.naoSelecionar(u.id, id);
  }
}
