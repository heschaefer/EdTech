import { Module } from '@nestjs/common';
import { NotificacoesController } from './notificacoes.controller';

/** O serviço vem do CompartilhadoModule (global); aqui só a central (ALU-11). */
@Module({ controllers: [NotificacoesController] })
export class NotificacoesModule {}
