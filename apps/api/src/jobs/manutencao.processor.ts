import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { conexaoRedis } from '../modules/email/redis';
import { ManutencaoService } from '../modules/manutencao/manutencao.service';

export const FILA_MANUTENCAO = 'manutencao';

/** Rotinas periódicas do worker: hoje, a limpeza de cadastros não verificados (RN-03), de hora em hora. */
@Injectable()
export class ManutencaoProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManutencaoProcessor.name);
  private readonly conexao = conexaoRedis();
  private fila?: Queue;
  private worker?: Worker;

  constructor(private readonly manutencao: ManutencaoService) {}

  async onModuleInit() {
    this.fila = new Queue(FILA_MANUTENCAO, { connection: this.conexao });
    await this.fila.upsertJobScheduler('apagar-nao-verificados', { every: 60 * 60_000 }, { name: 'apagar-nao-verificados' });
    this.worker = new Worker(
      FILA_MANUTENCAO,
      async (job) => {
        if (job.name === 'apagar-nao-verificados') return this.manutencao.apagarCadastrosNaoVerificados();
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
