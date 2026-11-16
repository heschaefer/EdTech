import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { ClockService } from '../../common/clock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { montarEmail } from '../email/templates';

export const MAX_TENTATIVAS_OUTBOX = 5;

/**
 * Outbox (seção 10, RN-23): toda notificação in-app vira e-mail. A linha nasce na mesma transação
 * da mudança de estado; aqui ela é entregue à fila de e-mails (que tenta até 5 vezes com backoff).
 * O jobId é o id da notificação, então rodar duas vezes não manda dois e-mails.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly email: EmailService,
  ) {}

  async processar(limite = 200): Promise<number> {
    const pendentes = await this.prisma.notificacao.findMany({
      where: { emailEnviadoEm: null, tentativas: { lt: MAX_TENTATIVAS_OUTBOX } },
      orderBy: { criadaEm: 'asc' },
      take: limite,
      include: { usuario: { select: { email: true } } },
    });
    let enviadas = 0;
    for (const n of pendentes) {
      try {
        const acao = n.link ? { rotulo: 'Abrir na plataforma', url: `${env().WEB_URL}${n.link}` } : undefined;
        await this.email.enfileirar(montarEmail(n.usuario.email, n.titulo, [n.mensagem], acao), `notificacao-${n.id}`);
        await this.prisma.notificacao.updateMany({ where: { id: n.id, emailEnviadoEm: null }, data: { emailEnviadoEm: this.clock.agora() } });
        enviadas++;
      } catch (e) {
        await this.prisma.notificacao.update({ where: { id: n.id }, data: { tentativas: { increment: 1 } } });
        this.logger.warn(`Notificação ${n.id}: falha ao enfileirar e-mail (${(e as Error).message})`);
      }
    }
    return enviadas;
  }
}
