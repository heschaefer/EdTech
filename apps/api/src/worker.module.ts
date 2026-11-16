import { Module } from '@nestjs/common';
import { EmailProcessor } from './jobs/email.processor';
import { ManutencaoProcessor } from './jobs/manutencao.processor';
import { ManutencaoModule } from './modules/manutencao/manutencao.module';
import { EmailModule } from './modules/email/email.module';
import { OutboxModule } from './modules/notificacoes/outbox.module';
import { InfraModule } from './prisma/prisma.module';
import { CicloModule } from './modules/ciclo/ciclo.module';
import { CompartilhadoModule } from './modules/compartilhado.module';

/** Mesmo código da API, outro processo: envia e-mails e roda os jobs de prazo (seção 10). */
@Module({
  imports: [InfraModule, EmailModule, CompartilhadoModule, OutboxModule, ManutencaoModule, CicloModule],
  providers: [EmailProcessor, ManutencaoProcessor],
})
export class WorkerModule {}
