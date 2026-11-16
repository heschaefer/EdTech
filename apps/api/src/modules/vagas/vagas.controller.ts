import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { atualizarVagaSchema, criarVagaSchema, filtroVagasEmpresaSchema, filtroVagasSchema, prorrogarVagaSchema } from '@vagas/contracts';
import { createZodDto } from 'nestjs-zod';
import { Roles, UsuarioAtual } from '../../common/decorators';
import type { UsuarioSessao } from '../../common/sessao';
import { VagasAlunoService } from './vagas-aluno.service';
import { VagasEmpresaService } from './vagas-empresa.service';

class CriarDto extends createZodDto(criarVagaSchema) {}
class AtualizarDto extends createZodDto(atualizarVagaSchema) {}
class ProrrogarDto extends createZodDto(prorrogarVagaSchema) {}
class FiltroEmpresaDto extends createZodDto(filtroVagasEmpresaSchema) {}
class FiltroAlunoDto extends createZodDto(filtroVagasSchema) {}

const Id = () => Param('id', ParseUUIDPipe);

@Roles('EMPRESA')
@Controller('empresa/vagas')
export class VagasEmpresaController {
  constructor(private readonly vagas: VagasEmpresaService) {}

  @Get()
  listar(@UsuarioAtual() u: UsuarioSessao, @Query() q: FiltroEmpresaDto) {
    return this.vagas.listar(u.id, q.status);
  }

  /** EMP-03 */
  @Post()
  criar(@UsuarioAtual() u: UsuarioSessao, @Body() dto: CriarDto) {
    return this.vagas.criar(u.id, dto);
  }

  @Get(':id')
  obter(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.vagas.obter(u.id, id);
  }

  /** EMP-04 */
  @Patch(':id')
  atualizar(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: AtualizarDto) {
    return this.vagas.atualizar(u.id, id, dto);
  }

  /** EMP-06 */
  @Delete(':id')
  @HttpCode(204)
  excluir(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.vagas.excluir(u.id, id);
  }

  /** EMP-05 */
  @Post(':id/pausar')
  @HttpCode(200)
  pausar(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.vagas.pausar(u.id, id);
  }

  @Post(':id/reativar')
  @HttpCode(200)
  reativar(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.vagas.reativar(u.id, id);
  }

  /** EMP-07 */
  @Post(':id/prorrogar')
  @HttpCode(200)
  prorrogar(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: ProrrogarDto) {
    return this.vagas.prorrogar(u.id, id, dto.prazo);
  }
}

@Roles('ALUNO')
@Controller('vagas')
export class VagasAlunoController {
  constructor(private readonly vagas: VagasAlunoService) {}

  /** ALU-05 */
  @Get()
  listar(@UsuarioAtual() u: UsuarioSessao, @Query() q: FiltroAlunoDto) {
    return this.vagas.listar(u.id, q);
  }

  /** ALU-06 */
  @Get(':id')
  obter(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.vagas.obter(u.id, id);
  }
}
