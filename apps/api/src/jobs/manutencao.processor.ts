import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { conexaoRedis } from '../modules/email/redis';
import { PrazosService } from '../modules/ciclo/prazos.service';
import { ManutencaoService } from '../modules/manutencao/manutencao.service';
import { OutboxService } from '../modules/notificacoes/outbox.service';

export const FILA_MANUTENCAO = 'manutencao';

/**
 * Rotinas periódicas do worker: jobs de prazo a cada 5 min (JOB-01 a JOB-03), limpeza de cadastros
 * não verificados (RN-03) e envio do outbox de notificações (RN-23).
 */
@Injectable()
export class ManutencaoProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManutencaoProcessor.name);
  private readonly conexao = conexaoRedis();
  private fila?: Queue;
  private worker?: Worker;

  constructor(
    private readonly manutencao: ManutencaoService,
    private readonly outbox: OutboxService,
    private readonly prazos: PrazosService,
  ) {}

  async onModuleInit() {
    this.fila = new Queue(FILA_MANUTENCAO, { connection: this.conexao });
    await this.fila.upsertJobScheduler('apagar-nao-verificados', { every: 60 * 60_000 }, { name: 'apagar-nao-verificados' });
    await this.fila.upsertJobScheduler('enviar-notificacoes', { every: 5_000 }, { name: 'enviar-notificacoes' });
    await this.fila.upsertJobScheduler('prazos', { every: 5 * 60_000 }, { name: 'prazos' });
    this.worker = new Worker(
      FILA_MANUTENCAO,
      async (job) => {
        if (job.name === 'apagar-nao-verificados') return this.manutencao.apagarCadastrosNaoVerificados();
        if (job.name === 'enviar-notificacoes') return this.outbox.processar();
        if (job.name === 'prazos') return this.prazos.rodarTodos();
      },
      { connection: this.conexao },
    );
    this.worker.on('failed', (job, err) => this.logger.warn(`Job ${job?.name} falhou: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.fila?.close();
    await this.conexao.quit().catch(() => undefined);
  }
}
