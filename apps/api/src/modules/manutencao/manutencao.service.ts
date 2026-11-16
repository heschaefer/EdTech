import { Injectable, Logger } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { PrismaService } from '../../prisma/prisma.service';

export const DIAS_PARA_APAGAR_NAO_VERIFICADO = 7;

@Injectable()
export class ManutencaoService {
  private readonly logger = new Logger(ManutencaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** RN-03: cadastro de aluno não verificado em 7 dias é apagado, liberando CPF e e-mail. */
  async apagarCadastrosNaoVerificados(): Promise<number> {
    const limite = new Date(this.clock.agora().getTime() - DIAS_PARA_APAGAR_NAO_VERIFICADO * 24 * 3600_000);
    const usuarios = await this.prisma.usuario.findMany({
      where: { papel: 'ALUNO', status: 'PENDENTE_VERIFICACAO', emailVerificadoEm: null, criadoEm: { lte: limite } },
      select: { id: true },
    });
    const ids = usuarios.map((u) => u.id);
    if (!ids.length) return 0;
    await this.prisma.$transaction([
      // Currículo e itens caem em cascata com o aluno; tokens e sessões, com o usuário.
      this.prisma.aluno.deleteMany({ where: { usuarioId: { in: ids } } }),
      this.prisma.usuario.deleteMany({ where: { id: { in: ids }, status: 'PENDENTE_VERIFICACAO' } }),
    ]);
    this.logger.log(`${ids.length} cadastro(s) não verificado(s) apagado(s) (RN-03)`);
    return ids.length;
  }
}
