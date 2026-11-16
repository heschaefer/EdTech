import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { atualizarEmpresaSchema, cadastroEmpresaSchema } from '@vagas/contracts';
import { createZodDto } from 'nestjs-zod';
import { Public, Roles, UsuarioAtual } from '../../common/decorators';
import { Limite } from '../../common/guards/limite.guard';
import type { UsuarioSessao } from '../../common/sessao';
import { EmpresasService } from './empresas.service';

class CadastroDto extends createZodDto(cadastroEmpresaSchema) {}
class AtualizarDto extends createZodDto(atualizarEmpresaSchema) {}

@Public()
@Controller('auth')
export class CadastroEmpresaController {
  constructor(private readonly empresas: EmpresasService) {}

  /** EMP-01 · seção 8.3: cadastro 10/h por IP. */
  @Limite(10, 3_600_000, 'ip')
  @Post('empresas')
  @HttpCode(201)
  async cadastrar(@Body() dto: CadastroDto) {
    await this.empresas.cadastrar(dto);
    return { ok: true, email: dto.email };
  }
}

@Roles('EMPRESA')
@Controller('empresa/me')
export class EmpresaController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  me(@UsuarioAtual() u: UsuarioSessao) {
    return this.empresas.perfil(u.id);
  }

  @Patch()
  atualizar(@UsuarioAtual() u: UsuarioSessao, @Body() dto: AtualizarDto) {
    return this.empresas.atualizar(u.id, dto);
  }

  @Post('solicitar-analise')
  @HttpCode(200)
  solicitarAnalise(@UsuarioAtual() u: UsuarioSessao) {
    return this.empresas.solicitarAnalise(u.id);
  }
}
