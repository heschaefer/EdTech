import { Module } from '@nestjs/common';
import { EmailProcessor } from './jobs/email.processor';
import { ManutencaoProcessor } from './jobs/manutencao.processor';
import { ManutencaoModule } from './modules/manutencao/manutencao.module';
import { EmailModule } from './modules/email/email.module';
import { OutboxModule } from './modules/notificacoes/outbox.module';
import { InfraModule } from './prisma/prisma.module';

/** Mesmo código da API, outro processo: envia e-mails e roda os jobs de prazo (Fase 6). */
@Module({ imports: [InfraModule, EmailModule, OutboxModule, ManutencaoModule], providers: [EmailProcessor, ManutencaoProcessor] })
export class WorkerModule {}
