import { Module } from '@nestjs/common';
import { EmailProcessor } from './jobs/email.processor';
import { InfraModule } from './prisma/prisma.module';

/** Mesmo código da API, outro processo: envia e-mails e roda os jobs de prazo (Fase 6). */
@Module({ imports: [InfraModule], providers: [EmailProcessor] })
export class WorkerModule {}
