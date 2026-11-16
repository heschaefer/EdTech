import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { conexaoRedis, FILA_EMAILS } from '../modules/email/redis';
import type { Email } from '../modules/email/templates';

/** Só o worker envia e-mail (seção 10); até 5 tentativas com backoff exponencial (RN-23). */
@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailProcessor.name);
  private worker?: Worker<Email>;
  private readonly conexao = conexaoRedis();
  private readonly smtp: Transporter = nodemailer.createTransport({
    host: env().SMTP_HOST,
    port: env().SMTP_PORT,
    secure: false,
    ignoreTLS: env().NODE_ENV !== 'production',
  });

  onModuleInit() {
    this.worker = new Worker<Email>(
      FILA_EMAILS,
      async (job) => {
        const { para, assunto, html, texto } = job.data;
        await this.smtp.sendMail({ from: env().MAIL_FROM, to: para, subject: assunto, html, text: texto });
      },
      { connection: this.conexao, concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => this.logger.warn(`E-mail ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.conexao.quit().catch(() => undefined);
  }
}
