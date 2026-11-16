import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { filtroNotificacoesSchema } from '@vagas/contracts';
import { createZodDto } from 'nestjs-zod';
import { PermitirInativo, UsuarioAtual } from '../../common/decorators';
import type { UsuarioSessao } from '../../common/sessao';
import { NotificacoesService } from './notificacoes.service';

class FiltroDto extends createZodDto(filtroNotificacoesSchema) {}

/** ALU-11: qualquer papel logado vê as próprias notificações (o aluno inativo também, como o histórico). */
@PermitirInativo()
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  listar(@UsuarioAtual() u: UsuarioSessao, @Query() q: FiltroDto) {
    return this.notificacoes.listar(u.id, q);
  }

  /** Contagem leve para o sino. */
  @Get('nao-lidas')
  naoLidas(@UsuarioAtual() u: UsuarioSessao) {
    return this.notificacoes.naoLidas(u.id);
  }

  @Patch('lidas')
  @HttpCode(200)
  marcarTodas(@UsuarioAtual() u: UsuarioSessao) {
    return this.notificacoes.marcarTodas(u.id);
  }

  @Patch(':id/lida')
  marcarLida(@UsuarioAtual() u: UsuarioSessao, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificacoes.marcarLida(u.id, id);
  }
}
