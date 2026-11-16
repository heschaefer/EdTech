import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { conexaoRedis, FILA_EMAILS } from './redis';
import type { Email } from './templates';

/**
 * Só enfileira: quem envia é o worker (seção 10), com até 5 tentativas e backoff exponencial (RN-23).
 */
@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly conexao = conexaoRedis();
  private readonly fila = new Queue<Email>(FILA_EMAILS, {
    connection: this.conexao,
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  });

  async enfileirar(email: Email, jobId?: string) {
    await this.fila.add('enviar', email, jobId ? { jobId } : undefined);
  }

  async onModuleDestroy() {
    await this.fila.close();
    await this.conexao.quit().catch(() => undefined);
  }
}
