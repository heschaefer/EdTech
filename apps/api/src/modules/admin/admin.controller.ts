import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  atualizarAreaSchema,
  atualizarFaculdadeAdminSchema,
  criarAreaSchema,
  criarFaculdadeSchema,
  dominioInputSchema,
  filtroFaculdadesSchema,
  atualizarEmpresaAdminSchema,
  filtroEmpresasSchema,
  reprovarEmpresaSchema,
} from '@vagas/contracts';
import type { Request } from 'express';
import { createZodDto } from 'nestjs-zod';
import { Roles, UsuarioAtual } from '../../common/decorators';
import type { UsuarioSessao } from '../../common/sessao';
import { AdminAreasService } from './admin-areas.service';
import { AdminEmpresasService } from './admin-empresas.service';
import { AdminFaculdadesService } from './admin-faculdades.service';

class CriarFaculdadeDto extends createZodDto(criarFaculdadeSchema) {}
class AtualizarFaculdadeDto extends createZodDto(atualizarFaculdadeAdminSchema) {}
class DominioDto extends createZodDto(dominioInputSchema) {}
class CriarAreaDto extends createZodDto(criarAreaSchema) {}
class AtualizarAreaDto extends createZodDto(atualizarAreaSchema) {}
class FiltroFaculdadesDto extends createZodDto(filtroFaculdadesSchema) {}
class FiltroEmpresasDto extends createZodDto(filtroEmpresasSchema) {}
class ReprovarDto extends createZodDto(reprovarEmpresaSchema) {}
class AtivaEmpresaDto extends createZodDto(atualizarEmpresaAdminSchema) {}

const ator = (u: UsuarioSessao, req: Request) => ({ id: u.id, ip: req.ip });

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly faculdades: AdminFaculdadesService,
    private readonly areas: AdminAreasService,
    private readonly empresas: AdminEmpresasService,
  ) {}

  // ---------- ADM-01 / ADM-02 ----------
  @Get('faculdades')
  listarFaculdades(@Query() q: FiltroFaculdadesDto) {
    return this.faculdades.listar(q);
  }

  @Get('faculdades/:id')
  obterFaculdade(@Param('id', ParseUUIDPipe) id: string) {
    return this.faculdades.obter(id);
  }

  @Post('faculdades')
  criarFaculdade(@Body() dto: CriarFaculdadeDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.faculdades.criar(dto, ator(u, req));
  }

  @Patch('faculdades/:id')
  atualizarFaculdade(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarFaculdadeDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.faculdades.atualizar(id, dto, ator(u, req));
  }

  @Post('faculdades/:id/dominios')
  adicionarDominio(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DominioDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.faculdades.adicionarDominio(id, dto.dominio, ator(u, req));
  }

  @Delete('faculdades/:id/dominios')
  removerDominio(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DominioDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.faculdades.removerDominio(id, dto.dominio, ator(u, req));
  }

  @Post('faculdades/:id/convite')
  @HttpCode(202)
  async reenviarConvite(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    await this.faculdades.reenviarConvite(id, ator(u, req));
    return { ok: true };
  }

  // ---------- ADM-03 ----------
  @Get('areas')
  listarAreas() {
    return this.areas.listar();
  }

  @Post('areas')
  criarArea(@Body() dto: CriarAreaDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.areas.criar(dto.nome, ator(u, req));
  }

  @Patch('areas/:id')
  atualizarArea(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarAreaDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.areas.atualizar(id, dto, ator(u, req));
  }

  @Delete('areas/:id')
  @HttpCode(204)
  excluirArea(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.areas.excluir(id, ator(u, req));
  }

  // ---------- ADM-04 / ADM-05 ----------
  @Get('empresas')
  listarEmpresas(@Query() q: FiltroEmpresasDto) {
    return this.empresas.listar(q);
  }

  @Get('empresas/:id')
  obterEmpresa(@Param('id', ParseUUIDPipe) id: string) {
    return this.empresas.obter(id);
  }

  @Post('empresas/:id/aprovar')
  @HttpCode(200)
  aprovar(@Param('id', ParseUUIDPipe) id: string, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.empresas.aprovar(id, ator(u, req));
  }

  @Post('empresas/:id/reprovar')
  @HttpCode(200)
  reprovar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReprovarDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.empresas.reprovar(id, dto.motivo, ator(u, req));
  }

  @Patch('empresas/:id')
  ativaEmpresa(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AtivaEmpresaDto, @UsuarioAtual() u: UsuarioSessao, @Req() req: Request) {
    return this.empresas.alterarAtiva(id, dto.ativa, ator(u, req));
  }
}
