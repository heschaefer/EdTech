import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria/auditoria.service';
import { NotificacoesService } from './notificacoes/notificacoes.service';

@Global()
@Module({ providers: [AuditoriaService, NotificacoesService], exports: [AuditoriaService, NotificacoesService] })
export class CompartilhadoModule {}
