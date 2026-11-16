import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  atualizarAulaSchema,
  atualizarCursoSchema,
  atualizarFaculdadeSchema,
  atualizarTurmaSchema,
  criarAulaSchema,
  criarCursoSchema,
  criarTurmaSchema,
} from '@vagas/contracts';
import { createZodDto } from 'nestjs-zod';
import { Roles, UsuarioAtual } from '../../common/decorators';
import type { UsuarioSessao } from '../../common/sessao';
import { CursosService } from './cursos.service';
import { FaculdadeAtualService } from './faculdade-atual.service';
import { GradeService } from './grade.service';
import { PerfilFaculdadeService } from './perfil.service';
import { TurmasService } from './turmas.service';

class AtualizarFaculdadeDto extends createZodDto(atualizarFaculdadeSchema) {}
class CriarCursoDto extends createZodDto(criarCursoSchema) {}
class AtualizarCursoDto extends createZodDto(atualizarCursoSchema) {}
class CriarAulaDto extends createZodDto(criarAulaSchema) {}
class AtualizarAulaDto extends createZodDto(atualizarAulaSchema) {}
class CriarTurmaDto extends createZodDto(criarTurmaSchema) {}
class AtualizarTurmaDto extends createZodDto(atualizarTurmaSchema) {}

const Id = (nome = 'id') => Param(nome, ParseUUIDPipe);

@Roles('FACULDADE')
@Controller('faculdade')
export class FaculdadeController {
  constructor(
    private readonly atual: FaculdadeAtualService,
    private readonly perfil: PerfilFaculdadeService,
    private readonly cursos: CursosService,
    private readonly grade: GradeService,
    private readonly turmas: TurmasService,
  ) {}

  // ---------- FAC-02 ----------
  @Get('me')
  async me(@UsuarioAtual() u: UsuarioSessao) {
    return this.perfil.obter(await this.atual.id(u.id));
  }

  @Patch('me')
  async atualizarMe(@UsuarioAtual() u: UsuarioSessao, @Body() dto: AtualizarFaculdadeDto) {
    return this.perfil.atualizar(await this.atual.id(u.id), dto);
  }

  // ---------- FAC-03 ----------
  @Get('cursos')
  async listarCursos(@UsuarioAtual() u: UsuarioSessao) {
    return this.cursos.listar(await this.atual.id(u.id));
  }

  @Post('cursos')
  async criarCurso(@UsuarioAtual() u: UsuarioSessao, @Body() dto: CriarCursoDto) {
    return this.cursos.criar(await this.atual.id(u.id), dto);
  }

  @Get('cursos/:id')
  async obterCurso(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.cursos.obter(await this.atual.id(u.id), id);
  }

  @Patch('cursos/:id')
  async atualizarCurso(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: AtualizarCursoDto) {
    return this.cursos.atualizar(await this.atual.id(u.id), id, dto);
  }

  @Delete('cursos/:id')
  @HttpCode(204)
  async excluirCurso(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    await this.cursos.excluir(await this.atual.id(u.id), id);
  }

  // ---------- FAC-04 ----------
  @Get('cursos/:id/semestres')
  async semestres(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.grade.semestres(await this.atual.id(u.id), id);
  }

  @Post('semestres/:id/aulas')
  async criarAula(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: CriarAulaDto) {
    return this.grade.criarAula(await this.atual.id(u.id), id, dto);
  }

  @Patch('aulas/:id')
  async atualizarAula(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: AtualizarAulaDto) {
    return this.grade.atualizarAula(await this.atual.id(u.id), id, dto);
  }

  @Delete('aulas/:id')
  @HttpCode(204)
  async excluirAula(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    await this.grade.excluirAula(await this.atual.id(u.id), id);
  }

  // ---------- FAC-05 ----------
  @Get('cursos/:id/turmas')
  async listarTurmas(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    return this.turmas.listar(await this.atual.id(u.id), id);
  }

  @Post('cursos/:id/turmas')
  async criarTurma(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: CriarTurmaDto) {
    return this.turmas.criar(await this.atual.id(u.id), id, dto);
  }

  @Patch('turmas/:id')
  async atualizarTurma(@UsuarioAtual() u: UsuarioSessao, @Id() id: string, @Body() dto: AtualizarTurmaDto) {
    return this.turmas.atualizar(await this.atual.id(u.id), id, dto);
  }

  @Delete('turmas/:id')
  @HttpCode(204)
  async excluirTurma(@UsuarioAtual() u: UsuarioSessao, @Id() id: string) {
    await this.turmas.excluir(await this.atual.id(u.id), id);
  }
}
